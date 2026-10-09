import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BillingPage from './page';
import { getBillingTransactions } from '@/lib/billing';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/components/support/SupportDialog', () => ({ SupportDialog: () => null }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'squid' }));
vi.mock('@/lib/billing', () => ({
  billingReferenceTaskId: (id: string) => id,
  getBillingBalance: vi.fn(async () => ({ balance: 100 })),
  getBillingConfig: vi.fn(async () => ({ credits_per_minute: 1, credit_rate_multiplier: 1, min_balance: 0, download_credits: 1 })),
  getBillingTransactions: vi.fn(),
}));

it('distinguishes failed transactions from an empty account and recovers after refresh', async () => {
  vi.mocked(getBillingTransactions).mockRejectedValueOnce(new Error('账单读取失败')).mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20, total_pages: 1 });
  render(<BillingPage />);
  await screen.findByRole('alert');
  expect(screen.queryByText('暂无交易记录')).not.toBeInTheDocument();
  expect(screen.queryByText('共 0 条')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await screen.findByText('暂无交易记录');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(getBillingTransactions).toHaveBeenCalledTimes(2);
});
