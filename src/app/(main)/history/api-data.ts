/**
 * History API adapter for Octopus /history endpoints.
 */

import { api } from '@/lib/api';
import type {
  GroupedSNVIndel,
  GroupedCNVSegment,
  GroupedCNVExon,
  GroupedSTR,
  GroupedMEI,
  GroupedMTVariant,
  GroupedUPDRegion,
  HistoryTableFilterState,
  PaginatedResult,
  ACMGClassification,
  STRStatus,
  MEIType,
  UPDType,
} from './types';

export const ACMG_CONFIG: Record<ACMGClassification, { label: string; variant: 'danger' | 'warning' | 'neutral' | 'info' | 'success' }> = {
  Pathogenic: { label: '致病', variant: 'danger' },
  Likely_Pathogenic: { label: '可能致病', variant: 'warning' },
  VUS: { label: '意义不明', variant: 'neutral' },
  Likely_Benign: { label: '可能良性', variant: 'info' },
  Benign: { label: '良性', variant: 'success' },
};

export const STR_STATUS_CONFIG: Record<STRStatus, { label: string; variant: 'danger' | 'warning' | 'success' }> = {
  FullMutation: { label: '全突变', variant: 'danger' },
  Premutation: { label: '前突变', variant: 'warning' },
  Normal: { label: '正常', variant: 'success' },
};

export const MEI_TYPE_CONFIG: Record<MEIType, { label: string; variant: 'info' | 'warning' | 'neutral' }> = {
  LINE1: { label: 'LINE1', variant: 'info' },
  Alu: { label: 'Alu', variant: 'warning' },
  SVA: { label: 'SVA', variant: 'neutral' },
  Unknown: { label: '未知', variant: 'neutral' },
};

export const UPD_TYPE_CONFIG: Record<UPDType, { label: string; variant: 'info' | 'warning' }> = {
  Isodisomy: { label: '同源UPD', variant: 'warning' },
  Heterodisomy: { label: '异源UPD', variant: 'info' },
};

const ACMG_ALIASES: Record<string, ACMGClassification> = {
  pathogenic: 'Pathogenic',
  likely_pathogenic: 'Likely_Pathogenic',
  likelypathogenic: 'Likely_Pathogenic',
  lp: 'Likely_Pathogenic',
  vus: 'VUS',
  uncertain_significance: 'VUS',
  variant_of_uncertain_significance: 'VUS',
  likely_benign: 'Likely_Benign',
  likelybenign: 'Likely_Benign',
  lb: 'Likely_Benign',
  benign: 'Benign',
};

type BackendPage<T> = T[] | {
  items?: T[];
  data?: T[] | { items?: T[] };
  total?: number;
  page?: number;
  pageSize?: number;
  page_size?: number;
};

type BackendRow = Record<string, unknown>;

function n(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    const firstNumber = value.match(/-?\d+(?:\.\d+)?/);
    if (firstNumber) {
      const parsedTextNumber = Number(firstNumber[0]);
      if (Number.isFinite(parsedTextNumber)) return parsedTextNumber;
    }
  }
  return fallback;
}

function s(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function arr(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        return [];
      }
    }
    return trimmed.split(/[,;|]/).map(item => item.trim()).filter(Boolean);
  }
  return [];
}

function acmg(value: unknown): ACMGClassification {
  const normalized = s(value, 'VUS')
    .trim()
    .replace(/[-\s]+/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase();
  return ACMG_ALIASES[normalized] ?? 'VUS';
}

function cnvType(value: unknown): GroupedCNVSegment['type'] {
  const normalized = s(value).toUpperCase();
  return normalized === 'DUP' || normalized === 'AMPLIFICATION' || normalized === 'GAIN' ? 'Amplification' : 'Deletion';
}

function strStatus(value: unknown): STRStatus {
  const normalized = s(value, 'Normal').replace(/[-\s]+/g, '').toLowerCase();
  if (normalized === 'premutation') return 'Premutation';
  if (normalized === 'fullmutation') return 'FullMutation';
  return 'Normal';
}

function meiType(value: unknown): MEIType {
  const normalized = s(value).toUpperCase();
  if (normalized === 'ALU') return 'Alu';
  if (normalized === 'SVA') return 'SVA';
  if (normalized === 'LINE1' || normalized === 'LINE-1' || normalized === 'L1') return 'LINE1';
  return 'Unknown';
}

function updType(value: unknown): UPDType {
  return s(value).replace(/[-\s]+/g, '').toLowerCase() === 'heterodisomy'
    ? 'Heterodisomy'
    : 'Isodisomy';
}

function parentOfOrigin(value: unknown): GroupedUPDRegion['parentOfOrigin'] {
  const normalized = s(value).trim().toLowerCase();
  if (normalized === 'maternal' || normalized === 'mother') return 'Maternal';
  if (normalized === 'paternal' || normalized === 'father') return 'Paternal';
  return 'Unknown';
}

function normalizeList<T>(response: BackendPage<BackendRow>, filterState: HistoryTableFilterState, mapper: (row: BackendRow) => T): PaginatedResult<T> {
  if (Array.isArray(response)) {
    return { data: response.map(mapper), total: response.length, page: filterState.page, pageSize: filterState.pageSize };
  }
  const rawData = response.data;
  const items = response.items ?? (Array.isArray(rawData) ? rawData : rawData?.items) ?? [];
  return {
    data: items.map(mapper),
    total: n(response.total, items.length),
    page: n(response.page, filterState.page),
    pageSize: n(response.pageSize ?? response.page_size, filterState.pageSize),
  };
}

function queryParams(filterState: HistoryTableFilterState): Record<string, string> {
  const params: Record<string, string> = {
    page: String(filterState.page),
    pageSize: String(filterState.pageSize),
  };
  if (filterState.searchQuery) params.searchQuery = filterState.searchQuery;
  if (filterState.sortColumn) params.sortColumn = filterState.sortColumn;
  if (filterState.sortDirection) params.sortDirection = filterState.sortDirection;
  return params;
}

async function getHistory<T>(endpoint: string, filterState: HistoryTableFilterState, mapper: (row: BackendRow) => T): Promise<PaginatedResult<T>> {
  const response = await api.get<BackendPage<BackendRow>>(endpoint, { params: queryParams(filterState) });
  return normalizeList(response, filterState, mapper);
}

function mapSNV(row: BackendRow): GroupedSNVIndel {
  return {
    groupId: s(row.groupId),
    gene: s(row.gene),
    hgvsc: s(row.hgvsc),
    hgvsp: s(row.hgvsp),
    transcript: s(row.transcript),
    acmgClassification: acmg(row.acmgClassification),
    consequence: s(row.consequence),
    rsId: s(row.rsId) || undefined,
    clinvarId: s(row.clinvarId) || undefined,
    gnomadAF: row.gnomadAF === undefined || row.gnomadAF === null ? undefined : n(row.gnomadAF),
    detectionCount: n(row.detectionCount),
    firstDetectedAt: s(row.firstDetectedAt),
    lastDetectedAt: s(row.lastDetectedAt),
    records: Array.isArray(row.records) ? row.records as GroupedSNVIndel['records'] : [],
  };
}

function mapCNVSegment(row: BackendRow): GroupedCNVSegment {
  return {
    groupId: s(row.groupId),
    chromosome: s(row.chromosome),
    startPosition: n(row.startPosition),
    endPosition: n(row.endPosition),
    length: n(row.length),
    type: cnvType(row.type),
    copyNumber: n(row.copyNumber),
    genes: arr(row.genes),
    confidence: n(row.confidence),
    detectionCount: n(row.detectionCount),
    firstDetectedAt: s(row.firstDetectedAt),
    lastDetectedAt: s(row.lastDetectedAt),
    records: Array.isArray(row.records) ? row.records as GroupedCNVSegment['records'] : [],
  };
}

function mapCNVExon(row: BackendRow): GroupedCNVExon {
  return {
    ...mapCNVSegment(row),
    gene: s(row.gene),
    transcript: s(row.transcript),
    exon: s(row.exon),
    ratio: n(row.ratio),
  };
}

function mapSTR(row: BackendRow): GroupedSTR {
  return {
    groupId: s(row.groupId),
    gene: s(row.gene),
    transcript: s(row.transcript),
    locus: s(row.locus),
    repeatUnit: s(row.repeatUnit),
    normalRangeMin: n(row.normalRangeMin),
    normalRangeMax: n(row.normalRangeMax),
    status: strStatus(row.status),
    minRepeatCount: n(row.minRepeatCount),
    maxRepeatCount: n(row.maxRepeatCount),
    detectionCount: n(row.detectionCount),
    firstDetectedAt: s(row.firstDetectedAt),
    lastDetectedAt: s(row.lastDetectedAt),
    records: Array.isArray(row.records) ? row.records as GroupedSTR['records'] : [],
  };
}

function mapMEI(row: BackendRow): GroupedMEI {
  return {
    groupId: s(row.groupId),
    chromosome: s(row.chromosome),
    position: n(row.position),
    gene: s(row.gene),
    meiType: meiType(row.meiType ?? row.teType),
    strand: s(row.strand ?? row.direction).startsWith('3') ? '-' : '+',
    length: n(row.length),
    impact: s(row.impact) || undefined,
    acmgClassification: row.acmgClassification ? acmg(row.acmgClassification) : undefined,
    detectionCount: n(row.detectionCount),
    firstDetectedAt: s(row.firstDetectedAt),
    lastDetectedAt: s(row.lastDetectedAt),
    records: Array.isArray(row.records) ? row.records as GroupedMEI['records'] : [],
  };
}

function mapMT(row: BackendRow): GroupedMTVariant {
  return {
    groupId: s(row.groupId),
    position: n(row.position),
    ref: s(row.ref),
    alt: s(row.alt),
    gene: s(row.gene),
    pathogenicity: acmg(row.pathogenicity ?? row.clinvarSig ?? row.clinvarSignificance),
    associatedDisease: s(row.associatedDisease ?? row.mitophenPhenotypes ?? row.clinvarDN),
    haplogroup: s(row.haplogroup) || undefined,
    minHeteroplasmy: n(row.minHeteroplasmy),
    maxHeteroplasmy: n(row.maxHeteroplasmy),
    detectionCount: n(row.detectionCount),
    firstDetectedAt: s(row.firstDetectedAt),
    lastDetectedAt: s(row.lastDetectedAt),
    records: Array.isArray(row.records) ? row.records as GroupedMTVariant['records'] : [],
  };
}

function mapUPD(row: BackendRow): GroupedUPDRegion {
  return {
    groupId: s(row.groupId),
    chromosome: s(row.chromosome),
    startPosition: n(row.startPosition),
    endPosition: n(row.endPosition),
    length: n(row.length),
    type: updType(row.type),
    genes: arr(row.genes),
    parentOfOrigin: parentOfOrigin(row.parentOfOrigin),
    detectionCount: n(row.detectionCount),
    firstDetectedAt: s(row.firstDetectedAt),
    lastDetectedAt: s(row.lastDetectedAt),
    records: Array.isArray(row.records) ? row.records as GroupedUPDRegion['records'] : [],
  };
}

export const getGroupedSNVIndels = (filterState: HistoryTableFilterState) => getHistory('/v1/history/snv-indel', filterState, mapSNV);
export const getGroupedCNVSegments = (filterState: HistoryTableFilterState) => getHistory('/v1/history/cnv-segment', filterState, mapCNVSegment);
export const getGroupedCNVExons = (filterState: HistoryTableFilterState) => getHistory('/v1/history/cnv-exon', filterState, mapCNVExon);
export const getGroupedSTRs = (filterState: HistoryTableFilterState) => getHistory('/v1/history/str', filterState, mapSTR);
export const getGroupedMEIs = (filterState: HistoryTableFilterState) => getHistory('/v1/history/mei', filterState, mapMEI);
export const getGroupedMTVariants = (filterState: HistoryTableFilterState) => getHistory('/v1/history/mt', filterState, mapMT);
export const getGroupedUPDRegions = (filterState: HistoryTableFilterState) => getHistory('/v1/history/upd', filterState, mapUPD);
