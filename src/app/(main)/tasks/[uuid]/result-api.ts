import { readSNVSample } from '@/lib/snv-sample-metrics';
import { LocalizedError } from '@/i18n/errors';
import {listGeneLists} from '@/lib/gene-lists';
import { api, ApiError } from '@/lib/api';
import {igvAPIURL, igvReferenceURL} from '@/lib/igv-api-url';
import {assessmentStatus} from '@/lib/assessment/client';
import { queryBrowserParquet, updateBrowserOverlay, updateBrowserContext } from '@/lib/parquet-browser';
import { clinvarReviewStars, optionalAnnotationNumber } from './utils/snv-annotations';
import { resultFilterValue } from './utils/filter-values';
import type {
  ACMGClassification,
  ACMGEvidenceEntry,
  CNVAssessment,
  CNVExon,
  CNVSegment,
  MEIVariant,
  MEIType,
  MitochondrialPathogenicity,
  MitochondrialVariant,
  PaginatedResult,
  IGVSession,
  IGVTrackURL,
  QCResult,
	ResultContext,
  ROHRegion,
  SNVIndel,
  STR,
  STRStatus,
  TableFilterState,
  UPDRegion,
  VariantReviewStatus,
} from './types';

export { ACMG_CONFIG } from './result-mappers';
export type { GeneListOption } from './result-mappers';
import { ACMG_CONFIG, ACMG_ALIASES, GeneListOption, BackendReviewStatus, BackendRow, BackendPage, n, nullableNumber, s, arr, nums, normalizeReview, normalizePage, ResultQueryType, params, toBackendCnvType, toBackendMEIType, cnvType, variantType, zygosity, acmg, strStatus, meiType, meiInsertionType, meiStrand, pathogenicity, repeatCount, predictedGender, updType, parentOfOrigin, mapSNV, mapCNVSegment, automaticCNVAssessment, mapCNVExon, mapSTR, mapMEI, mapMT, mapUPD, mapROH } from './result-mappers';

export async function getQCResult(taskId: string): Promise<QCResult | null> {
  const row = await api.get<BackendRow>(`/v1/tasks/${encodeURIComponent(taskId)}/results/qc`);
  return {
    totalReads: nullableNumber(row.totalReads),
    mappedReads: nullableNumber(row.mappedReads),
    mappingRate: nullableNumber(row.mappedReadsFraction),
    averageDepth: nullableNumber(row.averageDepth),
    dedupDepth: nullableNumber(row.dedupDepth),
    targetCoverage: nullableNumber(row.coverageGte30x),
    duplicateRate: nullableNumber(row.duplicateRate),
    q30Rate: nullableNumber(row.q30Rate),
    insertSize: nullableNumber(row.insertSizeMedian ?? row.insertSizeAverage),
    gcRatio: nullableNumber(row.gcContent),
    captureEfficiency: nullableNumber(row.targetDataFraction),
    predictedGender: predictedGender(row.predictedGender),
		mtCoverage: nullableNumber(row.mtCoverageGt0x),
		mtDepth: nullableNumber(row.mtAverageDepth),
  };
}

export async function getResultContext(taskId: string, signal?: AbortSignal): Promise<ResultContext> {
	const context=await api.get<ResultContext>(`/v1/tasks/${encodeURIComponent(taskId)}/results/context`, { signal });
  if(!signal?.aborted)await updateBrowserContext(taskId,context.executionAttemptId,context.version);
  return context;
}

export async function getIGVSession(taskId: string, signal?: AbortSignal): Promise<IGVSession> {
	const session = await api.get<IGVSession>(`/v1/tasks/${encodeURIComponent(taskId)}/results/igv`, { signal });
	for (const key of ['fastaURL', 'indexURL'] as const) {
        const value = session.reference[key];
        if (value) session.reference[key] = session.transport === 'api' ? igvAPIURL(taskId, value) : igvReferenceURL(taskId, value);
    }
	return session;
}

export interface IGVSnapshot {
	transport?: 'api';
  available: boolean;
  url?: string;
  locus?: string;
  reference?: string;
  createdAt?: string;
}

function resolveIGVSnapshot(taskId: string, value: IGVSnapshot): IGVSnapshot {
  return value.transport === 'api' && value.url ? {...value, url: igvAPIURL(taskId, value.url)} : value;
}

export async function getIGVSnapshot(taskId: string, locus: string, signal?: AbortSignal): Promise<IGVSnapshot> {
  return resolveIGVSnapshot(taskId, await api.get<IGVSnapshot>(`/v1/tasks/${encodeURIComponent(taskId)}/results/igv/snapshot`, { params: { locus }, signal, cache: 'no-store' }));
}

export async function saveIGVSnapshot(taskId: string, locus: string, version: string, image: Blob, signal?: AbortSignal): Promise<IGVSnapshot> {
  const form = new FormData();
  form.append('locus', locus);
  form.append('version', version);
  form.append('image', image, 'igv.png');
  return resolveIGVSnapshot(taskId, await api.postForm<IGVSnapshot>(`/v1/tasks/${encodeURIComponent(taskId)}/results/igv/snapshot`, form, { signal }));
}

export async function getIGVTrackURLs(taskId: string, version: string, trackIds: string[], signal?: AbortSignal): Promise<{ tracks: IGVTrackURL[]; expiresAt: string; transport?: 'api' }> {
	const response = await api.post<{ tracks: IGVTrackURL[]; expiresAt: string; transport?: 'api' }>(`/v1/tasks/${encodeURIComponent(taskId)}/results/igv/urls`, { version, trackIds }, { signal });
	if (response.transport === 'api') response.tracks = response.tracks.map(track => ({...track, url: igvAPIURL(taskId, track.url), ...(track.indexURL ? {indexURL: igvAPIURL(taskId, track.indexURL)} : {})}));
	return response;
}

function parquetColumn(type: ResultQueryType, column: string): string {
  const aliases: Record<string, string> = {
    chromosome: 'Chromosome', chr: 'Chr', position: 'Position', startPosition: 'Start', begin: 'Begin',
    endPosition: 'End', variantType: 'Type', type: type === 'cnv-segment' || type === 'cnv-exon' ? 'Col4' : 'Type',
    zygosity: 'Zygosity', genotype: 'Genotype', alleleFrequency: 'Sample_VAF', fatherAlleleFrequency: 'Sample_VAF_father', motherAlleleFrequency: 'Sample_VAF_mother', fatherZygosity:'Zygosity_father', motherZygosity:'Zygosity_mother', depth: 'Depth',
    gnomadAF: 'GnomAD_AF', gnomadEasAF: 'GnomAD_AF_EAS', clinvarSignificance: 'ClinVar_Sig',
    pathogenicity: 'ClinVar_Sig', status: 'Status', teType: 'TE_Family', acmgClassification: 'acmgClassification',
    gene: 'Gene', pinned: 'pinned', reviewed: 'reviewed', focused: 'focused',
    iscnCandidate: 'ISCN_Candidate',
    repeatUnit: 'Repeat_Unit', normalRangeMax: 'Normal_Max',
  };
  if (type === 'str' && column === 'status') return 'STR_Status';
  if (type === 'cnv-segment' && column === 'log2Ratio') return 'Col5';
  if (type === 'cnv-exon' && column === 'log2Ratio') return 'Col9';
  if (type === 'cnv-exon' && column === 'gene') return 'Col5';
  if (type === 'cnv-exon' && column === 'confidence') return 'Col18';
  if (type === 'cnv-segment' && column === 'confidence') return 'Col7';
  if (type === 'mei' && column === 'teType') return 'TE_Type';
  return aliases[column] ?? column;
}

const rowSnapshots = new Map<string, { attemptId: string; datasetVersion: string; version: number; rowOrdinal?:number; adjustments?:Record<string,unknown>; automatic?:BackendRow; cnvBaseline?:CNVAssessment }>();
const tableSnapshots = new Map<string, { datasetVersion: string; attemptId: string }>();
function snapshotKey(taskId: string, type: string, rowId: string) { return `${taskId}/${type}/${rowId}`; }

async function buildTableQuery(type: ResultQueryType, filterState: TableFilterState) {
  const queryFilters: Array<{ column: string; operator: string; value?: string | string[] }> = [];
  for (const [column, value] of Object.entries(filterState.filters)) {
    if (value === '' || (Array.isArray(value) && value.length === 0)) continue;
    queryFilters.push({
      column: parquetColumn(type, column),
      operator: Array.isArray(value) ? 'in' : (column === 'acmgClassification' || column === 'status' || column === 'type' || column === 'pathogenicity' ? 'equals' : 'contains'),
      value: column === "type" && type.startsWith("cnv-") ? (Array.isArray(value) ? value.map(toBackendCnvType) : toBackendCnvType(value)) : value,
    });
  }
  for (const filter of filterState.columnFilters ?? []) {
    if (filter.operator === 'is_missing' || filter.operator === 'is_not_missing') {
      queryFilters.push({ column: filter.column, operator: filter.operator });
    } else if (filter.value !== undefined && filter.value !== '') {
      queryFilters.push({ column: filter.column, operator: filter.operator, value: filter.value });
    }
  }
  if (filterState.geneListId) {
    const lists = await getGeneLists();
    const genes = lists.find(list => list.id === filterState.geneListId)?.genes;
    const current=lists.find(list=>list.id===filterState.geneListId);if(filterState.geneListRevision!==undefined&&current?.revision!==filterState.geneListRevision)throw new LocalizedError("display.geneListChangedRefreshItAndConfirm38f6ac");
 if (!genes?.length) throw new LocalizedError("display.selectedGeneListUnavailableRefreshTheList5f7305");
    queryFilters.push({ column: 'Gene', operator: 'in', value: genes });
  }
  for (const filter of queryFilters) {
    if (filter.value !== undefined && ['contains', 'not_contains', 'equals', 'in'].includes(filter.operator)) {
      filter.value = resultFilterValue(type, filter.column, filter.value, filter.operator);
    }
  }
  const sort = filterState.sortColumn ? parquetColumn(type, filterState.sortColumn) : '';
  return { offset: (filterState.page - 1) * filterState.pageSize, limit: filterState.pageSize,
    search: filterState.searchQuery, sort, direction: filterState.sortDirection, filters: queryFilters };
}

async function getPage<T>(taskId: string, type: ResultQueryType, filterState: TableFilterState, mapper: (row: BackendRow) => T, signal?: AbortSignal): Promise<PaginatedResult<T>> {
  const query = await buildTableQuery(type, filterState);
  const response: BackendPage<BackendRow> = await queryBrowserParquet(taskId,type,query,signal);
  if (!signal?.aborted) {
    tableSnapshots.set(`${taskId}/${type}`, { datasetVersion: response.version ?? '', attemptId: String(response.attemptId ?? response.items?.[0]?.attemptId ?? '') });
    for (const row of response.items ?? []) {
      rowSnapshots.set(snapshotKey(taskId, type, String(row.id)), {
        attemptId: String(row.attemptId ?? ''), datasetVersion: String(row.datasetVersion ?? ''), version: Number(row.adjustmentVersion ?? 0),
        rowOrdinal:typeof row.rowOrdinal==='number'&&Number.isSafeInteger(row.rowOrdinal)?row.rowOrdinal:undefined,
        adjustments:row.adjustments as Record<string,unknown>|undefined,
        automatic:row.automaticAssessment as BackendRow|undefined,
        cnvBaseline:type==='cnv-segment'||type==='cnv-exon'?automaticCNVAssessment(row):undefined,
      });
    }
  }
  return normalizePage(response, filterState, mapper);
}

export const getSNVIndels = (taskId: string, filterState: TableFilterState, signal?: AbortSignal) => getPage(taskId, 'snv-indel', filterState, mapSNV, signal);
export const getCNVSegments = (taskId: string, filterState: TableFilterState, signal?: AbortSignal) => getPage(taskId, 'cnv-segment', filterState, mapCNVSegment, signal);
export const getCNVExons = (taskId: string, filterState: TableFilterState, signal?: AbortSignal) => getPage(taskId, 'cnv-exon', filterState, mapCNVExon, signal);
export const getSTRs = (taskId: string, filterState: TableFilterState, signal?: AbortSignal) => getPage(taskId, 'str', filterState, mapSTR, signal);
export const getMEIs = (taskId: string, filterState: TableFilterState, signal?: AbortSignal) => getPage(taskId, 'mei', filterState, mapMEI, signal);
export const getMitochondrialVariants = (taskId: string, filterState: TableFilterState, signal?: AbortSignal) => getPage(taskId, 'mt', filterState, mapMT, signal);
export const getUPDRegions = (taskId: string, filterState: TableFilterState, signal?: AbortSignal) => getPage(taskId, 'upd', filterState, mapUPD, signal);
export const getROHRegions = (taskId: string, filterState: TableFilterState, signal?: AbortSignal) => getPage(taskId, 'roh', filterState, mapROH, signal);

type CNVAssessmentType = 'cnv-segment' | 'cnv-exon';

interface BackendCNVAssessment {
  variant_id?: string;
  variantId?: string;
  assessment?: CNVAssessment;
  version?: number;
  adjustments?: Record<string, unknown>;
}

export async function listCNVAssessments(
  taskId: string,
  type: CNVAssessmentType,
  variantIds: string[] = []
): Promise<Record<string, CNVAssessment>> {
  const items = await Promise.all(variantIds.map(async id => {
    const response = await api.get<BackendCNVAssessment>(`/v1/tasks/${encodeURIComponent(taskId)}/results/rows/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
    const raw = response.adjustments?.cnvAssessment;
    if (!raw || typeof raw !== 'object') return null;
    return { id, assessment: { ...(raw as CNVAssessment), adjustmentVersion: response.version } };
  }));
  return items.reduce<Record<string, CNVAssessment>>((acc, item) => {
    if (item?.id && item.assessment) acc[item.id] = item.assessment;
    return acc;
  }, {});
}

export async function saveCNVAssessment(
  taskId: string,
  type: CNVAssessmentType,
  variantId: string,
  assessment: CNVAssessment,
  expectedVersion = 0,
): Promise<CNVAssessment> {
  const response = await saveResultRowAdjustment(taskId, type, variantId, expectedVersion, {
    cnvAssessment: { ...assessment, cnvId: variantId },
  }, 'CNV evidence assessment updated');
  return { ...assessment, cnvId: variantId, isUserModified: true, updatedAt: new Date().toISOString(), adjustmentVersion: response.adjustment.version };
}

export async function getGeneLists():Promise<GeneListOption[]>{return (await listGeneLists()).map(x=>({id:x.id,name:x.name,geneCount:x.genes.length,genes:x.genes,revision:x.revision}));}

export async function pinVariant(taskId: string, type: string, variantId: string, pinned: boolean): Promise<{ pinned: boolean }> {
  const snapshot = rowSnapshots.get(snapshotKey(taskId, type, variantId));
  if (!snapshot) throw new LocalizedError("display.unknownResultVersionRefreshFindingsBeforeContinuing571c3a");
  await saveResultRowAdjustment(taskId, type, variantId, snapshot.version, { pinned }, pinned ? '手动置顶' : '取消置顶');
  return { pinned };
}

export async function reviewVariant(taskId: string, type: string, variantId: string, reviewed: boolean): Promise<{ reviewed: boolean }> {
  const snapshot = rowSnapshots.get(snapshotKey(taskId, type, variantId));
  if (!snapshot) throw new LocalizedError("display.refreshResultsBeforeSaving87b6ee");
  await saveResultRowAdjustment(taskId, type, variantId, snapshot.version, { reviewed }, '更新复核状态');
  return { reviewed };
}

export async function focusVariant(taskId: string, type: string, variantId: string, focused: boolean): Promise<{ focused: boolean }> {
  const snapshot = rowSnapshots.get(snapshotKey(taskId, type, variantId));
  if (!snapshot) throw new LocalizedError("display.refreshResultsBeforeSaving87b6ee");
  await saveResultRowAdjustment(taskId, type, variantId, snapshot.version, { focused }, focused ? '关注变异' : '取消关注');
  return { focused };
}

export async function saveResultRowAdjustment(
  taskId: string,
  type: string,
  rowId: string,
  expectedVersion: number,
  adjustments: Record<string, unknown>,
  reason = '',
): Promise<{ adjustment: { version: number; adjustments: Record<string, unknown> } }> {
  const snapshot = rowSnapshots.get(snapshotKey(taskId, type, rowId));
  if (!snapshot?.attemptId || !snapshot.datasetVersion) throw new LocalizedError("display.unknownResultVersionRefreshBeforeSavinge77429");
  const changesEvidence=['acmgEvidence','acmgOverride','resetAcmg','cnvAssessment'].some(key=>key in adjustments);
  const existingVersion=snapshot.adjustments?.assessmentVersion;
  const existingEvidence='acmgEvidence' in (snapshot.adjustments??{})||'cnvAssessment' in (snapshot.adjustments??{})||!!snapshot.adjustments?.acmgOverride;
  const currentVersion=assessmentStatus(taskId)?.state==='ready'?assessmentStatus(taskId)?.version:undefined;
  const evidenceVersion=changesEvidence?(currentVersion??existingVersion):undefined;
  const payload = {
    clientMutationId: crypto.randomUUID(),
    expectedVersion,
    attemptId: snapshot.attemptId,
    datasetVersion: snapshot.datasetVersion,
    rowOrdinal:snapshot.rowOrdinal,
    adjustments: {...(evidenceVersion?{assessmentVersion:evidenceVersion}:{}),...adjustments},
    reason,
  };
  const focusOnly=Object.keys(adjustments).length===1 && "focused" in adjustments;
 const endpoint=`/v1/tasks/${encodeURIComponent(taskId)}/results/rows/${encodeURIComponent(type)}/${encodeURIComponent(rowId)}${focusOnly?"/focus":""}`;
  const write=()=>api.put<{ adjustment: { version: number; adjustments: Record<string, unknown> } }>(endpoint,payload);
  let response;
  try {response=await write();} catch(cause) {
    if(cause instanceof TypeError || (cause instanceof ApiError && cause.status>=500))response=await write();else throw cause;
  }
  rowSnapshots.set(snapshotKey(taskId, type, rowId), { ...snapshot, adjustments:response.adjustment.adjustments,version: Math.max(rowSnapshots.get(snapshotKey(taskId,type,rowId))?.version??0,response.adjustment.version) });
  await updateBrowserOverlay(taskId,type,{rowId,version:response.adjustment.version,adjustments:response.adjustment.adjustments}).catch(()=>undefined);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('yijian:result-adjustment-saved'));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('yijian:result-overlays-synced',{detail:{taskId,table:type}}));
  return response;
}

export interface ResultRowAdjustmentEvent {
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reason: string;
  actor: string;
  createdAt: string;
}

export function getResultRowAdjustmentHistory(taskId: string, type: string, rowId: string, signal?: AbortSignal): Promise<ResultRowAdjustmentEvent[]> {
  return api.get(`/v1/tasks/${encodeURIComponent(taskId)}/results/rows/${encodeURIComponent(type)}/${encodeURIComponent(rowId)}/history`, { signal });
}

export function clearTaskRowSnapshots(taskId:string) {
 for(const key of rowSnapshots.keys()) if(key.startsWith(taskId+'/'))rowSnapshots.delete(key);
}
