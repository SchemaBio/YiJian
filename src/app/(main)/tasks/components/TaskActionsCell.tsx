'use client';
import { isFamilyAnalysis } from '@/lib/analysis-availability';
import { OperationScope } from '@/components/providers/BusinessPermissionProvider';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import * as React from 'react';
import { canInterpretTask, isTaskResultPreparing, isTaskResultImportFailed } from '@/lib/task-interpretation';
import { TableActions, TableAction } from '@/components/shared/TableActions';
import { type ButtonAction } from '@/components/shared/ActionButton';
import { ConfirmDialog } from '@/components/shared';
import type { AnalysisTask } from '@/types/task';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

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
  const terminalStatus = ['completed', 'failed', 'cancelled'].includes(task.status);
  // Cloud jobs may still own a node after analysis ends. Local terminal tasks
  // have no node to release, even if an older backend left a stale phase.
  const executionInFlight = Boolean(
    task.executionPhase && task.executionPhase !== 'idle' && task.executionPhase !== 'terminal'
    && (getRuntimeBackendFlavor() === 'squid' || !terminalStatus)
  );

  // 动态按钮配置：根据状态和进度自动切换
  // 1. 启动 - 排队中(queued)状态
  // 2. 停止 - 运行中(running)状态
  // 3. 解读 - 待解读(pending_interpretation)或已完成(completed)状态
  // 4. 重试 - 失败(failed)状态
  const getPrimaryAction = () => {
    if (isTaskResultImportFailed(task)) return { label: t('tasks.resultImportFailed81188a'), action: 'view' as ButtonAction, onClick: () => onDetails(task) };
    if (isTaskResultPreparing(task)) return { label: t("uploadExperience.resultsPreparing"), action: "wait" as ButtonAction, disabled: true };
    if (task.interpretationCompletedAt) return { disabled: !canInterpretTask(task), label: t("tasks.done33246f"), action: 'lock' as ButtonAction, onClick: () => onView(task) };
    // Node cleanup belongs to the service, never to the interpretation user.
    // Completed results remain readable while asynchronous cleanup finishes.
    if (executionInFlight && !['completed', 'pending_interpretation'].includes(task.status)) {
      if (terminalStatus || ['terminating', 'release_failed'].includes(task.executionPhase ?? '')) {
        return { label: t('tasks.automaticNodeCleanup'), action: 'wait' as ButtonAction, disabled: true };
      }
      return {
        label: t("admin.cancel4d0b46"),
        action: 'stop' as ButtonAction,
        onClick: () => onStop(task.id),
      };
    }

	if (isFamilyAnalysis(task) && ['queued','waiting_for_data','failed','cancelled'].includes(task.status)) {
		return {label:t('familyAnalysis.unavailable'), action:'wait' as ButtonAction, disabled:true};
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
  const canEdit = !isFamilyAnalysis(task) && !task.interpretationCompletedAt && task.status !== 'running' && !executionInFlight;
  const canDelete = !task.interpretationCompletedAt;

  return (
    <OperationScope permission={task.template === 'baseline_fix' ? 'baselines.manage' : 'tasks.manage'}>
      <TableActions>
        {primaryAction && <TableAction action={primaryAction.action} permission={task.interpretationCompletedAt ? null : undefined} label={translateUI(primaryAction.label, t)}
          tone={primaryAction.action === 'stop' ? 'danger' : primaryAction.disabled || task.interpretationCompletedAt || primaryAction.action === 'completed' ? 'default' : 'primary'}
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
    </OperationScope>
  );
}

