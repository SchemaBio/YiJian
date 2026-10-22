import { describe, expect, it } from 'vitest';
import { canInterpretTask, isTaskResultPreparing, isTaskResultImportFailed } from './task-interpretation';
import { normalizeTask, normalizeTaskDetail } from './tasks';
import { taskDisplayStatus } from './task-presentation';
import { sortPairedAssets } from './data-asset-order';
import type { DataAsset } from './data-assets';

describe('result readiness and paired ordering', () => {
  it.each(['pending', 'running'])('blocks interpretation until import succeeds (%s)', status => {
    for (const task of [normalizeTask({ status: 'completed', result_import_status: status }), normalizeTaskDetail({ status: 'completed', result_import_status: status })]) {
      expect(isTaskResultPreparing(task)).toBe(true);
      expect(canInterpretTask(task)).toBe(false);
      expect(taskDisplayStatus(task)).toBe('preparing_results');
    }
    expect(canInterpretTask(normalizeTask({ status: 'completed', result_import_status: 'success' }))).toBe(true);
    expect(canInterpretTask({ template: 'baseline_fix' })).toBe(false);
  });
  it('shows import failure instead of endless preparation and still blocks interpretation', () => {
    for (const task of [normalizeTask({status:'completed',result_import_status:'failed'}), normalizeTaskDetail({status:'completed',result_import_status:'failed'})]) {
      expect(isTaskResultPreparing(task)).toBe(false);
      expect(isTaskResultImportFailed(task)).toBe(true);
      expect(canInterpretTask(task)).toBe(false);
      expect(taskDisplayStatus(task)).toBe('import_failed');
    }
  });
  it('orders matching R1 above R2 regardless of completion timestamps and preserves other pairs', () => {
    const asset = (id: string, read: 'read1'|'read2', created: string) => ({ id, file_name: `sample_${id[0]}_${read === 'read1' ? 'R1' : 'R2'}_001.fastq.gz`, read_type: read, created_at: created }) as DataAsset;
    const files = [asset('a2','read2','2026-10-21T01:00:02Z'),asset('b1','read1','2026-10-20T01:00:00Z'),asset('a1','read1','2026-10-21T01:00:00Z'),asset('b2','read2','2026-10-20T01:00:02Z')];
    expect(sortPairedAssets(files).map(x => x.id)).toEqual(['a1','a2','b1','b2']);
    expect(files[0].id).toBe('a2');
  });
});
