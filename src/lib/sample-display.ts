import { chineseText, type TextTranslator } from '@/i18n/text';

const qualityLabels = {
  good: { label: '良好', variant: 'success' },
  acceptable: { label: '合格', variant: 'warning' },
  poor: { label: '不合格', variant: 'danger' },
  unknown: { label: '未提供', variant: 'neutral' },
} as const;

export function getSampleQualityDisplay(value: unknown, t: TextTranslator = chineseText) {
  const display = qualityLabels[value === 'good' || value === 'acceptable' || value === 'poor' ? value : 'unknown'];
  return {...display, label: t(display.label)};
}
export function getSamplePriorityLabel(value: unknown, t: TextTranslator = chineseText): string {
  return t(value === 'urgent' ? '加急' : value === 'normal' ? '普通' : '未提供');
}
export function getFamilyHistoryLabel(value: unknown, t: TextTranslator = chineseText): string {
  return t(value === true ? '有' : value === false ? '无' : '未提供');
}
export function formatTurnaroundDays(value: unknown, t: TextTranslator = chineseText): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? t('samples.turnaroundDays', {p0:value}) : '—';
}
