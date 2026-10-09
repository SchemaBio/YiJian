import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ReportTab } from './ReportTab';
import { reportsApi } from '@/lib/reports';

vi.mock('./RawResultDownloads', () => ({ RawResultDownloads: () => null }));
vi.mock('@/lib/reports', () => ({ reportsApi: { listTemplates: vi.fn(), listGenerations: vi.fn(async () => []) }, saveDownload: vi.fn() }));

it('shows a retryable template failure without a false empty-service message', async () => {
  vi.mocked(reportsApi.listTemplates).mockRejectedValueOnce(new Error('服务读取失败')).mockResolvedValueOnce([]);
  render(<ReportTab taskId="task" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('服务读取失败');
  expect(screen.queryByText('暂无可用报告服务')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByText('暂无可用报告服务');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(reportsApi.listTemplates).toHaveBeenCalledTimes(2);
});
