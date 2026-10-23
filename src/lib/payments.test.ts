import { beforeEach, expect, it, vi } from 'vitest';
import { createCheckoutSession, getPaymentOptions, parseCreditQuantity } from './payments';
import { api } from './api';
import { createTextTranslator } from '@/i18n/text';
vi.mock('./api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it.each(['', '0', '-1', '5001', '1.5', '1e3', 'text', 'Infinity', ' 1 '])('rejects invalid quantity %s', input => {
  expect(parseCreditQuantity(input)).toBeNull();
});
it.each(['1', '500', '5000'])('accepts quantity %s', input => expect(parseCreditQuantity(input)).toBe(Number(input)));
it('routes payment contracts directly to Squid with an idempotency key', async () => {
  await getPaymentOptions();
  expect(api.get).toHaveBeenCalledWith('/v1/billing/payment-options', { coreApi: false });
  await createCheckoutSession({ product: 'credit', quantity: 5000 }, 'unique-request');
  expect(api.post).toHaveBeenCalledWith('/v1/billing/checkout-sessions', { product: 'credit', quantity: 5000 }, { coreApi: false, headers: { 'Idempotency-Key': 'unique-request' } });
  expect(() => createCheckoutSession({ product: 'credit', quantity: 0 }, 'key')).toThrow();
  expect(() => createCheckoutSession({ product: 'credit', quantity: 1 }, '')).toThrow();
  expect(api.post).toHaveBeenCalledTimes(1);
});
it.each(['zh-CN', 'zh-Hant', 'en', 'es-419'] as const)('has quantity guidance in %s', locale => {
  const t = createTextTranslator(locale);
  expect(t('payments.quantityError')).toContain('5000');
  expect(t('payments.quantityHelp')).toContain('5000');
});
