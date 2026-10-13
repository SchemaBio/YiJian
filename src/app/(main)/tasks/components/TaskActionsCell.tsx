'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

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
  const t = useText();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // 动态按钮配置：根据状态和进度自动切换
  // 1. 启动 - 排队中(queued)状态
  // 2. 停止 - 运行中(running)状态
  // 3. 解读 - 待解读(pending_interpretation)或已完成(completed)状态
  // 4. 重试 - 失败(failed)状态
  const getPrimaryAction = () => {
    if (task.interpretationCompletedAt) return { disabled: !canInterpretTask(task), label: t("tasks.done33246f"), action: 'completed' as ButtonAction, onClick: () => onView(task) };
    if (task.executionPhase === 'terminating') return null;
    if (task.executionPhase && task.executionPhase !== 'idle' && task.executionPhase !== 'terminal') {
      return {
        label: task.status === 'completed' ? t("tasks.releaseNode76fea1") : t("admin.cancel4d0b46"),
        action: 'stop' as ButtonAction,
        onClick: () => onStop(task.id),
      };
    }
    switch (task.status) {
      case 'waiting_for_data':
        return {
          label: t("admin.waiting25d23b"),
          action: 'wait' as ButtonAction,
          onClick: undefined,
          disabled: true,
        };
      case 'queued':
        return {
          label: t("tasks.startebd26d"),
          action: 'start' as ButtonAction,
          onClick: () => onStart(task.id),
        };
      case 'running':
        return {
          label: t("admin.cancel4d0b46"),
          action: 'stop' as ButtonAction,
          onClick: () => onStop(task.id),
        };
      case 'pending_interpretation':
      case 'completed':
        if (!canInterpretTask(task)) return { label: t("tasks.done33246f"), action: 'completed' as ButtonAction, disabled: true };
        return {
          label: t("tasks.interpret10d345"),
          action: 'interpret' as ButtonAction,
          onClick: () => onView(task),
        };
      case 'cancelled':
      case 'failed':
        return {
          label: t("pipeline.retrye2d53a"),
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
        {primaryAction && <TableAction action={primaryAction.action} label={translateUI(primaryAction.label, t)}
          tone={primaryAction.action === 'stop' ? 'danger' : primaryAction.disabled || primaryAction.action === 'completed' ? 'default' : 'primary'}
          loading={isLoading} loadingLabel={t("tasks.processingfcb979")} disabled={isLoading || primaryAction.disabled} onClick={primaryAction.onClick} />}
        <TableAction action="view" label={t("tasks.details4f55ee")} disabled={!canInterpretTask(task)} hint={canInterpretTask(task) ? t("tasks.viewTaskDetailsfe0ccc") : t("tasks.cnvCalibrationTasksHaveNoVariantInterpretation699c4f")} aria-label={t("tasks.viewTaskDetailsf20ee8", {p0: String(task.internalId || task.id)})} onClick={() => onDetails(task)} />
        <TableAction action="edit" label={t("admin.edita7f814")} disabled={!canEdit || isLoading}
          hint={canEdit ? t("tasks.editTask67659b") : task.interpretationCompletedAt ? t("tasks.interpretationIsCompleteReopenItFirsta9331f") : t("tasks.stopTheRunningTaskFirst2d18d7")} onClick={() => onEdit(task)} />
        <TableAction action="delete" label={t("data.delete3755f5")} tone="danger" disabled={!canDelete || isLoading}
          hint={canDelete ? t("tasks.deleteTask070581") : t("tasks.interpretationIsCompleteReopenItFirsta9331f")} onClick={() => setShowDeleteConfirm(true)} />
      </TableActions>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t("tasks.deleteAnalysisTask9b9e33")}
        message={t("tasks.deleteTaskExecutionRecordsAndResultsMayf27ee3", {p0: String(task.internalId || task.id)})}
        confirmLabel={t("data.confirmDeletion3c06ab")}
        variant="danger"
        onConfirm={() => onDelete(task.id)}
      />
    </>
  );
}

