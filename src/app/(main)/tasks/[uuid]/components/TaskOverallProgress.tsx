'use client';

import { useText } from '@/i18n/useText';
import { taskLifecycleSteps, taskOverallProgress } from '@/lib/task-overall-progress';
import type { TaskProgressResponse } from '@/types/task';

export function TaskOverallProgress({ task }: { task: Partial<TaskProgressResponse> }) {
  const t = useText();
  const overall = taskOverallProgress(task);
  return <section aria-label={t('taskLifecycle.title')}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <h3 className="font-semibold text-fg-default">{t('taskLifecycle.title')}</h3>
      <span className="font-semibold tabular-nums">{overall.percent}%</span>
    </div>
    <div role="progressbar" aria-label={t('taskLifecycle.title')} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={overall.percent} aria-valuetext={`${overall.percent}% · ${t(`taskLifecycle.${overall.detail}`)}`}
      className="mt-3 h-2 overflow-hidden rounded-full bg-canvas-inset">
      <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${overall.stopped ? 'bg-danger-emphasis' : 'bg-accent-emphasis'}`} style={{ width: `${overall.percent}%` }} />
    </div>
    <ol className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
      {taskLifecycleSteps.map((key, index) => <li key={key} aria-current={!overall.completed && index === overall.step ? 'step' : undefined}
        className={`rounded-md border px-2 py-2 ${index <= overall.step ? 'border-accent-muted bg-accent-subtle text-fg-default' : 'border-border-default text-fg-muted'}`}>
        <span className="mr-1 tabular-nums">{overall.completed || index < overall.step ? '✓' : `${index + 1}.`}</span>{t(`taskLifecycle.step_${key}`)}
      </li>)}
    </ol>
    <p className={`mt-3 text-sm ${overall.stopped ? 'text-danger-fg' : 'text-fg-default'}`}>
      {overall.stopped && <span>{t('taskLifecycle.stopped')} · </span>}{t(`taskLifecycle.${overall.detail}`)}
    </p>
    <p className="mt-1 text-xs text-fg-muted">{t('taskLifecycle.explanation')}</p>
  </section>;
}
