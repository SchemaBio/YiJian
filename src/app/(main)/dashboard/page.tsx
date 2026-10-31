'use client';
import { TaskProgressCell } from '@/components/shared/TaskProgressCell';
import { useText } from '@/i18n/useText';
import { chineseText, translateUI, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Database, FlaskConical, Plus, Users, XCircle } from 'lucide-react';
import { PageContent } from '@/components/layout';
import { EmptyState } from '@/components/shared';
import { useAuth } from '@/components/providers/AuthProvider';
import { api } from '@/lib/api';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { tasksApi } from '@/lib/tasks';
import type { AnalysisTask, TaskStatsResponse } from '@/types/task';
import { taskDisplayStatus, taskStatusConfig, taskStatusClass } from '@/lib/task-presentation';

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

function formatDateTime(value: string, t: TextTranslator = chineseText): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(t.locale, { hour12: false });
}

export default function DashboardPage() {
  const { user, currentOrg } = useAuth();
  return <DashboardPageContent key={`${user?.id ?? ''}:${currentOrg?.id ?? ''}`} />;
}

function DashboardPageContent() {
  const t = useText();
  const { user } = useAuth();
  const generation = React.useRef(0);
  const inFlight = React.useRef(false);
  const [stats, setStats] = React.useState<DashboardStats>(EMPTY_STATS);
  const [taskStats, setTaskStats] = React.useState<TaskStatsResponse>(EMPTY_TASK_STATS);
  const [tasks, setTasks] = React.useState<AnalysisTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [updatedAt, setUpdatedAt] = React.useState<string>('');

  const loadDashboard = React.useCallback(async (background = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const requestGeneration = ++generation.current;
    if (!background) { setLoading(true); setError(''); }

    const [dashboardResult, tasksResult, taskStatsResult] = await Promise.allSettled([
      api.get<DashboardStats>('/v1/dashboard/stats'),
      tasksApi.list({ page: 1, page_size: 6 }),
      tasksApi.getStats(),
    ]);

    if (requestGeneration !== generation.current) return;

    const failures: string[] = [];
    if (dashboardResult.status === 'fulfilled') {
      setStats({ ...EMPTY_STATS, ...dashboardResult.value });
    } else {
      setStats(EMPTY_STATS);
      failures.push(t("common.overview630ee6"));
    }
    if (tasksResult.status === 'fulfilled') {
      setTasks(tasksResult.value.items ?? []);
    } else {
      setTasks([]);
      failures.push(t("admin.recentTasksabc5c3"));
    }
    if (taskStatsResult.status === 'fulfilled') {
      setTaskStats({ ...EMPTY_TASK_STATS, ...taskStatsResult.value });
    } else {
      setTaskStats(EMPTY_TASK_STATS);
      failures.push(t("common.runtimeMetrics63e240"));
    }
    setError(failures.length > 0 ? t("common.isTemporarilyUnavailableb40caa", {p0: String(failures.join('、'))}) : '');
    setUpdatedAt(new Date().toISOString());
    setLoading(false);
    inFlight.current = false;
  }, [t]);

  React.useEffect(() => {
    void loadDashboard();
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadDashboard(true);
    };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      ++generation.current;
      inFlight.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
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
    { title: t("common.totalSamplesd7dd99"), value: stats.totalSamples, hint: '', icon: Users, href: '/samples', tone: 'neutral' },
    { title: t("common.pending59a9eb"), value: stats.pendingTasks, hint: loading || error.includes('统计概览') ? '' : t("common.awaitingData424f97", {p0: String(stats.waitingDataTasks)}), icon: FlaskConical, href: '/tasks', tone: 'warning' },
    { title: t("admin.running594249"), value: stats.runningTasks, hint: '', icon: Clock3, href: '/tasks', tone: 'info' },
    { title: t("admin.completede99b48"), value: stats.completedTasks, hint: '', icon: CheckCircle2, href: '/tasks', tone: 'success' },
    { title: t("common.failedTasks174189"), value: stats.failedTasks, hint: loading || error.includes('运行指标') ? '' : t("common.inThePastHours248692", {p0: String(taskStats.failed_last_24h)}), icon: XCircle, href: '/tasks', tone: 'danger' },
  ] as const;

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="yj-page-title">{t("common.workspace8483cd")}</h2>
          <p className="yj-page-subtitle">
            {user?.name?.trim() || user?.email || t("common.currentUser16ce12")}{updatedAt && t("common.updatedAt057c4e", {p0: String(formatDateTime(updatedAt, t))})}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Button action="refresh"
            variant="secondary"

            onClick={() => void loadDashboard()}
            disabled={loading}
          >
            {t("admin.refresh38108e")}</Button>
          <Link href="/samples" className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-bg)] px-3 text-sm font-medium text-fg-default hover:bg-[var(--yj-panel-subtle)]">
            <Plus className="h-4 w-4" /> {t("common.newSamplea24694")}</Link>
          <Link href={getRuntimeBackendFlavor() === 'squid' ? '/tasks/new' : '/tasks'} className="inline-flex h-9 items-center gap-2 rounded-md bg-accent-emphasis px-3 text-sm font-medium text-fg-on-emphasis hover:opacity-90">
            <Plus className="h-4 w-4" /> {t("common.newTask132e02")}</Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3 text-sm text-warning-fg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}{t("common.refreshToRetryadb3d7")}</span>
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
              <h3 className="yj-section-title">{t("admin.recentTasksabc5c3")}</h3>

            </div>
            <Link href="/tasks" className="flex items-center gap-1 text-sm text-accent-fg hover:underline">
              {t("common.viewAll594e24")}<ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {tasks.length > 0 ? (
            <div>
              {tasks.map((task) => (
                <Link key={task.id} href={`/tasks/${encodeURIComponent(task.id)}`} className="yj-status-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_96px_150px] sm:gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg-default">{task.internalId || task.sampleId || task.id}</div>
                    <div className="mt-0.5 truncate text-xs text-fg-muted">{task.pipeline || '-'} {task.pipelineVersion || ''} · {formatDateTime(task.createdAt, t)}</div>
                  </div>
                  <span className={`yj-task-state-label ${taskStatusClass(taskDisplayStatus(task))}`} data-status={taskDisplayStatus(task)} data-interpretation-completed={!!task.interpretationCompletedAt}>
                    <span aria-hidden="true" />{translateUI(taskStatusConfig[taskDisplayStatus(task)].label, t)}
                  </span>
                  <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                    <TaskProgressCell task={task} />
                  </div>
                </Link>
              ))}
            </div>
          ) : loading ? <p role="status" className="p-8 text-center text-sm text-fg-muted">{t("common.loadingRecentTasks5d75b5")}</p> : error.includes('最近任务') ? <p className="p-8 text-center text-sm text-fg-muted">{t("common.recentTasksUnavailablee35a5e")}</p> : (
            <EmptyState
              icon={<Database />}
              title={t("common.noTasks15652e")}
              description={t("common.createATaskToSeeItsRuntime687814")}
            />
          )}
      </section>
      <aside className="yj-panel overflow-hidden" aria-labelledby="dashboard-attention-title">
        <div className="yj-panel-header"><h3 id="dashboard-attention-title" className="yj-section-title">{t("common.pendingActions0b0efa")}</h3></div>
        <dl className="divide-y divide-border-default px-4 text-sm">
          <div className="flex items-center justify-between py-3"><dt>{t("common.tasksAwaitingInterpretation195c3f")}</dt><dd className="font-semibold tabular-nums">{loading || error.includes('运行指标') ? '—' : taskStats.status_distribution.pending_interpretation ?? 0}</dd></div>
          <div className="flex items-center justify-between py-3"><dt>{t("common.awaitingSequencingData844492")}</dt><dd className="font-semibold tabular-nums">{loading || error.includes('统计概览') ? '—' : stats.waitingDataTasks}</dd></div>
          <div className="flex items-center justify-between py-3"><dt>{t("common.failuresInThePastHours598418")}</dt><dd className="font-semibold tabular-nums text-danger-fg">{loading || error.includes('运行指标') ? '—' : taskStats.failed_last_24h}</dd></div>
          <div className="flex items-center justify-between py-3"><dt>{t("common.importFailuresInThePastDaysfab0c7")}</dt><dd className="font-semibold tabular-nums text-warning-fg">{loading || error.includes('运行指标') ? '—' : taskStats.result_import_failed_last_7d}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2 border-t border-border-default p-4"><Link className="yj-tool-button" href="/tasks">{t("common.manageTasksb1a212")}</Link><Link className="yj-tool-button" href="/data">{t("common.matchDatab50c4f")}</Link></div>
      </aside>
      </div>
    </PageContent>
  );
}
