import {
  api, completeMultipartUpload, confirmUpload, initMultipartUpload,
  MULTIPART_PART_SIZE_BYTES, MULTIPART_THRESHOLD_BYTES, presignMultipartParts,
  getDataAssetUploadStatus, recordMultipartPart, requestPairedUploadJob, requestPresignedUploadUrl, startUpload,
  uploadPartToCOS, uploadToCOS, retryS3Upload, localUploadURL,
} from './api';

export type DataAssetStatus = 'pending' | 'uploading' | 'completed' | 'failed' | 'missing' | 'deleting' | 'deleted';
export type DataReadType = 'read1' | 'read2' | 'single' | 'bed';

export interface DataAsset {
  id: string;
  file_name: string;
  internal_id?: string;
  file_size: number;
  read_type: DataReadType;
  reference_genome?: 'GRCh37' | 'GRCh38';
  provider: 'local' | 's3';
  status: DataAssetStatus;
  source: 'upload' | 'scanner';
  expires_at?: string;
  created_at: string;
  updated_at: string;
  is_builtin?: boolean;
}

export interface DataCenterConfig {
  provider: 'local' | 's3';
  retention_days: number;
  temporary: boolean;
  download_allowed: boolean;
  max_file_size_bytes: number;
}

interface AssetListResponse {
  items: DataAsset[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UploadStorageStats {
  total: number;
  total_bytes: number;
}

export interface UploadFileProgress {
  fileId: string;
  jobId?: string;
  fileName: string;
  fileSize?: number;
  lastModified?: number;
  readType: DataReadType;
  progress: number;
  /** Durable multipart metadata used to resume after a full page refresh. */
  multipartSessionId?: string;
  completedParts?: number[];
}

export interface UploadCallbacks {
  onStarted?: (files: UploadFileProgress[]) => void;
  onFileProgress?: (file: UploadFileProgress) => void;
  onMultipartState?: (fileId: string, sessionId: string, completedParts: number[]) => void;
}

export async function listDataAssets(search = '', filters?: { readType?: DataReadType; status?: DataAssetStatus; referenceGenome?: 'GRCh37' | 'GRCh38' }): Promise<AssetListResponse> {
  return api.get<AssetListResponse>('/v1/data/assets', {
    params: {
      page: '1', page_size: '100',
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(filters?.readType ? { read_type: filters.readType } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.referenceGenome ? { reference_genome: filters.referenceGenome } : {}),
    },
  });
}

export function getDataCenterConfig(): Promise<DataCenterConfig> {
  return api.get<DataCenterConfig>('/v1/data/config');
}

export function getUploadStorageStats(): Promise<UploadStorageStats> {
  return api.get<UploadStorageStats>('/v1/upload/files/stats');
}

class UploadLimiter {
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly limit = 4) {}

  async acquire() {
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    // A release hands its slot directly to the next waiter. Do not increment
    // active again after the promise resolves, otherwise a synchronous burst
    // of R1/R2 retries can exceed the browser-wide four-request limit.
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release() {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter();
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }
}

// One browser-wide scheduler is shared by paired uploads, retry actions and
// BED uploads. This keeps the COS connection count bounded even if a user
// starts a retry while another upload is still running.
const globalUploadLimiter = new UploadLimiter(4);

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

type UploadSession = {
  file_id: string;
  upload_url: string;
  storage_type: string;
};

function filePartSize(file: File, partNumber: number, partSize: number): number {
  const start = (partNumber - 1) * partSize;
  return Math.min(partSize, Math.max(0, file.size - start));
}

async function uploadMultipartFile(
  file: File,
  session: UploadSession,
  onProgress: (bytes: number) => void,
  limiter: UploadLimiter,
  onMultipartState?: (sessionId: string, completedParts: number[]) => void,
): Promise<void> {
  const multipart = await initMultipartUpload(session.file_id);
  const partSize = multipart.part_size || MULTIPART_PART_SIZE_BYTES;
  const completed = new Set(multipart.completed_parts ?? []);
  const totalParts = multipart.total_parts || Math.ceil(file.size / partSize);
  const reportMultipartState = () => onMultipartState?.(multipart.session_id, Array.from(completed).sort((a, b) => a - b));
  reportMultipartState();

  let uploadedBytes = 0;
  completed.forEach((partNumber) => { uploadedBytes += filePartSize(file, partNumber, partSize); });
  onProgress(uploadedBytes);
  const pending = Array.from({ length: totalParts }, (_, index) => index + 1).filter((number) => !completed.has(number));
  const inFlightBytes = new Map<number, number>();
  const reportProgress = () => {
    const activeBytes = Array.from(inFlightBytes.values()).reduce((sum, value) => sum + value, 0);
    onProgress(Math.min(file.size, uploadedBytes + activeBytes));
  };
  // Sign only the next small batch.  A single 20 GiB object can contain
  // hundreds of parts; signing the whole object up front would leave the
  // later URLs expired before the browser reaches them.  A failed part gets
  // a fresh URL on each retry rather than reusing a stale presign.
  for (let offset = 0; offset < pending.length; offset += 4) {
    const batch = pending.slice(offset, offset + 4);
    const signed = await presignMultipartParts(session.file_id, multipart.session_id, batch);
    const urls = new Map(signed.parts.map((part) => [part.part_number, part.url]));
    await Promise.all(batch.map(async (partNumber) => {
      const size = filePartSize(file, partNumber, partSize);
      const start = (partNumber - 1) * partSize;
      let lastError: unknown;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          let url = urls.get(partNumber);
          if (!url) throw new Error(`未获取到第 ${partNumber} 个分片的上传地址`);
          // Refresh the URL before every retry.  This also handles a network
          // interruption that outlives the presign TTL.
          if (attempt > 0) {
            const refreshed = await presignMultipartParts(session.file_id, multipart.session_id, [partNumber]);
            url = refreshed.parts.find((part) => part.part_number === partNumber)?.url;
            if (!url) throw new Error(`未获取到第 ${partNumber} 个分片的重试上传地址`);
          }
          await limiter.acquire();
          try {
            const etag = await uploadPartToCOS(url, file.slice(start, start + size), (percent) => {
              // Count each active part exactly once so progress remains
              // monotonic while R1/R2 share the four global slots.
              inFlightBytes.set(partNumber, Math.round(size * percent / 100));
              reportProgress();
            });
            await recordMultipartPart(session.file_id, multipart.session_id, partNumber, etag, size);
            uploadedBytes += size;
            inFlightBytes.delete(partNumber);
            completed.add(partNumber);
            reportMultipartState();
            reportProgress();
            return;
          } finally {
            limiter.release();
          }
        } catch (error) {
          lastError = error;
          inFlightBytes.delete(partNumber);
          reportProgress();
          if (attempt < 3) {
            const base = Math.min(8000, 500 * (2 ** attempt));
            const jitter = 0.8 + Math.random() * 0.4;
            await sleep(Math.round(base * jitter));
          }
        }
      }
      throw lastError ?? new Error(`第 ${partNumber} 个分片上传失败`);
    }));
  }
  await completeMultipartUpload(session.file_id, multipart.session_id);
}

async function uploadSessionFile(
  file: File,
  session: UploadSession,
  onProgress: (bytes: number) => void,
  limiter: UploadLimiter,
  onMultipartState?: (sessionId: string, completedParts: number[]) => void,
): Promise<void> {
  await startUpload(session.file_id);
  if (session.storage_type === 'presigned' && file.size >= MULTIPART_THRESHOLD_BYTES) {
    await uploadMultipartFile(file, session, onProgress, limiter, onMultipartState);
    return;
  }
  await limiter.acquire();
  try {
    await uploadToCOS(session.upload_url, file, (percent) => onProgress(Math.round(file.size * percent / 100)));
  } finally {
    limiter.release();
  }
  if (session.storage_type === 'presigned') await confirmUpload(session.file_id);
}

async function uploadOne(file: File, readType: DataReadType, uploadPolicyAcknowledged: boolean, internalId: string, onProgress: (value: number) => void, callbacks?: UploadCallbacks) {
  const session = await requestPresignedUploadUrl(file.name, file.size, readType, undefined, uploadPolicyAcknowledged, internalId);
  const startedFile = { fileId: session.file_id, jobId: session.job_id, fileName: file.name, fileSize: file.size, lastModified: file.lastModified, readType, progress: 0 };
  callbacks?.onStarted?.([startedFile]);
  await uploadSessionFile(file, session, (bytes) => {
    const value = file.size > 0 ? Math.min(100, Math.round(bytes / file.size * 100)) : 100;
    onProgress(value);
    callbacks?.onFileProgress?.({ ...startedFile, progress: value });
  }, globalUploadLimiter, (sessionId, completedParts) => {
    callbacks?.onMultipartState?.(startedFile.fileId, sessionId, completedParts);
  });
}

export async function uploadDataFiles(
  read1: File | null,
  read2: File | null,
  uploadPolicyAcknowledged: boolean,
  internalId: string,
  onProgress: (value: number) => void,
  callbacks?: UploadCallbacks
): Promise<void> {
  if (!read1 && !read2) throw new Error('请至少选择一个文件');
  if (read1 && read2) {
    const job = await requestPairedUploadJob(read1, read2, uploadPolicyAcknowledged, undefined, internalId);
    const first = job.files.find((item) => item.read_type === 'read1');
    const second = job.files.find((item) => item.read_type === 'read2');
    if (!first || !second) throw new Error('上传任务没有返回完整的 Read1/Read2 文件');
    const startedFiles: UploadFileProgress[] = [
      { fileId: first.file_id, jobId: first.job_id, fileName: read1.name, fileSize: read1.size, lastModified: read1.lastModified, readType: 'read1', progress: 0 },
      { fileId: second.file_id, jobId: second.job_id, fileName: read2.name, fileSize: read2.size, lastModified: read2.lastModified, readType: 'read2', progress: 0 },
    ];
    callbacks?.onStarted?.(startedFiles);
    const totalBytes = read1.size + read2.size;
    const uploaded = new Map<string, number>([[first.file_id, 0], [second.file_id, 0]]);
    const update = (item: UploadFileProgress, file: File, bytes: number) => {
      uploaded.set(item.fileId, Math.min(file.size, bytes));
      const percent = file.size > 0 ? Math.round(uploaded.get(item.fileId)! / file.size * 100) : 100;
      callbacks?.onFileProgress?.({ ...item, progress: percent });
      const totalUploaded = Array.from(uploaded.values()).reduce((sum, value) => sum + value, 0);
      onProgress(totalBytes > 0 ? Math.min(100, Math.round(totalUploaded / totalBytes * 100)) : 100);
    };
    await Promise.all([
      uploadSessionFile(read1, first, (bytes) => update(startedFiles[0], read1, bytes), globalUploadLimiter, (sessionId, completedParts) => {
        callbacks?.onMultipartState?.(first.file_id, sessionId, completedParts);
      }),
      uploadSessionFile(read2, second, (bytes) => update(startedFiles[1], read2, bytes), globalUploadLimiter, (sessionId, completedParts) => {
        callbacks?.onMultipartState?.(second.file_id, sessionId, completedParts);
      }),
    ]);
    return;
  }
  await uploadOne((read1 ?? read2) as File, read1 ? 'read1' : 'read2', uploadPolicyAcknowledged, internalId, onProgress, callbacks);
}

/** Resume an upload whose browser tab was refreshed. The caller must provide
 * the original files; the server-side multipart session and completed parts
 * are discovered by file UUID, so no storage key is exposed to the browser. */
export async function resumeDataFiles(
  read1: File | null,
  read2: File | null,
  previous: UploadFileProgress[],
  onProgress: (value: number) => void,
  callbacks?: UploadCallbacks,
): Promise<void> {
  const selected = [
    read1 ? { file: read1, readType: 'read1' as const } : null,
    read2 ? { file: read2, readType: 'read2' as const } : null,
  ].filter(Boolean) as Array<{ file: File; readType: 'read1' | 'read2' }>;
  if (selected.length === 0) throw new Error('请至少选择一个文件');
  const entries = selected.map(({ file, readType }) => {
    const item = previous.find((candidate) => candidate.readType === readType && candidate.fileName === file.name && candidate.fileSize === file.size &&
      (candidate.lastModified === undefined || candidate.lastModified === file.lastModified));
    if (!item) throw new Error(`未找到 ${file.name} 的可恢复上传记录`);
    return { file, readType, item };
  });
  callbacks?.onStarted?.(entries.map(({ item }) => ({ ...item, progress: item.progress || 0 })));
  const totalBytes = entries.reduce((sum, entry) => sum + entry.file.size, 0);
  const uploaded = new Map(entries.map(({ item }) => [item.fileId, 0]));
  const update = (item: UploadFileProgress, file: File, bytes: number) => {
    uploaded.set(item.fileId, Math.min(file.size, bytes));
    const percent = file.size > 0 ? Math.round(uploaded.get(item.fileId)! / file.size * 100) : 100;
    callbacks?.onFileProgress?.({ ...item, progress: percent });
    const totalUploaded = Array.from(uploaded.values()).reduce((sum, value) => sum + value, 0);
    onProgress(totalBytes > 0 ? Math.min(100, Math.round(totalUploaded / totalBytes * 100)) : 100);
  };
  await Promise.all(entries.map(async ({ file, item }) => {
    // The backend is authoritative after a refresh. A paired upload can have
    // completed one file before the other failed; do not try to re-open an
    // already-completed multipart session or overwrite a completed object.
    const remote = await getDataAssetUploadStatus(item.fileId);
    if (remote.status === 'completed') {
      update(item, file, file.size);
      return;
    }
    if (remote.provider && remote.provider !== 's3') {
      throw new Error(`${file.name} 使用本地存储，刷新后无法断点续传，请重新选择并开始上传`);
    }
    if (file.size >= MULTIPART_THRESHOLD_BYTES) {
      await uploadSessionFile(file, { file_id: item.fileId, upload_url: '', storage_type: 'presigned' }, (bytes) => update(item, file, bytes), globalUploadLimiter, (sessionId, completedParts) => {
        callbacks?.onMultipartState?.(item.fileId, sessionId, completedParts);
      });
      return;
    }
    const retry = await retryS3Upload(item.fileId);
    if (!retry.presigned_url) throw new Error(`未获取到 ${file.name} 的重试上传地址`);
    await startUpload(item.fileId);
    await globalUploadLimiter.acquire();
    try {
      await uploadToCOS(retry.presigned_url, file, (percent) => update(item, file, Math.round(file.size * percent / 100)));
    } finally {
      globalUploadLimiter.release();
    }
    await confirmUpload(item.fileId);
  }));
}

export async function uploadBEDFile(
  file: File,
  referenceGenome: 'GRCh37' | 'GRCh38',
  uploadPolicyAcknowledged: boolean,
  onProgress: (value: number) => void
): Promise<void> {
  if (file.size > 20 * 1024 * 1024) throw new Error('BED 文件不能超过 20MB');
  if (!/\.bed(?:\.gz)?$/i.test(file.name)) throw new Error('请选择 .bed 或 .bed.gz 文件');
  const session = await requestPresignedUploadUrl(file.name, file.size, 'bed', referenceGenome, uploadPolicyAcknowledged);
  await startUpload(session.file_id);
  await globalUploadLimiter.acquire();
  try {
    await uploadToCOS(session.upload_url, file, onProgress);
  } finally {
    globalUploadLimiter.release();
  }
  if (session.storage_type === 'presigned') await confirmUpload(session.file_id);
}

export function deleteDataAsset(id: string): Promise<void> {
  return api.delete(`/v1/data/assets/${encodeURIComponent(id)}`);
}

export function updateDataAsset(id: string, internalId: string): Promise<DataAsset> {
  return api.put<DataAsset>(`/v1/data/assets/${encodeURIComponent(id)}`, { internal_id: internalId.trim() });
}

export async function retryDataAsset(id: string, file: File, onProgress?: (value: number) => void): Promise<DataAsset> {
  const remote = await getDataAssetUploadStatus(id);
  if (remote.provider === 's3' && file.size >= MULTIPART_THRESHOLD_BYTES) {
    await uploadSessionFile(file, { file_id: id, upload_url: '', storage_type: 'presigned' }, (bytes) => {
      onProgress?.(file.size > 0 ? Math.min(100, Math.round(bytes / file.size * 100)) : 100);
    }, globalUploadLimiter);
  } else if (remote.provider === 's3') {
    const session = await retryS3Upload(id);
    if (!session.presigned_url) throw new Error('未获取到重试上传地址');
    await startUpload(id);
    await globalUploadLimiter.acquire();
    try {
      await uploadToCOS(session.presigned_url, file, onProgress);
    } finally {
      globalUploadLimiter.release();
    }
    await confirmUpload(id);
  } else {
    // Self-deployed local storage keeps the existing authenticated streaming
    // endpoint. It deliberately never enters the S3 multipart path.
    await startUpload(id);
    await globalUploadLimiter.acquire();
    try {
      await uploadToCOS(localUploadURL(id), file, onProgress);
    } finally {
      globalUploadLimiter.release();
    }
  }
  const result = await api.get<DataAsset>(`/v1/data/assets/${encodeURIComponent(id)}`);
  return result;
}

export function downloadDataAsset(id: string, filename: string) {
  return api.download(`/v1/data/assets/${encodeURIComponent(id)}/download`, undefined, {
    method: 'GET', fallbackFilename: filename,
  });
}
