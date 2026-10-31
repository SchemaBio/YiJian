import { describe, expect, it } from 'vitest';
import { taskOverallProgress } from './task-overall-progress';

describe('overall task progress', () => {
  it('includes real allocation and bootstrap milestones before analysis', () => {
    const stages = [
      { status: 'queued' },
      { execution_phase: 'waiting_capacity' },
      { execution_phase: 'dispatching' },
      { vm_status: 'PENDING' },
      { execution_phase: 'bootstrapping' },
      ...['starting', 'preflight', 'mounting', 'references', 'downloading', 'validating_inputs', 'agent'].map(bootstrap_phase => ({ execution_phase: 'bootstrapping', bootstrap_phase })),
      { execution_phase: 'running', bootstrap_phase: 'running', progress: 0 },
    ];
    const values = stages.map(stage => taskOverallProgress({ ...stage, result_import_status: 'pending' }).percent);
    expect(values).toEqual([1, 3, 5, 8, 8, 10, 11, 12, 14, 16, 18, 19, 20]);
    expect(taskOverallProgress({ execution_phase: 'bootstrapping', bootstrap_phase: 'references' })).toMatchObject({ detail: 'references', step: 2 });
  });

  it('keeps workflow completion separate from archive/import completion', () => {
    expect(taskOverallProgress({ status: 'running', execution_phase: 'running', progress: 49 }).percent).toBe(57);
    expect(taskOverallProgress({ status: 'running', progress: 98, execution_phase: 'archiving' })).toMatchObject({ percent: 95, detail: 'archiving' });
    expect(taskOverallProgress({ status: 'completed', result_import_status: 'pending' }).percent).toBe(97);
    expect(taskOverallProgress({ status: 'completed', result_import_status: 'failed' })).toMatchObject({ percent: 97, completed: false, detail: 'importFailed' });
    expect(taskOverallProgress({ status: 'completed', result_import_status: 'success' })).toMatchObject({ percent: 100, completed: true });
    expect(taskOverallProgress({ status: 'completed' }).percent).toBe(100);
  });

  it('does not turn released or failed initialization into completed analysis', () => {
    expect(taskOverallProgress({ status: 'failed', execution_phase: 'terminal', vm_status: 'RECLAIMED', progress: 0 })).toMatchObject({ percent: 0, stopped: true, completed: false });
    expect(taskOverallProgress({ status: 'failed', execution_phase: 'terminal', bootstrap_phase: 'references', progress: 1 })).toMatchObject({ percent: 14, stopped: true, detail: 'references' });
    expect(taskOverallProgress({ status: 'running', execution_phase: 'diagnostic_hold', bootstrap_phase: 'downloading' })).toMatchObject({ percent: 16, stopped: true });
    expect(taskOverallProgress({ status: 'cancelled', progress: 40 }).percent).toBeLessThan(100);
    expect(taskOverallProgress({ progress: Number.NaN }).percent).toBe(0);
  });
});
