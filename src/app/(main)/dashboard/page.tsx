'use client';

import * as React from 'react';
import Link from 'next/link';
import { PageContent } from '@/components/layout';
import { Tag } from '@schema/ui-kit';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  FlaskConical,
  History,
  ListTodo,
  RefreshCw,
  Users,
  Workflow,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { tasksApi } from '@/lib/tasks';
import { useAuth } from '@/components/providers/AuthProvider';
import type { AnalysisTask, TaskStatus } from '@/types/task';

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

const STATUS_LABEL: Record<TaskStatus, string> = {
  waiting_for_data: '等待数据',
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  pending_interpretation: '待解读',
};

function formatDateTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function statusVariant(status: TaskStatus): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'running') return 'info';
  if (status === 'queued' || status === 'waiting_for_data') return 'warning';
  return 'neutral';
}

export default function DashboardPage() {
  const { user, currentOrg } = useAuth();
  const [currentTime, setCurrentTime] = React.useState('');
  const [stats, setStats] = React.useState<DashboardStats>(EMPTY_STATS);
  const [tasks, setTasks] = React.useState<AnalysisTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadDashboard = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, taskData] = await Promise.all([
        api.get<DashboardStats>('/v1/dashboard/stats'),
        tasksApi.list({ page: 1, page_size: 6 }),
      ]);
      setStats({ ...EMPTY_STATS, ...statsData });
      setTasks(taskData.items ?? []);
    } catch (err) {
      setStats(EMPTY_STATS);
      setTasks([]);
      setError(err instanceof Error ? err.message : '加载工作台数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setCurrentTime(formatDateTime(new Date()));
    const timer = window.setInterval(() => setCurrentTime(formatDateTime(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const cards = [
    {
      title: '样本总数',
      value: stats.totalSamples,
      hint: 'Octopus samples',
      icon: Users,
      href: '/samples',
      className: 'yj-kpi-blue',
    },
    {
      title: '待处理任务',
      value: stats.pendingTasks,
      hint: `等待数据 ${stats.waitingDataTasks}`,
      icon: FlaskConical,
      href: '/tasks',
      className: 'yj-kpi-orange',
    },
    {
      title: '运行中',
      value: stats.runningTasks,
      hint: 'running',
      icon: Clock,
      href: '/tasks',
      className: 'yj-kpi-purple',
    },
    {
      title: '已完成',
      value: stats.completedTasks,
      hint: 'completed',
      icon: CheckCircle,
      href: '/tasks',
      className: 'yj-kpi-green',
    },
    {
      title: '失败任务',
      value: stats.failedTasks,
      hint: 'failed',
      icon: XCircle,
      href: '/tasks',
      className: 'yj-kpi-teal',
    },
  ];

  return (
    <PageContent padded={false} className="h-full flex flex-col">
      <div className="p-6 xl:p-8 flex flex-col h-full min-h-0">
        <div className="mb-7 flex items-start justify-between gap-6 shrink-0">
          <div>
            <h2 className="text-[32px] leading-tight font-semibold text-[var(--yj-text-strong)] tracking-tight">今日工作台</h2>
            <p className="text-sm text-fg-muted mt-2">
              {user?.name || user?.email || '当前用户'}{currentOrg?.name ? ` · ${currentOrg.name}` : ''} · {currentTime || '加载中...'}
            </p>
            <p className="text-xs text-fg-muted mt-1">
              统计数据来自 Octopus `/api/v1/dashboard/stats`，不再使用前端模拟仪表盘数据。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="h-10 px-3.5 bg-[var(--yj-panel-bg)] rounded-xl border border-[var(--yj-border-subtle)] hover:border-[var(--yj-border-strong)] hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 text-fg-muted ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm text-fg-default">刷新</span>
            </button>
            <QuickLink href="/samples" icon={<Users className="w-4 h-4 text-fg-muted" />} label="样本管理" />
            <QuickLink href="/tasks" icon={<ListTodo className="w-4 h-4 text-fg-muted" />} label="任务中心" />
            <QuickLink href="/history" icon={<History className="w-4 h-4 text-fg-muted" />} label="历史检出" />
            <QuickLink href="/pipeline" icon={<Workflow className="w-4 h-4 text-fg-muted" />} label="流程中心" />
          </div>
        </div>

        {error && (
          <div className="yj-panel border border-danger-muted bg-danger-subtle text-danger-fg flex items-center gap-2 mb-5">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 shrink-0">
          {cards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.title}
                href={stat.href}
                className={`yj-kpi-card p-5 hover:bg-white transition-colors ${stat.className}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-fg-muted">{stat.title}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--yj-panel-subtle)] text-fg-muted">
                    <Icon className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-6">
                  <div className="text-[28px] leading-none font-semibold tracking-tight text-[var(--yj-text-strong)]">
                    {loading ? '...' : stat.value}
                  </div>
                  <div className="mt-2 text-xs font-medium text-accent-fg">{stat.hint}</div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)] gap-5 flex-1 min-h-0">
          <div className="yj-panel flex flex-col min-h-0">
            <div className="yj-panel-header shrink-0">
              <h3 className="font-medium text-fg-default flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                最近任务
              </h3>
              <Link href="/tasks" className="text-sm text-accent-fg hover:underline flex items-center gap-1">
                查看全部 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-y-auto flex-1">
              {tasks.length > 0 ? tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${encodeURIComponent(task.id)}`}
                  className="yj-status-row flex items-center justify-between p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-fg-default font-mono text-sm truncate">
                        {task.internalId || task.sampleId || task.id}
                      </span>
                      <Tag variant={statusVariant(task.status)}>{STATUS_LABEL[task.status] ?? task.status}</Tag>
                    </div>
                    <div className="text-sm text-fg-muted mt-0.5 truncate">
                      {task.pipeline || '-'} {task.pipelineVersion ? `· ${task.pipelineVersion}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-sm text-fg-muted">{task.progress ?? 0}%</div>
                    <div className="text-xs text-fg-subtle">{task.createdAt || '-'}</div>
                  </div>
                </Link>
              )) : (
                <div className="p-6 text-center text-fg-muted text-sm">
                  {loading ? '加载任务中...' : '暂无任务'}
                </div>
              )}
            </div>
          </div>

          <div className="yj-panel flex flex-col min-h-0">
            <div className="yj-panel-header shrink-0">
              <h3 className="font-medium text-fg-default flex items-center gap-2">
                <Workflow className="w-4 h-4 text-accent-fg" />
                API 对齐说明
              </h3>
            </div>
            <div className="p-4 space-y-3 text-sm text-fg-muted">
              <p>工作台只展示后端已有的样本和任务统计，不再维护前端本地公告、假任务或固定 KPI。</p>
              <p>如需组织公告/待办能力，建议在 Squid 增加 SaaS 侧公告接口后再接入，避免 UI 状态与审计记录脱节。</p>
              <div className="rounded-lg bg-canvas-subtle p-3 font-mono text-xs text-fg-default">
                GET /v1/dashboard/stats<br />
                GET /v1/tasks?page=1&amp;page_size=6
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContent>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="h-10 px-3.5 bg-[var(--yj-panel-bg)] rounded-xl border border-[var(--yj-border-subtle)] hover:border-[var(--yj-border-strong)] hover:bg-white transition-colors flex items-center gap-2"
    >
      {icon}
      <span className="text-sm text-fg-default">{label}</span>
    </Link>
  );
}
