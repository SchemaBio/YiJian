import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import BedPage from './bed/page';
import BaselinePage from './baseline/page';
import GeneListPage from './gene-list/page';
import { listAllBEDAssets } from '@/lib/data-assets';
import { listCNVBaselines } from '@/lib/cnv-baselines';
import { listGeneLists } from '@/lib/gene-lists';

vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user' }, currentOrg: { id: 'org' } }) }));
vi.mock('@/lib/builtin-resources', () => ({ BUILTIN_BED_ASSETS: [], BUILTIN_CNV_BASELINES: [] }));
vi.mock('@/lib/data-assets', () => ({
  listAllBEDAssets: vi.fn(), getDataCenterConfig: vi.fn(async () => ({})), getUploadStorageStats: vi.fn(async () => ({ total_bytes: 0 })),
  listDataAssets: vi.fn(async () => ({ items: [], total_pages: 1 })), deleteDataAsset: vi.fn(), validateBEDAsset: vi.fn(), uploadBEDFile: vi.fn(),
}));
vi.mock('@/lib/cnv-baselines', () => ({ listCNVBaselines: vi.fn(), createCNVBaseline: vi.fn() }));
vi.mock('@/lib/billing', () => ({ getBillingConfig: vi.fn(async () => ({})) }));
vi.mock('@/lib/gene-lists', () => ({ listGeneLists: vi.fn(), createGeneList: vi.fn(), publishGeneList: vi.fn(), deleteGeneList: vi.fn(), updateGeneList: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it.each([
  ['BED', BedPage, listAllBEDAssets, '暂无 BED 文件'],
  ['基线', BaselinePage, listCNVBaselines, '暂无 CNV 基线'],
  ['基因列表', GeneListPage, listGeneLists, '暂无基因列表'],
] as const)('%s keeps read failure separate from empty results and recovers on retry', async (_name, Page, read, emptyText) => {
  vi.mocked(read).mockRejectedValueOnce(new Error('读取失败')).mockResolvedValueOnce([]);
  render(<Page />);
  await screen.findByRole('alert');
  expect(screen.queryByText(emptyText)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await screen.findByText(emptyText);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(read).toHaveBeenCalledTimes(2);
});
