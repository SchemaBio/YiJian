import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import PipelinePage from './page';
import { readResourcePages } from '@/lib/resource-pages';
let translator = createTextTranslator('zh-CN');
vi.mock('@/i18n/useText', () => ({ useText: () => translator }));
beforeEach(() => { translator = createTextTranslator('zh-CN'); });

vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user' }, currentOrg: { id: 'org' } }) }));
vi.mock('@/lib/resource-pages', () => ({ readResourcePages: vi.fn() }));
vi.mock('@/lib/data-assets', () => ({ listAllBEDAssets: vi.fn(async () => []) }));
vi.mock('@/lib/cnv-baselines', () => ({ listCNVBaselines: vi.fn(async () => []) }));

it('keeps resource-load failures distinct from an empty pipeline list and supports retry', async () => {
  vi.mocked(readResourcePages).mockRejectedValueOnce(new Error('资源读取失败')).mockResolvedValueOnce([]);
  render(<PipelinePage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('资源读取失败');
  expect(screen.queryByText('暂无分析流程')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByText('暂无分析流程');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(readResourcePages).toHaveBeenCalledTimes(2);
});

it('updates built-in table names and search when the interface language changes', async () => {
  vi.mocked(readResourcePages).mockResolvedValue([{ id: 'builtin-wes-single-hg38', name: 'WES单样本分析（hg38）', is_builtin: true, reference_genome: 'hg38' }]);
  const { rerender } = render(<PipelinePage />);
  await screen.findByText('WES单样本分析（hg38）');
  translator = createTextTranslator('en');
  rerender(<PipelinePage />);
  await screen.findByText('WES single-sample analysis (hg38)');
  fireEvent.change(screen.getByPlaceholderText(translator('pipeline.searchPipelinesa96425')), { target: { value: 'single-sample' } });
  expect(screen.getByText('WES single-sample analysis (hg38)')).toBeInTheDocument();
});
