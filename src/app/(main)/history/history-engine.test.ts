import { describe, expect, it } from 'vitest';
import { HistoryEngine, type HistoryQuery, type ReportRow } from './history-engine';

const query: HistoryQuery = { table: 'snv-indel', search: '', includeWithdrawn: false, filters: {}, sort: 'detectionCount', direction: 'desc', page: 1, pageSize: 25 };
function row(id: string, task = 'task-a', values: Partial<ReportRow> = {}): ReportRow {
  return { id, revision: 1, table: 'snv-indel', taskUuid: task, attemptId: 'attempt-1', datasetId: 'dataset-1', datasetVersion: 'v1', rowId: id, groupKey: 'same-locus', reference: 'hg19', identityKnown: true,
    fields: { chromosome: 'chr1', position: '123', ref: 'A', alt: 'G', gene: 'TEST', gnomadAF: '0.0001' }, reported: true, classification: 'Pathogenic', reportedClassification: 'Pathogenic', firstReportedAt: '2026-10-01T01:00:00Z', lastReportedAt: '2026-10-02T01:00:00Z', reportedBy: 'doctor', adjustmentVersion: 1, updatedAt: '2026-10-02T01:00:00Z', ...values };
}
describe('history browser aggregation', () => {
  it('publishes an incremental synchronization atomically and discards interrupted scans', () => {
    const engine = new HistoryEngine(); engine.apply([row('a')], {});
    engine.begin('snv-indel'); engine.stage('snv-indel', [row('a', 'task-a', { revision: 2, reported: false }), row('b', 'task-b')], {});
    expect(engine.query(query).groups[0].detectionCount).toBe(1);
    expect(engine.sources('snv-indel', 'same-locus', false)[0].row.id).toBe('a');
    engine.commit('snv-indel'); expect(engine.sources('snv-indel', 'same-locus', false)[0].row.id).toBe('b');
    engine.begin('snv-indel'); engine.stage('snv-indel', [row('b', 'task-b', { revision: 3, reported: false })], {}); engine.discard('snv-indel');
    expect(engine.query(query).totalVariants).toBe(1);
  });
  it('counts tasks once across members, transcripts and attempts, but preserves sources', () => {
    const engine = new HistoryEngine(); engine.apply([row('a'), row('b', 'task-a', { attemptId: 'attempt-2' }), row('c', 'task-b')], {});
    expect(engine.query(query).groups[0].detectionCount).toBe(2);
    expect(engine.sources('snv-indel', 'same-locus', false)).toHaveLength(3);
  });
  it('withdraws only the source, removes tombstones, and ignores stale updates', () => {
    const engine = new HistoryEngine(); engine.apply([row('a'), row('b', 'task-b')], {});
    engine.apply([row('a', 'task-a', { revision: 2, reported: false })], {});
    expect(engine.query(query).groups[0].detectionCount).toBe(1);
    expect(engine.sources('snv-indel', 'same-locus', true)).toHaveLength(2);
    engine.apply([row('a')], {}); expect(engine.sources('snv-indel', 'same-locus', false)).toHaveLength(1);
    engine.apply([{ id: 'b', revision: 3, deleted: true } as ReportRow], {});
    engine.apply([row('b', 'task-b', { revision: 2 })], {});
    expect(engine.query(query).totalVariants).toBe(0);
    expect(engine.query({ ...query, includeWithdrawn: true }).groups[0].detectionCount).toBe(0);
  });
  it('does not select the most severe classification or replace unknown with VUS', () => {
    const engine = new HistoryEngine(); engine.apply([row('a'), row('b', 'task-b', { classification: '' })], {});
    expect(engine.query(query).groups[0].classification).toBe('mixed');
    expect(engine.query({ ...query, filters: { classification: '__missing' } }).total).toBe(1);
    engine.apply([row('a', 'task-a', { revision: 2, classification: 'Benign' })], {});
    expect(engine.sources('snv-indel', 'same-locus', false)[0].row.reportedClassification).toBe('Pathogenic');
  });
  it('isolates types and builds, filters before pagination, and preserves raw AF', () => {
    const engine = new HistoryEngine(); engine.apply([row('a'), row('b', 'task-b', { reference: 'hg38', groupKey: 'different-build', fields: { gene: 'OTHER', gnomadAF: '0.2' } }), row('c', 'task-c', { table: 'roh' })], {});
    expect(engine.query(query).total).toBe(2);
    const filtered = engine.query({ ...query, filters: { reference: 'hg19', gene: 'TEST' }, pageSize: 1 });
    expect(filtered.total).toBe(1); expect(filtered.groups[0].fields.gnomadAF).toBe('0.0001');
    engine.clear(); expect(engine.query(query).total).toBe(0);
  });
});
