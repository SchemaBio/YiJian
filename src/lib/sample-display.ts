const qualityLabels = {
  good: { label: '良好', variant: 'success' },
  acceptable: { label: '合格', variant: 'warning' },
  poor: { label: '不合格', variant: 'danger' },
  unknown: { label: '未提供', variant: 'neutral' },
} as const;

export function getSampleQualityDisplay(value: unknown) {
  return qualityLabels[value === 'good' || value === 'acceptable' || value === 'poor' ? value : 'unknown'];
}
export function getSamplePriorityLabel(value: unknown): string {
  return value === 'urgent' ? '加急' : value === 'normal' ? '普通' : '未提供';
}
export function getFamilyHistoryLabel(value: unknown): string {
  return value === true ? '有' : value === false ? '无' : '未提供';
}
export function formatTurnaroundDays(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${value}天` : '—';
}
