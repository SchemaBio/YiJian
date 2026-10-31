import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StripeRechargePanel } from './StripeRechargePanel';
import { createCheckoutSession, getPaymentOptions, getPaymentOrders, getPaymentOrder } from '@/lib/payments';
import { ApiError } from '@/lib/api';
import { USER_AGREEMENT_VERSION } from '@/lib/user-agreement';
import { getServicePolicy, SERVICE_POLICY_VERSION } from '@/lib/service-policy';
vi.mock('@/lib/service-policy', async original => ({ ...await original<typeof import('@/lib/service-policy')>(), getServicePolicy: vi.fn().mockResolvedValue({version:'research-service-2026-10-29-v1',configured:true}) }));
vi.mock('@/lib/payments', async original => ({ ...await original<typeof import('@/lib/payments')>(), createCheckoutSession: vi.fn(), getPaymentOptions: vi.fn(), getPaymentOrders: vi.fn(), getPaymentOrder: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); window.history.replaceState({}, '', '/billing/recharge'); vi.mocked(getPaymentOrders).mockResolvedValue({ items: [], total: 0 }); vi.mocked(getServicePolicy).mockResolvedValue({version:SERVICE_POLICY_VERSION,configured:true,operator:'Operator',contact:'support@fixture.invalid',address:'Address',service_url:'/service',terms_url:'/terms',refund_url:'/refund'}); });
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
 const pay = await screen.findByRole('button', { name: '测试支付' });
 expect(pay).toBeDisabled();
 await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(pay);
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
it('clears purchase acceptance when switching organizations', async () => {
 vi.mocked(getPaymentOptions).mockResolvedValue({provider:'stripe',product:'credit',credits_per_unit:1,min_quantity:1,max_quantity:5000,status:'available',mode:'live',price:{currency:'usd',unit_amount:100}});
 const view=render(<StripeRechargePanel quantity={10} orgId="first-org" />);
 await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeDisabled());
 fireEvent.click(screen.getByRole('checkbox'));
 expect(screen.getByRole('checkbox')).toBeChecked();
 view.rerender(<StripeRechargePanel quantity={10} orgId="second-org" />);
 await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeChecked());
 expect(createCheckoutSession).not.toHaveBeenCalled();
});
it('requires fresh confirmation after a server policy-version rejection', async () => {
 vi.mocked(getPaymentOptions).mockResolvedValue({provider:'stripe',product:'credit',credits_per_unit:1,min_quantity:1,max_quantity:5000,status:'available',mode:'test',simulated:true,price:{currency:'usd',unit_amount:100}});
 vi.mocked(createCheckoutSession).mockRejectedValue(new ApiError(400,'Bad Request',{code:'purchase_policy_outdated'}));
 render(<StripeRechargePanel quantity={10} orgId="org" />);
 await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeDisabled());
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(await screen.findByRole('button',{name:'测试支付'}));
 await screen.findByText('购买政策已更新，请重新阅读并确认。');
 expect(screen.getByRole('checkbox')).not.toBeChecked();
 expect(screen.getByRole('button',{name:'测试支付'})).toBeDisabled();
 expect(getServicePolicy).toHaveBeenCalledTimes(2);
});

it('links consent to the privacy policy and unified agreement without separate service or refund links', async()=>{
 vi.mocked(getPaymentOptions).mockResolvedValue({provider:'stripe',product:'credit',credits_per_unit:1,min_quantity:1,max_quantity:5000,status:'available',mode:'test',simulated:true,price:{currency:'usd',unit_amount:100}});
 render(<StripeRechargePanel quantity={500} orgId="org"/>);
 const privacy=screen.getByRole('link',{name:'《隐私政策》'});
 const agreement=screen.getByRole('link',{name:'《使用协议》'});
 expect(privacy).toHaveAttribute('href','/privacy?lang=zh-CN');
 expect(agreement).toHaveAttribute('href',`/agreement?lang=zh-CN&version=${USER_AGREEMENT_VERSION}&purchase_version=${SERVICE_POLICY_VERSION}`);
 for(const link of screen.getAllByRole('link'))expect(link.getAttribute('href')).not.toMatch(/#(?:service|terms|refund)|^\/(?:service|terms|refund)(?:\?|$)/);
 const consent=screen.getByRole('checkbox');expect(consent).not.toBeChecked();expect(consent).toBeRequired();
 await waitFor(()=>expect(consent).toBeEnabled());
 expect(screen.getByRole('button',{name:'测试支付'})).toBeDisabled();
 expect(screen.getByText('确认仅用于科研，不用于个人医疗决策。')).toBeInTheDocument();
 expect(createCheckoutSession).not.toHaveBeenCalled();
});
