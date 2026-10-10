import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { RawResultDownloads } from './RawResultDownloads';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), download: vi.fn() } }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => 'squid' }));
vi.mock('@schema/ui-kit', () => ({ Button: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => <button onClick={onClick} disabled={disabled}>{children}</button> }));
vi.mock('@/components/shared', () => ({ AppModal: ({ open, children, footer }: { open: boolean; children: React.ReactNode; footer: React.ReactNode }) => open ? <div role="dialog">{children}{footer}</div> : null }));

const quote = (kind: string) => ({ id: 'paid-grant', kind, filename: `sample.${kind}`, size_bytes: 100, credits: 1, charged_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3 * 3600_000).toISOString() });
const issued = (filename: string, expired = false) => ({ id: 'paid-grant', filename, url: `https://bucket.cos.ap-guangzhou.myqcloud.com/${filename}?signed=true`, credits_charged: 1, expires_at: new Date(Date.now() + (expired ? -60_000 : 1800_000)).toISOString(), grant_expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(), refresh_after: new Date(Date.now() - 60_000).toISOString(), remaining_issues: 11, traffic_limit_bps: 83886080, ip_bound: false });

beforeEach(() => { vi.clearAllMocks(); });

for (const kind of ['bam', 'zip']) {
  it(`recovers a paid ${kind} grant as a direct COS link without proxying file data`, async () => {
    vi.mocked(api.get).mockImplementation(async path => path.endsWith('/active') ? [quote(kind)] : { attempt_id: 'attempt', zip_status: 'ready', zip: { id: 'zip', filename: 'sample.zip', credits: 1, size_bytes: 100 }, bams: [], missing: [] });
    vi.mocked(api.post).mockResolvedValue(issued(`sample.${kind}`));
    render(<RawResultDownloads taskId="task" />);
    fireEvent.click(await screen.findByRole('button', { name: '取回已付费链接' }));
    fireEvent.click(screen.getByRole('button', { name: '取回下载链接' }));
    const link = await screen.findByRole('link', { name: '开始下载 / 续传' });
    expect(link).toHaveAttribute('href', `https://bucket.cos.ap-guangzhou.myqcloud.com/sample.${kind}?signed=true`);
    expect(api.download).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledWith('/v1/tasks/task/downloads/issue', { quote_id: 'paid-grant' });
    expect(screen.queryByText(/绑定申请 IP/)).not.toBeInTheDocument();
    expect(screen.getByText(/申请截止/)).toBeInTheDocument();
  });
}

it('keeps an expired link available for free refresh of the same paid grant', async () => {
  vi.mocked(api.get).mockImplementation(async path => path.endsWith('/active') ? [quote('bam')] : { attempt_id: 'attempt', zip_status: 'ready', bams: [], missing: [] });
  vi.mocked(api.post).mockResolvedValueOnce(issued('sample.bam', true)).mockResolvedValueOnce(issued('sample.bam'));
  render(<RawResultDownloads taskId="task" />);
  fireEvent.click(await screen.findByRole('button', { name: '取回已付费链接' }));
  fireEvent.click(screen.getByRole('button', { name: '取回下载链接' }));
  await screen.findByText('链接已到期，请免费刷新');
  expect(screen.queryByRole('link', { name: '开始下载 / 续传' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '免费刷新链接' }));
  await screen.findByRole('link', { name: '开始下载 / 续传' });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post).toHaveBeenLastCalledWith('/v1/tasks/task/downloads/issue', { quote_id: 'paid-grant' });
});
