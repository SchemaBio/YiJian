'use client';
import * as React from 'react';
import { canInterpretTask } from '@/lib/task-interpretation';
import { TableActions, TableAction } from '@/components/shared/TableActions';
import { type ButtonAction } from '@/components/shared/ActionButton';
import { ConfirmDialog } from '@/components/shared';
import type { AnalysisTask } from '@/types/task';

// 操作单元格组件
export function TaskActionsCell({
  task,
  onStart,
  onStop,
  onRetry,
  onEdit,
  onDelete,
  onView,
  onDetails,
  isLoading,
}: {
  task: AnalysisTask;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRetry: (id: string) => void;
  onEdit: (task: AnalysisTask) => void;
  onDelete: (id: string) => void;
  onView: (task: AnalysisTask) => void;
  onDetails: (task: AnalysisTask) => void;
  isLoading: boolean;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // 动态按钮配置：根据状态和进度自动切换
  // 1. 启动 - 排队中(queued)状态
  // 2. 停止 - 运行中(running)状态
  // 3. 解读 - 待解读(pending_interpretation)或已完成(completed)状态
  // 4. 重试 - 失败(failed)状态
  const getPrimaryAction = () => {
    if (task.interpretationCompletedAt) return { disabled: !canInterpretTask(task), label: '完成', action: 'completed' as ButtonAction, onClick: () => onView(task) };
    if (task.executionPhase === 'terminating') return null;
    if (task.executionPhase && task.executionPhase !== 'idle' && task.executionPhase !== 'terminal') {
      return {
        label: task.status === 'completed' ? '释放节点' : '取消',
        action: 'stop' as ButtonAction,
        onClick: () => onStop(task.id),
      };
    }
    switch (task.status) {
      case 'waiting_for_data':
        return {
          label: '等待',
          action: 'wait' as ButtonAction,
          onClick: undefined,
          disabled: true,
        };
      case 'queued':
        return {
          label: '启动',
          action: 'start' as ButtonAction,
          onClick: () => onStart(task.id),
        };
      case 'running':
        return {
          label: '取消',
          action: 'stop' as ButtonAction,
          onClick: () => onStop(task.id),
        };
      case 'pending_interpretation':
      case 'completed':
        if (!canInterpretTask(task)) return { label: '完成', action: 'completed' as ButtonAction, disabled: true };
        return {
          label: '解读',
          action: 'interpret' as ButtonAction,
          onClick: () => onView(task),
        };
      case 'cancelled':
      case 'failed':
        return {
          label: '重试',
          action: 'retry' as ButtonAction,
          onClick: () => onRetry(task.id),
        };
      default:
        return null;
    }
  };

  const primaryAction = getPrimaryAction();
  const executionInFlight = Boolean(
    task.executionPhase
      && task.executionPhase !== 'idle'
      && task.executionPhase !== 'terminal'
  );
  const canEdit = !task.interpretationCompletedAt && task.status !== 'running' && !executionInFlight;
  const canDelete = !task.interpretationCompletedAt;

  return (
    <>
      <TableActions>
        {primaryAction && <TableAction action={primaryAction.action} label={primaryAction.label}
          tone={primaryAction.action === 'stop' ? 'danger' : primaryAction.disabled || primaryAction.action === 'completed' ? 'default' : 'primary'}
          loading={isLoading} loadingLabel="处理中" disabled={isLoading || primaryAction.disabled} onClick={primaryAction.onClick} />}
        <TableAction action="view" label="详情" disabled={!canInterpretTask(task)} hint={canInterpretTask(task) ? "查看任务详情" : "CNV 校正任务不提供变异解读详情"} aria-label={`查看任务 ${task.internalId || task.id} 详情`} onClick={() => onDetails(task)} />
        <TableAction action="edit" label="编辑" disabled={!canEdit || isLoading}
          hint={canEdit ? '编辑任务' : task.interpretationCompletedAt ? '解读已完成，请先取消解读完成' : '请先停止运行中的任务'} onClick={() => onEdit(task)} />
        <TableAction action="delete" label="删除" tone="danger" disabled={!canDelete || isLoading}
          hint={canDelete ? '删除任务' : '解读已完成，请先取消解读完成'} onClick={() => setShowDeleteConfirm(true)} />
      </TableActions>

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

