import {
  api, completeMultipartUpload, confirmUpload, initMultipartUpload,
  MULTIPART_PART_SIZE_BYTES, MULTIPART_THRESHOLD_BYTES, presignMultipartParts,
  getDataAssetUploadStatus, recordMultipartPart, requestPairedUploadJob, requestPresignedUploadUrl, startUpload,
  uploadPartToCOS, uploadToCOS, retryS3Upload, localUploadURL, UploadCancelledError, isUploadCancelled,
} from './api';

export { getDataAssetUploadStatus } from './api';
export { UploadCancelledError, isUploadCancelled } from './api';

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
  status?: 'uploading' | 'canceling' | 'cancelled' | 'completed' | 'failed' | 'deleted';
}

export interface UploadCallbacks {
  onStarted?: (files: UploadFileProgress[]) => void;
  onFileProgress?: (file: UploadFileProgress) => void;
  onMultipartState?: (fileId: string, sessionId: string, completedParts: number[]) => void;
}

export interface UploadSignals {
  read1?: AbortSignal;
  read2?: AbortSignal;
  single?: AbortSignal;
  bed?: AbortSignal;
}

export interface UploadBatchResult {
  cancelledFileIds: string[];
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

type UploadWaiter = {
  resolve: () => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

class UploadLimiter {
  private active = 0;
  private waiters: Array<UploadWaiter> = [];

  constructor(private readonly limit = 4) {}

  async acquire(signal?: AbortSignal) {
    if (signal?.aborted) throw new UploadCancelledError();
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    // A release hands its slot directly to the next waiter. Do not increment
    // active again after the promise resolves, otherwise a synchronous burst
    // of R1/R2 retries can exceed the browser-wide four-request limit.
    await new Promise<void>((resolve, reject) => {
      const waiter: UploadWaiter = { resolve, reject, signal };
      const onAbort = () => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new UploadCancelledError());
      };
      waiter.onAbort = onAbort;
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  release() {
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      if (waiter.signal?.aborted) {
        waiter.onAbort?.();
        continue;
      }
      if (waiter.signal && waiter.onAbort) waiter.signal.removeEventListener('abort', waiter.onAbort);
      // A released slot is transferred directly to the waiter.
      waiter.resolve();
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }
}

// One browser-wide scheduler is shared by paired uploads, retry actions and
// BED uploads. This keeps the COS connection count bounded even if a user
// starts a retry while another upload is still running.
const globalUploadLimiter = new UploadLimiter(4);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new UploadCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new UploadCancelledError();
}

function cancellationFor(error: unknown, signal?: AbortSignal): UploadCancelledError | null {
  if (signal?.aborted || isUploadCancelled(error)) return new UploadCancelledError();
  return null;
}

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
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  const multipart = await initMultipartUpload(session.file_id, { signal });
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
    throwIfAborted(signal);
    const batch = pending.slice(offset, offset + 4);
    const signed = await presignMultipartParts(session.file_id, multipart.session_id, batch, { signal });
    const urls = new Map(signed.parts.map((part) => [part.part_number, part.url]));
    await Promise.all(batch.map(async (partNumber) => {
      const size = filePartSize(file, partNumber, partSize);
      const start = (partNumber - 1) * partSize;
      let lastError: unknown;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          throwIfAborted(signal);
          let url = urls.get(partNumber);
          if (!url) throw new Error(`未获取到第 ${partNumber} 个分片的上传地址`);
          // Refresh the URL before every retry.  This also handles a network
          // interruption that outlives the presign TTL.
          if (attempt > 0) {
            const refreshed = await presignMultipartParts(session.file_id, multipart.session_id, [partNumber], { signal });
            url = refreshed.parts.find((part) => part.part_number === partNumber)?.url;
            if (!url) throw new Error(`未获取到第 ${partNumber} 个分片的重试上传地址`);
          }
          await limiter.acquire(signal);
          try {
            const etag = await uploadPartToCOS(url, file.slice(start, start + size), (percent) => {
              // Count each active part exactly once so progress remains
              // monotonic while R1/R2 share the four global slots.
              inFlightBytes.set(partNumber, Math.round(size * percent / 100));
              reportProgress();
            }, signal);
            await recordMultipartPart(session.file_id, multipart.session_id, partNumber, etag, size, { signal });
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
          const cancelled = cancellationFor(error, signal);
          if (cancelled) throw cancelled;
          lastError = error;
          inFlightBytes.delete(partNumber);
          reportProgress();
          if (attempt < 3) {
            const base = Math.min(8000, 500 * (2 ** attempt));
            const jitter = 0.8 + Math.random() * 0.4;
            throwIfAborted(signal);
            await sleep(Math.round(base * jitter), signal);
          }
        }
      }
      throw lastError ?? new Error(`第 ${partNumber} 个分片上传失败`);
    }));
  }
  throwIfAborted(signal);
  await completeMultipartUpload(session.file_id, multipart.session_id, { signal });
}

async function uploadSessionFile(
  file: File,
  session: UploadSession,
  onProgress: (bytes: number) => void,
  limiter: UploadLimiter,
  onMultipartState?: (sessionId: string, completedParts: number[]) => void,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  await startUpload(session.file_id, { signal });
  if (session.storage_type === 'presigned' && file.size >= MULTIPART_THRESHOLD_BYTES) {
    await uploadMultipartFile(file, session, onProgress, limiter, onMultipartState, signal);
    return;
  }
  await limiter.acquire(signal);
  try {
    await uploadToCOS(session.upload_url, file, (percent) => onProgress(Math.round(file.size * percent / 100)), signal);
  } finally {
    limiter.release();
  }
  if (session.storage_type === 'presigned') await confirmUpload(session.file_id, { signal });
}

async function uploadOne(file: File, readType: DataReadType, uploadPolicyAcknowledged: boolean, internalId: string, onProgress: (value: number) => void, callbacks?: UploadCallbacks, signal?: AbortSignal): Promise<string> {
  const session = await requestPresignedUploadUrl(file.name, file.size, readType, undefined, uploadPolicyAcknowledged, internalId, { signal });
  const startedFile = { fileId: session.file_id, jobId: session.job_id, fileName: file.name, fileSize: file.size, lastModified: file.lastModified, readType, progress: 0, status: 'uploading' as const };
  callbacks?.onStarted?.([startedFile]);
  try {
    await uploadSessionFile(file, session, (bytes) => {
      const value = file.size > 0 ? Math.min(100, Math.round(bytes / file.size * 100)) : 100;
      onProgress(value);
      callbacks?.onFileProgress?.({ ...startedFile, progress: value });
    }, globalUploadLimiter, (sessionId, completedParts) => {
      callbacks?.onMultipartState?.(startedFile.fileId, sessionId, completedParts);
    }, signal);
    return startedFile.fileId;
  } catch (error) {
    const cancelled = cancellationFor(error, signal);
    if (cancelled) throw cancelled;
    throw error;
  }
}

export async function uploadDataFiles(
  read1: File | null,
  read2: File | null,
  uploadPolicyAcknowledged: boolean,
  internalId: string,
  onProgress: (value: number) => void,
  callbacks?: UploadCallbacks,
  signals?: UploadSignals,
): Promise<UploadBatchResult> {
  if (!read1 && !read2) throw new Error('请至少选择一个文件');
  if (read1 && read2) {
    const job = await requestPairedUploadJob(
      read1,
      read2,
      uploadPolicyAcknowledged,
      undefined,
      internalId,
      { signal: signals?.read1 ?? signals?.read2 },
    );
    const first = job.files.find((item) => item.read_type === 'read1');
    const second = job.files.find((item) => item.read_type === 'read2');
    if (!first || !second) throw new Error('上传任务没有返回完整的 Read1/Read2 文件');
    const startedFiles: UploadFileProgress[] = [
      { fileId: first.file_id, jobId: first.job_id, fileName: read1.name, fileSize: read1.size, lastModified: read1.lastModified, readType: 'read1', progress: 0, status: 'uploading' },
      { fileId: second.file_id, jobId: second.job_id, fileName: read2.name, fileSize: read2.size, lastModified: read2.lastModified, readType: 'read2', progress: 0, status: 'uploading' },
    ];
    callbacks?.onStarted?.(startedFiles);
    const uploaded = new Map<string, number>([[first.file_id, 0], [second.file_id, 0]]);
    const reportOverallProgress = () => {
      const activeBytes = [
        { file: read1, signal: signals?.read1, id: first.file_id },
        { file: read2, signal: signals?.read2, id: second.file_id },
      ].filter((entry) => !entry.signal?.aborted);
      const activeTotal = activeBytes.reduce((sum, entry) => sum + entry.file.size, 0);
      const activeUploaded = activeBytes.reduce((sum, entry) => sum + (uploaded.get(entry.id) ?? 0), 0);
      onProgress(activeTotal > 0 ? Math.min(100, Math.round(activeUploaded / activeTotal * 100)) : 100);
    };
    const update = (item: UploadFileProgress, file: File, bytes: number) => {
      uploaded.set(item.fileId, Math.min(file.size, bytes));
      const percent = file.size > 0 ? Math.round(uploaded.get(item.fileId)! / file.size * 100) : 100;
      callbacks?.onFileProgress?.({ ...item, progress: percent, status: 'uploading' });
      reportOverallProgress();
    };
    const abortListeners: Array<[AbortSignal, () => void]> = [];
    for (const signal of [signals?.read1, signals?.read2]) {
      if (!signal) continue;
      signal.addEventListener('abort', reportOverallProgress, { once: true });
      abortListeners.push([signal, reportOverallProgress]);
    }
    const uploadPairFile = (
      file: File,
      session: UploadSession,
      item: UploadFileProgress,
      signal: AbortSignal | undefined,
    ) => uploadSessionFile(
      file,
      session,
      (bytes) => update(item, file, bytes),
      globalUploadLimiter,
      (sessionId, completedParts) => callbacks?.onMultipartState?.(item.fileId, sessionId, completedParts),
      signal,
    ).then(() => ({ fileId: item.fileId, cancelled: false })).catch((error) => {
      if (cancellationFor(error, signal)) return { fileId: item.fileId, cancelled: true };
      throw error;
    });
    try {
      const results = await Promise.all([
        uploadPairFile(read1, first, startedFiles[0], signals?.read1),
        uploadPairFile(read2, second, startedFiles[1], signals?.read2),
      ]);
      return { cancelledFileIds: results.filter((result) => result.cancelled).map((result) => result.fileId) };
    } finally {
      abortListeners.forEach(([signal, listener]) => signal.removeEventListener('abort', listener));
    }
  }
  const file = (read1 ?? read2) as File;
  const readType = read1 ? 'read1' : 'read2';
  const signal = read1 ? signals?.read1 : signals?.read2;
  let startedFileId: string | undefined;
  const singleCallbacks: UploadCallbacks = {
    ...callbacks,
    onStarted: (files) => {
      startedFileId = files[0]?.fileId;
      callbacks?.onStarted?.(files);
    },
  };
  try {
    await uploadOne(file, readType, uploadPolicyAcknowledged, internalId, onProgress, singleCallbacks, signal);
    return { cancelledFileIds: [] };
  } catch (error) {
    if (cancellationFor(error, signal)) return { cancelledFileIds: startedFileId ? [startedFileId] : [] };
    throw error;
  }
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
  signals?: UploadSignals,
): Promise<UploadBatchResult> {
  const selected = [
    read1 ? { file: read1, readType: 'read1' as const } : null,
    read2 ? { file: read2, readType: 'read2' as const } : null,
  ].filter(Boolean) as Array<{ file: File; readType: 'read1' | 'read2' }>;
  if (selected.length === 0) throw new Error('请至少选择一个文件');
  // The server-side recovery list is authoritative.  Match every unfinished
  // record to a selected original file, while ignoring an extra file the user
  // may select for a paired upload whose other member already completed.
  const entries = previous.map((item) => {
    const selectedFile = selected.find(({ file, readType }) => readType === item.readType && file.name === item.fileName &&
      (item.fileSize === undefined || file.size === item.fileSize) &&
      (item.lastModified === undefined || file.lastModified === item.lastModified));
    if (!selectedFile) throw new Error(`未找到 ${item.fileName} 的可恢复上传记录`);
    return { file: selectedFile.file, readType: selectedFile.readType, item };
  });
  callbacks?.onStarted?.(entries.map(({ item }) => ({ ...item, progress: item.progress || 0, status: 'uploading' })));
  const uploaded = new Map(entries.map(({ item }) => [item.fileId, 0]));
  const signalFor = (item: UploadFileProgress) => signals?.[item.readType === 'read1' || item.readType === 'read2' ? item.readType : 'single'];
  const reportOverallProgress = () => {
    const activeEntries = entries.filter(({ item }) => !signalFor(item)?.aborted);
    const activeTotal = activeEntries.reduce((sum, entry) => sum + entry.file.size, 0);
    const activeUploaded = activeEntries.reduce((sum, entry) => sum + (uploaded.get(entry.item.fileId) ?? 0), 0);
    onProgress(activeTotal > 0 ? Math.min(100, Math.round(activeUploaded / activeTotal * 100)) : 100);
  };
  const update = (item: UploadFileProgress, file: File, bytes: number) => {
    uploaded.set(item.fileId, Math.min(file.size, bytes));
    const percent = file.size > 0 ? Math.round(uploaded.get(item.fileId)! / file.size * 100) : 100;
    callbacks?.onFileProgress?.({ ...item, progress: percent, status: 'uploading' });
    reportOverallProgress();
  };
  const abortListeners: Array<[AbortSignal, () => void]> = [];
  entries.forEach(({ item }) => {
    const signal = signalFor(item);
    if (!signal) return;
    signal.addEventListener('abort', reportOverallProgress, { once: true });
    abortListeners.push([signal, reportOverallProgress]);
  });
  try {
    const results = await Promise.all(entries.map(async ({ file, item }) => {
      const signal = signalFor(item);
      try {
        // The backend is authoritative after a refresh. A paired upload can have
        // completed one file before the other failed; do not try to re-open an
        // already-completed multipart session or overwrite a completed object.
        const remote = await getDataAssetUploadStatus(item.fileId, { signal });
        if (remote.status === 'completed') {
          update(item, file, file.size);
          return { fileId: item.fileId, cancelled: false };
        }
        if (remote.provider && remote.provider !== 's3') {
          throw new Error(`${file.name} 使用本地存储，刷新后无法断点续传，请重新选择并开始上传`);
        }
        if (file.size >= MULTIPART_THRESHOLD_BYTES) {
          await uploadSessionFile(file, { file_id: item.fileId, upload_url: '', storage_type: 'presigned' }, (bytes) => update(item, file, bytes), globalUploadLimiter, (sessionId, completedParts) => {
            callbacks?.onMultipartState?.(item.fileId, sessionId, completedParts);
          }, signal);
          return { fileId: item.fileId, cancelled: false };
        }
        const retry = await retryS3Upload(item.fileId, { signal });
        if (!retry.presigned_url) throw new Error(`未获取到 ${file.name} 的重试上传地址`);
        await startUpload(item.fileId, { signal });
        await globalUploadLimiter.acquire(signal);
        try {
          await uploadToCOS(retry.presigned_url, file, (percent) => update(item, file, Math.round(file.size * percent / 100)), signal);
        } finally {
          globalUploadLimiter.release();
        }
        await confirmUpload(item.fileId, { signal });
        return { fileId: item.fileId, cancelled: false };
      } catch (error) {
        if (cancellationFor(error, signal)) return { fileId: item.fileId, cancelled: true };
        throw error;
      }
    }));
    return { cancelledFileIds: results.filter((result) => result.cancelled).map((result) => result.fileId) };
  } finally {
    abortListeners.forEach(([signal, listener]) => signal.removeEventListener('abort', listener));
  }
}

export async function uploadBEDFile(
  file: File,
  referenceGenome: 'GRCh37' | 'GRCh38',
  uploadPolicyAcknowledged: boolean,
  onProgress: (value: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  if (file.size > 20 * 1024 * 1024) throw new Error('BED 文件不能超过 20MB');
  if (!/\.bed(?:\.gz)?$/i.test(file.name)) throw new Error('请选择 .bed 或 .bed.gz 文件');
  const session = await requestPresignedUploadUrl(file.name, file.size, 'bed', referenceGenome, uploadPolicyAcknowledged, undefined, { signal });
  await startUpload(session.file_id, { signal });
  await globalUploadLimiter.acquire(signal);
  try {
    await uploadToCOS(session.upload_url, file, onProgress, signal);
  } finally {
    globalUploadLimiter.release();
  }
  if (session.storage_type === 'presigned') await confirmUpload(session.file_id, { signal });
}

export function deleteDataAsset(id: string): Promise<void> {
  return api.delete(`/v1/data/assets/${encodeURIComponent(id)}`);
}

export function updateDataAsset(id: string, internalId: string): Promise<DataAsset> {
  return api.put<DataAsset>(`/v1/data/assets/${encodeURIComponent(id)}`, { internal_id: internalId.trim() });
}

export async function retryDataAsset(id: string, file: File, onProgress?: (value: number) => void, signal?: AbortSignal): Promise<DataAsset> {
  throwIfAborted(signal);
  const remote = await getDataAssetUploadStatus(id, { signal });
  if (remote.provider === 's3' && file.size >= MULTIPART_THRESHOLD_BYTES) {
    await uploadSessionFile(file, { file_id: id, upload_url: '', storage_type: 'presigned' }, (bytes) => {
      onProgress?.(file.size > 0 ? Math.min(100, Math.round(bytes / file.size * 100)) : 100);
    }, globalUploadLimiter, undefined, signal);
  } else if (remote.provider === 's3') {
    const session = await retryS3Upload(id, { signal });
    if (!session.presigned_url) throw new Error('未获取到重试上传地址');
    await startUpload(id, { signal });
    await globalUploadLimiter.acquire(signal);
    try {
      await uploadToCOS(session.presigned_url, file, onProgress, signal);
    } finally {
      globalUploadLimiter.release();
    }
    await confirmUpload(id, { signal });
  } else {
    // Self-deployed local storage keeps the existing authenticated streaming
    // endpoint. It deliberately never enters the S3 multipart path.
    await startUpload(id, { signal });
    await globalUploadLimiter.acquire(signal);
    try {
      await uploadToCOS(localUploadURL(id), file, onProgress, signal);
    } finally {
      globalUploadLimiter.release();
    }
  }
  const result = await api.get<DataAsset>(`/v1/data/assets/${encodeURIComponent(id)}`, { signal });
  return result;
}

export function downloadDataAsset(id: string, filename: string) {
  return api.download(`/v1/data/assets/${encodeURIComponent(id)}/download`, undefined, {
    method: 'GET', fallbackFilename: filename,
  });
}
