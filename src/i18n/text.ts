import { createTranslator } from 'next-intl';
import { getMessages } from './messages';
import { defaultLocale, type Locale } from './locales';
import sources from './sources.json';

export type TextValues = Record<string, string | number | Date>;
export type TextTranslator = ((key: string, values?: TextValues) => string) & {readonly locale: Locale};
const sourceKeys: Record<string, string> = sources;
export function createTextTranslator(locale: Locale): TextTranslator {
  const catalog = getMessages(locale);
  const fallback = createTranslator({locale: defaultLocale, messages: getMessages(defaultLocale)}) as unknown as TextTranslator;
  const translate = createTranslator({
    locale, messages: catalog,
    onError(error) { console.error('[i18n]', locale, error.message); },
    getMessageFallback({namespace, key}) {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return fallback(fullKey);
    },
  }) as unknown as TextTranslator;
  const resolve: TextTranslator = Object.assign((key: string, values?: TextValues) => {
    const messageKey = sourceKeys[key] ?? key;
    // Runtime business text is not translated. Only registered UI labels and keys are resolved.
    if (!sourceKeys[key] && !Object.hasOwn(getMessages(defaultLocale), messageKey.split('.')[0])) return key;
    const entry = messageKey.split('.').reduce<unknown>((value, part) =>
      value && typeof value === 'object' && Object.hasOwn(value, part) ? (value as Record<string, unknown>)[part] : undefined, catalog);
    if (typeof entry !== 'string') {
      console.error('[i18n] Missing message', {locale, key: messageKey});
      return fallback(messageKey, values);
    }
    return translate(messageKey, values);
  }, {locale});
  return resolve;
}
export const chineseText = createTextTranslator(defaultLocale);

/** Only registered display text is resolved; React nodes and arbitrary values are preserved. */
export function translateUI<T>(value: T, t: TextTranslator): T {
  return (typeof value === 'string' ? t(value) : value) as T;
}

/** Localize display descriptors, keeping values, IDs, accessors and render functions intact. */
export function localizeDisplay<T>(value: T, t: TextTranslator): T {
  if (Array.isArray(value)) return value.map(item => localizeDisplay(item, t)) as T;
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  const result = { ...value } as Record<string, unknown>;
  for (const key of ['label', 'title', 'header', 'description', 'placeholder', 'tooltip', 'emptyText']) {
    if (typeof result[key] === 'string') result[key] = t(result[key]);
  }
  if (Array.isArray(result.children)) result.children = localizeDisplay(result.children, t);
  return result as T;
}
