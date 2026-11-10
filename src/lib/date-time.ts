import { defaultLocale, type Locale } from '@/i18n/locales';

export function formatDateTime(value: string | undefined, locale: Locale = defaultLocale): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Date(value).toLocaleString(locale, { hour12: false });
}

export function formatLocalTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;

  const twoDigits = (part: number) => String(part).padStart(2, '0');
  const year = String(date.getFullYear()).padStart(4, '0');
  const day = [year, twoDigits(date.getMonth() + 1), twoDigits(date.getDate())].join('-');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(twoDigits).join(':');
  return `${day} ${time}`;
}
