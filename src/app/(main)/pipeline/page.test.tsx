import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PipelinePage from './page';
import { readResourcePages } from '@/lib/resource-pages';

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
