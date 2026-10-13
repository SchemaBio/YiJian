import policies from '@/i18n/privacy.json';
import type { Locale } from '@/i18n/locales';

export type PrivacyLanguage = Locale;
export interface PolicySection {
  id: string;
  title: string;
  paragraphs: readonly string[];
}
export const privacySections: Record<Locale, readonly PolicySection[]> = policies;
export function getPrivacySections(locale: Locale): readonly PolicySection[] {
  return privacySections[locale];
}
