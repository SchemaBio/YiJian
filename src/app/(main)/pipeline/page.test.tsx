import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import PipelinePage from './page';
import { readResourcePages } from '@/lib/resource-pages';
const mode = vi.hoisted(() => ({ backend: 'octopus' }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => mode.backend }));
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
  expect(screen.getByText('builtin-wes-single-hg38')).toBeInTheDocument();
  translator = createTextTranslator('en');
  rerender(<PipelinePage />);
  await screen.findByText('WES single-sample analysis (hg38)');
  fireEvent.change(screen.getByPlaceholderText(translator('pipeline.searchPipelinesa96425')), { target: { value: 'single-sample' } });
  expect(screen.getByText('WES single-sample analysis (hg38)')).toBeInTheDocument();
});

it.each(['octopus', 'squid'])('shows and copies the actual full pipeline ID in %s', async backend => {
  mode.backend = backend;
  const id = 'd3189181-2398-4a45-938a-437fa699790f';
  vi.mocked(readResourcePages).mockResolvedValue([{ id, name: 'Custom pipeline', reference_genome: 'hg38' }]);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {writeText} });
  render(<PipelinePage />);
  const cell = await screen.findByText(id);
  expect(screen.getByRole('columnheader', {name: '流程 ID'})).toBeInTheDocument();
  await act(async () => { fireEvent.click(cell); });
  expect(writeText).toHaveBeenCalledWith(id);
  fireEvent.change(screen.getByPlaceholderText(translator('pipeline.searchPipelinesa96425')), {target: {value: id}});
  expect(screen.getByText('Custom pipeline')).toBeInTheDocument();
});
