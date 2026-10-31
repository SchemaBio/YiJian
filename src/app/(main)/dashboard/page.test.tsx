import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardPage from './page';
import { api } from '@/lib/api';
import { tasksApi } from '@/lib/tasks';
import type { AnalysisTask } from '@/types/task';

const auth = vi.hoisted(() => ({ user: { id: 'user-1', name: '示例用户' }, currentOrg: { id: 'org-1' } }));
vi.mock('@/components/providers/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/lib/tasks', () => ({ tasksApi: { list: vi.fn(), getStats: vi.fn() } }));

beforeEach(() => {
  vi.resetAllMocks();
  auth.currentOrg = { id: 'org-1' };
});
afterEach(() => { delete window.__YIJIAN_CONFIG__; });

it.each([['octopus', '/tasks'], ['squid', '/tasks/new']] as const)('routes the %s new-task shortcut to %s',async(backend,href)=>{
  window.__YIJIAN_CONFIG__={BACKEND:backend};
  availableStats();
  vi.mocked(tasksApi.list).mockResolvedValue(taskList([]));
  render(<DashboardPage/>);
  await act(async()=>{});
  expect(screen.getByRole('link',{name:'新建任务'})).toHaveAttribute('href',href);
});

function task(id: string, status: AnalysisTask['status'], interpretationCompletedAt?: string): AnalysisTask {
  return { id, internalId: id, sampleId: '', pipeline: 'WES', pipelineVersion: '1', status, progress: 50, createdAt: '2026-10-12T00:00:00Z', createdBy: 'user-1', interpretationCompletedAt };
}

function availableStats() {
  vi.mocked(api.get).mockResolvedValue({});
  vi.mocked(tasksApi.getStats).mockResolvedValue({ total_tasks: 0, running_tasks: 0, failed_last_24h: 0, status_distribution: {}, result_import_failed_last_7d: 0, window_start: '' });
}

function taskList(items: AnalysisTask[]) {
  return { items, total: items.length, page: 1, page_size: 6, total_pages: 1 };
}

it('shows reported initialization progress on the dashboard before analysis starts', async () => {
  availableStats();
  vi.mocked(tasksApi.list).mockResolvedValue(taskList([{ ...task('initializing', 'queued'), progress: 0, executionPhase: 'bootstrapping', bootstrapPhase: 'references', resultImportStatus: 'pending' }]));
  render(<DashboardPage />);
  expect(await screen.findByRole('progressbar', { name: '任务总进度' })).toHaveAttribute('aria-valuenow', '14');
  expect(screen.getByText('正在准备参考数据')).toBeVisible();
});

it('does not turn unavailable dashboard data into zero-count hints or an empty task list', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('stats unavailable'));
  vi.mocked(tasksApi.list).mockRejectedValue(new Error('tasks unavailable'));
  vi.mocked(tasksApi.getStats).mockRejectedValue(new Error('metrics unavailable'));
  render(<DashboardPage />);
  await screen.findByRole('alert');
  expect(screen.queryByText('0 个等待数据')).not.toBeInTheDocument();
  expect(screen.queryByText('0 个发生于 24 小时内')).not.toBeInTheDocument();
  expect(screen.queryByText('暂无任务')).not.toBeInTheDocument();
  expect(screen.getByText('最近任务暂不可用')).toBeInTheDocument();
});

it('uses task-center labels for analysis, interpretation completion and pending interpretation', async () => {
  availableStats();
  vi.mocked(tasksApi.list).mockResolvedValue(taskList([task('analysis', 'completed'), task('interpretation', 'completed', '2026-10-12T01:00:00Z'), task('pending', 'pending_interpretation')]));
  render(<DashboardPage />);
  expect(await screen.findByText('分析完成')).toHaveAttribute('data-status', 'completed');
  expect(screen.getByText('解读完成')).toHaveAttribute('data-status', 'interpretation_completed');
  expect(screen.getByText('待解读')).toHaveAttribute('data-status', 'pending_interpretation');
});

it('refreshes on an interval and focus, pauses while hidden and removes listeners on unmount', async () => {
  availableStats();
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.mocked(tasksApi.list).mockResolvedValue(taskList([task('changing', 'running')]));
  const view = render(<DashboardPage />);
  try {
    await act(async () => {});
    vi.mocked(tasksApi.list).mockResolvedValue(taskList([task('changing', 'completed')]));
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(screen.getByText('分析完成')).toBeInTheDocument();
    visibility.mockReturnValue('hidden');
    const calls = vi.mocked(tasksApi.list).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(tasksApi.list).toHaveBeenCalledTimes(calls);
    vi.mocked(tasksApi.list).mockResolvedValue(taskList([task('changing', 'completed', '2026-10-12T01:00:00Z')]));
    visibility.mockReturnValue('visible');
    await act(async () => { fireEvent(window, new Event('focus')); });
    expect(screen.getByText('解读完成')).toBeInTheDocument();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); fireEvent(window, new Event('focus')); });
    expect(tasksApi.list).toHaveBeenCalledTimes(calls + 1);
  } finally {
    view.unmount(); visibility.mockRestore(); vi.useRealTimers();
  }
});

it('does not restore stale tasks when organization context changes during a request', async () => {
  availableStats();
  let finishOld!: (value: ReturnType<typeof taskList>) => void;
  vi.mocked(tasksApi.list).mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(taskList([task('new-org-task', 'completed')]));
  const view = render(<DashboardPage />);
  auth.currentOrg = { id: 'org-2' };
  view.rerender(<DashboardPage />);
  await screen.findByText('new-org-task');
  await act(async () => { finishOld(taskList([task('old-org-task', 'running')])); });
  expect(screen.queryByText('old-org-task')).not.toBeInTheDocument();
});
