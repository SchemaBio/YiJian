import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ReportTab } from './ReportTab';
import { reportsApi, saveDownload } from '@/lib/reports';

// Isolate report orchestration from Radix focus/scroll mechanics in JSDOM.
vi.mock('@schema/ui-kit', async importOriginal => {
  const actual = await importOriginal<typeof import('@schema/ui-kit')>();
  return { ...actual, Select: ({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => <select aria-label="报告服务" value={value} onChange={event => onChange(event.target.value)}><option value="">选择</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> };
});

vi.mock('./RawResultDownloads', () => ({ RawResultDownloads: () => null }));
vi.mock('@/lib/reports', () => ({ reportsApi: { generateTaskReport: vi.fn(), listTemplates: vi.fn(), listGenerations: vi.fn(async () => []) }, saveDownload: vi.fn() }));

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


it('recovers generation history separately from available report templates', async () => {
  vi.mocked(reportsApi.listTemplates).mockResolvedValue([]);
  vi.mocked(reportsApi.listGenerations).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([
    { id: 'record', state: 'ready', createdAt: '2026-10-09T00:00:00Z', errorCode: '', contractVersion: 'report-snapshot-v2' },
  ]);
  render(<ReportTab taskId="history-task" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('报告生成记录读取失败');
  fireEvent.click(screen.getByRole('button', { name: '重试读取记录' }));
  await screen.findByText('已生成');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});


it('downloads a generated report even if the following history refresh fails', async () => {
  vi.mocked(reportsApi.listTemplates).mockResolvedValue([{ id: 'template', name: '合成报告', description: '', contractVersion: 'report-snapshot-v2' }]);
  vi.mocked(reportsApi.listGenerations).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('history offline'));
  const download = { contentType: 'application/pdf', filename: 'report.pdf', blob: new Blob(['synthetic']) };
  vi.mocked(reportsApi.generateTaskReport).mockResolvedValue(download);
  render(<ReportTab taskId="download-task" />);
  await screen.findByText('合成报告');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'template' } });
  fireEvent.click(screen.getByRole('button', { name: '生成并下载' }));
  await screen.findByText('已下载：report.pdf');
  expect(saveDownload).toHaveBeenCalledWith(download);
  expect(await screen.findByRole('alert')).toHaveTextContent('报告生成记录读取失败');
  expect(screen.queryByRole('dialog', { name: '报告生成失败' })).not.toBeInTheDocument();
});
