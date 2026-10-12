import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BaselinePage from './page';
import { deleteCNVBaseline, listCNVBaselines } from '@/lib/cnv-baselines';
import { getBillingConfig } from '@/lib/billing';

vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' }, currentOrg: { id: 'synthetic-org' } }) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'squid' }));
vi.mock('@/lib/data-assets', () => ({ listDataAssets: vi.fn(async () => ({ items: [], total_pages: 1 })) }));
vi.mock('@/lib/cnv-baselines', () => ({ listCNVBaselines: vi.fn(), createCNVBaseline: vi.fn(), deleteCNVBaseline: vi.fn() }));
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

it('replaces task navigation with deletion and blocks deletion while running', async () => {
 vi.mocked(listCNVBaselines).mockResolvedValue([{ id: 'baseline', name: '自定义基线', task_id: 'calibration-task', reference_genome: 'GRCh38', status: 'running', progress: 30, read_pairs: [], bed: {id: 'bed-asset', file_name: 'test.bed'}, input_bytes: 0, credit_cost: 0, credits_charged: 0, created_at: '2026-10-11T00:00:00Z', updated_at: '2026-10-11T00:00:00Z' }]);
 render(<BaselinePage />);
 expect(await screen.findByRole('button', {name: '删除 自定义基线'})).toBeDisabled();
 expect(screen.queryByRole('button', {name: '查看任务'})).not.toBeInTheDocument();
 expect(screen.queryByRole('link', {name: '查看任务'})).not.toBeInTheDocument();
});

it('confirms deletion and refreshes the baseline list', async () => {
 const baseline = { id: 'baseline', name: '自定义基线', task_id: 'calibration-task', reference_genome: 'GRCh38' as const, status: 'completed' as const, progress: 100, read_pairs: [], bed: {id: 'bed-asset', file_name: 'test.bed'}, input_bytes: 0, credit_cost: 0, credits_charged: 0, created_at: '2026-10-11T00:00:00Z', updated_at: '2026-10-11T00:00:00Z' };
 vi.mocked(listCNVBaselines).mockResolvedValueOnce([baseline]).mockResolvedValue([]);
 vi.mocked(deleteCNVBaseline).mockResolvedValue();
 render(<BaselinePage />);
 fireEvent.click(await screen.findByRole('button', {name: '删除 自定义基线'}));
 expect(deleteCNVBaseline).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', {name: '确认删除'}));
 await screen.findByText('内置 WES CNV 基线（hg19）');
 expect(deleteCNVBaseline).toHaveBeenCalledWith('baseline');
 expect(await screen.findAllByText('只读')).toHaveLength(2);
});

it('keeps the confirmation open when deletion is rejected', async () => {
 vi.mocked(listCNVBaselines).mockResolvedValue([{ id: 'baseline', name: '自定义基线', task_id: 'calibration-task', reference_genome: 'GRCh38', status: 'completed', progress: 100, read_pairs: [], bed: {id: 'bed-asset', file_name: 'test.bed'}, input_bytes: 0, credit_cost: 0, credits_charged: 0, created_at: '2026-10-11T00:00:00Z', updated_at: '2026-10-11T00:00:00Z' }]);
 vi.mocked(deleteCNVBaseline).mockRejectedValue(new Error('请先解除流程中的基线选择'));
 render(<BaselinePage />);
 fireEvent.click(await screen.findByRole('button', {name: '删除 自定义基线'}));
 fireEvent.click(screen.getByRole('button', {name: '确认删除'}));
 expect(await screen.findByText('请先解除流程中的基线选择')).toBeInTheDocument();
 expect(screen.getByRole('button', {name: '取消'})).toBeEnabled();
});
