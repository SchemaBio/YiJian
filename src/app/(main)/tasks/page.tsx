'use client';
import { downloadTaskBatchTemplate } from '@/lib/task-batch-template';
import { useLiveRetention, useResearchExpiry } from '@/lib/research-retention';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';

import { canInterpretTask } from '@/lib/task-interpretation';
import { TaskActionsCell } from './components/TaskActionsCell';
import { ActionButton as Button } from '@/components/shared/ActionButton';

import { taskStatusConfig, taskDisplayCreatedAt, taskDisplayStatus, sortTasksByInterpretation, taskStatusClass, type TaskDisplayStatus } from '@/lib/task-presentation';
import { HoverHint } from '@/components/shared/HoverHint';


import { RetentionNotice, ExpiryCell } from '@/components/shared/ResearchPolicy';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Input, DataTable, Tooltip } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import type { Column } from '@schema/ui-kit';
import { Search, ChevronDown, Loader2, AlertTriangle, List } from 'lucide-react';
import { NewTaskModal, BatchTaskModal, EditTaskModal } from './components';
import type { NewTaskFormData, EditTaskFormData } from './components';
import type { AnalysisTask } from '@/types/task';
import { tasksApi } from '@/lib/tasks';
import { useApi, usePolling } from '@/hooks';
import { EmptyState, IdCell, TaskStatusTag } from '@/components/shared';
import { TaskCostValue } from '@/components/billing';
import { getRecentTaskBilling, notifyBillingUpdated, type TaskBillingSummary } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { formatLocalDateTime } from '@/lib/utils';

const executionReasons: Record<string, string> = { ORGANIZATION_INACTIVE: '组织已停用', ADMISSION_REJECTED: '执行申请未通过，请检查余额', DISPATCH_FAILED: '执行申请未确认，系统正在对账', BOOTSTRAP_FAILED: '节点初始化失败', AGENT_EXITED: '节点 Agent 意外退出', MAX_RUNTIME: '超过运行时限', LEGACY_RECONCILIATION_REQUIRED: '等待管理员核对', RELEASE_RETRY: '节点释放正在重试', RELEASE_FAILED: '节点释放失败，需要管理员处理', SEPIIDA_FIRST_REPORT_TIMEOUT: 'Sepiida 未按时收到任务进度', NODE_FIRST_REPORT_TIMEOUT: '节点首报超时', NODE_HEARTBEAT_TIMEOUT: '节点心跳中断超过 5 分钟', NODE_INITIALIZATION_TIMEOUT: '节点初始化超过 60 分钟', NODE_CALLBACK_AUTH_FAILED: '节点状态关注鉴权失败', NODE_CALLBACK_RATE_LIMITED: '节点状态关注被限流', NODE_CALLBACK_UPSTREAM_ERROR: '节点状态服务暂时异常', NODE_DNS_FAILED: '节点无法解析状态服务域名', NODE_TLS_FAILED: '节点 TLS 连接失败', BOOTSTRAP_DEPENDENCY_MISSING: '节点镜像缺少启动依赖', REFERENCE_DATABASE_FAILED: '参考数据库准备失败', INPUT_DOWNLOAD_FAILED: '输入文件下载失败', AGENT_START_FAILED: 'Sepiida Agent 启动失败' };
const executionLabels: Record<string, string> = { waiting_quota: '等待名额', waiting_capacity: '等待节点', dispatching: '申请确认中', bootstrapping: '初始化中', diagnostic_hold: '诊断日志保留中', running: '计算中', archiving: '归档中', terminating: '节点释放中', release_failed: '节点释放重试中', terminal: '本次执行已结束' };

const statusConfig = taskStatusConfig;

const statusFilterOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '运行中' },
  { value: 'pending_interpretation', label: '待解读' },
  { value: 'completed', label: '分析完成' },
  { value: 'interpretation_completed', label: '解读完成' },
  { value: 'failed', label: '失败' },
];

function areTaskListsEqual(previous: AnalysisTask[], next: AnalysisTask[]): boolean {
  return previous.length === next.length && previous.every((task, index) => {
    const candidate = next[index];
    return task.id === candidate.id
      && task.name === candidate.name
      && task.sampleId === candidate.sampleId
      && task.internalId === candidate.internalId
      && task.template === candidate.template
      && task.pipeline === candidate.pipeline
      && task.pipelineVersion === candidate.pipelineVersion
      && task.status === candidate.status
      && task.interpretationCompletedAt === candidate.interpretationCompletedAt
      && task.vmStatus === candidate.vmStatus
      && task.executionPhase === candidate.executionPhase
      && task.executionReasonCode === candidate.executionReasonCode
      && task.attemptId === candidate.attemptId
      && task.phaseUpdatedAt === candidate.phaseUpdatedAt
      && task.bootstrapPhase === candidate.bootstrapPhase
      && task.bootstrapLastHeartbeatAt === candidate.bootstrapLastHeartbeatAt
      && task.diagnosticHoldUntil === candidate.diagnosticHoldUntil
      && task.diagnosticSummary === candidate.diagnosticSummary
      && task.dispatchNextRetryAt === candidate.dispatchNextRetryAt
      && task.dispatchRetryDeadlineAt === candidate.dispatchRetryDeadlineAt
      && task.dispatchRetryCount === candidate.dispatchRetryCount
      && task.progress === candidate.progress
      && task.createdAt === candidate.createdAt
      && task.retryStartedAt === candidate.retryStartedAt
      && task.createdBy === candidate.createdBy
      && task.completedAt === candidate.completedAt
      && task.remark === candidate.remark;
  });
}

// 状态筛选下拉组件
function StatusFilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useText();
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 获取当前选中项的显示
  const getCurrentDisplay = () => {
    if (value === 'all') {
      return <span className="text-sm text-fg-default">{t("tasks.allStatuses1a4c26")}</span>;
    }
    const config = statusConfig[value as TaskDisplayStatus];
    return <Tag variant={config.variant} className={`justify-center yj-task-status-tag ${taskStatusClass(value as TaskDisplayStatus)}`}>{translateUI(config.label, t)}</Tag>;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center gap-2 px-3 py-1.5 border border-border-default rounded bg-canvas-default hover:bg-canvas-inset transition-colors"
      >
        {getCurrentDisplay()}
        <ChevronDown className={`w-4 h-4 text-fg-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-canvas-default border border-border-default rounded-md shadow-lg z-30 py-1 min-w-[120px]">
          {/* 全部状态选项 */}
          <button
            className={`w-full px-3 py-2 text-left text-sm hover:bg-canvas-subtle flex items-center gap-2 ${
              value === 'all' ? 'bg-canvas-inset' : ''
            }`}
            onClick={() => {
              onChange('all');
              setIsOpen(false);
            }}
          >
            <span className="text-fg-default">{t("tasks.allStatuses1a4c26")}</span>
          </button>

          {/* 各状态选项 */}
          {statusFilterOptions.filter(opt => opt.value !== 'all').map((option) => {
            const config = statusConfig[option.value as TaskDisplayStatus];
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                className={`w-full px-3 py-2 text-left hover:bg-canvas-subtle flex items-center gap-2 ${
                  isSelected ? 'bg-canvas-inset' : ''
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <Tag variant={config.variant} className={`justify-center yj-task-status-tag ${taskStatusClass(option.value as TaskDisplayStatus)}`}>{translateUI(config.label, t)}</Tag>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const t = useText();
  const router = useRouter();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [recentCounts, setRecentCounts] = React.useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = React.useState(false);
  const [isBatchTaskModalOpen, setIsBatchTaskModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<AnalysisTask | null>(null);
  useResearchExpiry(editingTask?.expiresAt,()=>setEditingTask(null));
  const [actionError, setActionError] = React.useState('');
  const [taskBilling, setTaskBilling] = React.useState<Record<string, TaskBillingSummary>>({});
  const [billingLoading, setBillingLoading] = React.useState(false);

  // Create fetcher function with current statusFilter
  const fetcher = React.useCallback(async () => {
    const params: Record<string, string> = { page: '1', page_size: '100' };
    if (statusFilter !== 'all') params.status = statusFilter;
    const data = await tasksApi.list(params);
    if (statusFilter === 'all') {
      const counts: Record<string, number> = { all: data.items.length };
      for (const task of data.items) counts[taskDisplayStatus(task)] = (counts[taskDisplayStatus(task)] ?? 0) + 1;
      setRecentCounts(counts);
    }
    return data.items;
  }, [statusFilter]);

  // Use polling hook - auto-polls when there are running tasks
  const { data: fetchedTasks, loading, error, refetch } = usePolling(
    fetcher,
    10000,
    { enabled: true, immediate: true, isEqual: areTaskListsEqual }
  );

  const tasks=useLiveRetention(fetchedTasks);
  const refreshTaskBilling = React.useCallback(async (taskItems: AnalysisTask[]) => {
    if (!isSaaS || taskItems.length === 0) {
      setTaskBilling({});
      return;
    }
    setBillingLoading(true);
    try {
      setTaskBilling(await getRecentTaskBilling(taskItems.map((task) => task.id)));
    } catch {
      setTaskBilling({});
    } finally {
      setBillingLoading(false);
    }
  }, [isSaaS]);

  React.useEffect(() => {
    void refreshTaskBilling(tasks ?? []);
  }, [refreshTaskBilling, tasks]);

  const handleCreateTask = async (data: NewTaskFormData) => {
    setActionError('');
    try {
      await tasksApi.create({
        sampleId: data.sampleId,
        internalId: data.internalId,
        pipelineId: data.pipelineId,
        pipelineName: data.pipelineName,
        pipelineVersion: data.pipelineVersion,
        remark: data.remark,
        template: data.template,
        inputs: data.inputs,
 vcf_asset_id: data.vcf_asset_id, vcf_sample_name: data.vcf_sample_name,
      });
      refetch(); // Refresh data after creating
    } catch (err) {
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToCreateTaska23940");
      setActionError(message);
      throw new Error(message);
    }
  };

  const handleEditTask = async (id: string, data: EditTaskFormData) => {
    setActionError('');
    try {
      await tasksApi.update(id, {
        internalId: data.internalId,
        pipeline: data.pipeline,
        remark: data.remark,
      });
      refetch(); // Refresh data after updating
    } catch (err) {
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToUpdateTaskf9b5e6");
      setActionError(message);
      throw new Error(message);
    }
  };

  const handleStartTask = async (taskId: string) => {
    setActionLoading(taskId);
    setActionError('');
    try {
      await tasksApi.start(taskId);
      notifyBillingUpdated();
      await refreshTaskBilling(tasks ?? []);
      refetch(); // Refresh data after starting
    } catch (err) {
      setActionError(err instanceof Error ? errorText(err, t) : t("tasks.unableToStartTask2f67d1"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopTask = async (taskId: string) => {
    setActionLoading(taskId);
    setActionError('');
    try {
      await tasksApi.stop(taskId);
      refetch(); // Refresh data after stopping
    } catch (err) {
      setActionError(err instanceof Error ? errorText(err, t) : t("tasks.unableToStopTaskb0cdcf"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryTask = async (taskId: string) => {
    setActionLoading(taskId);
    setActionError('');
    try {
      await tasksApi.retry(taskId);
      notifyBillingUpdated();
      await refreshTaskBilling(tasks ?? []);
      refetch(); // Refresh data after retrying
    } catch (err) {
      setActionError(err instanceof Error ? errorText(err, t) : t("tasks.unableToRetryTaska0acb1"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setActionError('');
    try {
      await tasksApi.cancel(taskId);
      notifyBillingUpdated();
      await refreshTaskBilling(tasks ?? []);
      refetch(); // Refresh data after deleting
    } catch (err) {
      setActionError(err instanceof Error ? errorText(err, t) : t("tasks.unableToDeleteTaskb29722"));
    }
  };

  const handleOpenDetails = React.useCallback((task: AnalysisTask) => {
    if (!canInterpretTask(task)) return;
    router.push(`/tasks/${encodeURIComponent(task.id)}`);
  }, [router]);

  const handleOpenInterpretation = React.useCallback((task: AnalysisTask) => {
    if (!canInterpretTask(task)) return;
    router.push(`/tasks/${encodeURIComponent(task.id)}?tab=overview`);
  }, [router]);

  const filteredTasks = React.useMemo(() => {
    let result = tasks ?? [];
    // 先按状态筛选
    if (statusFilter !== 'all') {
      result = result.filter(t => taskDisplayStatus(t) === statusFilter);
    }
    // 再按搜索词筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.name ?? '').toLowerCase().includes(query) ||
          t.id.toLowerCase().includes(query) ||
          t.sampleId.toLowerCase().includes(query) ||
          t.internalId.toLowerCase().includes(query)
      );
    }
    return sortTasksByInterpretation(result);
  }, [searchQuery, statusFilter, tasks, t]);

  const columns: Column<AnalysisTask>[] = [
    ...(isSaaS ? [{id:'expiresAt',header:t('research.expiresAt'),accessor:(row:AnalysisTask)=><ExpiryCell value={row.expiresAt} />,width:170}] : []),
    {
      id: 'taskId',
      header: t("admin.task3172b3"),
      accessor: (row) => (
        <div className="min-w-0 text-left">
          <IdCell id={row.id} full />
          <div className="mt-1">
            <HoverHint content={row.name || row.pipeline}>
              <button type="button" onClick={() => handleOpenDetails(row)} className="block max-w-[220px] truncate text-xs text-fg-muted hover:text-accent-fg">
                {row.name || row.pipeline || t("samples.analysisTasksf269c8")}
              </button>
            </HoverHint>
          </div>
        </div>
      ),
      width: 300,
      align: 'left',
    },
    {
      id: 'sample',
      header: t("history.sampleId6d686e"),
      accessor: (row) => (
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-sm font-medium text-fg-default">{row.internalId || '-'}</span>
          <IdCell id={row.sampleId} full />
        </div>
      ),
      width: 300,
      align: 'center',
    },
    {
      id: 'pipeline',
      header: t("tasks.analysisPipelinef22c14"),
      accessor: (row) => (
        <div className="text-center">
          <div className="text-fg-default">{row.pipeline}</div>
          <div className="text-xs text-fg-muted">{row.pipelineVersion}</div>
        </div>
      ),
      width: 140,
      align: 'center',
    },
    {
      id: 'status',
      header: t("admin.status62e951"),
      accessor: (row) => {
        const config = statusConfig[taskDisplayStatus(row)];
        const terminalStatus = ['completed', 'failed', 'cancelled'].includes(row.status);
        const phaseLabel = row.executionPhase ? executionLabels[row.executionPhase] : undefined;
        const cleanupPhase = terminalStatus && ['terminating', 'release_failed'].includes(row.executionPhase ?? '');
        const vmStatus = row.vmStatus?.toUpperCase();
        const releaseConfirmed = row.executionPhase === 'terminal' && ['TERMINATED', 'RECLAIMED'].includes(vmStatus ?? '');
        const label = config.label;
        const releaseLabel = cleanupPhase
          ? phaseLabel
          : releaseConfirmed
            ? row.status === 'completed' ? undefined : t("tasks.nodeReleased3f8287")
            : row.executionPhase === 'terminal' && vmStatus === 'LAUNCH_FAILED'
              ? t("tasks.noComputeNodeCreatedacf8b0")
              : undefined;
        const duplicateReleaseReason = cleanupPhase && ['RELEASE_RETRY', 'RELEASE_FAILED'].includes(row.executionReasonCode ?? '');
        return <HoverHint content={translateUI(row.executionReasonCode ? executionReasons[row.executionReasonCode] ?? t("tasks.viewTaskDetails8132d3") : undefined, t)}><div ><span className={`yj-task-state-label ${taskStatusClass(taskDisplayStatus(row))}`} data-interpretation-completed={!!row.interpretationCompletedAt} data-status={taskDisplayStatus(row)}><span aria-hidden="true" />{t(label)}</span>{!terminalStatus && row.executionPhase !== 'terminal' && phaseLabel && phaseLabel !== config.label && <div className="text-xs text-fg-muted">{t(phaseLabel)}</div>}{releaseLabel && <div className={`text-xs ${row.executionPhase === 'release_failed' ? 'text-danger-fg' : row.executionPhase === 'terminating' ? 'text-warning-fg' : 'text-fg-muted'}`}>{t(releaseLabel)}</div>}{row.diagnosticHoldUntil && <div className="text-xs text-warning-fg">{t("tasks.retainedUntil028411")}{new Date(row.diagnosticHoldUntil).toLocaleTimeString(t.locale, { hour12: false })}</div>}{row.executionReasonCode && !duplicateReleaseReason && <div className="text-xs text-fg-muted">{t(executionReasons[row.executionReasonCode] ?? t("tasks.viewTaskDetails8132d3"))}</div>}</div></HoverHint>;
      },
      width: 90,
      align: 'center',
    },
    {
      id: 'progress',
      header: t("tasks.progressacf014"),
      accessor: (row) => {
        const terminalStatus = ['completed', 'failed', 'cancelled'].includes(row.status);
        const preparing = !terminalStatus && ['bootstrapping', 'diagnostic_hold'].includes(row.executionPhase ?? '') && row.progress === 0;
        if (preparing) return <span className="text-xs text-fg-muted">{t("tasks.preparing4f1f8a")}</span>;
        if (row.status !== 'running' || !Number.isFinite(row.progress)) return <span className="text-xs text-fg-muted">—</span>;
        const progress = Math.min(100, Math.max(0, row.progress));
        return (
        <div className="flex items-center justify-center gap-2">
          <div className="flex-1 h-2 bg-canvas-inset rounded-full overflow-hidden max-w-[60px]">
            <div
              className="h-full rounded-full bg-accent-emphasis"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-fg-muted w-8">{progress}%</span>
        </div>
        );
      },
      width: 120,
      align: 'center',
    },
    ...(isSaaS ? [{
      id: 'cost',
      header: t("tasks.cost9836a9"),
      accessor: (row: AnalysisTask) => (
        <TaskCostValue summary={taskBilling[row.id]} loading={billingLoading && !taskBilling[row.id]} />
      ),
      width: 110,
      align: 'center' as const,
    }] : []),
    {
      id: 'createdAt',
      header: t("admin.createdAt84e380"),
      accessor: (row) => <span className="whitespace-nowrap tabular-nums">{formatLocalDateTime(taskDisplayCreatedAt(row))}</span>,
      width: 170,
      align: 'center',
    },
    {
      id: 'completedAt',
      header: t("tasks.completedAt754a8a"),
      accessor: (row) => <span className="whitespace-nowrap tabular-nums">{formatLocalDateTime(row.completedAt)}</span>,
      width: 170,
      align: 'center',
    },
    {
      id: 'remark',
      header: t("admin.notese03614"),
      accessor: (row) => (
        <span className={row.remark ? 'text-fg-default truncate block max-w-[100px] text-center' : 'text-fg-muted text-center'}>
          {row.remark || '-'}
        </span>
      ),
      width: 100,
      align: 'center',
    },
    {
      id: 'actions',
      header: t("admin.actionsf3ea6d"),
      accessor: (row) => (
        <TaskActionsCell
          task={row}
          onStart={handleStartTask}
          onStop={handleStopTask}
          onRetry={handleRetryTask}
          onEdit={setEditingTask}
          onDelete={handleDeleteTask}
          onView={handleOpenInterpretation}
          onDetails={handleOpenDetails}
          isLoading={actionLoading === row.id}
        />
      ),
      width: 272,
      minWidth: 272,
      maxWidth: 272,
      align: 'center',
      pinned: 'right',
    },
  ];

  return (
    <div className="flex h-full min-w-0 w-full">
        <div className="min-w-0 flex-1">
          <div className="yj-page-shell yj-task-page h-full min-w-0 overflow-y-auto overflow-x-hidden p-6 xl:p-8">
            <div className="yj-task-heading">
              <div><h2 className="yj-page-title">{t("tasks.taskCenterf692ff")}</h2><p className="yj-page-subtitle">{t("tasks.trackAnalysisProgressAndInterpretResults9952cc")}</p></div>

            </div>

            <RetentionNotice kind="task" />

            {actionError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            {error && tasks !== null && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3 text-sm text-warning-fg">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t("tasks.backgroundRefreshFailedShowingPreviouslyLoadedData78931b")}{error}
              </div>
            )}

            {loading && tasks === null && (
              <div className="yj-empty-state">
                <div>
                  <span className="yj-empty-state-icon">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </span>
                  <p className="text-sm text-fg-muted">{t("tasks.loading514c33")}</p>
                </div>
              </div>
            )}

            {error && tasks === null && !loading && (
              <div className="yj-empty-state">
                <div>
                  <span className="yj-empty-state-icon">
                    <AlertTriangle className="w-5 h-5 text-danger-fg" />
                  </span>
                  <p className="text-sm font-medium text-[var(--yj-text-strong)] mb-1">{t("tasks.taskListUnavailable459e4e")}</p>
                  <p className="text-sm text-danger-fg mb-4">{error}</p>
                  <Button permission={null} action="retry" variant="secondary" onClick={refetch}>{t("pipeline.retrye2d53a")}</Button>
                </div>
              </div>
            )}

            {tasks !== null && <HoverHint content={t("tasks.summaryOfUpToRecentTasksUsee0ade1")}><div className="yj-task-metrics" aria-label={t("tasks.recentTaskStatusOverview65fe08")} >
                  {([{ label: t("admin.recentTasksabc5c3"), value: 'all' }, { label: t("admin.running594249"), value: 'running' }, { label: t("tasks.awaitingInterpretation0b7bdd"), value: 'pending_interpretation' }, { label: t("admin.completede99b48"), value: 'completed' }, { label: t("admin.failed3e3c80"), value: 'failed' }] as const).map(item => <button type="button" key={item.label} aria-pressed={statusFilter === item.value} onClick={() => setStatusFilter(item.value)}>
                    <strong>{(recentCounts[item.value] ?? 0).toLocaleString(t.locale)}</strong>{translateUI(item.label, t)}
                  </button>)}
                </div></HoverHint>}
                <div className="yj-panel min-w-0 overflow-hidden">
                <div className="yj-panel-header flex-wrap gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-64">
                      <Input
                        placeholder={t("tasks.searchTaskOrSampleId9c4f1c")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        leftElement={<Search className="w-4 h-4" />}
                      />
                    </div>
                    <div className="w-36">
                      <StatusFilterDropdown
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                      />
                    </div>
                  </div>
                  {tasks !== null && <span className="text-xs text-fg-muted">{t("tasks.showing5d908b")}{filteredTasks.length.toLocaleString(t.locale)} {t("tasks.tasks0fdf86")}</span>}
                  <div role="group" aria-label={t('tasks.taskActions')} className="ml-auto flex flex-wrap items-center gap-2">
                    <Button permission={null} action="download" onClick={downloadTaskBatchTemplate}>{t('samples.downloadTemplatea3afb2')}</Button>
                    <Button permission="tasks.manage" action="upload" onClick={()=>setIsBatchTaskModalOpen(true)}>{t('tasks.uploadTaskInformation')}</Button>
                    <Button permission="tasks.manage" action="add" variant="primary" onClick={()=>setIsNewTaskModalOpen(true)}>{t('tasks.newTask6b717c')}</Button>
                  </div>
                </div>

                {tasks !== null && (filteredTasks.length > 0 ? (
                  <DataTable
                    data={filteredTasks}
                    columns={localizeDisplay(columns, t)}
                    rowKey="id"
                    density="compact"
                    className="yj-data-table right-pinned-actions-table task-center-table"
                  />
                ) : (
                  <EmptyState
                    icon={<List />}
                    title={t("common.noTasks15652e")}
                    description={t("tasks.adjustFiltersOrCreateANewAnalysis5cca37")}
                  />
                ))}
                </div>
          </div>
        </div>
      {/* 新建任务弹窗 */}
      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onSubmit={handleCreateTask}
      />

      <BatchTaskModal
        isOpen={isBatchTaskModalOpen}
        onClose={() => setIsBatchTaskModalOpen(false)}
        onCompleted={async () => {
          await refetch();
        }}
      />

      {/* 编辑任务弹窗 */}
      <EditTaskModal
        isOpen={editingTask !== null}
        onClose={() => setEditingTask(null)}
        onSubmit={handleEditTask}
        task={editingTask}
      />
    </div>
  );
}
