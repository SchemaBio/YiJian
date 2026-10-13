import zh from './messages/zh-CN.json';
import hant from './messages/zh-Hant.json';
import en from './messages/en.json';
import es from './messages/es-419.json';
import type { Locale } from './locales';
import type { AbstractIntlMessages } from 'next-intl';

export const messages: Record<Locale, AbstractIntlMessages> = { 'zh-CN': zh, 'zh-Hant': hant, en, 'es-419': es };
export function getMessages(locale: Locale) { return messages[locale]; }
