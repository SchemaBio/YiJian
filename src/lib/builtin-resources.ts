import type { CNVBaseline } from './cnv-baselines';
import type { DataAsset } from './data-assets';
import { chineseText, type TextTranslator } from '@/i18n/text';

export type BuiltinGenome = 'hg19' | 'hg38';

export function builtinBEDId(genome: BuiltinGenome): string {
  return `builtin-bed-${genome}`;
}

export function builtinCNVBaselineId(genome: BuiltinGenome): string {
  return `builtin-cnv-baseline-${genome}`;
}

export function builtinBEDLabel(genome: BuiltinGenome, t: TextTranslator = chineseText): string {
  return t('内置 WES BED（{p0}）', {p0: genome});
}

export function builtinCNVBaselineLabel(genome: BuiltinGenome, t: TextTranslator = chineseText): string {
  return t('内置 WES CNV 基线（{p0}）', {p0: genome});
}

/** Built-in IDs identify application labels; custom asset names stay verbatim. */
export function resourceDisplayName(id: string, original: string, t: TextTranslator): string {
  const match = /^builtin-(bed|cnv-baseline)-(hg19|hg38)$/.exec(id);
  if (!match) return original;
  return match[1] === 'bed' ? builtinBEDLabel(match[2] as BuiltinGenome, t) : builtinCNVBaselineLabel(match[2] as BuiltinGenome, t);
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
