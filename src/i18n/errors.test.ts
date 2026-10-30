import { expect, it } from 'vitest';
import { errorText, LocalizedError } from './errors';
import { createTextTranslator } from './text';
import { ApiError } from '@/lib/api';
it.each([
  ['zh-CN', '密码过于常见，请设置更安全的密码。'],
  ['zh-Hant', '密碼過於常見，請設定更安全的密碼。'],
  ['en', 'This password is too common. Choose a more secure password.'],
  ['es-419', 'Esta contraseña es demasiado común. Elija una más segura.'],
] as const)('renders actual API password errors in %s', (locale, message) => {
  expect(errorText(new ApiError(500, 'Internal Server Error', { error: 'password is too common' }), createTextTranslator(locale))).toBe(message);
});
it('uses the current locale each time instead of retaining the first language', () => {
  const error = new Error('email already exists');
  expect(errorText(error, createTextTranslator('zh-CN'))).toBe('该邮箱已被注册，请使用其他邮箱。');
  expect(errorText(error, createTextTranslator('en'))).toBe('This email address is already registered. Use another address.');
});
it('preserves unknown messages and explicit frontend errors', () => {
  const t = createTextTranslator('en');
  expect(errorText(new Error('custom upstream diagnostic'), t)).toBe('custom upstream diagnostic');
  expect(errorText('constructor', t)).toBe('constructor');
  expect(errorText(new LocalizedError('请求失败'), t)).toBe('Request failed');
});

it.each(['zh-CN','zh-Hant','en','es-419'] as const)('localizes pending manual review in %s',locale=>{
 const t=createTextTranslator(locale);
 expect(errorText('account is pending approval',t)).toBe(t('registration.manualPending'));
});
