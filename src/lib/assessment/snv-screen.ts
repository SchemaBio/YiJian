import type { AutomaticAssessment, Classification } from './types';

// These are deliberately simple triage thresholds, not disease-specific
// ACMG BA1/BS1/PM2 criteria. Never manufacture ACMG points from annotations.
export const COMMON_AF = 0.05;
export const FREQUENT_AF = 0.01;
const CLINVAR_CLASSES: Record<string, Classification> = { pathogenic: 'Pathogenic', 'likely pathogenic': 'Likely_Pathogenic', benign: 'Benign', 'likely benign': 'Likely_Benign', 'uncertain significance': 'VUS' };
type ClinVarReference = { classification?: Classification; conflict: boolean };
const clinvarCache = new Map<string, ClinVarReference>();
const significant = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '' && v !== '.';
const read = (v: Record<string, unknown>, ...keys: string[]) => keys.map(k => v[k]).find(significant);
function frequency(v: unknown): number | undefined {
  if (!significant(v) || (typeof v !== 'number' && typeof v !== 'string')) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : undefined;
}
function parseClinvar(text: string): ClinVarReference {
  if (/conflict/.test(text)) return { conflict: true };
  const terms = text.split(/[\/&|;,]+/).map(t => Object.hasOwn(CLINVAR_CLASSES,t.trim()) ? CLINVAR_CLASSES[t.trim()] : undefined);
  if (!terms.length || terms.some(t => !t)) return { conflict: false };
  const p = terms.some(t => t === 'Pathogenic' || t === 'Likely_Pathogenic');
  const b = terms.some(t => t === 'Benign' || t === 'Likely_Benign');
  if ((p && b) || ((p || b) && terms.includes('VUS'))) return { conflict: true };
  // Preserve the less certain member of a combined assertion.
  return { classification: terms.includes('Likely_Pathogenic') ? 'Likely_Pathogenic' : terms.includes('Likely_Benign') ? 'Likely_Benign' : terms[0], conflict: false };
}
function clinvar(v: unknown): ClinVarReference {
  const text = String(v ?? '').toLowerCase().replace(/_/g, ' ').trim();
  const cached = clinvarCache.get(text);
  if (cached) return cached;
  const result = parseClinvar(text);
  if (clinvarCache.size < 128) clinvarCache.set(text, result);
  return result;
}

export function screenSNV(values: Record<string, unknown>, result: AutomaticAssessment): void {
  const globalAF = frequency(read(values, 'GnomAD_AF', 'gnomAD_AF', 'gnomadAF'));
  const easAF = frequency(read(values, 'GnomAD_AF_EAS', 'gnomAD_AF_EAS', 'gnomadEasAF'));
  const available = [globalAF, easAF].filter((f): f is number => f !== undefined);
  const maxAF = available.length ? Math.max(...available) : undefined;
  const significance = read(values, 'ClinVar_Sig', 'ClinVar_CLNSIG', 'clinvarSignificance');
  const review = String(read(values, 'ClinVar_RevStat', 'clinvarReviewStatus') ?? '未提供审核状态');
  const reference = clinvar(significance);
  const notes: string[] = [];
  if (maxAF !== undefined) {
    notes.push(`gnomAD：总体 AF=${globalAF ?? '未提供'}，东亚 AF=${easAF ?? '未提供'}；${maxAF >= COMMON_AF ? '常见' : maxAF >= FREQUENT_AF ? '较常见' : maxAF === 0 ? '报告 AF 为 0（不能等同已核验缺失）' : maxAF <= 0.0001 ? '稀有' : '低频'}`);
  }
  if (significant(significance)) notes.push(`ClinVar：${significance}；${review}`);
  const formal = result.classification;
  const pathogenic = (c?: Classification) => c === 'Pathogenic' || c === 'Likely_Pathogenic';
  const benign = (c?: Classification) => c === 'Benign' || c === 'Likely_Benign';
  if (reference.conflict || (pathogenic(reference.classification) && maxAF !== undefined && maxAF >= FREQUENT_AF) || (pathogenic(formal) && benign(reference.classification)) || (benign(formal) && pathogenic(reference.classification))) {
    result.classification = 'VUS';
    result.classificationBasis = 'screening_conflict';
    notes.push('现有注释或评估证据存在冲突，保留 VUS，优先人工复核');
  } else if (formal && (pathogenic(formal) || (formal === 'Benign' && result.criteria.some(e => e.code === 'BA1')))) {
    result.classificationBasis = 'acmg_evidence';
  } else if (reference.classification) {
    result.classification = reference.classification;
    result.classificationBasis = 'clinvar_reference';
    notes.push('采用 ClinVar 已知结论作为快速初评参考，不转换为 PP5/BP6 或 ACMG 积分');
  } else if (maxAF !== undefined && maxAF >= FREQUENT_AF) {
    result.classification = maxAF >= COMMON_AF ? 'Benign' : 'Likely_Benign';
    result.classificationBasis = 'population_screening';
    notes.push('按通用频率阈值快速筛查，未核验疾病特定阈值及 AN，不生成 BA1/BS1 积分');
  } else if (formal) {
    result.classificationBasis = 'acmg_evidence';
  } else if (maxAF !== undefined || significant(significance) || significant(read(values, 'Consequence', 'consequence')) || /^(SNP|SNV|DEL|INS|INDEL)$/i.test(String(values.Type ?? ''))) {
    result.classification = 'VUS';
    result.classificationBasis = 'screening_vus';
    notes.push('现有注释未支持明确致病或良性倾向，快速初评保留 VUS；低频本身不等于致病');
  }
  result.screeningNotes = notes;
}
