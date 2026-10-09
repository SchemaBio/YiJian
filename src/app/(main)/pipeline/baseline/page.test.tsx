import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BaselinePage from './page';
import { listCNVBaselines } from '@/lib/cnv-baselines';
import { getBillingConfig } from '@/lib/billing';

vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' }, currentOrg: { id: 'synthetic-org' } }) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'squid' }));
vi.mock('@/lib/data-assets', () => ({ listDataAssets: vi.fn(async () => ({ items: [], total_pages: 1 })) }));
vi.mock('@/lib/cnv-baselines', () => ({ listCNVBaselines: vi.fn(), createCNVBaseline: vi.fn() }));
vi.mock('@/lib/billing', () => ({ getBillingConfig: vi.fn(async () => ({ cnv_baseline_credits_per_gib: 2 })) }));

it('keeps the loaded credit rate when baseline reading is retried', async () => {
  vi.mocked(listCNVBaselines).mockRejectedValueOnce(new Error('基线读取失败')).mockResolvedValueOnce([]);
  render(<BaselinePage />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  const create = await screen.findByRole('button', { name: '校正内置 CNV 基线' });
  expect(create).toBeEnabled();
  fireEvent.click(create);
  expect(await screen.findByText('预计消耗 0 积分')).toBeInTheDocument();
  expect(screen.getByText(/每 GiB 2 积分/)).toBeInTheDocument();
  expect(getBillingConfig).toHaveBeenCalledTimes(1);
});
