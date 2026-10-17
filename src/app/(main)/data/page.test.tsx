import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import DataCenterPage from './page';
const mode=vi.hoisted(()=>({backend:'octopus'}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=>mode.backend}));
beforeEach(()=>{mode.backend='octopus';});
import { listDataAssets } from '@/lib/data-assets';
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ currentOrg: null, hasPermission: () => true }) }));
vi.mock('@/components/providers/UploadProvider', () => ({ useUpload: () => ({ activeUpload: null }) }));
vi.mock('@/lib/data-assets', () => ({
  listDataAssets: vi.fn(), getDataAssetUploadStatus: vi.fn(),
  getDataCenterConfig: vi.fn().mockResolvedValue({ temporary: false, download_allowed: true,provider:"local",local_import_directory:"/data" }),
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



it('exposes local information import and template download only for self-hosting',async()=>{
 vi.mocked(listDataAssets).mockResolvedValue({items:[],total:0,page:1,page_size:20,total_pages:0});
 const {unmount}=render(<DataCenterPage/>);
 expect(await screen.findByRole('button',{name:'批量信息上传'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'下载模板'})).toBeInTheDocument();unmount();
 mode.backend='squid';render(<DataCenterPage/>);
 await screen.findByText('暂无数据资产');
 expect(screen.queryByRole('button',{name:'批量信息上传'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'下载模板'})).not.toBeInTheDocument();
});
