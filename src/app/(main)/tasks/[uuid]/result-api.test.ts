import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { queryBrowserParquet, exportBrowserParquet } from '@/lib/parquet-browser';
import { DEFAULT_FILTER_STATE } from './types';
import { exportEffectiveTable, getCNVSegments, getSNVIndels, reviewVariant, saveResultRowAdjustment } from './result-api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), download: vi.fn() }, ApiError: class extends Error {} }));
vi.mock('@/lib/parquet-browser',()=>({queryBrowserParquet:vi.fn(),exportBrowserParquet:vi.fn(),updateBrowserOverlay:vi.fn().mockResolvedValue(undefined)}));

describe('versioned Parquet adjustments and effective export', () => {
  beforeEach(() => vi.clearAllMocks());
  async function load(task: string) {
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({ items: [{ id: 'row', attemptId: 'attempt', datasetVersion: 'hash', adjustmentVersion: 0 }], total: 1, rowCount:1, columns:[],columnTypes:{},fieldProfileVersion:'parquet-fields-v2',offset:0,limit:20,version: 'hash', attemptId: 'attempt' });
    await getSNVIndels(task, { ...DEFAULT_FILTER_STATE, columnFilters: [{ column: 'reviewed', operator: 'equals' as const, value: 'false' }] });
  }
  it('uses the browser overlay for CNV assessment without per-row server queries', async () => {
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({ items: [{ id: 'cnv', attemptId: 'attempt', datasetVersion: 'hash', adjustmentVersion: 3, cnvAssessment: { cnvId: 'cnv', totalScore: 1 } }], total: 1, rowCount: 1, columns: [], columnTypes: {}, fieldProfileVersion: 'parquet-fields-v2', offset: 0, limit: 20, version: 'hash', attemptId: 'attempt' });
    const page = await getCNVSegments('task-cnv', DEFAULT_FILTER_STATE);
    expect(page.data[0].assessment).toMatchObject({ cnvId: 'cnv', totalScore: 1, adjustmentVersion: 3 });
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('passes the attempt, object and expected adjustment versions on every save', async () => {
    await load('task-save');
    vi.mocked(api.put).mockResolvedValueOnce({ adjustment: { version: 1, adjustments: { reviewed: true } } });
    await reviewVariant('task-save', 'snv-indel', 'row', true);
    expect(api.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ expectedVersion: 0, attemptId: 'attempt', datasetVersion: 'hash', adjustments: { reviewed: true } }));
    vi.mocked(api.put).mockResolvedValueOnce({ adjustment: { version: 2, adjustments: { reported: true } } });
    await reviewVariant('task-save', 'snv-indel', 'row', false);
    expect(api.put).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ expectedVersion: 1 }));
  });
  it('rejects unproven rows and preserves conflict errors', async () => {
    await expect(saveResultRowAdjustment('unknown-task', 'snv-indel', 'unknown-row', 0, { reviewed: true })).rejects.toThrow('结果版本未知');
    await load('task-conflict');
    vi.mocked(api.put).mockRejectedValueOnce(new Error('409 conflict'));
    await expect(reviewVariant('task-conflict', 'snv-indel', 'row', true)).rejects.toThrow('409 conflict');
  });
  it('exports the same filters and snapshot as the displayed query', async () => {
    await load('task-export');
    const state = { ...DEFAULT_FILTER_STATE, columnFilters: [{ column: 'reviewed', operator: 'equals' as const, value: 'false' }] };
    await exportEffectiveTable('task-export', 'snv-indel', state);
    expect(exportBrowserParquet).toHaveBeenCalledWith('task-export','snv-indel', expect.objectContaining({ filters: [{ column: 'reviewed', operator: 'equals' as const, value: 'false' }] }));
    expect(api.post).not.toHaveBeenCalled();
    expect(api.download).not.toHaveBeenCalled();
  });
});
