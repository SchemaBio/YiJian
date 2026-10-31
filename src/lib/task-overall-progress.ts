import type { TaskProgressResponse } from '@/types/task';

export const taskLifecycleSteps = ['queue', 'node', 'initialize', 'analysis', 'results'] as const;

// Display weights describe milestones, not elapsed time. Never advance on a timer.
const bootstrapMilestones: Record<string, { percent: number; key: string }> = {
  starting: { percent: 10, key: 'starting' },
  preflight: { percent: 11, key: 'preflight' },
  mounting: { percent: 12, key: 'mounting' },
  references: { percent: 14, key: 'references' },
  downloading: { percent: 16, key: 'downloading' },
  validating_inputs: { percent: 18, key: 'validating' },
  agent: { percent: 19, key: 'agent' },
};

export function taskOverallProgress(task: Partial<TaskProgressResponse>) {
  const status = task.status ?? '';
  const phase = task.execution_phase;
  const vm = task.vm_status?.toUpperCase();
  const stopped = ['failed', 'error', 'cancelled', 'canceled'].includes(status)
    || ['diagnostic_hold', 'release_failed'].includes(phase ?? '')
    || task.result_import_status === 'failed';
  const raw = task.analysis_progress?.percent ?? task.progress ?? 0;
  const analysis = Number.isFinite(raw) ? Math.min(98, Math.max(0, raw)) : 0;
  const workflowDone = ['completed', 'succeeded', 'success', 'pending_interpretation'].includes(status);
  // New tasks already have import status "pending" before any analysis starts.
  const importPending = !['baseline_fix', 'germline_baseline_fix'].includes(task.template ?? '')
    && (['running', 'failed'].includes(task.result_import_status ?? '')
      || (workflowDone && ['pending', 'queued'].includes(task.result_import_status ?? '')));
  const completed = workflowDone && !importPending;
  let percent = 0, step = 0, detail = status === 'waiting_for_data' ? 'waitingData' : 'queue';

  if (completed) {
    percent = 100; step = 4; detail = 'complete';
  } else if (importPending || phase === 'archiving' || analysis >= 98) {
    percent = importPending ? 97 : 95; step = 4;
    detail = task.result_import_status === 'failed' ? 'importFailed' : importPending ? 'importing' : 'archiving';
  } else if (phase !== 'running' && (bootstrapMilestones[task.bootstrap_phase ?? ''] || phase === 'bootstrapping')) {
    const milestone = bootstrapMilestones[task.bootstrap_phase ?? ''];
    percent = milestone?.percent ?? 8; step = 2; detail = milestone?.key ?? 'waitingReport';
  } else if (phase === 'running' || task.bootstrap_phase === 'running'
    || (!['bootstrapping', 'waiting_quota', 'waiting_capacity', 'dispatching'].includes(phase ?? '') && analysis > 0)) {
    percent = Math.min(95, 20 + Math.floor(analysis / 98 * 75)); step = 3; detail = 'analysis';
  } else if (vm === 'PENDING') {
    percent = 8; step = 1; detail = 'starting';
  } else if (phase === 'dispatching' || vm === 'DISPATCHING') {
    percent = 5; step = 1; detail = 'allocating';
  } else if (phase === 'waiting_capacity' || vm === 'WAITING_CAPACITY') {
    percent = 3; step = 1; detail = 'capacity';
  } else if (phase === 'waiting_quota') {
    percent = 2; detail = 'quota';
  } else if (['queued', 'pending'].includes(status)) {
    percent = 1;
  } else if (status === 'running' && !stopped) {
    percent = 20; step = 3; detail = 'analysis';
  }
  if (stopped && percent === 0) detail = 'noProgress';
  return { percent, step, detail, stopped, completed };
}
