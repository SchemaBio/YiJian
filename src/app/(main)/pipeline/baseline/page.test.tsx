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

it('keeps calibration task navigation disabled without a task link', async () => {
 vi.mocked(listCNVBaselines).mockResolvedValue([{ id: 'baseline', name: '自定义基线', task_id: 'calibration-task', reference_genome: 'GRCh38', status: 'running', progress: 30, input_bytes: 0, credit_cost: 0, credits_charged: 0, updated_at: '2026-10-11T00:00:00Z', read_pairs: [], bed: {id: 'bed', file_name: 'test.bed'}, created_at: '2026-10-11T00:00:00Z' }] as Awaited<ReturnType<typeof listCNVBaselines>>);
 render(<BaselinePage />);
 expect(await screen.findByRole('button', {name: '查看任务'})).toBeDisabled();
 expect(screen.queryByRole('link', {name: '查看任务'})).not.toBeInTheDocument();
});
