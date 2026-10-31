import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './page';
import { tasksApi } from '@/lib/tasks';
import { useInterpretationReadOnly } from './components/InterpretationLock';

vi.mock('next/navigation', () => ({ useParams: () => ({ uuid: 'task' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/tasks', () => ({ tasksApi: { get: vi.fn(), getSample: vi.fn(), setInterpretationCompleted: vi.fn() } }));
vi.mock('@/components/layout', () => ({ PageContent: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('./result-api', () => ({ getResultContext: vi.fn().mockResolvedValue({ state: 'ready', reference: {} }) }));
vi.mock('./hooks/useTabState', () => ({ useTabState: () => ({ activeTab: 'overview', hasExplicitTab: true, setActiveTab: vi.fn() }) }));
vi.mock('./components/AssessmentStatusBar', () => ({ AssessmentStatusBar: () => null }));
vi.mock('./components/TaskRuntimeTab', () => ({ TaskRuntimeTab: ({ taskId }: { taskId: string }) => <section aria-label="任务运行进度">{taskId}</section> }));
vi.mock('./components', () => ({
  TaskHeader: ({ completionControl }: { completionControl: React.ReactNode }) => <header>{completionControl}</header>,
  ResultTabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResultOverview: () => <button disabled={useInterpretationReadOnly()}>修改判读</button>,
}));

const openTask = { id: 'task', status: 'completed', attemptId: 'attempt' };
const closedTask = { ...openTask, interpretationCompletedAt: '2026-10-09T08:00:00Z' };

describe('task interpretation completion control', () => {
  beforeEach(() => {
    vi.mocked(tasksApi.get).mockReset().mockResolvedValue(openTask as never);
    vi.mocked(tasksApi.getSample).mockResolvedValue(null as never);
    vi.mocked(tasksApi.setInterpretationCompleted).mockReset();
  });

  it('opens the runtime progress view for queued tasks instead of interpretation results', async () => {
    vi.mocked(tasksApi.get).mockResolvedValue({ ...openTask, status: 'queued', executionPhase: 'bootstrapping' } as never);
    render(<Page />);
    expect(await screen.findByRole('region', { name: '任务运行进度' })).toHaveTextContent('task');
    expect(screen.queryByRole('button', { name: '修改判读' })).toBeNull();
    expect(tasksApi.getSample).not.toHaveBeenCalled();
  });

  it('finishes and reopens with the current attempt and restores editing', async () => {
    vi.mocked(tasksApi.setInterpretationCompleted).mockResolvedValueOnce(closedTask as never).mockResolvedValueOnce(openTask as never);
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: '解读未完成，点击完成' }));
    await screen.findByRole('button', { name: '已解读完成，点击取消' });
    expect(tasksApi.setInterpretationCompleted).toHaveBeenLastCalledWith('task', true, 'attempt');
    expect(screen.getByRole('button', { name: '修改判读' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('当前为只读');
    fireEvent.click(screen.getByRole('button', { name: '已解读完成，点击取消' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '修改判读' })).toBeEnabled());
    expect(tasksApi.setInterpretationCompleted).toHaveBeenLastCalledWith('task', false, 'attempt');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignores a stale refresh that resolves after completing interpretation', async () => {
    render(<Page />);
    await screen.findByRole('button', { name: '解读未完成，点击完成' });
    let resolve!: (value: unknown) => void;
    vi.mocked(tasksApi.get).mockImplementationOnce(() => new Promise(done => { resolve = done as never; }));
    fireEvent(window, new Event('focus'));
    vi.mocked(tasksApi.setInterpretationCompleted).mockResolvedValue(closedTask as never);
    fireEvent.click(screen.getByRole('button', { name: '解读未完成，点击完成' }));
    await screen.findByRole('button', { name: '已解读完成，点击取消' });
    await act(async () => { resolve(openTask); });
    expect(screen.getByRole('button', { name: '修改判读' })).toBeDisabled();
  });

  it('shows a rejected completion and keeps editing available', async () => {
    vi.mocked(tasksApi.setInterpretationCompleted).mockRejectedValue(new Error('任务执行批次已变更'));
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: '解读未完成，点击完成' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('任务执行批次已变更');
    expect(screen.getByRole('button', { name: '修改判读' })).toBeEnabled();
  });
});
