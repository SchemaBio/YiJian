'use client';

import { useText } from '@/i18n/useText';
import { taskOverallProgress } from '@/lib/task-overall-progress';
import type { AnalysisTask } from '@/types/task';

export function TaskProgressCell({ task }: { task: AnalysisTask }) {
  const t = useText();
  const overall = taskOverallProgress({
    status: task.status, template: task.template, progress: task.progress,
    execution_phase: task.executionPhase, vm_status: task.vmStatus,
    bootstrap_phase: task.bootstrapPhase, result_import_status: task.resultImportStatus,
  });
  return <div className="min-w-0 space-y-1" title={t('taskLifecycle.explanation')}>
    <div className="flex items-center gap-2">
      <div role="progressbar" aria-label={t('taskLifecycle.title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={overall.percent}
        aria-valuetext={`${overall.percent}% · ${t(`taskLifecycle.${overall.detail}`)}`}
        className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-canvas-inset">
        <div className={`h-full rounded-full ${overall.stopped ? 'bg-danger-emphasis' : 'bg-accent-emphasis'}`} style={{ width: `${overall.percent}%` }} />
      </div>
      <span className="text-xs tabular-nums text-fg-muted">{overall.percent}%</span>
    </div>
    <p className={`text-xs ${overall.stopped ? 'text-danger-fg' : 'text-fg-muted'}`}>{t(overall.stopped ? 'taskLifecycle.stopped' : `taskLifecycle.${overall.detail}`)}</p>
  </div>;
}
