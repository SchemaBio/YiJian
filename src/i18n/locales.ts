export const locales = ['zh-CN', 'zh-Hant', 'en', 'es-419'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'zh-CN';
export const localeCookie = 'yijian-locale';
export const localeNames: Record<Locale, string> = {
  'zh-CN': '简体中文', 'zh-Hant': '繁體中文', en: 'English', 'es-419': 'Español (Latinoamérica)',
};
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale);
}
export function resolveLocale(preference?: string, deployment?: string): Locale {
  return isLocale(preference) ? preference : isLocale(deployment) ? deployment : defaultLocale;
}
export function policyLocale(value: string | null | undefined, fallback: Locale): Locale {
  return value === 'zh' ? 'zh-CN' : resolveLocale(value ?? undefined, fallback);
}
