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
  executor?: 'local' | 'slurm' | 'lsf' | 'cvm_spot';
  inputs?: Record<string, unknown>;
  config_file?: string;
  output_dir?: string;
  uploaded_file_ids?: number[];
  estimatedMinutes?: number;
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
  sepiida?: SepiidaWorkflow;
  tasks?: SepiidaTask[];
}
