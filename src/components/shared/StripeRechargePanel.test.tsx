import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StripeRechargePanel } from './StripeRechargePanel';
import { createCheckoutSession, getPaymentOptions, getPaymentOrders, getPaymentOrder } from '@/lib/payments';
vi.mock('@/lib/payments', async original => ({ ...await original<typeof import('@/lib/payments')>(), createCheckoutSession: vi.fn(), getPaymentOptions: vi.fn(), getPaymentOrders: vi.fn(), getPaymentOrder: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); window.history.replaceState({}, '', '/billing/recharge'); vi.mocked(getPaymentOrders).mockResolvedValue({ items: [], total: 0 }); });
afterEach(cleanup);
it('keeps manual fallback and creates no Checkout when collection is disabled', async () => {
 vi.mocked(getPaymentOptions).mockResolvedValue({ provider: 'stripe', product: 'credit', credits_per_unit: 1, min_quantity: 1, max_quantity: 5000, status: 'disabled', price: null });
 render(<StripeRechargePanel quantity={10} orgId="org" />);
 await screen.findByText('在线收款暂未启用，可使用下方人工申请。');
 expect(createCheckoutSession).not.toHaveBeenCalled();
});
it('preserves an idempotency key after a timeout and marks test payments as simulated', async () => {
 vi.mocked(getPaymentOptions).mockResolvedValue({ provider: 'stripe', product: 'credit', credits_per_unit: 1, min_quantity: 1, max_quantity: 5000, status: 'available', mode: 'test', simulated: true, price: { currency: 'usd', unit_amount: 100 } });
 vi.mocked(createCheckoutSession).mockRejectedValue(new Error('timeout'));
 render(<StripeRechargePanel quantity={10} orgId="org" />);
 fireEvent.click(await screen.findByRole('button', { name: '测试支付' }));
 await screen.findByRole('alert');
 fireEvent.click(screen.getByRole('button', { name: '测试支付' }));
 await waitFor(() => expect(createCheckoutSession).toHaveBeenCalledTimes(2));
 expect(vi.mocked(createCheckoutSession).mock.calls[0][1]).toBe(vi.mocked(createCheckoutSession).mock.calls[1][1]);
 expect(screen.getByText('测试支付仅模拟到账，不增加可用积分。')).toBeInTheDocument();
});
it('a return URL only reads the authenticated order and never creates a payment', async () => {
 const id='00000000-0000-0000-0000-000000000001'; window.history.replaceState({}, '', '/billing/recharge?order='+id);
 vi.mocked(getPaymentOptions).mockResolvedValue({ provider: 'stripe', product: 'credit', credits_per_unit: 1, min_quantity: 1, max_quantity: 5000, status: 'disabled', price: null });
 vi.mocked(getPaymentOrder).mockResolvedValue({ id, mode: 'live', quantity: 10, currency: 'usd', amount: 1000, state: 'paid', simulated: false, refunded_amount: 0, recovered_credits: 0, created_at: '' });
 render(<StripeRechargePanel quantity={10} orgId="org" />);
 await screen.findByText(id+': 积分已到账'); expect(createCheckoutSession).not.toHaveBeenCalled();
});
