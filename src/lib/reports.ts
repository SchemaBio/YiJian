import { api, type DownloadResult } from './api';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
}

interface RawReportTemplate {
  id?: unknown;
  name?: unknown;
  description?: unknown;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
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
    const templates = await api.get<RawReportTemplate[]>('/v1/report-templates');
    return templates.map(normalizeTemplate).filter(template => template.id && template.name);
  },

  async generateTaskReport(taskId: string, template: ReportTemplate): Promise<DownloadResult> {
    return api.download(
      `/v1/tasks/${taskId}/reports`,
      {
        name: template.name,
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

  exportTaskFile(taskId: string, kind: 'excel' | 'parquet' | 'vcf' | 'mt-vcf'): Promise<DownloadResult> {
    const fallbackByKind = {
      excel: `task-${taskId}-results.xlsx`,
      parquet: `task-${taskId}-results.parquet`,
      vcf: `task-${taskId}.vcf`,
      'mt-vcf': `task-${taskId}-mt.vcf`,
    };
    return api.download(
      `/v1/tasks/${taskId}/export/${kind}`,
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
