'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Tag } from '@schema/ui-kit';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  FlaskConical,
  Plus,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { PageContent } from '@/components/layout';
import { EmptyState } from '@/components/shared';
import { useAuth } from '@/components/providers/AuthProvider';
import { api } from '@/lib/api';
import { tasksApi } from '@/lib/tasks';
import type { AnalysisTask, TaskStatsResponse, TaskStatus } from '@/types/task';

interface DashboardStats {
  totalSamples: number;
  pendingTasks: number;
  waitingDataTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
}

const EMPTY_STATS: DashboardStats = {
  totalSamples: 0,
  pendingTasks: 0,
  waitingDataTasks: 0,
  runningTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
};

const EMPTY_TASK_STATS: TaskStatsResponse = {
  total_tasks: 0,
  running_tasks: 0,
  failed_last_24h: 0,
  status_distribution: {},
  result_import_failed_last_7d: 0,
  window_start: '',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  waiting_for_data: '等待数据',
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  pending_interpretation: '待解读',
};

function statusVariant(status: TaskStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'running') return 'info';
  if (status === 'queued' || status === 'waiting_for_data') return 'warning';
  return 'neutral';
}

function formatDateTime(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState<DashboardStats>(EMPTY_STATS);
  const [taskStats, setTaskStats] = React.useState<TaskStatsResponse>(EMPTY_TASK_STATS);
  const [tasks, setTasks] = React.useState<AnalysisTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [updatedAt, setUpdatedAt] = React.useState<string>('');

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError('');

    const [dashboardResult, tasksResult, taskStatsResult] = await Promise.allSettled([
      api.get<DashboardStats>('/v1/dashboard/stats'),
      tasksApi.list({ page: 1, page_size: 6 }),
      tasksApi.getStats(),
    ]);

    const failures: string[] = [];
    if (dashboardResult.status === 'fulfilled') {
      setStats({ ...EMPTY_STATS, ...dashboardResult.value });
    } else {
      setStats(EMPTY_STATS);
      failures.push('统计概览');
    }
    if (tasksResult.status === 'fulfilled') {
      setTasks(tasksResult.value.items ?? []);
    } else {
      setTasks([]);
      failures.push('最近任务');
    }
    if (taskStatsResult.status === 'fulfilled') {
      setTaskStats({ ...EMPTY_TASK_STATS, ...taskStatsResult.value });
    } else {
      setTaskStats(EMPTY_TASK_STATS);
      failures.push('运行指标');
    }
    setError(failures.length > 0 ? `${failures.join('、')}暂时不可用` : '');
    setUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const cardToneClasses = {
    neutral: {
      card: 'bg-[var(--yj-panel-bg)] border-[var(--yj-border-subtle)]',
      text: 'text-fg-muted',
      value: 'text-[var(--yj-text-strong)]',
    },
    warning: {
      card: 'bg-[var(--yj-panel-bg)] border-[var(--yj-border-subtle)]',
      text: 'text-warning-fg',
      value: 'text-warning-fg',
    },
    info: {
      card: 'bg-[var(--yj-panel-bg)] border-[var(--yj-border-subtle)]',
      text: 'text-[var(--color-variant-indel)]',
      value: 'text-[var(--color-variant-indel)]',
    },
    success: {
      card: 'bg-[var(--yj-panel-bg)] border-[var(--yj-border-subtle)]',
      text: 'text-success-fg',
      value: 'text-success-fg',
    },
    danger: {
      card: 'bg-[var(--yj-panel-bg)] border-[var(--yj-border-subtle)]',
      text: 'text-danger-fg',
      value: 'text-danger-fg',
    },
  } as const;

  const cards = [
    { title: '样本总数', value: stats.totalSamples, hint: '', icon: Users, href: '/samples', tone: 'neutral' },
    { title: '待处理', value: stats.pendingTasks, hint: loading || error.includes('统计概览') ? '' : `${stats.waitingDataTasks} 个等待数据`, icon: FlaskConical, href: '/tasks', tone: 'warning' },
    { title: '运行中', value: stats.runningTasks, hint: '', icon: Clock3, href: '/tasks', tone: 'info' },
    { title: '已完成', value: stats.completedTasks, hint: '', icon: CheckCircle2, href: '/tasks', tone: 'success' },
    { title: '失败任务', value: stats.failedTasks, hint: loading || error.includes('运行指标') ? '' : `${taskStats.failed_last_24h} 个发生于 24 小时内`, icon: XCircle, href: '/tasks', tone: 'danger' },
  ] as const;

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="yj-page-title">工作台</h2>
          <p className="yj-page-subtitle">
            {user?.name?.trim() || user?.email || '当前用户'}{updatedAt && ` · 更新于 ${formatDateTime(updatedAt)}`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => void loadDashboard()}
            disabled={loading}
          >
            刷新
          </Button>
          <Link href="/samples" className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-bg)] px-3 text-sm font-medium text-fg-default hover:bg-[var(--yj-panel-subtle)]">
            <Plus className="h-4 w-4" /> 新建样本
          </Link>
          <Link href="/tasks/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-accent-emphasis px-3 text-sm font-medium text-fg-on-emphasis hover:opacity-90">
            <Plus className="h-4 w-4" /> 新建任务
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3 text-sm text-warning-fg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}，请刷新重试。</span>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map(({ title, value, hint, icon: Icon, href, tone }) => {
          const toneClasses = cardToneClasses[tone];
          return (
          <Link key={title} href={href} className={`yj-kpi-card p-4 transition-colors hover:border-[var(--yj-border-strong)] ${toneClasses.card}`}>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-sm ${toneClasses.text}`}>{title}</span>
              <Icon className={`h-4 w-4 ${toneClasses.text}`} />
            </div>
            <div className={`mt-4 text-2xl font-semibold ${toneClasses.value}`}>{loading || error.includes('统计概览') ? '—' : value}</div>
            <div className={`mt-1 min-h-4 truncate text-xs ${toneClasses.text}`}>{hint}</div>
          </Link>
          );
        })}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="yj-panel overflow-hidden">
          <div className="yj-panel-header">
            <div>
              <h3 className="yj-section-title">最近任务</h3>

            </div>
            <Link href="/tasks" className="flex items-center gap-1 text-sm text-accent-fg hover:underline">
              查看全部 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {tasks.length > 0 ? (
            <div>
              {tasks.map((task) => (
                <Link key={task.id} href={`/tasks/${encodeURIComponent(task.id)}`} className="yj-status-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_96px_150px] sm:gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg-default">{task.internalId || task.sampleId || task.id}</div>
                    <div className="mt-0.5 truncate text-xs text-fg-muted">{task.pipeline || '-'} {task.pipelineVersion || ''} · {formatDateTime(task.createdAt)}</div>
                  </div>
                  <Tag
                    variant={statusVariant(task.status)}
                    className={`h-4 w-fit justify-self-start px-1.5 text-[11px] leading-4 ${
                      task.status === 'running'
                        ? 'border-[var(--color-variant-indel)] bg-[var(--color-variant-indel-subtle)] text-[var(--color-variant-indel)]'
                        : ''
                    }`}
                  >
                    {STATUS_LABEL[task.status] ?? task.status}
                  </Tag>
                  <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                    {task.status === 'running' && (
                      typeof task.progress === 'number' && Number.isFinite(task.progress) ? (
                        <>
                          <span className="w-8 text-right text-xs font-medium tabular-nums text-fg-default">{Math.min(100, Math.max(0, task.progress))}%</span>
                          <div role="progressbar" aria-label="任务运行进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, task.progress))} className="h-1.5 w-[92px] overflow-hidden rounded-full bg-canvas-inset">
                            <div className="h-full rounded-full bg-accent-emphasis" style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }} />
                          </div>
                        </>
                      ) : <span className="text-xs text-fg-muted">进度暂不可用</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : loading ? <p role="status" className="p-8 text-center text-sm text-fg-muted">加载最近任务…</p> : error.includes('最近任务') ? <p className="p-8 text-center text-sm text-fg-muted">最近任务暂不可用</p> : (
            <EmptyState
              icon={<Database />}
              title="暂无任务"
              description="创建任务后可在这里查看运行状态。"
            />
          )}
      </section>
      <aside className="yj-panel overflow-hidden" aria-labelledby="dashboard-attention-title">
        <div className="yj-panel-header"><h3 id="dashboard-attention-title" className="yj-section-title">待处理事项</h3></div>
        <dl className="divide-y divide-border-default px-4 text-sm">
          <div className="flex items-center justify-between py-3"><dt>待解读任务</dt><dd className="font-semibold tabular-nums">{loading || error.includes('运行指标') ? '—' : taskStats.status_distribution.pending_interpretation ?? 0}</dd></div>
          <div className="flex items-center justify-between py-3"><dt>等待测序数据</dt><dd className="font-semibold tabular-nums">{loading || error.includes('统计概览') ? '—' : stats.waitingDataTasks}</dd></div>
          <div className="flex items-center justify-between py-3"><dt>近 24 小时失败</dt><dd className="font-semibold tabular-nums text-danger-fg">{loading || error.includes('运行指标') ? '—' : taskStats.failed_last_24h}</dd></div>
          <div className="flex items-center justify-between py-3"><dt>近 7 天导入失败</dt><dd className="font-semibold tabular-nums text-warning-fg">{loading || error.includes('运行指标') ? '—' : taskStats.result_import_failed_last_7d}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2 border-t border-border-default p-4"><Link className="yj-tool-button" href="/tasks">管理任务</Link><Link className="yj-tool-button" href="/data">匹配数据</Link></div>
      </aside>
      </div>
    </PageContent>
  );
}
