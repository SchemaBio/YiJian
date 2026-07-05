'use client';

import * as React from 'react';
import { Button, Input } from '@schema/ui-kit';
import { X } from 'lucide-react';
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
    if (!task || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(task.id, formData);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="编辑任务"
      size="small"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={(e: React.MouseEvent) => handleSubmit(e)} disabled={submitting}>保存</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <div>
          <label className="block text-xs text-fg-muted mb-1">样本编号</label>
          <Input value={task.sampleId} disabled className="bg-gray-50 text-fg-muted" />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">内部编号 *</label>
          <Input value={formData.internalId} onChange={(e) => handleChange('internalId', e.target.value)} placeholder="如：INT-001" required />
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">分析流程 *</label>
          <select
            value={formData.pipeline}
            onChange={(e) => handleChange('pipeline', e.target.value)}
            className="w-full px-3 py-2 border border-border-default rounded-md text-fg-default bg-canvas-default focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            required
          >
            {pipelineOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">备注</label>
          <Input value={formData.remark} onChange={(e) => handleChange('remark', e.target.value)} placeholder="可选备注信息" />
        </div>
      </form>
    </AppModal>
  );
}