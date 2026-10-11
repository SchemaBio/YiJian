// Calibration tasks produce baseline resources, not variant interpretation reports.
export function canInterpretTask(task: { template?: string }): boolean {
  return task.template !== 'baseline_fix';
}
