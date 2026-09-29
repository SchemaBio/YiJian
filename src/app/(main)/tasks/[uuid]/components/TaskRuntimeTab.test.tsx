import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tasksApi } from '@/lib/tasks';
import type { TaskProgressResponse } from '@/types/task';
import { TaskRuntimeTab } from './TaskRuntimeTab';

vi.mock('@/lib/tasks', () => ({
  tasksApi: {
    getProgress: vi.fn(),
    getLogs: vi.fn(),
    retryResultImport: vi.fn(),
  },
}));

const getProgress = vi.mocked(tasksApi.getProgress);
const getLogs = vi.mocked(tasksApi.getLogs);
const retryResultImport = vi.mocked(tasksApi.retryResultImport);

function progressResponse(overrides: Partial<TaskProgressResponse> = {}): TaskProgressResponse {
  return {
    id: 'task-1',
    uuid: 'task-1',
    name: 'SingleWES',
    template: 'SingleWES',
    status: 'running',
    progress: 42,
    created_at: '2026-09-29T00:00:00Z',
    ...overrides,
  };
}

describe('TaskRuntimeTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLogs.mockResolvedValue('');
  });

  it('shows analysis, node and Agent liveness as independent states and refreshes them', async () => {
    getProgress
      .mockResolvedValueOnce(progressResponse({
        analysis_progress: {
          percent: 42,
          profile_version: 'germline-v2-progress-1',
          active_stages: ['alignment'],
          stages: [{ code: 'alignment', label: '预处理与比对', weight: 30, percent: 50, status: 'running' }],
        },
        node_liveness: { state: 'delayed', last_seen_at: '2026-09-29T00:00:00Z' },
        agent_liveness: {
          state: 'online',
          last_collected_at: '2026-09-29T00:00:01Z',
          last_progress_push_at: '2026-09-29T00:00:02Z',
          collection_status: 'ok',
        },
      }))
      .mockResolvedValueOnce(progressResponse({
        analysis_progress: {
          percent: 43,
          profile_version: 'germline-v2-progress-1',
          active_stages: ['alignment'],
          stages: [{ code: 'alignment', label: '预处理与比对', weight: 30, percent: 55, status: 'running' }],
        },
        node_liveness: { state: 'delayed', last_seen_at: '2026-09-29T00:00:00Z' },
        agent_liveness: {
          state: 'offline',
          last_collected_at: '2026-09-29T00:00:01Z',
          last_progress_push_at: '2026-09-29T00:00:02Z',
          collection_status: 'error',
          error_code: 'collection_failed',
        },
      }));

    render(<TaskRuntimeTab taskId="task-1" initialStatus="running" />);

    const analysisHeading = await screen.findByRole('heading', { name: '分析进度' });
    expect(analysisHeading).toBeInTheDocument();
    expect(screen.getByText('正在进行：预处理与比对')).toBeInTheDocument();

    const nodePanel = screen.getByRole('heading', { name: '计算节点' }).closest('.yj-panel');
    const agentPanel = screen.getByRole('heading', { name: 'Sepiida Agent' }).closest('.yj-panel');
    expect(nodePanel).not.toBeNull();
    expect(agentPanel).not.toBeNull();
    expect(within(nodePanel as HTMLElement).getByText('延迟')).toBeInTheDocument();
    expect(within(agentPanel as HTMLElement).getByText('在线')).toBeInTheDocument();
    expect(within(agentPanel as HTMLElement).getByText(/最近采集：/)).toBeInTheDocument();
    expect(within(agentPanel as HTMLElement).getByText(/最近进度上报：/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    await waitFor(() => {
      expect(within(agentPanel as HTMLElement).getByText('离线')).toBeInTheDocument();
      expect(within(agentPanel as HTMLElement).getByText(/最近一次采集异常/)).toBeInTheDocument();
    });
    expect(getProgress).toHaveBeenCalledTimes(2);
  });

  it('renders legacy progress responses without liveness fields', async () => {
    getProgress.mockResolvedValue(progressResponse({
      status: 'failed',
      progress: 0,
      execution_phase: 'terminal',
    }));

    render(<TaskRuntimeTab taskId="task-1" initialStatus="failed" />);

    expect(await screen.findByText(/工作流：SingleWES/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '计算节点' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sepiida Agent' })).not.toBeInTheDocument();
    expect(screen.getByText('分析进度')).toBeInTheDocument();
  });

  it('recovers a failed structured import from the archived attempt', async () => {
    getProgress
      .mockResolvedValueOnce(progressResponse({ status: 'completed', result_import_status: 'failed', result_import_attempts: 1 }))
      .mockResolvedValueOnce(progressResponse({ status: 'completed', result_import_status: 'success', result_import_attempts: 2 }));
    retryResultImport.mockResolvedValue(progressResponse({ status: 'completed', result_import_status: 'success', result_import_attempts: 2 }));
    const onResultImportChange = vi.fn().mockResolvedValue(undefined);

    render(<TaskRuntimeTab taskId="task-1" initialStatus="completed" onResultImportChange={onResultImportChange} />);

    fireEvent.click(await screen.findByRole('button', { name: '重新导入结果' }));
    await waitFor(() => expect(retryResultImport).toHaveBeenCalledWith('task-1'));
    await waitFor(() => expect(onResultImportChange).toHaveBeenCalledTimes(1));
  });

  it('offers recovery when an old completed task is still marked importing', async () => {
    getProgress.mockResolvedValue(progressResponse({ status: 'completed', result_import_status: 'running', result_import_attempts: 1 }));

    render(<TaskRuntimeTab taskId="task-1" initialStatus="completed" />);

    expect(await screen.findByRole('button', { name: '恢复导入' })).toBeInTheDocument();
  });
});
