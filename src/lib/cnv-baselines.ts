import { api } from './api';

export type CNVBaselineStatus = 'queued' | 'waiting_for_data' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CNVBaselineAsset {
  id: string;
  file_name: string;
}

export interface CNVBaseline {
  id: string;
  name: string;
  reference_genome: 'GRCh37' | 'GRCh38';
  bed: CNVBaselineAsset;
  read_pairs: [CNVBaselineAsset, CNVBaselineAsset][];
  task_id: string;
  status: CNVBaselineStatus;
  progress: number;
  output_path?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCNVBaselineInput {
  name: string;
  reference_genome: 'GRCh37' | 'GRCh38';
  bed_asset_id: string;
  read1_asset_ids: string[];
  read2_asset_ids: string[];
}

export function listCNVBaselines(): Promise<CNVBaseline[]> {
  return api.get<CNVBaseline[]>('/v1/cnv-baselines');
}

export function createCNVBaseline(input: CreateCNVBaselineInput): Promise<CNVBaseline> {
  return api.post<CNVBaseline>('/v1/cnv-baselines', input);
}
