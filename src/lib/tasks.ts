import { api } from './api';
import type {
  AnalysisTask,
  AnalysisTaskDetail,
  TaskListResponse,
  TaskCreateRequest,
  TaskUpdateRequest,
  TaskProgressResponse,
} from '@/types/task';
import type { SampleDetail } from '@/app/(main)/samples/types';
import { normalizeSampleDetail } from './task-resources';

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
    return api.get<TaskListResponse>('/v1/tasks', { params: searchParams });
  },

  /** Create a new task */
  create(data: TaskCreateRequest): Promise<AnalysisTask> {
    return api.post<AnalysisTask>('/v1/tasks', data);
  },

  /** Get a single task by UUID */
  get(id: string): Promise<AnalysisTaskDetail> {
    return api.get<AnalysisTaskDetail>(`/v1/tasks/${id}`);
  },

  /** Get the sample associated with a task */
  async getSample(id: string): Promise<SampleDetail> {
    const sample = await api.get<unknown>(`/v1/tasks/${id}/sample`);
    return normalizeSampleDetail(sample);
  },

  /** Update a task */
  update(id: string, data: TaskUpdateRequest): Promise<AnalysisTask> {
    return api.put<AnalysisTask>(`/v1/tasks/${id}`, data);
  },

  /** Start a task */
  start(id: string): Promise<AnalysisTask> {
    return api.post<AnalysisTask>(`/v1/tasks/${id}/start`);
  },

  /** Cancel/delete a task */
  cancel(id: string): Promise<void> {
    return api.delete<void>(`/v1/tasks/${id}`);
  },

  /** Get task progress (with Sepiida data) */
  getProgress(id: string): Promise<TaskProgressResponse> {
    return api.get<TaskProgressResponse>(`/v1/tasks/${id}/progress`);
  },
};
