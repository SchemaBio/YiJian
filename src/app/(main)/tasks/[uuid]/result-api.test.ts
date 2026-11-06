import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { queryBrowserParquet } from '@/lib/parquet-browser';
import { DEFAULT_FILTER_STATE } from './types';
import { getCNVSegments, getMitochondrialVariants, getSNVIndels, focusVariant, reviewVariant, saveResultRowAdjustment } from './result-api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), download: vi.fn() }, ApiError: class extends Error {} }));
vi.mock('@/lib/parquet-browser',()=>({queryBrowserParquet:vi.fn(),exportBrowserParquet:vi.fn(),updateBrowserOverlay:vi.fn().mockResolvedValue(undefined)}));

it('reads mitochondrial depth and ALT support from the archived report', async () => {
  vi.mocked(queryBrowserParquet).mockResolvedValueOnce({
    items: [
      { depth: 101, aD: '1,100', position: 16304, ref: 'T', alt: 'C' },
      { depth: '50', ad: '30,20,0', mtHgvs: 'm.309dup' },
      { depth: '.', aD: '.', position: 309, ref: 'C', alt: 'CC' },
    ],
    total: 3, rowCount: 3, columns: [], columnTypes: {}, fieldProfileVersion: 'parquet-fields-v2',
    offset: 0, limit: 20, version: 'hash', attemptId: 'attempt',
  });
  const page = await getMitochondrialVariants('mt-read-support', DEFAULT_FILTER_STATE);
  expect(page.data.map(row => row.hgvs)).toEqual(['m.16304T>C', 'm.309dup', undefined]);
  expect(page.data.map(({ depth, altReadCounts }) => ({ depth, altReadCounts }))).toEqual([
    { depth: 101, altReadCounts: [100] },
    { depth: 50, altReadCounts: [20, 0] },
    { depth: null, altReadCounts: [] },
  ]);
});

describe('versioned Parquet adjustments', () => {
  it('keeps the adopted manual classification separate from quick screening', async () => {
    const automaticAcmg = { classification: 'Pathogenic', criteria: [] };
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({
      items: [
        { automaticAcmg, acmgClassificationComputed: 'Pathogenic', adjustments: { adoptedACMG: { source: 'manual', version: 'legacy' } } },
        { automaticAcmg, acmgClassificationComputed: 'Pathogenic', adjustments: { adoptedACMG: { source: 'manual_evidence', version: 'legacy', classification: 'Benign' } } },
      ],
      total: 2, rowCount: 2, columns: [], columnTypes: {}, fieldProfileVersion: 'parquet-fields-v2',
      offset: 0, limit: 20, version: 'hash', attemptId: 'attempt',
    });
    const { data } = await getSNVIndels('manual-source', DEFAULT_FILTER_STATE);
    expect(data[0].adoptedACMG?.source).toBe('manual');
    expect(data[0].acmgClassification).toBeUndefined();
    expect(data[1].acmgClassification).toBe('Benign');
  });

  it('restores the saved SVC AI snapshot without changing the active classification',async()=>{
    const savedAI={requestId:'saved-request',feature:'svcv4',summary:'Saved SVC summary',resultKind:'experimental',suggestedClassification:'VUS'};
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({items:[{id:'row',attemptId:'attempt',datasetVersion:'hash',adjustmentVersion:2,acmgClassification:'Likely_Benign',adjustments:{svcv4AIResult:savedAI,activeAcmgVersion:'legacy'}}],total:1,rowCount:1,columns:[],columnTypes:{},fieldProfileVersion:'parquet-fields-v2',offset:0,limit:20,version:'hash',attemptId:'attempt'});
    const page=await getSNVIndels('saved-svc-ai',DEFAULT_FILTER_STATE);
    expect(page.data[0].svcv4AIResult).toEqual(savedAI);
    expect(page.data[0].activeAcmgVersion).toBe('legacy');
    expect(page.data[0].acmgClassification).toBe('Likely_Benign');
  });

  it('restores the saved CNV AI snapshot and adopted CNV', async () => {
    const savedCNVAI = { requestId: 'cnv-req-1', feature: 'cnv_loss', summary: 'CNV Loss summary', resultKind: 'evidence_only', suggestedClassification: 'Pathogenic' };
    const adopted = { source: 'ai' as const, classification: 'Pathogenic' as const, score: 100, savedAt: '2026-11-01T00:00:00Z' };
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({
      items: [{
        id: 'cnv-row',
        attemptId: 'attempt',
        datasetVersion: 'hash',
        adjustmentVersion: 1,
        adjustments: { cnvAIResult: savedCNVAI, adoptedCNV: adopted },
      }],
      total: 1,
      rowCount: 1,
      columns: [],
      columnTypes: {},
      fieldProfileVersion: 'parquet-fields-v2',
      offset: 0,
      limit: 20,
      version: 'hash',
      attemptId: 'attempt',
    });
    const page = await getCNVSegments('cnv-saved-task', DEFAULT_FILTER_STATE);
    expect(page.data[0].cnvAIResult).toEqual(savedCNVAI);
    expect(page.data[0].adoptedCNV).toEqual(adopted);
  });

  beforeEach(() => vi.clearAllMocks());
  it('normalizes translated exclusion filters in the actual browser query', async () => {
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({items:[],total:0,rowCount:0,columns:[],columnTypes:{},fieldProfileVersion:'parquet-fields-v2',offset:0,limit:20,version:'hash',attemptId:'attempt'});
    await getSNVIndels('localized-filter', {...DEFAULT_FILTER_STATE, columnFilters:[
      {column:'acmgClassification', operator:'not_contains', value:'良性'},
      {column:'Zygosity', operator:'not_contains', value:'杂合'},
      {column:'HGVS_c', operator:'contains', value:'c.123'},
    ]});
    expect(queryBrowserParquet).toHaveBeenCalledWith('localized-filter', 'snv-indel', expect.objectContaining({filters:[
      {column:'acmgClassification', operator:'not_contains', value:'Benign'},
      {column:'Zygosity', operator:'not_contains', value:['Het', 'Heterozygous']},
      {column:'HGVS_c', operator:'contains', value:'c.123'},
    ]}), undefined);
  });
  async function load(task: string) {
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({ items: [{ id: 'row', attemptId: 'attempt', datasetVersion: 'hash', adjustmentVersion: 0 }], total: 1, rowCount:1, columns:[],columnTypes:{},fieldProfileVersion:'parquet-fields-v2',offset:0,limit:20,version: 'hash', attemptId: 'attempt' });
    await getSNVIndels(task, { ...DEFAULT_FILTER_STATE, columnFilters: [{ column: 'reviewed', operator: 'equals' as const, value: 'false' }] });
  }
  it('only writes the focus marker without capturing or confirming evidence',async()=>{
    const criteria=[{code:'PP3',strength:'strong',source:'fixture',note:'fixture'}];
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({items:[{id:'row',attemptId:'attempt',datasetVersion:'hash',adjustmentVersion:0,adjustments:{},automaticAssessment:{contextVersion:'fixed-context',criteria},automaticAcmg:{criteria}}],total:1,rowCount:1,columns:[],columnTypes:{},fieldProfileVersion:'parquet-fields-v2',offset:0,limit:20,version:'hash',attemptId:'attempt'});
    await getSNVIndels('focus-baseline',DEFAULT_FILTER_STATE);
    vi.mocked(api.put).mockResolvedValueOnce({adjustment:{version:1,adjustments:{focused:true}}});
    await focusVariant('focus-baseline','snv-indel','row',true);
    expect(api.put).toHaveBeenLastCalledWith(expect.any(String),expect.objectContaining({adjustments:{focused:true}}));
    vi.mocked(api.put).mockResolvedValueOnce({adjustment:{version:2,adjustments:{focused:false,acmgEvidence:criteria}}});
    await focusVariant('focus-baseline','snv-indel','row',false);
    expect(api.put).toHaveBeenLastCalledWith(expect.any(String),expect.objectContaining({adjustments:{focused:false}}));
  });
  it('does not overwrite manual evidence when focusing',async()=>{
    const manual=[{code:'PM2',strength:'supporting'}];
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({items:[{id:'row',attemptId:'attempt',datasetVersion:'hash',adjustmentVersion:2,adjustments:{acmgEvidence:manual,assessmentVersion:'manual-context'},automaticAssessment:{contextVersion:'fixed-context',criteria:[{code:'PP3',strength:'strong'}]}}],total:1,rowCount:1,columns:[],columnTypes:{},fieldProfileVersion:'parquet-fields-v2',offset:0,limit:20,version:'hash',attemptId:'attempt'});
    await getSNVIndels('focus-manual',DEFAULT_FILTER_STATE);
    vi.mocked(api.put).mockResolvedValueOnce({adjustment:{version:3,adjustments:{focused:true,acmgEvidence:manual}}});
    await focusVariant('focus-manual','snv-indel','row',true);
    expect(api.put).toHaveBeenLastCalledWith(expect.any(String),expect.objectContaining({adjustments:{focused:true}}));
  });
  it('uses the browser overlay for CNV assessment without per-row server queries', async () => {
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({ items: [{ id: 'cnv', attemptId: 'attempt', datasetVersion: 'hash', adjustmentVersion: 3, cnvAssessment: { cnvId: 'cnv', totalScore: 1 } }], total: 1, rowCount: 1, columns: [], columnTypes: {}, fieldProfileVersion: 'parquet-fields-v2', offset: 0, limit: 20, version: 'hash', attemptId: 'attempt' });
    const page = await getCNVSegments('task-cnv', DEFAULT_FILTER_STATE);
    expect(page.data[0].assessment).toMatchObject({ cnvId: 'cnv', totalScore: 1, adjustmentVersion: 3 });
    expect(api.get).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('preserves Region signal weights above one and sorts by the source weight field', async () => {
    vi.mocked(queryBrowserParquet).mockResolvedValueOnce({ items: [{ id: 'weighted-cnv', weight: 12.34 }], total: 1, rowCount: 1, columns: ['Col7'], columnTypes: { Col7: 'text' }, fieldProfileVersion: 'parquet-fields-v2', offset: 0, limit: 20, version: 'hash', attemptId: 'attempt' });
    const page = await getCNVSegments('weighted-task', { ...DEFAULT_FILTER_STATE, sortColumn: 'confidence', sortDirection: 'desc' });
    expect(page.data[0].confidence).toBe(12.34);
    expect(queryBrowserParquet).toHaveBeenLastCalledWith('weighted-task', 'cnv-segment', expect.objectContaining({ sort: 'Col7', direction: 'desc' }), undefined);
  });
  it('passes the attempt, object and expected adjustment versions on every save', async () => {
    await load('task-save');
    vi.mocked(api.put).mockResolvedValueOnce({ adjustment: { version: 1, adjustments: { reviewed: true } } });
    await reviewVariant('task-save', 'snv-indel', 'row', true);
    expect(api.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ expectedVersion: 0, attemptId: 'attempt', datasetVersion: 'hash', adjustments: { reviewed: true } }));
    vi.mocked(api.put).mockResolvedValueOnce({ adjustment: { version: 2, adjustments: { focused: true } } });
    await reviewVariant('task-save', 'snv-indel', 'row', false);
    expect(api.put).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ expectedVersion: 1 }));
  });
  it('rejects unproven rows and preserves conflict errors', async () => {
    await expect(saveResultRowAdjustment('unknown-task', 'snv-indel', 'unknown-row', 0, { reviewed: true })).rejects.toThrow('结果版本未知');
    await load('task-conflict');
    vi.mocked(api.put).mockRejectedValueOnce(new Error('409 conflict'));
    await expect(reviewVariant('task-conflict', 'snv-indel', 'row', true)).rejects.toThrow('409 conflict');
  });
});


describe('family SNP/InDel sample values',()=>{
 it('maps missing raw VAF using individual AD, keeps unknown missing, and sorts the displayed VAF',async()=>{
  vi.mocked(queryBrowserParquet).mockResolvedValueOnce({items:[{id:'family',genotype:'0/1',vaf:'.',annotationValues:{Genotype:'0/1',Zygosity:'Het',VAF:'.',AD:'60,46',Genotype_father:'1/1',Zygosity_father:'Hom',VAF_father:'.',AD_father:'0,88',Genotype_mother:'./.',VAF_mother:'.',AD_mother:'.'}}],total:1,rowCount:1,columns:['VAF','AD','VAF_father','VAF_mother','Sample_VAF'],columnTypes:{},fieldProfileVersion:'parquet-fields-v2',offset:0,limit:20,version:'hash',attemptId:'attempt'});
  const page=await getSNVIndels('family-metrics',{...DEFAULT_FILTER_STATE,sortColumn:'alleleFrequency',sortDirection:'desc'});
  expect(page.data[0]).toMatchObject({zygosity:'Heterozygous',alleleFrequency:46/106,father:{zygosity:'Homozygous',alleleFrequency:1},mother:{zygosity:'Unknown'}});
  expect(page.data[0].mother?.alleleFrequency).toBeUndefined();
  expect(page.data[0].annotationValues?.VAF).toBe('.');
  expect(queryBrowserParquet).toHaveBeenLastCalledWith('family-metrics','snv-indel',expect.objectContaining({sort:'Sample_VAF'}),undefined);
 });
});
