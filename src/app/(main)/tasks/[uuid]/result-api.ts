import { api } from '@/lib/api';
import type {
  ACMGClassification,
  CNVAssessment,
  CNVExon,
  CNVSegment,
  MEIVariant,
  MEIType,
  MitochondrialPathogenicity,
  MitochondrialVariant,
  PaginatedResult,
  QCResult,
  ROHRegion,
  SNVIndel,
  STR,
  STRStatus,
  TableFilterState,
  UPDRegion,
  VariantReviewStatus,
} from './types';

export const ACMG_CONFIG: Record<ACMGClassification, { label: string; variant: 'danger' | 'warning' | 'neutral' | 'info' | 'success' }> = {
  Pathogenic: { label: '致病', variant: 'danger' },
  Likely_Pathogenic: { label: '可能致病', variant: 'warning' },
  VUS: { label: '意义未明', variant: 'neutral' },
  Likely_Benign: { label: '可能良性', variant: 'info' },
  Benign: { label: '良性', variant: 'success' },
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

export interface GeneListOption {
  id: string;
  name: string;
  geneCount: number;
  genes: string[];
}

type BackendReviewStatus = Partial<VariantReviewStatus> & {
  reviewed_by?: string;
  reviewed_at?: string;
  reported_by?: string;
  reported_at?: string;
};

type BackendRow = Record<string, unknown> & {
  id?: string;
  reviewStatus?: BackendReviewStatus;
  review_status?: BackendReviewStatus;
};

interface BackendPage<T> {
  items?: T[];
  data?: T[];
  total?: number;
  page?: number;
  page_size?: number;
  pageSize?: number;
}

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

function nums(value: unknown): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(nums);
  if (typeof value !== 'string') return [];
  return Array.from(value.matchAll(/-?\d+(?:\.\d+)?/g))
    .map(match => Number(match[0]))
    .filter(Number.isFinite);
}

function normalizeReview(row: BackendRow): VariantReviewStatus {
  const review = row.reviewStatus ?? row.review_status ?? {};
  return {
    reviewed: Boolean(review.reviewed ?? row.reviewed),
    reported: Boolean(review.reported ?? row.reported),
    reviewedBy: s(review.reviewedBy ?? review.reviewed_by ?? row.reviewedBy ?? row.reviewed_by, undefined as unknown as string),
    reviewedAt: s(review.reviewedAt ?? review.reviewed_at ?? row.reviewedAt ?? row.reviewed_at, undefined as unknown as string),
    reportedBy: s(review.reportedBy ?? review.reported_by ?? row.reportedBy ?? row.reported_by, undefined as unknown as string),
    reportedAt: s(review.reportedAt ?? review.reported_at ?? row.reportedAt ?? row.reported_at, undefined as unknown as string),
  };
}

function normalizePage<T, U>(
  response: BackendPage<T> | T[],
  filterState: TableFilterState,
  mapper: (row: T) => U
): PaginatedResult<U> {
  if (Array.isArray(response)) {
    return {
      data: response.map(mapper),
      total: response.length,
      page: filterState.page,
      pageSize: filterState.pageSize,
    };
  }

  const items = response.items ?? response.data ?? [];
  return {
    data: items.map(mapper),
    total: n(response.total, items.length),
    page: n(response.page, filterState.page),
    pageSize: n(response.pageSize ?? response.page_size, filterState.pageSize),
  };
}

type ResultQueryType = 'snv-indel' | 'cnv-segment' | 'cnv-exon' | 'str' | 'mei' | 'mt' | 'upd' | 'roh';

function params(type: ResultQueryType, filterState: TableFilterState): Record<string, string> {
  const result: Record<string, string> = {
    page: String(filterState.page),
    page_size: String(filterState.pageSize),
  };
  if (filterState.searchQuery) result.search = filterState.searchQuery;

  const filters = filterState.filters;
  switch (type) {
    case 'snv-indel':
      if (filterState.geneListId) result.geneListId = filterState.geneListId;
      if (typeof filters.acmgClassification === 'string') result.classification = filters.acmgClassification;
      break;
    case 'cnv-segment':
      if (typeof filters.type === 'string') result.type = toBackendCnvType(filters.type);
      break;
    case 'str':
      if (typeof filters.status === 'string') result.status = filters.status;
      break;
    case 'mei':
      if (typeof filters.type === 'string') result.teType = toBackendMEIType(filters.type);
      break;
    case 'cnv-exon':
    case 'mt':
    case 'upd':
    case 'roh':
      break;
  }
  return result;
}

function toBackendCnvType(type: string): string {
  if (type === 'Amplification') return 'DUP';
  if (type === 'Deletion') return 'DEL';
  if (type === 'Normal') return 'Normal';
  return type;
}

function toBackendMEIType(type: string): string {
  if (type === 'LINE1') return 'L1';
  return type;
}

function cnvType(type: unknown): CNVSegment['type'] {
  const value = s(type).toUpperCase();
  if (value === 'DUP' || value === 'AMPLIFICATION' || value === 'GAIN') return 'Amplification';
  if (value === 'DEL' || value === 'DELETION' || value === 'LOSS') return 'Deletion';
  return 'Normal';
}

function copyNumber(type: unknown, copyRatio: unknown): number {
  const normalizedType = cnvType(type);
  const fallbackRatio = normalizedType === 'Amplification' ? 2 : normalizedType === 'Deletion' ? 1 : 1;
  const inferred = Math.round(n(copyRatio, fallbackRatio) * 2);
  return Math.max(0, inferred);
}

function variantType(type: unknown): SNVIndel['variantType'] {
  const value = s(type).toUpperCase();
  if (value === 'INS' || value === 'INSERTION') return 'Insertion';
  if (value === 'DEL' || value === 'DELETION') return 'Deletion';
  if (value === 'MNP' || value === 'COMPLEX') return 'Complex';
  return 'SNV';
}

function zygosity(value: unknown): SNVIndel['zygosity'] {
  const normalized = s(value).toLowerCase();
  if (normalized.includes('hom') || normalized === '1/1') return 'Homozygous';
  if (normalized.includes('hemi')) return 'Hemizygous';
  return 'Heterozygous';
}

function acmg(value: unknown): ACMGClassification {
  const normalized = s(value, 'VUS')
    .trim()
    .replace(/[-\s]+/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase();
  return ACMG_ALIASES[normalized] ?? 'VUS';
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
  if (normalized === 'L1' || normalized === 'LINE1' || normalized === 'LINE-1') return 'LINE1';
  return 'Unknown';
}

function pathogenicity(row: BackendRow): MitochondrialPathogenicity {
  const source = row.pathogenicity ?? row.clinvarSig ?? row.clinvarSignificance;
  const value = s(source).toLowerCase();
  if (value.includes('pathogenic') && value.includes('likely')) return 'Likely_Pathogenic';
  if (value.includes('pathogenic')) return 'Pathogenic';
  if (value.includes('benign') && value.includes('likely')) return 'Likely_Benign';
  if (value.includes('benign')) return 'Benign';
  return 'VUS';
}

function repeatCount(row: BackendRow): number {
  const direct = n(row.repeatCount, NaN);
  if (Number.isFinite(direct)) return direct;
  const alleles = [
    ...nums(row.allele1Repeats),
    ...nums(row.allele2Repeats),
    ...nums(row.repeatDisplay),
  ];
  return alleles.length > 0 ? Math.max(...alleles) : n(row.refRepeats);
}

function predictedGender(value: unknown): QCResult['predictedGender'] {
  const normalized = s(value, 'Unknown').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'm' || normalized === 'xy') return 'Male';
  if (normalized === 'female' || normalized === 'f' || normalized === 'xx') return 'Female';
  return 'Unknown';
}

function updType(value: unknown): UPDRegion['type'] {
  return s(value).replace(/[-\s]+/g, '').toLowerCase() === 'heterodisomy'
    ? 'Heterodisomy'
    : 'Isodisomy';
}

function parentOfOrigin(value: unknown): UPDRegion['parentOfOrigin'] {
  const normalized = s(value).trim().toLowerCase();
  if (normalized === 'maternal' || normalized === 'mother') return 'Maternal';
  if (normalized === 'paternal' || normalized === 'father') return 'Paternal';
  return 'Unknown';
}

function mapSNV(row: BackendRow): SNVIndel {
  return {
    id: s(row.id),
    gene: s(row.gene, '-'),
    chromosome: s(row.chromosome),
    position: n(row.position),
    ref: s(row.ref, '-'),
    alt: s(row.alt, '-'),
    variantType: variantType(row.variantType),
    zygosity: zygosity(row.zygosity ?? row.genotype),
    alleleFrequency: n(row.alleleFrequency ?? row.vaf),
    depth: n(row.depth),
    acmgClassification: acmg(row.acmgClassification),
    transcript: s(row.transcript, '-'),
    hgvsc: s(row.hgvsc, '-'),
    hgvsp: s(row.hgvsp, '-'),
    consequence: s(row.consequence, '-'),
    rsId: s(row.rsId),
    clinvarSignificance: s(row.clinvarSignificance),
    gnomadAF: n(row.gnomadAF, undefined as unknown as number),
    gnomadEasAF: n(row.gnomadEasAF, undefined as unknown as number),
    diseaseAssociation: s(row.diseaseAssociation ?? row.genccDiseaseTitle),
    inheritanceMode: s(row.inheritanceMode ?? row.genccMoi),
    ...normalizeReview(row),
  };
}

function mapCNVSegment(row: BackendRow): CNVSegment {
  const start = n(row.startPosition);
  const end = n(row.endPosition);
  return {
    id: s(row.id),
    chromosome: s(row.chromosome),
    startPosition: start,
    endPosition: end,
    length: Math.max(0, end - start + 1),
    type: cnvType(row.type),
    copyNumber: copyNumber(row.type, row.copyRatio),
    genes: arr(row.dosageGenes ?? row.genccADGenes),
    confidence: n(row.weight ?? row.quality, 1),
    ...normalizeReview(row),
  };
}

function mapCNVExon(row: BackendRow): CNVExon {
  return {
    ...mapCNVSegment(row),
    gene: s(row.gene, '-'),
    transcript: s(row.transcript, '-'),
    exon: s(row.exon ?? row.exonCount, '-'),
    ratio: n(row.copyRatio ?? row.depthRatio ?? row.ratio2, 1),
  };
}

function mapSTR(row: BackendRow): STR {
  const max = n(row.normalRangeMax);
  return {
    id: s(row.id),
    gene: s(row.gene, '-'),
    transcript: s(row.transcript, '-'),
    locus: s(row.chromosome) ? `${s(row.chromosome)}:${n(row.position)}` : s(row.locus, '-'),
    repeatUnit: s(row.repeatUnit, '-'),
    repeatCount: repeatCount(row),
    normalRangeMin: n(row.normalRangeMin),
    normalRangeMax: max,
    status: strStatus(row.status),
    ...normalizeReview(row),
  };
}

function mapMEI(row: BackendRow): MEIVariant {
  return {
    id: s(row.id),
    chromosome: s(row.chromosome),
    position: n(row.position),
    meiType: meiType(row.teType ?? row.teFamily),
    insertionType: 'insertion',
    strand: s(row.direction).startsWith('3') ? '-' : '+',
    length: n(row.avgSoftClipLength),
    gene: s(row.gene, '-'),
    transcript: s(row.transcript),
    impact: s(row.impact ?? row.location ?? row.consequence),
    zygosity: 'Heterozygous',
    supportingReads: n(row.supportingReads),
    totalReads: n(row.depth ?? row.supportingReads),
    frequency: n(row.gnomadAF, undefined as unknown as number),
    acmgClassification: undefined,
    clinvarId: s(row.clinvarId),
    diseaseAssociation: s(row.clinvarDn ?? row.clinvarDN),
    notes: s(row.confidence),
    ...normalizeReview(row),
  };
}

function mapMT(row: BackendRow): MitochondrialVariant {
  return {
    id: s(row.id),
    position: n(row.position),
    ref: s(row.ref, '-'),
    alt: s(row.alt, '-'),
    gene: s(row.mtGene ?? row.gene, '-'),
    heteroplasmy: n(row.heteroplasmy),
    pathogenicity: pathogenicity(row),
    associatedDisease: s(row.associatedDisease ?? row.mitophenPhenotypes ?? row.clinvarDn ?? row.clinvarDN, '-'),
    haplogroup: s(row.haplogroup),
    ...normalizeReview(row),
  };
}

function mapUPD(row: BackendRow): UPDRegion {
  const start = n(row.startPosition);
  const end = n(row.endPosition);
  return {
    id: s(row.id),
    chromosome: s(row.chromosome),
    startPosition: start,
    endPosition: end,
    length: n(row.length, Math.max(0, end - start + 1)),
    type: updType(row.type),
    genes: arr(row.genes),
    parentOfOrigin: parentOfOrigin(row.parentOfOrigin),
    ...normalizeReview(row),
  };
}

function mapROH(row: BackendRow): ROHRegion {
  const start = n(row.begin ?? row.startPosition);
  const end = n(row.end ?? row.endPosition);
  const sizeMb = n(row.sizeMb, Math.max(0, end - start + 1) / 1_000_000);
  return {
    id: s(row.id),
    chromosome: s(row.chr ?? row.chromosome),
    startPosition: start,
    endPosition: end,
    length: Math.round(sizeMb * 1_000_000),
    sizeMb,
    variantCount: n(row.nbVariants),
    homozygosity: n(row.percentageHomozygosity),
    genes: arr(row.recessiveGenes),
    ...normalizeReview(row),
  };
}

export async function getQCResult(taskId: string): Promise<QCResult | null> {
  const row = await api.get<BackendRow>(`/v1/tasks/${encodeURIComponent(taskId)}/results/qc`);
  return {
    totalReads: n(row.totalReads),
    mappedReads: n(row.mappedReads),
    mappingRate: n(row.mappedReadsFraction),
    averageDepth: n(row.averageDepth ?? row.meanTargetCoverage),
    dedupDepth: n(row.dedupDepth),
    targetCoverage: n(row.coverageGte30x ?? row.pctTargetBases30x),
    duplicateRate: n(row.duplicateRate),
    q30Rate: n(row.q30Rate),
    insertSize: n(row.insertSizeMedian ?? row.insertSizeAverage),
    gcRatio: n(row.gcRatio ?? row.gcContent),
    uniformity: n(row.uniformity ?? row.pctTargetBases30x),
    captureEfficiency: n(row.captureEfficiency ?? row.targetDataFraction),
    predictedGender: predictedGender(row.predictedGender),
    contaminationRate: n(row.contaminationRate ?? row.pfMismatchRate),
    mtCoverage: n(row.mtCoverageGt0x),
    mtDepth: n(row.mtAverageDepth),
  };
}

async function getPage<T>(taskId: string, type: ResultQueryType, filterState: TableFilterState, mapper: (row: BackendRow) => T): Promise<PaginatedResult<T>> {
  const response = await api.get<BackendPage<BackendRow>>(`/v1/tasks/${encodeURIComponent(taskId)}/results/${encodeURIComponent(type)}`, { params: params(type, filterState) });
  return normalizePage(response, filterState, mapper);
}

export const getSNVIndels = (taskId: string, filterState: TableFilterState) => getPage(taskId, 'snv-indel', filterState, mapSNV);
export const getCNVSegments = (taskId: string, filterState: TableFilterState) => getPage(taskId, 'cnv-segment', filterState, mapCNVSegment);
export const getCNVExons = (taskId: string, filterState: TableFilterState) => getPage(taskId, 'cnv-exon', filterState, mapCNVExon);
export const getSTRs = (taskId: string, filterState: TableFilterState) => getPage(taskId, 'str', filterState, mapSTR);
export const getMEIs = (taskId: string, filterState: TableFilterState) => getPage(taskId, 'mei', filterState, mapMEI);
export const getMitochondrialVariants = (taskId: string, filterState: TableFilterState) => getPage(taskId, 'mt', filterState, mapMT);
export const getUPDRegions = (taskId: string, filterState: TableFilterState) => getPage(taskId, 'upd', filterState, mapUPD);
export const getROHRegions = (taskId: string, filterState: TableFilterState) => getPage(taskId, 'roh', filterState, mapROH);

type CNVAssessmentType = 'cnv-segment' | 'cnv-exon';

interface BackendCNVAssessment {
  variant_id?: string;
  variantId?: string;
  assessment?: CNVAssessment;
}

export async function listCNVAssessments(
  taskId: string,
  type: CNVAssessmentType,
  variantIds: string[] = []
): Promise<Record<string, CNVAssessment>> {
  const response = await api.get<BackendCNVAssessment[] | BackendPage<BackendCNVAssessment>>(
    `/v1/tasks/${encodeURIComponent(taskId)}/results/cnv-assessments`,
    {
      params: {
        type,
        ...(variantIds.length > 0 ? { variant_ids: variantIds.join(',') } : {}),
      },
    }
  );
  const items = Array.isArray(response) ? response : response.items ?? response.data ?? [];
  return items.reduce<Record<string, CNVAssessment>>((acc, item) => {
    const assessment = item.assessment;
    const id = assessment?.cnvId ?? s(item.variant_id ?? item.variantId);
    if (id && assessment) acc[id] = assessment;
    return acc;
  }, {});
}

export async function saveCNVAssessment(
  taskId: string,
  type: CNVAssessmentType,
  variantId: string,
  assessment: CNVAssessment
): Promise<CNVAssessment> {
  const response = await api.put<BackendCNVAssessment>(
    `/v1/tasks/${encodeURIComponent(taskId)}/results/cnv-assessments/${encodeURIComponent(type)}/${encodeURIComponent(variantId)}`,
    { assessment }
  );
  if (!response.assessment) {
    throw new Error('Octopus did not return saved CNV assessment');
  }
  return response.assessment;
}

export async function getGeneLists(): Promise<GeneListOption[]> {
  try {
    const response = await api.get<BackendPage<BackendRow>>('/v1/gene-lists', { params: { page: '1', page_size: '100' } });
    const items = response.items ?? response.data ?? [];
    return items.map(item => ({
      id: s(item.id),
      name: s(item.name),
      geneCount: n(item.geneCount ?? item.gene_count, arr(item.genes).length),
      genes: arr(item.genes),
    }));
  } catch {
    return [];
  }
}

export function reviewVariant(taskId: string, type: string, variantId: string, reviewed: boolean): Promise<{ reviewed: boolean }> {
  if (!reviewed) {
    return Promise.reject(new Error('Octopus review endpoint only supports marking a variant as reviewed.'));
  }
  return api.put(`/v1/tasks/${encodeURIComponent(taskId)}/results/${encodeURIComponent(type)}/${encodeURIComponent(variantId)}/review`, { reviewed });
}

export function reportVariant(taskId: string, type: string, variantId: string, reported: boolean): Promise<{ reported: boolean }> {
  if (!reported) {
    return Promise.reject(new Error('Octopus report endpoint only supports marking a variant as reported.'));
  }
  return api.put(`/v1/tasks/${encodeURIComponent(taskId)}/results/${encodeURIComponent(type)}/${encodeURIComponent(variantId)}/report`, { reported });
}
