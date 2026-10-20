import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NewTaskModal } from './NewTaskModal';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

vi.mock('@/lib/runtime-config', () => ({ getRuntimeBackendFlavor: vi.fn(() => 'squid') }));
vi.mock('@/lib/task-resources', async importOriginal => ({...await importOriginal<typeof import('@/lib/task-resources')>(),
  samplesApi: { list: vi.fn(async () => [{ id: 'sample-1', internalId: 'research-001' }]) },
  pipelinesApi: { list: vi.fn(async () => [{ id: 'pipeline-1', name: 'Research pipeline', template: 'single' }]) },
  templatesApi: { list: vi.fn(async () => []) },
}));
vi.mock('@/lib/resource-pages',()=>({readResourcePage:vi.fn(async()=>({items:[{id:'sample-1',internal_id:'research-001'}],total:1}))}));
vi.mock('@/lib/billing', () => ({
  getBillingBalance: vi.fn(async () => null),
  getBillingConfig: vi.fn(async () => null),
  calculateEstimatedCredits: vi.fn(() => null),
}));
vi.mock('@/lib/tasks', () => ({ tasksApi: { estimate: vi.fn(async () => ({ estimated_minutes: 60 })) } }));

beforeEach(() => {
  vi.mocked(getRuntimeBackendFlavor).mockReturnValue('squid');
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

it('requires retention acknowledgment before creating a SaaS task and resets on reopen', async () => {
  const submit = vi.fn().mockResolvedValue(undefined);
  const props = { onClose: vi.fn(), onSubmit: submit };
  const { rerender } = render(<NewTaskModal isOpen {...props} />);
  fireEvent.click(await screen.findByText('research-001', { exact: false }));
  const create = screen.getByRole('button', { name: '创建任务' });
  await waitFor(() => expect(screen.queryByText('正在加载样本和流水线...')).not.toBeInTheDocument());
  expect(create).toBeDisabled();
  fireEvent.click(create);
  expect(submit).not.toHaveBeenCalled();
  const checkbox = screen.getByRole('checkbox', { name: '我已阅读并了解上述保留期限。' });
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ sampleId: 'sample-1' })));
  rerender(<NewTaskModal isOpen={false} {...props} />);
  rerender(<NewTaskModal isOpen {...props} />);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});

it('keeps self-hosted task creation available without the SaaS acknowledgment', async () => {
  vi.mocked(getRuntimeBackendFlavor).mockReturnValue('octopus');
  render(<NewTaskModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);
  fireEvent.click(await screen.findByText('research-001', { exact: false }));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: '创建任务' })).toBeEnabled());
});
