import { api } from './api';

export type ReportStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'RELEASED';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
}

export interface ReportRecord {
  id: string;
  name: string;
  type: 'generated' | 'uploaded';
  templateName?: string;
  fileName?: string;
  status: ReportStatus;
  createdAt: string;
  createdBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  releasedBy?: string;
  downloadUrl?: string;
}

interface RawReportTemplate {
  id?: unknown;
  name?: unknown;
  description?: unknown;
}

interface RawReportRecord {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  templateName?: unknown;
  template_name?: unknown;
  fileName?: unknown;
  file_name?: unknown;
  externalUrl?: unknown;
  external_url?: unknown;
  downloadUrl?: unknown;
  download_url?: unknown;
  status?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  createdBy?: unknown;
  created_by?: unknown;
  reviewedBy?: unknown;
  reviewed_by?: unknown;
  approvedBy?: unknown;
  approved_by?: unknown;
  releasedBy?: unknown;
  released_by?: unknown;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asReportStatus(value: unknown): ReportStatus {
  const status = asString(value);
  if (status === 'PENDING_REVIEW' || status === 'APPROVED' || status === 'RELEASED') {
    return status;
  }
  return 'DRAFT';
}

function asReportType(value: unknown): ReportRecord['type'] {
  return value === 'uploaded' ? 'uploaded' : 'generated';
}

function formatDateTime(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\//g, '-');
}

function normalizeTemplate(raw: RawReportTemplate): ReportTemplate {
  return {
    id: asString(raw.id),
    name: asString(raw.name),
    description: asString(raw.description),
  };
}

function normalizeReport(raw: RawReportRecord): ReportRecord {
  const externalUrl = asString(raw.externalUrl ?? raw.external_url);
  const downloadUrl = asString(raw.downloadUrl ?? raw.download_url) || externalUrl || undefined;
  const templateName = asString(raw.templateName ?? raw.template_name) || undefined;
  const fileName = asString(raw.fileName ?? raw.file_name) || undefined;

  return {
    id: asString(raw.id),
    name: asString(raw.name) || fileName || templateName || asString(raw.id),
    type: asReportType(raw.type),
    templateName,
    fileName,
    status: asReportStatus(raw.status),
    createdAt: formatDateTime(asString(raw.createdAt ?? raw.created_at)),
    createdBy: asString(raw.createdBy ?? raw.created_by),
    reviewedBy: asString(raw.reviewedBy ?? raw.reviewed_by) || undefined,
    approvedBy: asString(raw.approvedBy ?? raw.approved_by) || undefined,
    releasedBy: asString(raw.releasedBy ?? raw.released_by) || undefined,
    downloadUrl,
  };
}

export const reportsApi = {
  async listTemplates(): Promise<ReportTemplate[]> {
    const templates = await api.get<RawReportTemplate[]>('/v1/report-templates');
    return templates.map(normalizeTemplate).filter(template => template.id && template.name);
  },

  async listTaskReports(taskId: string): Promise<ReportRecord[]> {
    const reports = await api.get<RawReportRecord[]>(`/v1/tasks/${taskId}/reports`);
    return reports.map(normalizeReport).filter(report => report.id);
  },

  async createTaskReport(taskId: string, template: ReportTemplate): Promise<ReportRecord> {
    const report = await api.post<RawReportRecord>(`/v1/tasks/${taskId}/reports`, {
      name: template.name,
      templateName: template.name,
    });
    return normalizeReport(report);
  },
};
