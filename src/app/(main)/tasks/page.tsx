'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Button, Input, DataTable, Tag, Tooltip } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search, Plus, RotateCcw, X, ChevronRight, ChevronLeft, List, Play, Square, Pencil, Trash2, BookOpen, ChevronDown, Loader2, AlertTriangle, FileSpreadsheet, MoreHorizontal } from 'lucide-react';
import { AnalysisDetailPanel, NewTaskModal, BatchTaskModal, EditTaskModal } from './components';
import type { NewTaskFormData, EditTaskFormData } from './components';
import type { AnalysisTask } from '@/types/task';
import { tasksApi } from '@/lib/tasks';
import { useApi, usePolling } from '@/hooks';
import { ConfirmDialog, EmptyState, IdCell, TaskStatusTag } from '@/components/shared';
import { TaskCostValue } from '@/components/billing';
import { getRecentTaskBilling, notifyBillingUpdated, type TaskBillingSummary } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { formatLocalDateTime } from '@/lib/utils';

const statusConfig: Record<AnalysisTask['status'], { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }> = {
  waiting_for_data: { label: '等待数据', variant: 'warning' },
  queued: { label: '排队中', variant: 'neutral' },
  running: { label: '运行中', variant: 'info' },
  completed: { label: '已完成', variant: 'success' },
  failed: { label: '失败', variant: 'danger' },
  cancelled: { label: '已取消', variant: 'neutral' },
  pending_interpretation: { label: '待解读', variant: 'warning' },
};

const statusDotColors: Record<AnalysisTask['status'], string> = {
  waiting_for_data: 'bg-attention-emphasis',
  queued: 'bg-neutral-emphasis',
  running: 'bg-accent-emphasis',
  completed: 'bg-success-emphasis',
  failed: 'bg-danger-emphasis',
  cancelled: 'bg-neutral-emphasis',
  pending_interpretation: 'bg-attention-emphasis',
};

const statusFilterOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '运行中' },
  { value: 'pending_interpretation', label: '待解读' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
];

function areTaskListsEqual(previous: AnalysisTask[], next: AnalysisTask[]): boolean {
  return previous.length === next.length && previous.every((task, index) => {
    const candidate = next[index];
    return task.id === candidate.id
      && task.sampleId === candidate.sampleId
      && task.internalId === candidate.internalId
      && task.pipeline === candidate.pipeline
      && task.pipelineVersion === candidate.pipelineVersion
      && task.status === candidate.status
      && task.progress === candidate.progress
      && task.createdAt === candidate.createdAt
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
      return <span className="text-sm text-fg-default">全部状态</span>;
    }
    const config = statusConfig[value as AnalysisTask['status']];
    return <Tag variant={config.variant} className="w-14 justify-center">{config.label}</Tag>;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 border border-border-default rounded bg-canvas-default hover:bg-canvas-inset transition-colors"
      >
        {getCurrentDisplay()}
        <ChevronDown className={`w-4 h-4 text-fg-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 py-1 min-w-[120px]">
          {/* 全部状态选项 */}
          <button
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
              value === 'all' ? 'bg-gray-100' : ''
            }`}
            onClick={() => {
              onChange('all');
              setIsOpen(false);
            }}
          >
            <span className="text-fg-default">全部状态</span>
          </button>

          {/* 各状态选项 */}
          {statusFilterOptions.filter(opt => opt.value !== 'all').map((option) => {
            const config = statusConfig[option.value as AnalysisTask['status']];
            const isSelected = value === option.value;
            return (
              <button
                key={option.value}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                  isSelected ? 'bg-gray-100' : ''
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <Tag variant={config.variant} className="w-14 justify-center">{config.label}</Tag>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface OpenTab {
  id: string;
  taskId: string;
  sampleId: string;
  name: string;
}

// 操作单元格组件
function TaskActionsCell({
  task,
  onStart,
  onStop,
  onRetry,
  onEdit,
  onDelete,
  onView,
  isLoading,
}: {
  task: AnalysisTask;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRetry: (id: string) => void;
  onEdit: (task: AnalysisTask) => void;
  onDelete: (id: string) => void;
  onView: (task: AnalysisTask) => void;
  isLoading: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  // 动态按钮配置：根据状态和进度自动切换
  // 1. 启动 - 排队中(queued)状态
  // 2. 停止 - 运行中(running)状态
  // 3. 解读 - 待解读(pending_interpretation)或已完成(completed)状态
  // 4. 重试 - 失败(failed)状态
  const getPrimaryAction = () => {
    switch (task.status) {
      case 'queued':
        return {
          label: '启动',
          icon: Play,
          onClick: () => onStart(task.id),
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100',
        };
      case 'running':
        return {
          label: '停止',
          icon: Square,
          onClick: () => onStop(task.id),
          className: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100',
        };
      case 'pending_interpretation':
      case 'completed':
        return {
          label: '解读',
          icon: BookOpen,
          onClick: () => onView(task),
          className: 'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100',
        };
      case 'failed':
        return {
          label: '重试',
          icon: RotateCcw,
          onClick: () => onRetry(task.id),
          className: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100',
        };
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();
  const canEdit = task.status !== 'running';
  const canDelete = true;

  return (
    <>
      <div
        className="inline-flex h-9 items-center justify-center gap-0.5 rounded-lg border border-border-default bg-canvas-default p-0.5 shadow-[0_1px_2px_rgba(17,24,39,0.06)]"
        onClick={(event) => event.stopPropagation()}
      >
        {primaryAction && (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={isLoading}
            aria-label={primaryAction.label}
            className={`inline-flex h-8 min-w-[68px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold shadow-[0_1px_1px_rgba(17,24,39,0.04)] transition-all ${isLoading ? 'cursor-wait opacity-60' : 'active:translate-y-px'} ${primaryAction.className}`}
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <primaryAction.icon className="h-3.5 w-3.5" />}
            {isLoading ? '处理中' : primaryAction.label}
          </button>
        )}

        <PopoverPrimitive.Root open={showMoreMenu} onOpenChange={setShowMoreMenu}>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-fg-muted transition-colors hover:bg-canvas-subtle hover:text-fg-default data-[state=open]:bg-canvas-subtle data-[state=open]:text-fg-default"
              aria-label="更多任务操作"
              title="更多操作"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              side="bottom"
              align="end"
              sideOffset={6}
              collisionPadding={12}
              onClick={(event) => event.stopPropagation()}
              className="z-50 w-44 overflow-hidden rounded-lg border border-border-default bg-canvas-default p-1.5 shadow-[0_10px_30px_rgba(17,24,39,0.14)] outline-none"
            >
              <div role="menu" aria-label="任务操作">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canEdit}
                  title={canEdit ? '编辑任务' : '请先停止运行中的任务'}
                  onClick={() => {
                    setShowMoreMenu(false);
                    onEdit(task);
                  }}
                  className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-fg-default transition-colors hover:bg-canvas-subtle disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Pencil className="h-4 w-4 text-fg-muted" />
                  编辑任务
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canDelete}
                  title="删除任务"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-fg-muted disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Trash2 className="h-4 w-4" />
                  删除任务
                </button>
                {!canEdit && (
                  <p className="mx-2 mt-1 border-t border-border-muted pt-2 pb-1 text-[11px] leading-4 text-fg-muted">
                    请先停止任务再进行修改
                  </p>
                )}
              </div>
              <PopoverPrimitive.Arrow className="fill-canvas-default" />
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="删除分析任务"
        message={`确定删除任务 ${task.internalId || task.id}？已产生的运行记录和结果可能无法恢复。`}
        confirmLabel="确认删除"
        variant="danger"
        onConfirm={() => onDelete(task.id)}
      />
    </>
  );
}

export default function AnalysisPage() {
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [openTabs, setOpenTabs] = React.useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = React.useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(true);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = React.useState(false);
  const [isBatchTaskModalOpen, setIsBatchTaskModalOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<AnalysisTask | null>(null);
  const [actionError, setActionError] = React.useState('');
  const [taskBilling, setTaskBilling] = React.useState<Record<string, TaskBillingSummary>>({});
  const [billingLoading, setBillingLoading] = React.useState(false);

  // Create fetcher function with current statusFilter
  const fetcher = React.useCallback(async () => {
    const params: Record<string, string> = { page: '1', page_size: '100' };
    if (statusFilter !== 'all') params.status = statusFilter;
    const data = await tasksApi.list(params);
    return data.items;
  }, [statusFilter]);

  // Use polling hook - auto-polls when there are running tasks
  const { data: tasks, loading, error, refetch } = usePolling(
    fetcher,
    10000,
    { enabled: true, immediate: true, isEqual: areTaskListsEqual }
  );

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
      });
      refetch(); // Refresh data after creating
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
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
      const message = err instanceof Error ? err.message : 'Failed to update task';
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
      setActionError(err instanceof Error ? err.message : '启动任务失败');
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
      setActionError(err instanceof Error ? err.message : '停止任务失败');
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
      setActionError(err instanceof Error ? err.message : '重试任务失败');
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
      setActionError(err instanceof Error ? err.message : '删除任务失败');
    }
  };

  const handleOpenTab = React.useCallback((task: AnalysisTask) => {
    const existingTab = openTabs.find(t => t.taskId === task.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab: OpenTab = {
      id: `tab-${Date.now()}`,
      taskId: task.id,
      sampleId: task.sampleId,
      name: task.sampleId,
    };
    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [openTabs]);

  const handleCloseTab = React.useCallback((tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const filteredTasks = React.useMemo(() => {
    let result = tasks ?? [];
    // 先按状态筛选
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }
    // 再按搜索词筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(query) ||
          t.sampleId.toLowerCase().includes(query) ||
          t.internalId.toLowerCase().includes(query)
      );
    }
    return result;
  }, [searchQuery, statusFilter, tasks]);

  const columns: Column<AnalysisTask>[] = [
    {
      id: 'taskId',
      header: '任务编号',
      accessor: (row) => <IdCell id={row.id} />,
      width: 100,
      align: 'center',
    },
    {
      id: 'sample',
      header: '样本编号',
      accessor: (row) => (
        <div className="flex flex-col items-center gap-0.5">
          <IdCell id={row.sampleId} />
          <span className="text-xs text-fg-muted">{row.internalId}</span>
        </div>
      ),
      width: 140,
      align: 'center',
    },
    {
      id: 'pipeline',
      header: '分析流程',
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
      header: '状态',
      accessor: (row) => {
        const config = statusConfig[row.status];
        return <Tag variant={config.variant} className="w-14 justify-center">{config.label}</Tag>;
      },
      width: 90,
      align: 'center',
    },
    {
      id: 'progress',
      header: '进度',
      accessor: (row) => (
        <div className="flex items-center justify-center gap-2">
          <div className="flex-1 h-2 bg-canvas-inset rounded-full overflow-hidden max-w-[60px]">
            <div
              className={`h-full rounded-full transition-all ${
                row.status === 'failed' ? 'bg-danger-emphasis' : 'bg-accent-emphasis'
              }`}
              style={{ width: `${row.progress}%` }}
            />
          </div>
          <span className="text-xs text-fg-muted w-8">{row.progress}%</span>
        </div>
      ),
      width: 120,
      align: 'center',
    },
    ...(isSaaS ? [{
      id: 'cost',
      header: '费用',
      accessor: (row: AnalysisTask) => (
        <TaskCostValue summary={taskBilling[row.id]} loading={billingLoading && !taskBilling[row.id]} />
      ),
      width: 110,
      align: 'center' as const,
    }] : []),
    {
      id: 'createdAt',
      header: '创建时间',
      accessor: (row) => <span className="whitespace-nowrap tabular-nums">{formatLocalDateTime(row.createdAt)}</span>,
      width: 170,
      align: 'center',
    },
    {
      id: 'completedAt',
      header: '完成时间',
      accessor: (row) => <span className="whitespace-nowrap tabular-nums">{formatLocalDateTime(row.completedAt)}</span>,
      width: 170,
      align: 'center',
    },
    {
      id: 'remark',
      header: '备注',
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
      header: '操作',
      accessor: (row) => (
        <TaskActionsCell
          task={row}
          onStart={handleStartTask}
          onStop={handleStopTask}
          onRetry={handleRetryTask}
          onEdit={setEditingTask}
          onDelete={handleDeleteTask}
          onView={handleOpenTab}
          isLoading={actionLoading === row.id}
        />
      ),
      width: 126,
      minWidth: 122,
      maxWidth: 140,
      align: 'center',
      pinned: 'right',
    },
  ];

  const activeTab = openTabs.find(t => t.id === activeTabId);
  const hasOpenTabs = openTabs.length > 0;

  return (
    <div className="flex h-full min-w-0 w-full">
      {/* 左侧任务列表 */}
      {hasOpenTabs ? (
        // 收起/展开状态
        sidebarCollapsed ? (
          // 完全收起：只显示展开按钮
          <div className="w-10 flex-shrink-0 border-r border-border-default bg-canvas-subtle flex flex-col items-center py-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-2 rounded hover:bg-canvas-inset text-fg-muted hover:text-fg-default transition-colors"
              title="展开任务列表"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="mt-2 text-xs text-fg-muted writing-mode-vertical">
              任务
            </div>
            {/* 显示打开的任务数量 */}
            <div className="mt-auto mb-2 w-5 h-5 rounded-full bg-accent-emphasis text-white text-xs flex items-center justify-center">
              {openTabs.length}
            </div>
          </div>
        ) : (
          // 展开状态：窄边栏显示样本列表
          <div className="w-56 flex-shrink-0 border-r border-border-default bg-canvas-subtle flex flex-col">
            {/* 标题栏 */}
            <div className="px-3 py-2 border-b border-border-default flex items-center justify-between">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-fg-muted" />
                <span className="text-sm font-medium text-fg-default">任务列表</span>
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1 rounded hover:bg-canvas-inset text-fg-muted hover:text-fg-default transition-colors"
                title="收起"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* 搜索框 */}
            <div className="p-2 border-b border-border-default">
              <Input
                placeholder="搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftElement={<Search className="w-3.5 h-3.5" />}
                className="text-xs"
              />
            </div>

            {/* 任务列表 */}
            <div className="flex-1 overflow-auto">
              {filteredTasks.map((task) => {
                const isOpen = openTabs.some(t => t.taskId === task.id);
                const isActive = activeTab?.taskId === task.id;
                return (
                  <div
                    key={task.id}
                    onClick={() => handleOpenTab(task)}
                    className={`
                      px-3 py-2 cursor-pointer border-b border-border-muted
                      transition-colors
                      ${isActive
                        ? 'bg-accent-subtle border-l-2 border-l-accent-emphasis'
                        : isOpen
                          ? 'bg-canvas-inset'
                          : 'hover:bg-canvas-inset'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusDotColors[task.status]}`} />
                      <span className={`text-sm ${isActive ? 'text-accent-fg font-medium' : 'text-fg-default'}`}>
                        {task.internalId}
                      </span>
                    </div>
                    <div className="text-xs text-fg-muted ml-4 font-mono">{task.sampleId}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        // 展开状态：完整表格
        <div className="min-w-0 flex-1">
          <div className="yj-page-shell h-full min-w-0 overflow-y-auto overflow-x-hidden p-6 xl:p-8">
            <div className="yj-page-header">
              <h2 className="yj-page-title">任务列表</h2>
            </div>

            {actionError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            {error && tasks !== null && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3 text-sm text-warning-fg">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                后台刷新失败，当前显示的是上一次成功加载的数据：{error}
              </div>
            )}

            {loading && tasks === null && (
              <div className="yj-empty-state">
                <div>
                  <span className="yj-empty-state-icon">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </span>
                  <p className="text-sm text-fg-muted">加载中...</p>
                </div>
              </div>
            )}

            {error && tasks === null && !loading && (
              <div className="yj-empty-state">
                <div>
                  <span className="yj-empty-state-icon">
                    <AlertTriangle className="w-5 h-5 text-danger-fg" />
                  </span>
                  <p className="text-sm font-medium text-[var(--yj-text-strong)] mb-1">任务列表暂不可用</p>
                  <p className="text-sm text-danger-fg mb-4">{error}</p>
                  <Button variant="secondary" onClick={refetch}>重试</Button>
                </div>
              </div>
            )}

            {tasks !== null && (
              <>
                <div className="yj-toolbar-panel">
                  <div className="flex items-center gap-4">
                    <div className="w-64">
                      <Input
                        placeholder="搜索样本编号..."
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
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" leftIcon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => setIsBatchTaskModalOpen(true)}>
                      批量新建
                    </Button>
                    <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsNewTaskModalOpen(true)}>
                      新建任务
                    </Button>
                  </div>
                </div>

                {filteredTasks.length > 0 ? (
                  <DataTable
                    data={filteredTasks}
                    columns={columns}
                    rowKey="id"
                    striped
                    density="compact"
                    className="yj-data-table right-pinned-actions-table task-center-table"
                  />
                ) : (
                  <EmptyState
                    className="yj-panel"
                    icon={<List />}
                    title="暂无任务"
                    description="调整筛选条件，或创建新的分析任务。"
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 右侧详情面板 */}
      {hasOpenTabs && (
        <div className="flex-1 flex flex-col min-w-0">
          {/* 标签栏 */}
          <div className="flex items-center border-b border-border-default bg-canvas-subtle overflow-x-auto flex-shrink-0">
            {openTabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-border-muted
                  text-sm whitespace-nowrap transition-colors
                  ${activeTabId === tab.id
                    ? 'bg-canvas-default text-fg-default border-b-2 border-b-accent-emphasis -mb-px'
                    : 'text-fg-muted hover:bg-canvas-inset hover:text-fg-default'
                  }
                `}
              >
                <span>{tab.name}</span>
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="p-0.5 rounded hover:bg-canvas-inset"
                  aria-label="关闭标签"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* 详情内容 */}
          <div className="flex-1 overflow-auto">
            {activeTab && (
              <AnalysisDetailPanel
                key={activeTab.taskId}
                taskId={activeTab.taskId}
              />
            )}
          </div>
        </div>
      )}

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
