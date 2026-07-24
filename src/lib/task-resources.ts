import { api } from './api';
import type { SampleDetail } from '@/app/(main)/samples/types';

type MaybeList<T> = T[] | { items?: T[]; list?: T[]; data?: T[] | { items?: T[]; list?: T[] } };

function unwrapList<T>(value: MaybeList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.list)) return value.list;
  if (Array.isArray(value.data)) return value.data;
  if (value.data && !Array.isArray(value.data)) {
    if (Array.isArray(value.data.items)) return value.data.items;
    if (Array.isArray(value.data.list)) return value.data.list;
  }
  return [];
}

function valueOf<T>(raw: Record<string, unknown>, camel: string, snake: string, fallback: T): T {
  return (raw[camel] ?? raw[snake] ?? fallback) as T;
}

export interface TaskSampleListItem {
  id: string;
  internalId: string;
  matchedPair: { r1Path?: string; r2Path?: string } | null;
}

export interface TaskPipelineOption {
  id: string;
  name: string;
  version: string;
  baseType?: string;
  template?: string;
  status?: string;
  isBuiltin?: boolean;
}

export interface TaskTemplateOption {
  name: string;
  displayName?: string;
  path?: string;
  description?: string;
  inputFields?: string[];
}

function normalizeMatchedPair(raw: unknown): { r1Path?: string; r2Path?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const pair = raw as Record<string, unknown>;
  const matchedPair = {
    r1Path: valueOf<string>(pair, 'r1Path', 'r1_path', '').trim(),
    r2Path: valueOf<string>(pair, 'r2Path', 'r2_path', '').trim(),
  };
  return matchedPair.r1Path && matchedPair.r2Path ? matchedPair : null;
}

export function normalizeSampleListItem(rawValue: unknown): TaskSampleListItem {
  const raw = (rawValue ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    internalId: valueOf<string>(raw, 'internalId', 'internal_id', ''),
    matchedPair: normalizeMatchedPair(raw.matchedPair ?? raw.matched_pair),
  };
}

export function normalizeSampleDetail(rawValue: unknown): SampleDetail {
  const raw = (rawValue ?? {}) as Record<string, unknown>;
  const clinicalDiagnosis = raw.clinicalDiagnosis ?? raw.clinical_diagnosis;
  const hpoTerms = valueOf<{ id: string; name: string }[]>(raw, 'hpoTerms', 'hpo_terms', []);

  return {
    id: String(raw.id ?? ''),
    internalId: valueOf<string>(raw, 'internalId', 'internal_id', ''),
    gender: valueOf<SampleDetail['gender']>(raw, 'gender', 'gender', 'unknown'),
    age: valueOf<number | undefined>(raw, 'age', 'age', undefined),
    sampleType: valueOf<SampleDetail['sampleType']>(raw, 'sampleType', 'sample_type', '其他'),
    batch: valueOf<string>(raw, 'batch', 'batch', ''),
    matchedPair: normalizeMatchedPair(raw.matchedPair ?? raw.matched_pair) as SampleDetail['matchedPair'],
    matchStatus: valueOf<SampleDetail['matchStatus']>(raw, 'matchStatus', 'match_status', raw.matchedPair ?? raw.matched_pair ? 'matched' : 'unmatched'),
    matchMode: valueOf<SampleDetail['matchMode']>(raw, 'matchMode', 'match_mode', ''),
    autoMatchEnabled: valueOf<boolean>(raw, 'autoMatchEnabled', 'auto_match_enabled', true),
    remark: valueOf<string>(raw, 'remark', 'remark', ''),
    clinicalDiagnosis: typeof clinicalDiagnosis === 'object' && clinicalDiagnosis !== null
      ? clinicalDiagnosis as SampleDetail['clinicalDiagnosis']
      : { mainDiagnosis: String(clinicalDiagnosis ?? ''), symptoms: [], hpoTerms },
    submissionInfo: valueOf<SampleDetail['submissionInfo']>(
      raw,
      'submissionInfo',
      'submission_info',
      { submissionDate: '', sampleCollectionDate: '', sampleReceiveDate: '', sampleQuality: 'acceptable' }
    ),
    projectInfo: valueOf<SampleDetail['projectInfo']>(
      raw,
      'projectInfo',
      'project_info',
      { projectId: '', projectName: '', testItems: [], turnaroundDays: 0, priority: 'normal' }
    ),
    familyHistory: valueOf<SampleDetail['familyHistory']>(
      raw,
      'familyHistory',
      'family_history',
      { hasHistory: false }
    ),
    analysisTasks: valueOf<SampleDetail['analysisTasks']>(raw, 'analysisTasks', 'analysis_tasks', []),
    createdAt: valueOf<string>(raw, 'createdAt', 'created_at', ''),
    updatedAt: valueOf<string>(raw, 'updatedAt', 'updated_at', ''),
  };
}

function normalizePipeline(rawValue: unknown): TaskPipelineOption {
  const raw = (rawValue ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    version: String(raw.version ?? ''),
    baseType: valueOf<string | undefined>(raw, 'baseType', 'base_type', undefined),
    template: valueOf<string | undefined>(raw, 'template', 'template', undefined),
    status: String(raw.status ?? ''),
    isBuiltin: Boolean(raw.isBuiltin ?? raw.is_builtin),
  };
}

function normalizeTemplate(rawValue: unknown): TaskTemplateOption {
  const raw = (rawValue ?? {}) as Record<string, unknown>;
  const rawName = String(raw.name ?? '');
  const shortName = valueOf<string>(raw, 'shortName', 'short_name', '');
  return {
    // Octopus' template catalog exposes logical names such as
    // "germline_single" plus a shortName "single", while CreateTask currently
    // resolves <template>.wdl directly. Use shortName for task creation so the
    // UI does not submit "germline_single" and then fail on missing
    // germline_single.wdl.
    name: shortName || rawName,
    displayName: rawName || shortName,
    path: String(raw.path ?? ''),
    description: String(raw.description ?? ''),
    inputFields: valueOf<string[]>(raw, 'inputFields', 'input_fields', []),
  };
}

export const samplesApi = {
  async list(params?: { search?: string; page?: number; page_size?: number }): Promise<TaskSampleListItem[]> {
    const searchParams: Record<string, string> = {
      page: String(params?.page ?? 1),
      page_size: String(params?.page_size ?? 100),
    };
    if (params?.search) searchParams.search = params.search;
    const response = await api.get<MaybeList<unknown>>('/v1/samples', { params: searchParams });
    return unwrapList(response).map(normalizeSampleListItem).filter(sample => sample.id);
  },
};

export const pipelinesApi = {
  async list(): Promise<TaskPipelineOption[]> {
    const response = await api.get<MaybeList<unknown>>('/v1/pipelines', {
      params: { page: '1', page_size: '100' },
    });
    return unwrapList(response)
      .map(normalizePipeline)
      .filter(pipeline => pipeline.id && pipeline.name && pipeline.status !== 'inactive');
  },
};

export const templatesApi = {
  async list(): Promise<TaskTemplateOption[]> {
    const response = await api.get<MaybeList<unknown>>('/v1/templates');
    return unwrapList(response).map(normalizeTemplate).filter(template => template.name);
  },
};
