import { expect, it } from 'vitest';
import { HistoryEngine, type HistoryQuery, type ReportRow } from './history-engine';

// A worst-case fixture with 100,000 distinct loci: no friendly deduplication.
it('benchmarks 100,000 compact sources without server queries', () => {
  const engine = new HistoryEngine();
  const before = process.memoryUsage().heapUsed;
  const rows: ReportRow[] = Array.from({ length: 100000 }, (_, index) => ({
    id: String(index), revision: 1, table: 'snv-indel', taskUuid: `task-${index % 1000}`, attemptId: 'attempt',
    groupKey: `locus-${index}`, reference: 'hg19', identityKnown: true,
    fields: { chromosome: `chr${index % 22 + 1}`, position: String(index + 1), ref: 'A', alt: 'G', gene: `GENE${index % 500}`, gnomadAF: '0.0001' },
    reported: true, classification: index % 2 ? 'VUS' : 'Pathogenic', reportedClassification: 'VUS', firstReportedAt: '2026-10-01T00:00:00Z', lastReportedAt: '2026-10-02T00:00:00Z', reportedBy: 'fixture', adjustmentVersion: 1, updatedAt: '2026-10-02T00:00:00Z',
  }));
  const bytes = Buffer.byteLength(JSON.stringify(rows));
  engine.apply(rows, {});
  const query: HistoryQuery = { table: 'snv-indel', search: '', includeWithdrawn: false, filters: {}, sort: 'detectionCount', direction: 'desc', page: 1, pageSize: 25 };
  const started = performance.now(); expect(engine.query(query).total).toBe(100000);
  const initialMs = performance.now() - started;
  const timings: number[] = [];
  for (let i = 0; i < 12; i++) {
    const start = performance.now(); engine.query({ ...query, page: i + 1, filters: i % 2 ? { classification: 'Pathogenic' } : {} }); timings.push(performance.now() - start);
  }
  const p95 = timings.sort((a, b) => a - b)[Math.ceil(timings.length * 0.95) - 1];
  console.info(JSON.stringify({ runtime: 'node-engine', sourceRows: rows.length, serializedBytes: bytes, initialMs: Math.round(initialMs), cachedQueryP95Ms: Math.round(p95), heapDeltaBytes: process.memoryUsage().heapUsed - before }));
  expect(p95).toBeLessThan(1000);
}, 20000);
