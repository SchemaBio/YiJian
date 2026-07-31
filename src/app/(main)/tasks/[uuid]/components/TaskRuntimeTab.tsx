'use client';

import * as React from 'react';
import { Button, Tag } from '@schema/ui-kit';
import { AlertCircle, Check, Clipboard, Clock3, FileText, Loader2, RefreshCw, Server } from 'lucide-react';
import { tasksApi } from '@/lib/tasks';
import type { TaskProgressResponse, TaskStatus } from '@/types/task';

interface TaskRuntimeTabProps {
  taskId: string;
  initialStatus: TaskStatus;
}

function formatTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'completed' || status === 'succeeded' || status === 'success') return 'success';
  if (status === 'failed' || status === 'error') return 'danger';
  if (status === 'running') return 'info';
  if (status === 'queued' || status === 'waiting_for_data' || status === 'pending') return 'warning';
  return 'neutral';
}

function areTaskProgressResponsesEqual(
  previous: TaskProgressResponse,
  next: TaskProgressResponse
): boolean {
  const previousTasks = previous.tasks ?? [];
  const nextTasks = next.tasks ?? [];
  const tasksEqual = previousTasks.length === nextTasks.length
    && previousTasks.every((task, index) => {
      const candidate = nextTasks[index];
      return task.id === candidate.id
        && task.workflow_id === candidate.workflow_id
        && task.name === candidate.name
        && task.job_name === candidate.job_name
        && task.status === candidate.status
        && task.start_time === candidate.start_time
        && task.end_time === candidate.end_time
        && task.stdout === candidate.stdout
        && task.stderr === candidate.stderr;
    });
  const sepiidaEqual = previous.sepiida === next.sepiida
    || (previous.sepiida !== undefined
      && next.sepiida !== undefined
      && previous.sepiida.id === next.sepiida.id
      && previous.sepiida.uuid === next.sepiida.uuid
      && previous.sepiida.name === next.sepiida.name
      && previous.sepiida.status === next.sepiida.status
      && previous.sepiida.start_time === next.sepiida.start_time
      && previous.sepiida.end_time === next.sepiida.end_time);

  return previous.id === next.id
    && previous.uuid === next.uuid
    && previous.name === next.name
    && previous.template === next.template
    && previous.status === next.status
    && previous.progress === next.progress
    && previous.created_at === next.created_at
    && previous.result_import_status === next.result_import_status
    && previous.result_import_error === next.result_import_error
    && previous.result_imported_at === next.result_imported_at
    && previous.result_import_attempts === next.result_import_attempts
    && sepiidaEqual
    && tasksEqual;
}

export function TaskRuntimeTab({ taskId, initialStatus }: TaskRuntimeTabProps) {
  const [progress, setProgress] = React.useState<TaskProgressResponse | null>(null);
  const [logs, setLogs] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const loadRuntime = React.useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError('');
    const [progressResult, logsResult] = await Promise.allSettled([
      tasksApi.getProgress(taskId),
      tasksApi.getLogs(taskId),
    ]);

    if (progressResult.status === 'fulfilled') {
      setProgress((previous) => (
        previous && areTaskProgressResponsesEqual(previous, progressResult.value)
          ? previous
          : progressResult.value
      ));
    } else {
      setError('任务运行状态暂时不可用');
    }

    if (logsResult.status === 'fulfilled') {
      setLogs(logsResult.value);
    } else if (progressResult.status === 'fulfilled') {
      setError('任务日志暂时不可用');
    }
    if (!background) setLoading(false);
  }, [taskId]);

  React.useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  React.useEffect(() => {
    const status = progress?.status || initialStatus;
    if (!['waiting_for_data', 'queued', 'running'].includes(status)) return;
    const timer = window.setInterval(() => void loadRuntime(true), 5000);
    return () => window.clearInterval(timer);
  }, [initialStatus, loadRuntime, progress?.status]);

  const handleCopy = async () => {
    if (!logs) return;
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('无法复制日志，请检查浏览器剪贴板权限');
    }
  };

  const value = Math.min(100, Math.max(0, progress?.progress ?? 0));
  const taskSteps = progress?.tasks ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="yj-section-title">运行状态</h3>
          <p className="mt-1 text-xs text-fg-muted">任务执行、结果入库与工作流日志</p>
        </div>
        <Button
          variant="secondary"
          size="small"
          leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          onClick={() => void loadRuntime()}
          disabled={loading}
        >
          刷新
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-warning-muted bg-warning-subtle px-3 py-2 text-sm text-warning-fg">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="yj-panel overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--yj-border-subtle)] md:grid-cols-4 md:divide-y-0">
          <RuntimeMetric icon={<Server className="h-4 w-4" />} label="任务状态" value={<Tag variant={statusVariant(progress?.status || initialStatus)}>{progress?.status || initialStatus}</Tag>} />
          <RuntimeMetric icon={<Clock3 className="h-4 w-4" />} label="执行进度" value={`${value}%`} />
          <RuntimeMetric icon={<FileText className="h-4 w-4" />} label="结果入库" value={progress?.result_import_status || '-'} />
          <RuntimeMetric icon={<RefreshCw className="h-4 w-4" />} label="入库尝试" value={String(progress?.result_import_attempts ?? 0)} />
        </div>
        <div className="border-t border-[var(--yj-border-subtle)] p-4">
          <div className="h-2 overflow-hidden rounded-full bg-canvas-inset">
            <div className="h-full rounded-full bg-accent-emphasis transition-[width]" style={{ width: `${value}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-fg-muted">
            <span>工作流：{progress?.template || progress?.name || '-'}</span>
            <span>创建时间：{formatTime(progress?.created_at)}</span>
          </div>
          {progress?.result_import_error && (
            <p className="mt-3 rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger-fg">{progress.result_import_error}</p>
          )}
        </div>
      </div>

      {taskSteps.length > 0 && (
        <section className="yj-panel overflow-hidden">
          <div className="yj-panel-header"><h3 className="yj-section-title">工作流步骤</h3></div>
          <div className="divide-y divide-[var(--yj-border-subtle)]">
            {taskSteps.map((step) => (
              <div key={step.id || step.name} className="grid grid-cols-[minmax(0,1fr)_110px_180px] items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-fg-default">{step.name || step.job_name}</div>
                  <div className="truncate text-xs text-fg-muted">{step.job_name || '-'}</div>
                </div>
                <Tag variant={statusVariant(step.status)}>{step.status || '-'}</Tag>
                <div className="text-right text-xs text-fg-muted">{formatTime(step.start_time)}{step.end_time ? ` - ${formatTime(step.end_time)}` : ''}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="yj-panel overflow-hidden">
        <div className="yj-panel-header">
          <div>
            <h3 className="yj-section-title">执行日志</h3>
            <p className="mt-1 text-xs text-fg-muted">最近一次工作流运行输出</p>
          </div>
          {logs && (
            <Button variant="secondary" size="small" leftIcon={copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />} onClick={() => void handleCopy()}>
              {copied ? '已复制' : '复制'}
            </Button>
          )}
        </div>
        {loading && !progress ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-fg-muted" /></div>
        ) : logs ? (
          <pre className="max-h-[520px] overflow-auto bg-[#111714] p-4 text-xs leading-5 text-[#dce8df]">{logs}</pre>
        ) : (
          <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-fg-muted">当前任务暂无执行日志</div>
        )}
      </section>
    </div>
  );
}

function RuntimeMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 text-xs text-fg-muted">{icon}{label}</div>
      <div className="mt-2 text-sm font-semibold text-fg-default">{value}</div>
    </div>
  );
}
