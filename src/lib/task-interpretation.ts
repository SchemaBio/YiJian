type ResultReadiness = { template?: string; status?: string; resultImportStatus?: string; executionPhase?: string };
export function isTaskResultPreparing(task: ResultReadiness): boolean {
  return task.template !== 'baseline_fix' && ['completed', 'pending_interpretation'].includes(task.status ?? '') &&
    (!!task.resultImportStatus && !['success', 'failed'].includes(task.resultImportStatus));
}
export function isTaskResultImportFailed(task: ResultReadiness): boolean {
  return task.template !== 'baseline_fix' && ['completed', 'pending_interpretation'].includes(task.status ?? '') && task.resultImportStatus === 'failed';
}
export function canInterpretTask(task: ResultReadiness): boolean {
  return task.template !== 'baseline_fix' && !isTaskResultPreparing(task) && !isTaskResultImportFailed(task);
}
