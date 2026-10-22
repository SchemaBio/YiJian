import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import DataCenterPage from './page';
import type {GlobalUploadState} from '@/components/providers/UploadProvider';
import { LocalizedError } from '@/i18n/errors';
const uploads=vi.hoisted(()=>({activeUpload:null as GlobalUploadState|null,cancelUpload:vi.fn(),pruneFiles:vi.fn(),clearUpload:vi.fn(),refreshCapacity:vi.fn().mockResolvedValue({total:0,total_bytes:0,reserved_bytes:0,tracked_bytes:0}),startUpload:vi.fn()}));
const mode=vi.hoisted(()=>({backend:'octopus',quota:0}));
vi.mock('@/lib/runtime-config',()=>({getRuntimeBackendFlavor:()=>mode.backend}));
beforeEach(()=>{mode.backend='octopus';mode.quota=0;uploads.activeUpload=null;uploads.cancelUpload.mockClear();uploads.refreshCapacity.mockResolvedValue({total:0,total_bytes:0,reserved_bytes:0,tracked_bytes:0});uploads.startUpload.mockReset();});
import { listDataAssets, getDataAssetUploadStatus } from '@/lib/data-assets';
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ currentOrg: mode.quota ? {id:'org',storageQuotaBytes:mode.quota} : null, hasPermission: () => true }) }));
vi.mock('@/components/providers/UploadProvider', () => ({ useUpload: () => ({ activeUpload: uploads.activeUpload, cancelUpload: uploads.cancelUpload, pruneFiles: uploads.pruneFiles, clearUpload: uploads.clearUpload, refreshCapacity:uploads.refreshCapacity,startUpload:uploads.startUpload }) }));
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

it.each(['footer', 'close'])('allows hiding an active self-hosted upload via %s and reopening its progress', async control => {
 uploads.activeUpload={status:'uploading',progress:27,files:[],read1Name:'sample_R1.fastq.gz'};
 vi.mocked(listDataAssets).mockResolvedValue({items:[],total:0,page:1,page_size:20,total_pages:0});
 render(<DataCenterPage/>);
 const view=await screen.findByRole('button',{name:/查看上传/});
 fireEvent.click(view);
 const dialog=screen.getByRole('dialog');
 const hide=within(dialog).getByRole('button',{name:'隐藏到数据中心'});
 expect(hide).toBeEnabled();
 expect(within(dialog).getByText('27%')).toBeInTheDocument();
 fireEvent.click(control==='footer'?hide:within(dialog).getByRole('button',{name:'关闭弹窗'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(uploads.cancelUpload).not.toHaveBeenCalled();
 expect(uploads.activeUpload.status).toBe('uploading');
 fireEvent.click(screen.getByRole('button',{name:/查看上传/}));
 expect(within(screen.getByRole('dialog')).getByText('27%')).toBeInTheDocument();
});
it('keeps the upload window open during cancellation in self-hosting', async () => {
 uploads.activeUpload={status:'uploading',progress:27,files:[]};
 vi.mocked(listDataAssets).mockResolvedValue({items:[],total:0,page:1,page_size:20,total_pages:0});
 const {rerender}=render(<DataCenterPage/>);
 fireEvent.click(await screen.findByRole('button',{name:/查看上传/}));
 uploads.activeUpload={...uploads.activeUpload,status:'canceling'};rerender(<DataCenterPage/>);
 expect(within(screen.getByRole('dialog')).getByRole('button',{name:'隐藏到数据中心'})).toBeDisabled();
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'关闭弹窗'}));
 expect(screen.getByRole('dialog')).toBeInTheDocument();
});
it('preserves the existing SaaS upload window behavior', async () => {
 mode.backend='squid';uploads.activeUpload={status:'uploading',progress:27,files:[]};
 vi.mocked(listDataAssets).mockResolvedValue({items:[],total:0,page:1,page_size:20,total_pages:0});
 render(<DataCenterPage/>);
 fireEvent.click(await screen.findByRole('button',{name:/查看上传/}));
 expect(within(screen.getByRole('dialog')).getByRole('button',{name:'隐藏到数据中心'})).toBeEnabled();
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'隐藏到数据中心'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(uploads.cancelUpload).not.toHaveBeenCalled();
});

it('dismisses the recovery notice without discarding resumable metadata', async () => {
 uploads.activeUpload={status:'needs_file',progress:12,files:[{fileId:'r1',fileName:'R1.fastq',readType:'read1',progress:12,status:'failed'}]};
 vi.mocked(listDataAssets).mockResolvedValue({items:[],total:0,page:1,page_size:20,total_pages:0});
 vi.mocked(getDataAssetUploadStatus).mockResolvedValue({status:'failed'} as never);
 uploads.clearUpload.mockClear();
 render(<DataCenterPage/>);
 fireEvent.click(await screen.findByRole('button',{name:'关闭恢复提示'}));
 expect(screen.queryByText(/上次上传在浏览器刷新/)).not.toBeInTheDocument();
 expect(uploads.clearUpload).not.toHaveBeenCalled();
 expect(uploads.activeUpload.files).toHaveLength(1);
});

it('shows used, reserved and genuinely available storage together', async () => {
  mode.backend='squid'; mode.quota=30*1024**3;
  uploads.refreshCapacity.mockResolvedValue({total:2,total_bytes:20*1024**3,reserved_bytes:9*1024**3,tracked_bytes:0});
  vi.mocked(listDataAssets).mockResolvedValue({items:[],total:0,page:1,page_size:20,total_pages:0});
  render(<DataCenterPage/>);
  await screen.findByText('20.0 GB / 30.0 GB');
  expect(screen.getByText('上传中预留')).toBeInTheDocument();
  expect(screen.getByText('9.0 GB')).toBeInTheDocument();
  expect(screen.getByText('实际可用')).toBeInTheDocument();
  expect(screen.getByText('1.0 GB')).toBeInTheDocument();
});

it('keeps selected files and shows an admission error inside the upload window', async () => {
  mode.backend='squid'; mode.quota=30*1024**3;
  uploads.startUpload.mockRejectedValue(new LocalizedError('uploadCapacity.insufficient'));
  vi.mocked(listDataAssets).mockResolvedValue({items:[],total:0,page:1,page_size:20,total_pages:0});
  render(<DataCenterPage/>);
  await screen.findByText('暂无数据资产');
  fireEvent.click(screen.getByRole('button',{name:'上传数据'}));
  const dialog=screen.getByRole('dialog');
  const input=dialog.querySelector('input[type=file]')!;
  fireEvent.change(input,{target:{files:[new File(['r1'],'selected_R1.fastq')]}});
  fireEvent.click(within(dialog).getByRole('button',{name:'开始上传'}));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('可用容量不足');
  expect(within(dialog).getByText('selected_R1.fastq')).toBeInTheDocument();
  expect(uploads.startUpload).toHaveBeenCalledWith(expect.objectContaining({quotaBytes:mode.quota}));
});
