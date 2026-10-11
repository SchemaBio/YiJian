import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import TemplatesPage from './page';
import { api } from '@/lib/api';
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user' }, currentOrg: { id: 'org' } }) }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
it('distinguishes template-read failure from missing configuration and recovers', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  render(<TemplatesPage />);
  await screen.findByRole('alert');
  expect(screen.queryByText('尚未配置报告服务')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试读取' }));
  await screen.findByText('尚未配置报告服务');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('keeps maintenance actions usable after disabling and re-enabling without a list reload', async () => {
  const template = { id: 'report-1', name: '报告测试', scope: 'organization', canMaintain: true, revision: 1, isActive: true, apiEndpoint: 'https://reports.invalid/generate', hasApiKey: true };
  vi.mocked(api.get).mockResolvedValue([template]);
  let finishDisable!: (result: unknown) => void;
  vi.mocked(api.put).mockImplementationOnce(() => new Promise(resolve => { finishDisable = resolve; }))
    .mockResolvedValueOnce({ ...template, revision: 3 });
  render(<TemplatesPage />);
  const disable = await screen.findByRole('button', { name: '停用' });
  expect(screen.getByRole('button', { name: '删除' })).toBeDisabled();
  fireEvent.click(disable);
  expect(screen.getByText('报告测试')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '编辑' })).toBeDisabled();
  finishDisable({ ...template, revision: 2, isActive: false });
  await waitFor(() => expect(screen.getByRole('button', { name: '删除' })).toBeEnabled());
  expect(screen.getByRole('button', { name: '编辑' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '启用' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '停用' })).toBeEnabled());
  expect(screen.getByRole('button', { name: '编辑' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '删除' })).toBeDisabled();
  expect(api.get).toHaveBeenCalledTimes(1);
});

it('removes sharing and protocol selection from report service maintenance', async () => {
 const template = { id: 'personal-report', name: '个人报告', scope: 'personal', canMaintain: true, revision: 1, isActive: false, apiEndpoint: 'https://reports.invalid/generate', hasApiKey: true };
 vi.mocked(api.get).mockResolvedValue([template]);
 vi.mocked(api.put).mockResolvedValue({ ...template, revision: 2 });
 render(<TemplatesPage />);
 fireEvent.click(await screen.findByRole('button', { name: '编辑' }));
 expect(screen.queryByRole('button', { name: '共享' })).not.toBeInTheDocument();
 expect(screen.queryByText('报告协议')).not.toBeInTheDocument();
 expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: '保存' }));
 await waitFor(() => expect(api.put).toHaveBeenCalledWith('/v1/report-templates/personal-report', expect.objectContaining({contractVersion: 'report-snapshot-v2'})));
});
