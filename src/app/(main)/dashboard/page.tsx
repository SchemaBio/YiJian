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
  FileUp,
  FlaskConical,
  HardDrive,
  Plus,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';
import { PageContent } from '@/components/layout';
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

interface UploadStats {
  total: number;
  total_bytes: number;
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

const STATUS_ORDER: TaskStatus[] = [
  'running',
  'queued',
  'waiting_for_data',
  'pending_interpretation',
  'completed',
  'failed',
  'cancelled',
];

function statusVariant(status: TaskStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export default function DashboardPage() {
  const { user, currentOrg } = useAuth();
  const [stats, setStats] = React.useState<DashboardStats>(EMPTY_STATS);
  const [taskStats, setTaskStats] = React.useState<TaskStatsResponse>(EMPTY_TASK_STATS);
  const [uploadStats, setUploadStats] = React.useState<UploadStats>({ total: 0, total_bytes: 0 });
  const [tasks, setTasks] = React.useState<AnalysisTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [lastUpdated, setLastUpdated] = React.useState('');

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError('');

    const [dashboardResult, tasksResult, taskStatsResult, uploadStatsResult] = await Promise.allSettled([
      api.get<DashboardStats>('/v1/dashboard/stats'),
      tasksApi.list({ page: 1, page_size: 6 }),
      tasksApi.getStats(),
      api.get<UploadStats>('/v1/upload/files/stats'),
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
    if (uploadStatsResult.status === 'fulfilled') {
      setUploadStats(uploadStatsResult.value);
    } else {
      setUploadStats({ total: 0, total_bytes: 0 });
      failures.push('文件指标');
    }

    setError(failures.length > 0 ? `${failures.join('、')}暂时不可用` : '');
    setLastUpdated(new Date().toISOString());
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const cards = [
    { title: '样本总数', value: stats.totalSamples, hint: '已登记样本', icon: Users, href: '/samples' },
    { title: '待处理', value: stats.pendingTasks, hint: `${stats.waitingDataTasks} 个等待数据`, icon: FlaskConical, href: '/tasks' },
    { title: '运行中', value: stats.runningTasks, hint: '正在执行', icon: Clock3, href: '/tasks' },
    { title: '已完成', value: stats.completedTasks, hint: '累计完成', icon: CheckCircle2, href: '/tasks' },
    { title: '失败任务', value: stats.failedTasks, hint: `${taskStats.failed_last_24h} 个发生于 24 小时内`, icon: XCircle, href: '/tasks' },
  ];

  const totalForDistribution = Math.max(
    1,
    Object.values(taskStats.status_distribution ?? {}).reduce((sum, value) => sum + value, 0)
  );

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">工作台</h2>
          <p className="yj-page-subtitle">
            {user?.name || user?.email || '当前用户'}{currentOrg?.name ? ` · ${currentOrg.name}` : ''}
            {lastUpdated ? ` · 更新于 ${formatDateTime(lastUpdated)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
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
        <div className="mb-4 flex items-center gap-2 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3 text-sm text-warning-fg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}，其余数据仍可继续使用。</span>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map(({ title, value, hint, icon: Icon, href }) => (
          <Link key={title} href={href} className="yj-kpi-card p-4 transition-colors hover:border-[var(--yj-border-strong)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg-muted">{title}</span>
              <Icon className="h-4 w-4 text-fg-muted" />
            </div>
            <div className="mt-4 text-2xl font-semibold text-[var(--yj-text-strong)]">{loading ? '--' : value}</div>
            <div className="mt-1 truncate text-xs text-fg-muted">{hint}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <section className="yj-panel overflow-hidden">
          <div className="yj-panel-header">
            <div>
              <h3 className="yj-section-title">最近任务</h3>
              <p className="mt-1 text-xs text-fg-muted">按创建时间展示最近 6 个分析任务</p>
            </div>
            <Link href="/tasks" className="flex items-center gap-1 text-sm text-accent-fg hover:underline">
              查看全部 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {tasks.length > 0 ? (
            <div>
              {tasks.map((task) => (
                <Link key={task.id} href={`/tasks/${encodeURIComponent(task.id)}`} className="yj-status-row grid grid-cols-[minmax(0,1fr)_120px_88px] items-center gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg-default">{task.internalId || task.sampleId || task.id}</div>
                    <div className="mt-0.5 truncate text-xs text-fg-muted">{task.pipeline || '-'} {task.pipelineVersion || ''}</div>
                  </div>
                  <Tag variant={statusVariant(task.status)}>{STATUS_LABEL[task.status] ?? task.status}</Tag>
                  <div className="text-right">
                    <div className="text-sm font-medium text-fg-default">{task.progress ?? 0}%</div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas-inset">
                      <div className="h-full rounded-full bg-accent-emphasis" style={{ width: `${Math.min(100, Math.max(0, task.progress ?? 0))}%` }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <Database className="h-6 w-6 text-fg-muted" />
              <p className="mt-3 text-sm font-medium text-fg-default">暂无任务</p>
              <p className="mt-1 text-xs text-fg-muted">创建任务后可在这里查看运行状态。</p>
            </div>
          )}
        </section>

        <aside className="yj-panel overflow-hidden">
          <div className="yj-panel-header">
            <div>
              <h3 className="yj-section-title">运行概况</h3>
              <p className="mt-1 text-xs text-fg-muted">任务、结果入库与上传文件状态</p>
            </div>
          </div>
          <div className="grid grid-cols-2 border-b border-[var(--yj-border-subtle)]">
            <OperationalMetric icon={<FileUp className="h-4 w-4" />} label="已上传文件" value={String(uploadStats.total)} />
            <OperationalMetric icon={<HardDrive className="h-4 w-4" />} label="数据量" value={formatBytes(uploadStats.total_bytes)} />
            <OperationalMetric icon={<XCircle className="h-4 w-4" />} label="24h 失败" value={String(taskStats.failed_last_24h)} />
            <OperationalMetric icon={<Database className="h-4 w-4" />} label="7d 入库失败" value={String(taskStats.result_import_failed_last_7d)} />
          </div>
          <div className="space-y-3 p-4">
            {STATUS_ORDER.map((status) => {
              const count = taskStats.status_distribution?.[status] ?? 0;
              const width = `${Math.max(count > 0 ? 4 : 0, (count / totalForDistribution) * 100)}%`;
              return (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-fg-muted">{STATUS_LABEL[status]}</span>
                    <span className="font-medium text-fg-default">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-canvas-inset">
                    <div className="h-full rounded-full bg-accent-emphasis" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </PageContent>
  );
}

function OperationalMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="border-r border-t border-[var(--yj-border-subtle)] p-4 even:border-r-0 first:border-t-0 [&:nth-child(2)]:border-t-0">
      <div className="flex items-center gap-2 text-xs text-fg-muted">{icon}{label}</div>
      <div className="mt-2 text-lg font-semibold text-fg-default">{value}</div>
    </div>
  );
}
