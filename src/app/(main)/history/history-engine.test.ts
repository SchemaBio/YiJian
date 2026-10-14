import { describe, expect, it } from 'vitest';
import { HistoryEngine, historyPosition, type HistoryQuery, type FocusRow } from './history-engine';

const query: HistoryQuery = { table: 'snv-indel', search: '', includeWithdrawn: false, filters: {}, sort: 'detectionCount', direction: 'desc', page: 1, pageSize: 25 };
function row(id: string, task = 'task-a', values: Partial<FocusRow> = {}): FocusRow {
  return { id, revision: 1, table: 'snv-indel', taskUuid: task, attemptId: 'attempt-1', datasetId: 'dataset-1', datasetVersion: 'v1', rowId: id, groupKey: 'same-locus', reference: 'hg19', identityKnown: true,
    fields: { chromosome: 'chr1', position: '123', ref: 'A', alt: 'G', gene: 'TEST', gnomadAF: '0.0001' }, focused: true, classification: 'Pathogenic', focusedClassification: 'Pathogenic', firstFocusedAt: '2026-10-01T01:00:00Z', lastFocusedAt: '2026-10-02T01:00:00Z', focusedBy: 'doctor', adjustmentVersion: 1, updatedAt: '2026-10-02T01:00:00Z', ...values };
}
describe('history browser aggregation', () => {
  it('filters split coordinate columns independently and sorts positions naturally', () => {
    const engine = new HistoryEngine();
    engine.apply([
      row('a', 'task-a', { groupKey: 'a', fields: { chromosome: 'chr2', position: '20', ref: 'A', alt: 'G' } }),
      row('b', 'task-b', { groupKey: 'b', fields: { chromosome: 'chr1', position: '3', ref: 'C', alt: 'T' } }),
    ], {});
    expect(engine.query({ ...query, sort: 'pos', direction: 'asc' }).groups.map(group => group.id)).toEqual(['b', 'a']);
    for (const [key, value] of Object.entries({ chrom: 'chr2', pos: '20', ref: 'A', alt: 'G' })) {
      expect(engine.query({ ...query, filters: { [key]: value } }).groups.map(group => group.id)).toEqual(['a']);
    }
  });
  it('retains interval coordinates and missing alleles in the split columns', () => {
    const fields = { chromosome: 'chrX', startPosition: '100', endPosition: '200' };
    expect(historyPosition(fields)).toBe('100-200');
    expect(historyPosition({})).toBe('');
    const engine = new HistoryEngine();
    engine.apply([row('interval', 'task-a', { table: 'cnv-segment', groupKey: 'interval', fields })], {});
    expect(engine.query({ ...query, table: 'cnv-segment', filters: { pos: '100-200', ref: '未提供', alt: '未提供' } }).total).toBe(1);
  });
  it('publishes an incremental synchronization atomically and discards interrupted scans', () => {
    const engine = new HistoryEngine(); engine.apply([row('a')], {});
    engine.begin('snv-indel'); engine.stage('snv-indel', [row('a', 'task-a', { revision: 2, focused: false }), row('b', 'task-b')], {});
    expect(engine.query(query).groups[0].detectionCount).toBe(1);
    expect(engine.sources('snv-indel', 'same-locus', false)[0].row.id).toBe('a');
    engine.commit('snv-indel'); expect(engine.sources('snv-indel', 'same-locus', false)[0].row.id).toBe('b');
    engine.begin('snv-indel'); engine.stage('snv-indel', [row('b', 'task-b', { revision: 3, focused: false })], {}); engine.discard('snv-indel');
    expect(engine.query(query).totalVariants).toBe(1);
  });
  it('counts tasks once across members, transcripts and attempts, but preserves sources', () => {
    const engine = new HistoryEngine(); engine.apply([row('a'), row('b', 'task-a', { attemptId: 'attempt-2' }), row('c', 'task-b')], {});
    expect(engine.query(query).groups[0].detectionCount).toBe(2);
    expect(engine.sources('snv-indel', 'same-locus', false)).toHaveLength(3);
  });
  it('withdraws only the source, removes tombstones, and ignores stale updates', () => {
    const engine = new HistoryEngine(); engine.apply([row('a'), row('b', 'task-b')], {});
    engine.apply([row('a', 'task-a', { revision: 2, focused: false })], {});
    expect(engine.query(query).groups[0].detectionCount).toBe(1);
    expect(engine.sources('snv-indel', 'same-locus', true)).toHaveLength(2);
    engine.apply([row('a')], {}); expect(engine.sources('snv-indel', 'same-locus', false)).toHaveLength(1);
    engine.apply([{ id: 'b', revision: 3, deleted: true } as FocusRow], {});
    engine.apply([row('b', 'task-b', { revision: 2 })], {});
    expect(engine.query(query).totalVariants).toBe(0);
    expect(engine.query({ ...query, includeWithdrawn: true }).groups[0].detectionCount).toBe(0);
  });
  it('does not select the most severe classification or replace unknown with VUS', () => {
    const engine = new HistoryEngine(); engine.apply([row('a'), row('b', 'task-b', { classification: '' })], {});
    expect(engine.query(query).groups[0].classification).toBe('mixed');
    expect(engine.query({ ...query, filters: { classification: '__missing' } }).total).toBe(1);
    engine.apply([row('a', 'task-a', { revision: 2, classification: 'Benign' })], {});
    expect(engine.sources('snv-indel', 'same-locus', false)[0].row.focusedClassification).toBe('Pathogenic');
  });
  it('isolates types and builds, filters before pagination, and preserves raw AF', () => {
    const engine = new HistoryEngine(); engine.apply([row('a'), row('b', 'task-b', { reference: 'hg38', groupKey: 'different-build', fields: { gene: 'OTHER', gnomadAF: '0.2' } }), row('c', 'task-c', { table: 'roh' })], {});
    expect(engine.query(query).total).toBe(2);
    const filtered = engine.query({ ...query, filters: { reference: 'hg19', gene: 'TEST' }, pageSize: 1 });
    expect(filtered.total).toBe(1); expect(filtered.groups[0].fields.gnomadAF).toBe('0.0001');
    engine.clear(); expect(engine.query(query).total).toBe(0);
  });
});
