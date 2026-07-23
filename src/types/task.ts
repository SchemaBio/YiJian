export type TaskStatus =
  | 'waiting_for_data'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'pending_interpretation';

export interface AnalysisTask {
  id: string;
  sampleId: string;
  internalId: string;
  pipeline: string;
  pipelineVersion: string;
  status: TaskStatus;
  progress: number;
  createdAt: string;
  createdBy: string;
  completedAt?: string;
  remark?: string;
}

export interface AnalysisTaskDetail {
  id: string;
  name: string;
  sampleId: string;
  internalId: string;
  pipeline: string;
  pipelineVersion: string;
  status: TaskStatus;
  createdAt: string;
  createdBy: string;
  completedAt?: string;
}

export interface TaskListResponse {
  items: AnalysisTask[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TaskCreateRequest {
  sampleId: string;
  internalId: string;
  pipelineId: string;
  pipelineName: string;
  pipelineVersion: string;
  remark: string;
  template?: string;
  executor?: 'local' | 'slurm' | 'lsf';
  inputs?: Record<string, unknown>;
  config_file?: string;
  output_dir?: string;
}

export interface TaskUpdateRequest {
  internalId: string;
  pipeline: string;
  remark: string;
}

export interface SepiidaWorkflow {
  id: string;
  uuid: string;
  name: string;
  status: string;
  start_time?: string;
  end_time?: string;
}

export interface SepiidaTask {
  id: string;
  workflow_id: string;
  name: string;
  job_name: string;
  status: string;
  start_time?: string;
  end_time?: string;
  stdout?: string;
  stderr?: string;
}

export interface TaskProgressResponse {
  id: string;
  uuid: string;
  name: string;
  template: string;
  status: string;
  progress: number;
  created_at: string;
  result_import_status?: string;
  result_import_error?: string;
  result_imported_at?: string;
  result_import_attempts?: number;
  sepiida?: SepiidaWorkflow;
  tasks?: SepiidaTask[];
}

export interface TaskStatsResponse {
  total_tasks: number;
  running_tasks: number;
  failed_last_24h: number;
  status_distribution: Record<string, number>;
  result_import_failed_last_7d: number;
  window_start: string;
}
