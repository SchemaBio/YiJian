import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import SamplesPage from './page';
import { listSamples } from '@/lib/samples';
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
