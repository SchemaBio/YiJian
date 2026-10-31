import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import RechargePage from './page';
import { getBillingBalance, getBillingConfig } from '@/lib/billing';
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { email: 'preview@example.invalid' }, currentOrg: { id: 'org', name: 'preview' } }) }));
vi.mock('@/lib/payments', async original => ({ ...await original<typeof import('@/lib/payments')>(), getPaymentOptions: vi.fn().mockResolvedValue({ status: 'disabled', price: null }), getPaymentOrders: vi.fn().mockResolvedValue({ items: [], total: 0 }) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'squid' }));
vi.mock('@/lib/billing', () => ({ getBillingBalance: vi.fn(), getBillingConfig: vi.fn(), calculateEstimatedCredits: vi.fn(() => null) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBillingBalance).mockResolvedValue({ balance: 100, org_id: 'org' });
  vi.mocked(getBillingConfig).mockResolvedValue({ credits_per_minute: 1, credit_rate_multiplier: 2 } as Awaited<ReturnType<typeof getBillingConfig>>);
});
it('recovers failed recharge information without displaying infinite runtime', async () => {
  vi.mocked(getBillingBalance).mockRejectedValueOnce(new Error('余额读取失败')).mockResolvedValueOnce({ balance: 100, org_id: "org" });
  vi.mocked(getBillingConfig).mockResolvedValue({ credits_per_minute: 0, credit_rate_multiplier: 1 } as Awaited<ReturnType<typeof getBillingConfig>>);
  render(<RechargePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('余额读取失败');
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await waitFor(() => expect(screen.getByText('当前余额').nextElementSibling).toHaveTextContent('100'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  expect(getBillingBalance).toHaveBeenCalledTimes(2);
});

it('keeps the manual flow and validates the actual input instead of coercing it', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<RechargePage />);
  await waitFor(() => expect(screen.getByText('当前余额').nextElementSibling).toHaveTextContent('100'));
  const input = screen.getByRole('spinbutton');
  const copy = screen.getByRole('button', { name: '复制充值申请' });
  expect(input).toHaveValue(500);
  expect(input).toHaveAttribute('step', '1');
  expect(input).toHaveAttribute('max', '5000');
  for (const value of ['', '0', '-1', '1.5', '5001']) {
    fireEvent.change(input, { target: { value } });
    expect(copy).toBeDisabled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('1～5000');
    fireEvent.click(copy);
  }
  expect(writeText).not.toHaveBeenCalled();
  for (const value of ['1', '5000']) {
    fireEvent.change(input, { target: { value } });
    expect(copy).toBeEnabled();
    await act(async () => { fireEvent.click(copy); });
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining(value));
  }
  expect(screen.queryByRole('button', { name: /Stripe/ })).not.toBeInTheDocument();
});

it('shows the three reference durations as estimates independently of the selected credit amount', async()=>{
 render(<RechargePage/>);
 await waitFor(()=>expect(screen.getByText('当前余额').nextElementSibling).toHaveTextContent('100'));
 expect(screen.getByRole('heading',{name:'项目分析时间参考'})).toBeInTheDocument();
 for(const [label,duration] of [['单个外显子分析','约 50 分钟'],['父母子家系分析','约 100 分钟'],['单样本基线校对','约 15 分钟']]){
  expect(screen.getByText(label).nextElementSibling).toHaveTextContent(duration);
 }
 expect(screen.getByText(/以上时间均为预估，仅供参考，不代表完成时限/)).toBeInTheDocument();
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'1000'}});
 expect(screen.getByText('单个外显子分析').nextElementSibling).toHaveTextContent('约 50 分钟');
 expect(screen.getByText(/实际耗时会受数据量、排队情况、计算资源和分析流程影响/)).toBeInTheDocument();
});
