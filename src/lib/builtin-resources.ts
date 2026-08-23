import type { CNVBaseline } from './cnv-baselines';
import type { DataAsset } from './data-assets';

export type BuiltinGenome = 'hg19' | 'hg38';

export function builtinBEDId(genome: BuiltinGenome): string {
  return `builtin-bed-${genome}`;
}

export function builtinCNVBaselineId(genome: BuiltinGenome): string {
  return `builtin-cnv-baseline-${genome}`;
}

export function builtinBEDLabel(genome: BuiltinGenome): string {
  return `内置 WES BED（${genome}）`;
}

export function builtinCNVBaselineLabel(genome: BuiltinGenome): string {
  return `内置 WES CNV 基线（${genome}）`;
}

export const BUILTIN_BED_ASSETS: DataAsset[] = (['hg19', 'hg38'] as const).map((genome) => ({
  id: builtinBEDId(genome),
  file_name: builtinBEDLabel(genome),
  file_size: 0,
  read_type: 'bed',
  reference_genome: genome === 'hg38' ? 'GRCh38' : 'GRCh37',
  provider: 'local',
  status: 'completed',
  source: 'scanner',
  created_at: '',
  updated_at: '',
  is_builtin: true,
}));

export const BUILTIN_CNV_BASELINES: CNVBaseline[] = (['hg19', 'hg38'] as const).map((genome) => ({
  id: builtinCNVBaselineId(genome),
  name: builtinCNVBaselineLabel(genome),
  reference_genome: genome === 'hg38' ? 'GRCh38' : 'GRCh37',
  bed: { id: builtinBEDId(genome), file_name: builtinBEDLabel(genome) },
  read_pairs: [],
  task_id: '',
  status: 'completed',
  progress: 100,
  input_bytes: 0,
  credit_cost: 0,
  credits_charged: 0,
  created_at: '',
  updated_at: '',
  is_builtin: true,
}));
