import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DataCenterPage from './page';
import { listDataAssets } from '@/lib/data-assets';
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ currentOrg: null }) }));
vi.mock('@/components/providers/UploadProvider', () => ({ useUpload: () => ({ activeUpload: null }) }));
vi.mock('@/lib/data-assets', () => ({
  listDataAssets: vi.fn(), getDataAssetUploadStatus: vi.fn(),
  getDataCenterConfig: vi.fn().mockResolvedValue({ temporary: false, download_allowed: true }),
  getUploadStorageStats: vi.fn().mockResolvedValue({ total_bytes: 0 }),
}));
it('distinguishes failed reads from an empty data center and retries', async () => {
  vi.mocked(listDataAssets).mockRejectedValueOnce(new Error('数据读取失败')).mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
  render(<DataCenterPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('数据读取失败');
  expect(screen.queryByText('暂无数据资产')).not.toBeInTheDocument();
  expect(screen.queryByText('0 B / 无限制')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await screen.findByText('暂无数据资产');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('0 B / 无限制')).toBeInTheDocument();
});


