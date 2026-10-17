import * as React from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BaselinePage from './page';
import { createCNVBaseline, deleteCNVBaseline, listCNVBaselines } from '@/lib/cnv-baselines';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import { getBillingConfig } from '@/lib/billing';

vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' }, currentOrg: { id: 'synthetic-org' } }) }));
const mode = vi.hoisted(() => ({backend: 'squid'}));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => mode.backend }));
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

it('selects whole samples and submits both reads in the same selection order', async () => {
 Element.prototype.scrollIntoView = vi.fn();
 const file = (id: string, name: string, read_type: DataAsset['read_type'], extra: Partial<DataAsset> = {}): DataAsset => ({ id, file_name: name, read_type, file_size: 1024 ** 3, provider: 's3', status: 'completed', source: 'upload', created_at: '', updated_at: '', ...extra });
 vi.mocked(listDataAssets).mockResolvedValue({ items: [file('a1', 'A_R1.fastq.gz', 'read1'), file('b2', 'B_R2.fastq.gz', 'read2'), file('a2', 'A_R2.fastq.gz', 'read2'), file('b1', 'B_R1.fastq.gz', 'read1'), file('incomplete', 'C_R1.fastq.gz', 'read1'), file('bed', 'normal.bed', 'bed', { reference_genome: 'GRCh38', validation_status: 'valid' })], total: 6, page: 1, page_size: 20, total_pages: 1 });
 vi.mocked(listCNVBaselines).mockResolvedValue([]);
 vi.mocked(createCNVBaseline).mockResolvedValue({ id: 'new', task_id: 'new-task', name: 'New baseline', reference_genome: 'GRCh38', status: 'queued', progress: 0, read_pairs: [], bed: { id: 'bed', file_name: 'normal.bed' }, input_bytes: 0, credit_cost: 0, credits_charged: 0, created_at: '', updated_at: '' });
 render(<BaselinePage />);
 const open = await screen.findByRole('button', { name: '校正内置 CNV 基线' });
 await waitFor(() => expect(open).toBeEnabled());
 fireEvent.click(open);
 fireEvent.change(screen.getByPlaceholderText('如 GRCh38-WES-normal-2026Q3'), { target: { value: 'New baseline' } });
 fireEvent.click(screen.getByRole('button', { name: '选择样本组' }));
 expect(screen.queryByRole('checkbox', { name: /C_R1/ })).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('checkbox', { name: /B.*Read1/ }));
 fireEvent.click(screen.getByRole('checkbox', { name: /A.*Read1/ }));
 expect(screen.getByText('预计消耗 8 积分')).toBeInTheDocument();
 const preview = screen.getByRole('table', { name: '已选样本组 · Read1/Read2 同组提交' });
 expect(within(preview).getAllByRole('row')[1]).toHaveTextContent('B_R1.fastq.gzB_R2.fastq.gz');
 fireEvent.click(screen.getByRole('button', { name: '选择样本组' }));
 fireEvent.keyDown(screen.getByText('选择 BED 文件').closest('button')!, { key: 'ArrowDown' });
 fireEvent.keyDown(await screen.findByRole('option', { name: /normal.bed/ }), { key: 'Enter' });
 fireEvent.click(screen.getByRole('button', { name: '启动校正流程' }));
 await waitFor(() => expect(createCNVBaseline).toHaveBeenCalledWith({ name: 'New baseline', reference_genome: 'GRCh38', bed_asset_id: 'bed', read1_asset_ids: ['b1', 'a1'], read2_asset_ids: ['b2', 'a2'] }));
}, 60000);

it.each(['octopus', 'squid'])('shows searchable, copyable built-in and custom baseline IDs in %s', async backend => {
 mode.backend = backend;
 const id = 'b71a0364-5922-40f8-ac96-18be0b99312b';
 vi.mocked(listCNVBaselines).mockResolvedValue([{id, task_id: 'calibration-task', name: 'Custom baseline', reference_genome: 'GRCh38', status: 'completed', progress: 100, read_pairs: [], bed: {id: 'bed', file_name: 'test.bed'}, input_bytes: 0, credit_cost: 0, credits_charged: 0, created_at: '', updated_at: ''}]);
 const writeText = vi.fn().mockResolvedValue(undefined);
 Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText}});
 render(<BaselinePage />);
 const cell = await screen.findByText(id);
 expect(screen.getByRole('columnheader', {name: '基线 ID'})).toBeInTheDocument();
 await act(async () => { fireEvent.click(cell); });expect(writeText).toHaveBeenCalledWith(id);
 const builtIn = screen.getByText('builtin-cnv-baseline-hg38');
 await act(async () => { fireEvent.click(builtIn); });expect(writeText).toHaveBeenCalledWith('builtin-cnv-baseline-hg38');
 fireEvent.change(screen.getByPlaceholderText('搜索名称、基因组或 BED...'), {target: {value: id}});
 expect(screen.getByText('Custom baseline')).toBeInTheDocument();
 expect(screen.queryByText('builtin-cnv-baseline-hg38')).not.toBeInTheDocument();
});
