import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ConfigPage from './page';
import { listPipelines, type Pipeline } from '@/lib/pipelines';
vi.mock('@/lib/pipelines', () => ({ listPipelines: vi.fn() }));
it('does not claim configuration is empty when reading fails and supports refresh', async () => {
  vi.mocked(listPipelines).mockRejectedValueOnce(new Error('配置读取失败')).mockResolvedValueOnce([]);
  render(<ConfigPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('配置读取失败');
  expect(screen.queryByText('暂无流程配置')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  await screen.findByText('暂无流程配置');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('retains the last successful configuration when a refresh fails', async () => {
  const pipeline: Pipeline = { id: 'synthetic-pipeline', name: '示例 WES', basePipelineId: '', baseType: 'wes_single', version: 'v1', description: '', bedFile: 'synthetic.bed', referenceGenome: 'GRCh38', cnvBaseline: '', bedAssetId: '', cnvBaselineId: '', isBuiltin: false, status: 'active', createdAt: '', updatedAt: '', resourceAvailable: true, resourceError: '' };
  vi.mocked(listPipelines).mockResolvedValueOnce([pipeline]).mockRejectedValueOnce(new Error('刷新失败'));
  render(<ConfigPage />);
  await screen.findByRole('heading', { name: '示例 WES' });
  fireEvent.click(screen.getByRole('button', { name: '刷新' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('刷新失败');
  expect(screen.getByRole('heading', { name: '示例 WES' })).toBeInTheDocument();
  expect(screen.getByText('synthetic-pipeline')).toBeInTheDocument();
  expect(screen.queryByText('暂无流程配置')).not.toBeInTheDocument();
});
