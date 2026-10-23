import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import RechargePage from './page';
import { getBillingBalance, getBillingConfig } from '@/lib/billing';
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { email: 'preview@example.invalid' }, currentOrg: { id: 'org', name: 'preview' } }) }));
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
  await screen.findByText('100 积分', { selector: 'p' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  expect(getBillingBalance).toHaveBeenCalledTimes(2);
});

it('keeps the manual flow and validates the actual input instead of coercing it', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<RechargePage />);
  await screen.findByText('100 积分', { selector: 'p' });
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
