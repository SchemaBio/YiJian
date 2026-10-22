import { chineseText, type TextTranslator, type TextValues } from './text';

/** An error authored by the frontend, with an explicit dictionary identity. */
export class LocalizedError extends Error {
  constructor(public readonly messageKey: string, public readonly values?: TextValues, originalMessage?: string) {
    super(originalMessage ?? chineseText(messageKey, values));
    this.name = 'LocalizedError';
  }
}

// Translate only known API messages; arbitrary server/user text stays intact.
const backendMessages: Record<string, string> = {
  'organization storage quota exceeded': 'uploadCapacity.insufficient',
  'password is too common': 'backendErrors.passwordTooCommon',
  'password must be at least 8 characters': 'backendErrors.passwordTooShort',
  'password must be at least 12 characters': 'backendErrors.adminPasswordTooShort',
  'password must include at least 3 of: lowercase, uppercase, digit, symbol': 'backendErrors.passwordComplexity',
  'invalid email or password': 'backendErrors.invalidCredentials',
  'invalid old password': 'backendErrors.invalidOldPassword',
  'email already exists': 'backendErrors.emailExists',
  'invalid system role': 'backendErrors.invalidRole',
  'cannot delete your own account': 'backendErrors.cannotDeleteSelf',
  'cannot deactivate your own account': 'backendErrors.cannotDeactivateSelf',
  'cannot remove your own super-admin role': 'backendErrors.cannotDemoteSelf',
};

/** Known API errors follow the active locale; unknown messages remain verbatim. */
export function errorText(error: unknown, t: TextTranslator): string {
  if (error && typeof error === 'object' && 'data' in error && (error as { data?: { code?: string } }).data?.code === 'permission_denied') return t('permissions.denied');
  if (error instanceof LocalizedError) return t(error.messageKey, error.values);
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
  if (message === undefined) return t('未知错误');
  const key = Object.prototype.hasOwnProperty.call(backendMessages, message) ? backendMessages[message] : undefined;
  return key ? t(key) : message;
}
