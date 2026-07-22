import { api } from './api';
import type {
  AnalysisTask,
  AnalysisTaskDetail,
  TaskListResponse,
  TaskCreateRequest,
  TaskUpdateRequest,
  TaskProgressResponse,
  TaskStatsResponse,
  TaskStatus,
} from '@/types/task';
import type { SampleDetail } from '@/app/(main)/samples/types';
import { normalizeSampleDetail } from './samples';

interface RawTask {
  id?: string;
  sampleId?: string;
  sample_id?: string;
  internalId?: string;
  internal_id?: string;
  pipeline?: string;
  pipelineVersion?: string;
  pipeline_version?: string;
  status?: string;
  progress?: number;
  createdAt?: string;
  created_at?: string;
  createdBy?: string;
  created_by?: string;
  completedAt?: string;
  completed_at?: string;
  remark?: string;
  name?: string;
}

type MaybeTaskList = RawTask[] | TaskListResponse | {
  items?: RawTask[];
  data?: RawTask[] | {
    items?: RawTask[];
    total?: number;
    page?: number;
    page_size?: number;
    pageSize?: number;
    total_pages?: number;
    totalPages?: number;
  };
  total?: number;
  page?: number;
  page_size?: number;
  pageSize?: number;
  total_pages?: number;
  totalPages?: number;
};

function asRawTask(value: unknown): RawTask {
  return value && typeof value === 'object' ? value as RawTask : {};
}

function normalizeStatus(value: unknown): TaskStatus {
  const allowed: TaskStatus[] = [
    'waiting_for_data',
    'queued',
    'running',
    'completed',
    'failed',
    'cancelled',
    'pending_interpretation',
  ];
  return allowed.includes(value as TaskStatus) ? value as TaskStatus : 'queued';
}

export function normalizeTask(rawValue: unknown): AnalysisTask {
  const raw = asRawTask(rawValue);
  return {
    id: String(raw.id ?? ''),
    sampleId: String(raw.sampleId ?? raw.sample_id ?? ''),
    internalId: String(raw.internalId ?? raw.internal_id ?? ''),
    pipeline: String(raw.pipeline ?? ''),
    pipelineVersion: String(raw.pipelineVersion ?? raw.pipeline_version ?? ''),
    status: normalizeStatus(raw.status),
    progress: typeof raw.progress === 'number' && Number.isFinite(raw.progress) ? raw.progress : 0,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    createdBy: String(raw.createdBy ?? raw.created_by ?? ''),
    completedAt: raw.completedAt ?? raw.completed_at,
    remark: raw.remark,
  };
}

export function normalizeTaskDetail(rawValue: unknown): AnalysisTaskDetail {
  const raw = asRawTask(rawValue);
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? raw.id ?? ''),
    sampleId: String(raw.sampleId ?? raw.sample_id ?? ''),
    internalId: String(raw.internalId ?? raw.internal_id ?? ''),
    pipeline: String(raw.pipeline ?? ''),
    pipelineVersion: String(raw.pipelineVersion ?? raw.pipeline_version ?? ''),
    status: normalizeStatus(raw.status),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    createdBy: String(raw.createdBy ?? raw.created_by ?? ''),
    completedAt: raw.completedAt ?? raw.completed_at,
  };
}

function taskItems(value: MaybeTaskList): RawTask[] {
  if (Array.isArray(value)) return value.map(asRawTask);
  const payload = value as { items?: unknown; data?: unknown };
  if (Array.isArray(payload.items)) return payload.items.map(asRawTask);
  if (Array.isArray(payload.data)) return payload.data.map(asRawTask);
  const nested = payload.data && typeof payload.data === 'object' ? payload.data as { items?: unknown } : null;
  if (Array.isArray(nested?.items)) {
    return nested.items.map(asRawTask);
  }
  return [];
}

function listMeta(value: MaybeTaskList) {
  const payload = value as { data?: unknown };
  const nested = payload && typeof payload === 'object' && payload.data && !Array.isArray(payload.data)
    ? payload.data
    : payload;
  return nested as {
    total?: number;
    page?: number;
    page_size?: number;
    pageSize?: number;
    total_pages?: number;
    totalPages?: number;
  };
}

export function normalizeTaskListResponse(value: MaybeTaskList, fallbackPage = 1, fallbackPageSize = 20): TaskListResponse {
  const items = taskItems(value).map(normalizeTask).filter(task => task.id);
  const meta = listMeta(value);
  return {
    items,
    total: meta.total ?? items.length,
    page: meta.page ?? fallbackPage,
    page_size: meta.page_size ?? meta.pageSize ?? fallbackPageSize,
    total_pages: meta.total_pages ?? meta.totalPages ?? 1,
  };
}

export function normalizeTaskProgress(rawValue: unknown): TaskProgressResponse {
  const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, unknown> : {};
  return {
    ...raw,
    id: String(raw.id ?? ''),
    uuid: String(raw.uuid ?? ''),
    name: String(raw.name ?? ''),
    template: String(raw.template ?? ''),
    status: String(raw.status ?? ''),
    progress: typeof raw.progress === 'number' && Number.isFinite(raw.progress) ? raw.progress : 0,
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
  } as TaskProgressResponse;
}

export const tasksApi = {
  /** List tasks with optional filters */
  list(params?: {
    status?: string;
    sampleId?: string;
    page?: number;
    page_size?: number;
  }): Promise<TaskListResponse> {
    const searchParams: Record<string, string> = {};
    if (params?.status) searchParams.status = params.status;
    if (params?.sampleId) searchParams.sampleId = params.sampleId;
    if (params?.page) searchParams.page = String(params.page);
    if (params?.page_size) searchParams.page_size = String(params.page_size);
    return api
      .get<MaybeTaskList>('/v1/tasks', { params: searchParams })
      .then(response => normalizeTaskListResponse(response, params?.page ?? 1, params?.page_size ?? 20));
  },

  /** Create a new task */
  async create(data: TaskCreateRequest): Promise<AnalysisTask> {
    return normalizeTask(await api.post<unknown>('/v1/tasks', data));
  },

  /** Get a single task by UUID */
  async get(id: string): Promise<AnalysisTaskDetail> {
    return normalizeTaskDetail(await api.get<unknown>(`/v1/tasks/${encodeURIComponent(id)}`));
  },

  /** Get the sample associated with a task */
  async getSample(id: string): Promise<SampleDetail> {
    const sample = await api.get<unknown>(`/v1/tasks/${encodeURIComponent(id)}/sample`);
    return normalizeSampleDetail(sample);
  },

  /** Update a task */
  async update(id: string, data: TaskUpdateRequest): Promise<AnalysisTask> {
    return normalizeTask(await api.put<unknown>(`/v1/tasks/${encodeURIComponent(id)}`, data));
  },

  /** Start a task */
  async start(id: string): Promise<AnalysisTask> {
    return normalizeTask(await api.post<unknown>(`/v1/tasks/${encodeURIComponent(id)}/start`));
  },

  /** Stop a running task */
  async stop(id: string): Promise<AnalysisTask> {
    return normalizeTask(await api.post<unknown>(`/v1/tasks/${encodeURIComponent(id)}/stop`));
  },

  /** Retry a failed task */
  async retry(id: string): Promise<AnalysisTask> {
    return normalizeTask(await api.post<unknown>(`/v1/tasks/${encodeURIComponent(id)}/retry`));
  },

  /** Cancel/delete a task */
  cancel(id: string): Promise<void> {
    return api.delete<void>(`/v1/tasks/${encodeURIComponent(id)}`);
  },

  /** Get task progress (with Sepiida data) */
  async getProgress(id: string): Promise<TaskProgressResponse> {
    return normalizeTaskProgress(await api.get<unknown>(`/v1/tasks/${encodeURIComponent(id)}/progress`));
  },

  /** Get scoped operational task statistics. */
  getStats(): Promise<TaskStatsResponse> {
    return api.get<TaskStatsResponse>('/v1/tasks/stats');
  },

  /** Get the execution log as plain text. */
  getLogs(id: string): Promise<string> {
    return api.get<string>(`/v1/tasks/${encodeURIComponent(id)}/logs`);
  },
};
