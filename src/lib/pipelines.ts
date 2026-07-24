import { api } from './api';

export type PipelineBaseType = 'wes_single' | 'wes_family';
export type PipelineStatus = 'active' | 'inactive';

export interface Pipeline {
  id: string;
  name: string;
  basePipelineId: string;
  baseType: PipelineBaseType;
  version: string;
  description: string;
  bedFile: string;
  referenceGenome: string;
  cnvBaseline: string;
  bedAssetId: string;
  cnvBaselineId: string;
  isBuiltin: boolean;
  status: PipelineStatus;
  createdAt: string;
  updatedAt: string;
}

interface PipelineListResponse {
  items?: unknown[];
  data?: unknown[] | { items?: unknown[] };
  total?: number;
}

function rawString(raw: Record<string, unknown>, camel: string, snake: string, fallback = ''): string {
  const value = raw[camel] ?? raw[snake];
  return typeof value === 'string' ? value : fallback;
}

function normalizeBaseType(value: string): PipelineBaseType {
  return value === 'wes_family' ? value : 'wes_single';
}

function normalizeStatus(value: string): PipelineStatus {
  return value === 'active' ? 'active' : 'inactive';
}

function unwrapList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const payload = value as PipelineListResponse | null | undefined;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && !Array.isArray(payload.data) && Array.isArray(payload.data.items)) {
    return payload.data.items;
  }
  return [];
}

export function normalizePipeline(value: unknown): Pipeline {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    name: rawString(raw, 'name', 'name'),
    basePipelineId: rawString(raw, 'basePipelineId', 'base_pipeline_id'),
    baseType: normalizeBaseType(rawString(raw, 'baseType', 'base_type', 'wes_single')),
    version: rawString(raw, 'version', 'version'),
    description: rawString(raw, 'description', 'description'),
    bedFile: rawString(raw, 'bedFile', 'bed_file'),
    referenceGenome: rawString(raw, 'referenceGenome', 'reference_genome'),
    cnvBaseline: rawString(raw, 'cnvBaseline', 'cnv_baseline'),
    bedAssetId: rawString(raw, 'bedAssetId', 'bed_asset_id'),
    cnvBaselineId: rawString(raw, 'cnvBaselineId', 'cnv_baseline_id'),
    isBuiltin: Boolean(raw.isBuiltin ?? raw.is_builtin),
    status: normalizeStatus(rawString(raw, 'status', 'status', 'inactive')),
    createdAt: rawString(raw, 'createdAt', 'created_at'),
    updatedAt: rawString(raw, 'updatedAt', 'updated_at'),
  };
}

export async function listPipelines(params: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}): Promise<Pipeline[]> {
  const data = await api.get<PipelineListResponse | unknown[]>('/v1/pipelines', {
    params: {
      page: String(params.page ?? 1),
      page_size: String(params.pageSize ?? 100),
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return unwrapList(data).map(normalizePipeline);
}
