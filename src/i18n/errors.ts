import { chineseText, type TextTranslator, type TextValues } from './text';

/** An error authored by the frontend, with an explicit dictionary identity. */
export class LocalizedError extends Error {
  constructor(public readonly messageKey: string, public readonly values?: TextValues, originalMessage?: string) {
    super(originalMessage ?? chineseText(messageKey, values));
    this.name = 'LocalizedError';
  }
}

/** Unknown backend messages remain verbatim, even when they resemble a UI label. */
export function errorText(error: unknown, t: TextTranslator): string {
  if (error instanceof LocalizedError) return t(error.messageKey, error.values);
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : t('未知错误');
}
