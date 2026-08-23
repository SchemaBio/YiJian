import { api, requestPairedUploadJob, requestPresignedUploadUrl, uploadToCOS, confirmUpload } from './api';

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
  fileName: string;
  readType: DataReadType;
  progress: number;
}

export interface UploadCallbacks {
  onStarted?: (files: UploadFileProgress[]) => void;
  onFileProgress?: (file: UploadFileProgress) => void;
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

async function uploadOne(file: File, readType: DataReadType, uploadPolicyAcknowledged: boolean, internalId: string, onProgress: (value: number) => void, callbacks?: UploadCallbacks) {
  const session = await requestPresignedUploadUrl(file.name, file.size, readType, undefined, uploadPolicyAcknowledged, internalId);
  const startedFile = { fileId: session.file_id, fileName: file.name, readType, progress: 0 };
  callbacks?.onStarted?.([startedFile]);
  await uploadToCOS(session.upload_url, file, (value) => {
    onProgress(value);
    callbacks?.onFileProgress?.({ ...startedFile, progress: value });
  });
  if (session.storage_type === 'presigned') await confirmUpload(session.file_id);
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
      { fileId: first.file_id, fileName: read1.name, readType: 'read1', progress: 0 },
      { fileId: second.file_id, fileName: read2.name, readType: 'read2', progress: 0 },
    ];
    callbacks?.onStarted?.(startedFiles);
    await uploadToCOS(first.upload_url, read1, (value) => {
      onProgress(Math.round(value / 2));
      callbacks?.onFileProgress?.({ ...startedFiles[0], progress: value });
    });
    if (first.storage_type === 'presigned') await confirmUpload(first.file_id);
    await uploadToCOS(second.upload_url, read2, (value) => {
      onProgress(50 + Math.round(value / 2));
      callbacks?.onFileProgress?.({ ...startedFiles[1], progress: value });
    });
    if (second.storage_type === 'presigned') await confirmUpload(second.file_id);
    return;
  }
  await uploadOne((read1 ?? read2) as File, read1 ? 'read1' : 'read2', uploadPolicyAcknowledged, internalId, onProgress, callbacks);
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
  await uploadToCOS(session.upload_url, file, onProgress);
  if (session.storage_type === 'presigned') await confirmUpload(session.file_id);
}

export function deleteDataAsset(id: string): Promise<void> {
  return api.delete(`/v1/data/assets/${encodeURIComponent(id)}`);
}

export function updateDataAsset(id: string, internalId: string): Promise<DataAsset> {
  return api.put<DataAsset>(`/v1/data/assets/${encodeURIComponent(id)}`, { internal_id: internalId.trim() });
}

export async function retryDataAsset(id: string, file: File, onProgress?: (value: number) => void): Promise<DataAsset> {
  const session = await api.post<{ id: string; presigned_url?: string }>(`/v1/upload/files/${encodeURIComponent(id)}/retry`, {});
  if (!session.presigned_url) throw new Error('未获取到重试上传地址');
  await uploadToCOS(session.presigned_url, file, onProgress);
  await confirmUpload(id);
  const result = await api.get<DataAsset>(`/v1/data/assets/${encodeURIComponent(id)}`);
  return result;
}

export function downloadDataAsset(id: string, filename: string) {
  return api.download(`/v1/data/assets/${encodeURIComponent(id)}/download`, undefined, {
    method: 'GET', fallbackFilename: filename,
  });
}
