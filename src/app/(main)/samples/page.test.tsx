import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import SamplesPage from './page';
import { listSamples } from '@/lib/samples';
import { downloadSampleList } from '@/lib/sample-export';
import type { Sample } from './types';
vi.mock('@/lib/sample-export', () => ({ downloadSampleList: vi.fn() }));
vi.mock('@/lib/samples', () => ({ listSamples: vi.fn(), normalizeSample: vi.fn(), samplePayload: vi.fn() }));
vi.mock('./components', () => ({ NewSampleModal: () => null, EditSampleModal: () => null, DataLinkModal: () => null }));
it('keeps failed reads distinct from empty samples and recovers on retry', async () => {
  vi.mocked(listSamples).mockRejectedValueOnce(new Error('样本读取失败')).mockResolvedValueOnce([]);
  render(<SamplesPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('样本读取失败');
  expect(screen.queryByText('暂无样本')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '批量导入' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await screen.findByText('暂无样本');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('搜索样本编号、内部编号、批次或诊断...'), { target: { value: 'missing' } });
  expect(screen.getByText('没有匹配的样本')).toBeInTheDocument();
});

it('exports only checked samples, including selections retained while searching', async () => {
  const sample = (id: string): Sample => ({ id, internalId: `INT-${id}`, gender: 'unknown', sampleType: '全血', batch: '', clinicalDiagnosis: '', hpoTerms: [], matchedPair: null, matchStatus: 'unmatched', matchMode: '', autoMatchEnabled: false, remark: '', createdAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-12T00:00:00Z' });
  const samples = [sample('selected'), sample('unselected')];
  vi.mocked(listSamples).mockResolvedValue(samples);
  render(<SamplesPage />);
  await screen.findByText('INT-selected');
  expect(screen.getByRole('button', { name: '导出已选样本' })).toBeDisabled();
  const row = screen.getByText('INT-selected').closest('tr')!;
  fireEvent.click(within(row).getByRole('checkbox'));
  fireEvent.change(screen.getByPlaceholderText('搜索样本编号、内部编号、批次或诊断...'), { target: { value: 'INT-unselected' } });
  fireEvent.click(screen.getByRole('button', { name: '导出已选样本 (1)' }));
  expect(downloadSampleList).toHaveBeenCalledWith([samples[0]]);
});
