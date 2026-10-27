import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ flavor: 'squid', org: 'org-a', get: vi.fn() }));
vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: () => mocks.flavor }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user' }, currentOrg: { id: mocks.org } }) }));
vi.mock('@/lib/api', () => ({ api: { get: mocks.get } }));
vi.mock('next/navigation', () => ({ usePathname: () => '/samples' }));
import { ExampleBadge, ExampleDataNotice } from './ExampleData';
beforeEach(() => { mocks.flavor = 'squid'; mocks.org = 'org-a'; mocks.get.mockReset(); });
afterEach(cleanup);

it('does not render or request templates in self-hosted deployments', () => {
  mocks.flavor = 'octopus';
  render(<><ExampleBadge origin="example" /><ExampleDataNotice /></>);
  expect(screen.queryByText('示例')).toBeNull();
  expect(mocks.get).not.toHaveBeenCalled();
});

it('shows seven-day expiry while keeping the remaining results accessible', async () => {
  mocks.get.mockResolvedValue({ status: 'ready', sample_id: 'sample', task_id: 'task', data_expires_at: '2020-01-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z' });
  render(<ExampleDataNotice />);
  expect(await screen.findByText(/FASTQ\/BAM 已到期/)).toBeInTheDocument();
  expect(mocks.get).toHaveBeenCalledWith('/v1/auth/example-data', expect.objectContaining({ coreApi: true }));
  expect(screen.getByRole('link', { name: '查看分析结果' })).toHaveAttribute('href', '/tasks/task');
});

it('discards a late response from the previous organization', async () => {
  let resolve!: (value: unknown) => void;
  mocks.get.mockImplementationOnce(() => new Promise(value => { resolve = value; })).mockResolvedValue({ status: 'not_selected' });
  const view = render(<ExampleDataNotice />);
  mocks.org = 'org-b'; view.rerender(<ExampleDataNotice />);
  resolve({ status: 'ready', sample_id: 'private-sample', task_id: 'private-task' });
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('link', { name: '查看分析结果' })).toBeNull();
});
