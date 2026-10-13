import { defaultLocale, type Locale } from '@/i18n/locales';

export function formatDateTime(value: string | undefined, locale: Locale = defaultLocale): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Date(value).toLocaleString(locale, { hour12: false });
}
