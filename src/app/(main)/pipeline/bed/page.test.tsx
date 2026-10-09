import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BedPage from './page';
import { uploadBEDFile } from '@/lib/data-assets';

vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' }, currentOrg: null }) }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'octopus' }));
vi.mock('@/lib/builtin-resources', () => ({ BUILTIN_BED_ASSETS: [] }));
vi.mock('@/lib/data-assets', () => ({
  listAllBEDAssets: vi.fn(async () => []),
  getDataCenterConfig: vi.fn(async () => ({ temporary: false })),
  getUploadStorageStats: vi.fn(async () => ({ total_bytes: 0 })),
  uploadBEDFile: vi.fn(), deleteDataAsset: vi.fn(), validateBEDAsset: vi.fn(),
}));

it('locks file selection during upload and retains the file for retry after failure', async () => {
  let rejectUpload!: (reason: Error) => void;
  vi.mocked(uploadBEDFile).mockImplementationOnce((_file, _genome, _acknowledged, onProgress) => {
    onProgress?.(37);
    return new Promise((_resolve, reject) => { rejectUpload = reject; });
  });
  render(<BedPage />);
  await screen.findByText('暂无 BED 文件');
  fireEvent.click(screen.getByRole('button', { name: '上传 BED 文件' }));
  const file = new File(['chr1\t0\t100\n'], 'synthetic.bed');
  const picker = screen.getByLabelText('BED 文件');
  fireEvent.change(picker, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: '开始上传' }));
  expect(await screen.findByRole('button', { name: '上传中 37%' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '选择BED 文件' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
  await act(async () => rejectUpload(new Error('上传连接中断')));
  expect(await screen.findByRole('alert')).toHaveTextContent('上传连接中断');
  expect(screen.getByText('synthetic.bed')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '开始上传' })).toBeEnabled();
  fireEvent.change(picker, { target: { files: [file] } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('synthetic.bed')).toBeInTheDocument();
  expect(uploadBEDFile).toHaveBeenCalledTimes(1);
});
