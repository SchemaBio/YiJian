import { api, requestPairedUploadJob, requestPresignedUploadUrl, uploadToCOS, confirmUpload } from './api';

export type DataAssetStatus = 'pending' | 'uploading' | 'completed' | 'failed' | 'missing' | 'deleted';
export type DataReadType = 'read1' | 'read2' | 'single' | 'bed';

export interface DataAsset {
  id: string;
  file_name: string;
  file_size: number;
  read_type: DataReadType;
  provider: 'local' | 's3';
  status: DataAssetStatus;
  source: 'upload' | 'scanner';
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DataCenterConfig {
  provider: 'local' | 's3';
  retention_days: number;
  temporary: boolean;
  download_allowed: boolean;
}

interface AssetListResponse {
  items: DataAsset[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function listDataAssets(search = ''): Promise<AssetListResponse> {
  return api.get<AssetListResponse>('/v1/data/assets', {
    params: { page: '1', page_size: '100', ...(search.trim() ? { search: search.trim() } : {}) },
  });
}

export function getDataCenterConfig(): Promise<DataCenterConfig> {
  return api.get<DataCenterConfig>('/v1/data/config');
}

async function uploadOne(file: File, readType: DataReadType, onProgress: (value: number) => void) {
  const session = await requestPresignedUploadUrl(file.name, file.size, readType);
  await uploadToCOS(session.upload_url, file, onProgress);
  if (session.storage_type === 'presigned') await confirmUpload(session.file_id);
}

export async function uploadDataFiles(
  read1: File | null,
  read2: File | null,
  onProgress: (value: number) => void
): Promise<void> {
  if (!read1 && !read2) throw new Error('请至少选择一个文件');
  if (read1 && read2) {
    const job = await requestPairedUploadJob(read1, read2);
    const first = job.files.find((item) => item.read_type === 'read1');
    const second = job.files.find((item) => item.read_type === 'read2');
    if (!first || !second) throw new Error('上传任务没有返回完整的 Read1/Read2 文件');
    await uploadToCOS(first.upload_url, read1, (value) => onProgress(Math.round(value / 2)));
    if (first.storage_type === 'presigned') await confirmUpload(first.file_id);
    await uploadToCOS(second.upload_url, read2, (value) => onProgress(50 + Math.round(value / 2)));
    if (second.storage_type === 'presigned') await confirmUpload(second.file_id);
    return;
  }
  await uploadOne((read1 ?? read2) as File, read1 ? 'read1' : 'read2', onProgress);
}

export function deleteDataAsset(id: string): Promise<void> {
  return api.delete(`/v1/data/assets/${encodeURIComponent(id)}`);
}

export function downloadDataAsset(id: string, filename: string) {
  return api.download(`/v1/data/assets/${encodeURIComponent(id)}/download`, undefined, {
    method: 'GET', fallbackFilename: filename,
  });
}
