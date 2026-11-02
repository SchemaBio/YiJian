import type { TextTranslator } from '@/i18n/text';

// Translate known system-generated notes at display time. Clinical annotations,
// user evidence and archived assessment values remain unchanged.
export function screeningNoteText(note: string, t: TextTranslator): string {
  if (t.locale === 'zh-CN') return note;
  const known: Record<string, string> = {
    '采用 ClinVar 已知结论作为快速初评参考，不转换为 PP5/BP6 或 ACMG 积分': 'clinvarReference',
    '按通用频率阈值快速筛查，未核验疾病特定阈值及 AN，不生成 BA1/BS1 积分': 'populationNote',
    '现有注释或评估证据存在冲突，保留 VUS，优先人工复核': 'conflictNote',
  };
  if (Object.hasOwn(known, note)) return t(`assessmentDisplay.${known[note]}`);
  const frequency = /^gnomAD：总体 AF=(.+)，东亚 AF=(.+)；(.+)$/.exec(note);
  if (frequency) {
    const categories: Record<string, string> = { '常见': 'common', '较常见': 'frequent', '稀有': 'rare', '低频': 'lowFrequency', '报告 AF 为 0（不能等同已核验缺失）': 'zeroFrequency' };
    return t('assessmentDisplay.frequency', {
      global: frequency[1] === '未提供' ? t('assessmentDisplay.missing') : frequency[1],
      eas: frequency[2] === '未提供' ? t('assessmentDisplay.missing') : frequency[2],
      category: Object.hasOwn(categories, frequency[3]) ? t(`assessmentDisplay.${categories[frequency[3]]}`) : frequency[3],
    });
  }
  if (note.startsWith('ClinVar：')) return note.replace('ClinVar：', 'ClinVar: ').replace('；', '; ').replace('未提供审核状态', t('assessmentDisplay.reviewMissing'));
  return note;
}
