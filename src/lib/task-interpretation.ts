type ResultReadiness = { template?: string; status?: string; resultImportStatus?: string; executionPhase?: string };
export function isTaskResultPreparing(task: ResultReadiness): boolean {
  return task.template !== 'baseline_fix' && ['completed', 'pending_interpretation'].includes(task.status ?? '') &&
    (!!task.resultImportStatus && task.resultImportStatus !== 'success');
}
export function canInterpretTask(task: ResultReadiness): boolean {
  return task.template !== 'baseline_fix' && !isTaskResultPreparing(task);
}
