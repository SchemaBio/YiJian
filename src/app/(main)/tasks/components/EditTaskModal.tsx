'use client';
import {canEditTask} from '@/lib/task-editing';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import { Input } from '@schema/ui-kit';

import { AppModal } from '@/components/shared';
import type { AnalysisTask } from '@/types/task';

export type { AnalysisTask };

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: EditTaskFormData) => void | Promise<void>;
  task: AnalysisTask | null;
}

export interface EditTaskFormData {
  internalId: string;
  pipeline: string;
  remark: string;
}

const pipelineOptions = [
  'WES-Germline-v1',
  'WES-Germline-v2',
  'Panel-Cardio',
  'Panel-Neuro',
  'WGS-Germline-v1',
];

export function EditTaskModal({ isOpen, onClose, onSubmit, task }: EditTaskModalProps) {
  const t = useText();
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState<EditTaskFormData>({
    internalId: '',
    pipeline: '',
    remark: '',
  });

  // 当 task 变化时更新表单数据
  React.useEffect(() => {
    if (task) {
      setSubmitError('');
      setFormData({
        internalId: task.internalId,
        pipeline: task.pipeline,
        remark: task.remark || '',
      });
    }
  }, [task]);

  const handleChange = (field: keyof EditTaskFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!task || submitting || !canEditTask(task)) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(task.id, formData);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? errorText(err, t) : t("tasks.unableToUpdateTask64c6e4"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title={t("tasks.editTask67659b")}
      size="small"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>{t("admin.cancel4d0b46")}</Button>
          <Button action="save" variant="primary" onClick={(e: React.MouseEvent) => handleSubmit(e)} disabled={submitting||!canEditTask(task)}>{t("data.savefadf24")}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}><fieldset disabled={submitting||!canEditTask(task)} className="space-y-4">
 {!canEditTask(task)&&<p role="alert">{t("tasks.onlyFailedOrQueuedEditable")}</p>}
        {submitError && (
          <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
            {submitError}
          </div>
        )}
        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("history.sampleId6d686e")}</label>
          <Input value={task.sampleId} disabled className="bg-canvas-subtle text-fg-muted" />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("samples.internalIdadcd0f")}</label>
          <Input value={formData.internalId} onChange={(e) => handleChange('internalId', e.target.value)} placeholder={t("samples.forExampleInt00b6e2")} required />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("tasks.analysisPipeline22bb4b")}</label>
          <select
            value={formData.pipeline}
            onChange={(e) => handleChange('pipeline', e.target.value)}
            className="w-full px-3 py-2 border border-border-default rounded-md text-fg-default bg-canvas-default focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            required
          >
            {formData.pipeline && !pipelineOptions.includes(formData.pipeline) && (
              <option value={formData.pipeline}>{formData.pipeline}</option>
            )}
            {pipelineOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">{t("admin.notese03614")}</label>
          <Input value={formData.remark} onChange={(e) => handleChange('remark', e.target.value)} placeholder={t("tasks.optionalNotes6dd2f7")} />
        </div>
      </fieldset></form>
    </AppModal>
  );
}
