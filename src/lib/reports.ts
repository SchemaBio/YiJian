import { api, type DownloadResult } from './api';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
}

export type ResultPackageStatus = 'pending' | 'building' | 'ready' | 'failed';

export interface ResultPackageState {
  task_uuid: string;
  execution_attempt_id: string;
  status: ResultPackageStatus;
  result_package_url?: string;
  result_package_filename?: string;
  result_package_size_bytes?: number;
  result_package_expires_at?: string;
  source_fingerprint?: string;
  error?: string;
}

interface RawReportTemplate {
  id?: unknown;
  name?: unknown;
  description?: unknown;
}

type MaybeList<T> = T[] | { items?: T[]; data?: T[] | { items?: T[] } };

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function unwrapList<T>(value: MaybeList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (value.data && !Array.isArray(value.data) && Array.isArray(value.data.items)) return value.data.items;
  return [];
}

function normalizeTemplate(raw: RawReportTemplate): ReportTemplate {
  return {
    id: asString(raw.id),
    name: asString(raw.name),
    description: asString(raw.description),
  };
}

function fallbackReportFilename(template: ReportTemplate): string {
  const base = template.name.trim() || template.id.trim() || 'report';
  return /\.[a-z0-9]{2,8}$/i.test(base) ? base : `${base}.bin`;
}

export function saveDownload(download: DownloadResult) {
  const url = URL.createObjectURL(download.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = download.filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const reportsApi = {
  async listTemplates(): Promise<ReportTemplate[]> {
    const templates = await api.get<MaybeList<RawReportTemplate>>('/v1/report-templates');
    return unwrapList(templates).map(normalizeTemplate).filter(template => template.id && template.name);
  },

  async generateTaskReport(taskId: string, template: ReportTemplate): Promise<DownloadResult> {
    return api.download(
      `/v1/tasks/${encodeURIComponent(taskId)}/reports`,
      {
        name: template.name,
        templateId: template.id,
        templateName: template.name,
      },
      {
        fallbackFilename: fallbackReportFilename(template),
        headers: {
          Accept: 'application/octet-stream,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
        },
      }
    );
  },

  prepareTaskResultPackage(taskId: string): Promise<ResultPackageState> {
    return api.post<ResultPackageState>(`/v1/tasks/${encodeURIComponent(taskId)}/result-package/prepare`, {});
  },

  getTaskResultPackage(taskId: string): Promise<ResultPackageState> {
    return api.get<ResultPackageState>(`/v1/tasks/${encodeURIComponent(taskId)}/result-package`);
  },

  exportTaskFile(taskId: string, kind: 'excel' | 'parquet' | 'vcf' | 'mt-vcf'): Promise<DownloadResult> {
    const fallbackByKind = {
      excel: `task-${taskId}-results.xlsx`,
      parquet: `task-${taskId}-results.parquet`,
      vcf: `task-${taskId}.vcf`,
      'mt-vcf': `task-${taskId}-mt.vcf`,
    };
    return api.download(
      `/v1/tasks/${encodeURIComponent(taskId)}/export/${encodeURIComponent(kind)}`,
      undefined,
      {
        method: 'GET',
        fallbackFilename: fallbackByKind[kind],
        headers: {
          Accept: 'application/octet-stream,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
        },
      }
    );
  },
};
