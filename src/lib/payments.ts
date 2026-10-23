import { api } from './api';

export const MIN_CREDIT_QUANTITY = 1;
export const MAX_CREDIT_QUANTITY = 5000;

export interface PaymentOptions {
  provider: 'stripe';
  product: 'credit';
  credits_per_unit: 1;
  min_quantity: number;
  max_quantity: number;
  status: 'not_integrated';
  price: null;
}

export interface CreditCheckoutRequest {
  product: 'credit';
  quantity: number;
}

// No success response is implemented yet: the reserved endpoint returns 503
// with code PAYMENT_NOT_INTEGRATED. Define success data when Checkout is wired.
export interface PaymentUnavailableError {
  code: 'PAYMENT_NOT_INTEGRATED';
  error: string;
}

export function parseCreditQuantity(input: string): number | null {
  if (!/^\d+$/.test(input)) return null;
  const quantity = Number(input);
  return Number.isSafeInteger(quantity) && quantity >= MIN_CREDIT_QUANTITY && quantity <= MAX_CREDIT_QUANTITY ? quantity : null;
}

export function getPaymentOptions() {
  return api.get<PaymentOptions>('/v1/billing/payment-options', { coreApi: false });
}

export function createCheckoutSession(input: CreditCheckoutRequest, idempotencyKey: string) {
  if (input.product !== 'credit' || !Number.isInteger(input.quantity) || input.quantity < MIN_CREDIT_QUANTITY || input.quantity > MAX_CREDIT_QUANTITY) {
    throw new Error('Invalid Credit quantity');
  }
  if (!idempotencyKey.trim() || idempotencyKey.length > 200 || /[\r\n]/.test(idempotencyKey)) throw new Error('Invalid Idempotency-Key');
  return api.post<never>('/v1/billing/checkout-sessions', input, { coreApi: false, headers: { 'Idempotency-Key': idempotencyKey } });
}
