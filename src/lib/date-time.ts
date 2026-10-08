export function formatDateTime(value: string | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
