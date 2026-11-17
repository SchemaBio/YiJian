import { readSNVSample } from '@/lib/snv-sample-metrics';
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
export const ACMG_CONFIG: Record<ACMGClassification, { label: string; variant: 'danger' | 'warning' | 'neutral' | 'info' | 'success' }> = {
  Pathogenic: { label: 'Pathogenic', variant: 'danger' },
  Likely_Pathogenic: { label: 'Likely_Pathogenic', variant: 'warning' },
  VUS: { label: 'VUS', variant: 'neutral' },
  Likely_Benign: { label: 'Likely_Benign', variant: 'info' },
  Benign: { label: 'Benign', variant: 'success' },
};

export const ACMG_ALIASES: Record<string, ACMGClassification> = {
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
 revision:number;
  id: string;
  name: string;
  geneCount: number;
  genes: string[];
}

export type BackendReviewStatus = Partial<VariantReviewStatus> & {
  reviewed_by?: string;
  reviewed_at?: string;
  focused_by?: string;
  focused_at?: string;
};

export type BackendRow = Record<string, unknown> & {
  id?: string;
  reviewStatus?: BackendReviewStatus;
  review_status?: BackendReviewStatus;
};

export interface BackendPage<T> {
  items?: T[];
  data?: T[];
  total?: number;
  page?: number;
  page_size?: number;
  pageSize?: number;
  columns?: string[];
  columnTypes?: PaginatedResult<unknown>['columnTypes'];
  columnAliases?: Record<string, string[]>;
  fieldProfileVersion?: string;
  version?: string;
  attemptId?: string;
  rowCount?: number;
}

export function n(value: unknown, fallback = 0): number {
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

export function nullableNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

export function s(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function arr(value: unknown): string[] {
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

export function nums(value: unknown): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) return [value];
  if (Array.isArray(value)) return value.flatMap(nums);
  if (typeof value !== 'string') return [];
  return Array.from(value.matchAll(/-?\d+(?:\.\d+)?/g))
    .map(match => Number(match[0]))
    .filter(Number.isFinite);
}

export function normalizeReview(row: BackendRow): VariantReviewStatus {
  const review = row.reviewStatus ?? row.review_status ?? {};
  return {
    rowOrdinal: typeof row.rowOrdinal === 'number' && Number.isSafeInteger(row.rowOrdinal) && row.rowOrdinal >= 0 ? row.rowOrdinal : undefined,
    attemptId: typeof row.attemptId === 'string' ? row.attemptId : undefined,
    datasetVersion: typeof row.datasetVersion === 'string' ? row.datasetVersion : undefined,
    pinned: row.pinned === true || review.pinned === true,
    automaticAssessment: row.automaticAssessment as VariantReviewStatus['automaticAssessment'],
    pinReasons: Array.isArray(row.pinReasons) ? row.pinReasons.filter((x):x is string=>typeof x==='string') : undefined,
    pinSource: row.pinSource === 'automatic' ? 'automatic' : row.pinSource === 'manual' ? 'manual' : undefined,
    reviewed: Boolean(review.reviewed ?? row.reviewed),
    focused: Boolean(review.focused ?? row.focused),
    reviewedBy: s(review.reviewedBy ?? review.reviewed_by ?? row.reviewedBy ?? row.reviewed_by, undefined as unknown as string),
    reviewedAt: s(review.reviewedAt ?? review.reviewed_at ?? row.reviewedAt ?? row.reviewed_at, undefined as unknown as string),
    focusedBy: s(review.focusedBy ?? review.focused_by ?? row.focusedBy ?? row.focused_by, undefined as unknown as string),
    focusedAt: s(review.focusedAt ?? review.focused_at ?? row.focusedAt ?? row.focused_at, undefined as unknown as string),
    adjustmentVersion: n(row.adjustmentVersion ?? row.adjustment_version),
  };
}

export function normalizePage<T, U>(
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
    columns: response.columns,
    columnTypes: response.columnTypes,
    columnAliases: response.columnAliases,
    fieldProfileVersion: response.fieldProfileVersion,
    version: response.version,
  };
}

export type ResultQueryType = 'snv-indel' | 'cnv-segment' | 'cnv-exon' | 'str' | 'mei' | 'mt' | 'upd' | 'roh';

export function params(type: ResultQueryType, filterState: TableFilterState): Record<string, string> {
  const result: Record<string, string> = {
    page: String(filterState.page),
    page_size: String(filterState.pageSize),
  };
  if (filterState.searchQuery) result.search = filterState.searchQuery;
	if (filterState.sortColumn) result.sort = filterState.sortColumn;
	if (filterState.sortDirection) result.direction = filterState.sortDirection;

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
    case 'mt':
		if (typeof filters.pathogenicity === 'string') result.pathogenicity = filters.pathogenicity;
		break;
    case 'cnv-exon':
    case 'upd':
    case 'roh':
      break;
  }
  return result;
}

export function toBackendCnvType(type: string): string {
  if (type === 'Amplification') return 'DUP';
  if (type === 'Deletion') return 'DEL';
  if (type === 'Normal') return 'Normal';
  return type;
}

export function toBackendMEIType(type: string): string {
  if (type === 'LINE1') return 'L1';
  return type;
}

export function cnvType(type: unknown): CNVSegment['type'] {
  const value = s(type).toUpperCase();
  if (value === 'DUP' || value === 'AMPLIFICATION' || value === 'GAIN') return 'Amplification';
  if (value === 'DEL' || value === 'DELETION' || value === 'LOSS') return 'Deletion';
  if (value === 'NORMAL' || value === 'NEUTRAL') return 'Normal';
  return 'Unknown';
}

export function variantType(type: unknown): SNVIndel['variantType'] {
  const value = s(type).toUpperCase();
  if (value === 'INS' || value === 'INSERTION') return 'Insertion';
  if (value === 'DEL' || value === 'DELETION') return 'Deletion';
  if (value === 'MNP' || value === 'COMPLEX') return 'Complex';
  return 'SNV';
}

export function zygosity(value: unknown): MEIVariant['zygosity'] {
  const normalized = s(value).toLowerCase();
  if (normalized.includes('hom') || normalized === '1/1') return 'Homozygous';
  if (normalized.includes('hemi')) return 'Hemizygous';
  if (normalized.includes('het') || normalized === '0/1' || normalized === '1/0') return 'Heterozygous';
  return 'Unknown';
}

export function acmg(value: unknown): ACMGClassification | undefined {
  const normalized = s(value)
    .trim()
    .replace(/[-\s]+/g, '_')
    .replace(/__+/g, '_')
    .toLowerCase();
  return ACMG_ALIASES[normalized];
}

export function strStatus(value: unknown): STRStatus {
  const normalized = s(value).replace(/[-\s]+/g, '').toLowerCase();
  if (normalized === 'normal') return 'Normal';
  if (normalized === 'premutation') return 'Premutation';
  if (normalized === 'fullmutation') return 'FullMutation';
  return 'Unknown';
}

export function meiType(value: unknown): MEIType {
  const normalized = s(value).toUpperCase();
  if (normalized === 'ALU') return 'Alu';
  if (normalized === 'SVA') return 'SVA';
  if (normalized === 'L1' || normalized === 'LINE1' || normalized === 'LINE-1') return 'LINE1';
  return 'Unknown';
}

export function meiInsertionType(value: unknown): MEIVariant['insertionType'] {
  const normalized = s(value).trim().toLowerCase();
  if (normalized === 'insertion' || normalized === 'insert') return 'insertion';
  if (normalized === 'deletion' || normalized === 'delete') return 'deletion';
  if (normalized === 'complex') return 'complex';
  return 'Unknown';
}

export function meiStrand(value: unknown): MEIVariant['strand'] {
  const normalized = s(value).trim().toLowerCase();
  if (normalized === '+' || normalized === 'plus' || normalized.startsWith('5')) return '+';
  if (normalized === '-' || normalized === 'minus' || normalized.startsWith('3')) return '-';
  return 'Unknown';
}

export function pathogenicity(row: BackendRow): MitochondrialPathogenicity {
  const source = row.pathogenicity ?? row.clinvarSig ?? row.clinvarSignificance;
  const value = s(source).toLowerCase();
  if (value.includes('pathogenic') && value.includes('likely')) return 'Likely_Pathogenic';
  if (value.includes('pathogenic')) return 'Pathogenic';
  if (value.includes('benign') && value.includes('likely')) return 'Likely_Benign';
  if (value.includes('benign')) return 'Benign';
  return 'Unknown';
}

export function repeatCount(row: BackendRow): number {
  const direct = n(row.repeatCount, NaN);
  if (Number.isFinite(direct)) return direct;
  const alleles = [
    ...nums(row.allele1Repeats),
    ...nums(row.allele2Repeats),
    ...nums(row.repeatDisplay),
  ];
  return alleles.length > 0 ? Math.max(...alleles) : n(row.refRepeats);
}

export function predictedGender(value: unknown): QCResult['predictedGender'] {
  const normalized = s(value, 'Unknown').trim().toLowerCase();
  if (normalized === 'male' || normalized === 'm' || normalized === 'xy') return 'Male';
  if (normalized === 'female' || normalized === 'f' || normalized === 'xx') return 'Female';
  return 'Unknown';
}

export function updType(value: unknown): UPDRegion['type'] {
  const normalized = s(value).replace(/[-\s]+/g, '').toLowerCase();
  if (normalized === 'heterodisomy') return 'Heterodisomy';
  if (normalized === 'isodisomy') return 'Isodisomy';
  return 'Unknown';
}

export function parentOfOrigin(value: unknown): UPDRegion['parentOfOrigin'] {
  const normalized = s(value).trim().toLowerCase();
  if (normalized === 'maternal' || normalized === 'mother') return 'Maternal';
  if (normalized === 'paternal' || normalized === 'father') return 'Paternal';
  return 'Unknown';
}

export function mapSNV(row: BackendRow): SNVIndel {
  const annotations = row.annotationValues && typeof row.annotationValues === 'object' ? row.annotationValues as Record<string, string> : undefined;
  const reviewStatus = annotations?.ClinVar_RevStat ?? s(row.clinvarRevStat);
  const source = {...row, ...annotations};
  const proband = readSNVSample(source);
  const hasRole = (role: string) => Object.keys(source).some(key => /^(Genotype|Zygosity|VAF|AD)_/.test(key) && key.endsWith('_'+role));
  const automaticAcmg = row.automaticAcmg && typeof row.automaticAcmg === 'object'
    ? row.automaticAcmg as SNVIndel['automaticAcmg']
    : undefined;
  const adjustments = row.adjustments && typeof row.adjustments === 'object' ? row.adjustments as BackendRow : {};
  const adoptedACMG = adjustments.adoptedACMG as SNVIndel['adoptedACMG'];
  return {
    id: s(row.id),
    gene: s(row.gene, '-'),
    chromosome: s(row.chromosome),
    position: n(row.position),
    ref: s(row.ref, '-'),
    alt: s(row.alt, '-'),
    variantType: variantType(row.variantType),
    zygosity: proband.zygosity,
    alleleFrequency: proband.alleleFrequency,
    proband,
    father: hasRole('father') ? readSNVSample(source, 'father') : undefined,
    mother: hasRole('mother') ? readSNVSample(source, 'mother') : undefined,
    depth: n(row.depth),
    acmgClassification: adoptedACMG && !adoptedACMG.automatic
      ? acmg(adoptedACMG.classification)
      : acmg(row.acmgClassification ?? row.acmgClassificationComputed),
    automaticAcmg,
    acmgEvidence: Array.isArray(adjustments.acmgEvidence) ? adjustments.acmgEvidence as ACMGEvidenceEntry[] : automaticAcmg?.criteria,
    acmgOverride: acmg(adjustments.acmgOverride),
    acmgOverrideReason: s(adjustments.acmgOverrideReason),
    activeAcmgVersion: adoptedACMG?.version ?? (adjustments.activeAcmgVersion === 'svcv4' ? 'svcv4' : 'legacy'),
    svcv4Assessment: adjustments.svcv4Assessment as SNVIndel['svcv4Assessment'],
    acmgSavedAt: adjustments.acmgSavedAt as string | undefined, acmgSavedBy: adjustments.acmgSavedBy as string | undefined, svcv4SavedAt: adjustments.svcv4SavedAt as string | undefined, svcv4SavedBy: adjustments.svcv4SavedBy as string | undefined,
    adoptedACMG,
    acmgAIResult: adjustments.acmgAIResult as SNVIndel['acmgAIResult'],
    svcv4AIResult: adjustments.svcv4AIResult as SNVIndel['svcv4AIResult'],
    legacyAcmgClassification: acmg(adjustments.acmgOverride) ?? ('acmgEvidence' in adjustments ? acmg(adjustments.acmgClassification) : automaticAcmg?.classification),
    acmgVusSubclass: s(row.acmgVusSubclass),
    acmgState: s(adjustments.acmgState ?? automaticAcmg?.state),
    acmgAssessmentSource: row.acmgAssessmentSource === 'manual_override' || row.acmgAssessmentSource === 'manual_evidence' ? row.acmgAssessmentSource : 'automatic',
    interpretation: s(adjustments.interpretation),
    acmgCriteria: Array.isArray(adjustments.acmgEvidence) ? adjustments.acmgEvidence.map(item => typeof item === 'object' && item !== null ? String((item as Record<string, unknown>).code ?? '') : String(item)) : automaticAcmg?.criteria.map(item => item.code),
    transcript: s(row.transcript, '-'),
    hgvsc: s(row.hgvsc, '-'),
    hgvsp: s(row.hgvsp, '-'),
    consequence: s(row.consequence, '-'),
    rsId: s(row.rsId),
    clinvarSignificance: s(row.clinvarSignificance),
    clinvarReviewStatus: reviewStatus,
    clinvarDisease: s(row.clinvarDn),
    clinvarStars: clinvarReviewStars(reviewStatus),
    annotationValues: row.annotationValues && typeof row.annotationValues === 'object' ? row.annotationValues as Record<string, string> : undefined,
    gnomadAF: optionalAnnotationNumber(row.gnomadAF),
    gnomadEasAF: optionalAnnotationNumber(row.gnomadEasAF),
    maxAF: optionalAnnotationNumber(row.maxAF),
    gnomadNhomaltXX: optionalAnnotationNumber(row.gnomadNhomaltXX),
    gnomadNhomaltXY: optionalAnnotationNumber(row.gnomadNhomaltXY),
    pangolinGain: optionalAnnotationNumber(row.pangolinGain),
    pangolinLoss: optionalAnnotationNumber(row.pangolinLoss),
    pangolinAnnotation: s(row.pangolinAN),
    evoScore: optionalAnnotationNumber(row.evoScore),
    evoAnnotation: s(row.evoScoreAN),
    alphaMissenseScore: optionalAnnotationNumber(row.alphaMissenseAM),
    alphaMissenseClass: s(row.alphaMissenseAMC),
    diseaseAssociation: s(row.diseaseAssociation ?? row.genccDiseaseTitle),
    inheritanceMode: s(row.inheritanceMode ?? row.genccMoi),
    ...normalizeReview(row),
  };
}

export function mapCNVSegment(row: BackendRow): CNVSegment {
  const adjustments = row.adjustments && typeof row.adjustments === 'object' ? row.adjustments as Record<string, unknown> : {};
  const start = n(row.startPosition);
  const end = n(row.endPosition);
  return {
    id: s(row.id),
    attemptId: s(row.attemptId),
    annotationValues: row.annotationValues as Record<string, string> | undefined,
    iscnCandidate: s(row.iscnCandidate ?? row.ISCN_Candidate),
    chromosome: s(row.chromosome),
    startPosition: start,
    coordinateSystem: row.coordinateSystem === '0-based-half-open' || row.coordinateSystem === '1-based-inclusive' ? row.coordinateSystem : undefined,
    endPosition: end,
    interpretation: s(adjustments.interpretation),
    length: Math.max(0, end - start),
    type: cnvType(row.type),
    copyNumber: nullableNumber(row.copyNumber ?? row.CN ?? row.Col8),
    copyRatio: nullableNumber(row.Copy_Ratio ?? row.copyRatio),
    log2Ratio: nullableNumber(row.log2Ratio),
    genes: arr(row.dosageGenes ?? row.genccADGenes),
    confidence: nullableNumber(row.weight ?? row.quality),
    assessment: row.cnvAssessment && typeof row.cnvAssessment === "object"
      ? { ...(row.cnvAssessment as CNVAssessment), adjustmentVersion: n(row.adjustmentVersion) }
      : automaticCNVAssessment(row),
    adoptedCNV: (adjustments.adoptedCNV ?? row.adoptedCNV) as CNVSegment['adoptedCNV'],
    cnvAIResult: (adjustments.cnvAIResult ?? row.cnvAIResult) as CNVSegment['cnvAIResult'],
    ...normalizeReview(row),
  };
}

export function automaticCNVAssessment(row:BackendRow):CNVAssessment|undefined{
 const auto=row.automaticAssessment as VariantReviewStatus['automaticAssessment'];
 if(!auto?.cnvCriteria)return undefined;
 return {id:'automatic-'+s(row.id),cnvId:s(row.id),cnvType:cnvType(row.type),criteria:auto.cnvCriteria as unknown as CNVAssessment['criteria'],sectionScores:auto.sectionScores as unknown as CNVAssessment['sectionScores'],totalScore:auto.cnvScore??0,classification:auto.cnvClassification??'VUS',assessmentState:auto.cnvClassification?'evaluated':'insufficient_evidence',assessmentVersion:auto.contextVersion,autoEvidenceNotes:auto.pending,isAutoCalculated:true,isUserModified:false,createdAt:'',updatedAt:''};
}

export function mapCNVExon(row: BackendRow): CNVExon {
  return {
    ...mapCNVSegment(row),
    gene: s(row.gene, '-'),
    transcript: s(row.transcript, '-'),
    exon: s(row.exon ?? row.exonCount, '-'),
    copyNumber: nullableNumber(row.copyNumber),
    ratio: nullableNumber(row.copyRatio),
    confidenceLabel: s(row.confidenceLabel),
  };
}

export function mapSTR(row: BackendRow): STR {
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

export function mapMEI(row: BackendRow): MEIVariant {
  return {
    id: s(row.id),
    chromosome: s(row.chromosome),
    position: n(row.position),
    meiType: meiType(row.teType ?? row.teFamily),
    insertionType: meiInsertionType(row.insertionType ?? row.eventType),
    strand: meiStrand(row.direction ?? row.strand),
    length: n(row.avgSoftClipLength),
    gene: s(row.gene, '-'),
    transcript: s(row.transcript),
    impact: s(row.impact ?? row.location ?? row.consequence),
    zygosity: zygosity(row.zygosity ?? row.genotype),
    supportingReads: n(row.supportingReads),
    totalReads: n(row.depth ?? row.supportingReads),
    frequency: optionalAnnotationNumber(row.gnomadAF),
    acmgClassification: undefined,
    clinvarId: s(row.clinvarId),
    diseaseAssociation: s(row.clinvarDn ?? row.clinvarDN),
    notes: s(row.confidence),
    ...normalizeReview(row),
  };
}

export function mapMT(row: BackendRow): MitochondrialVariant {
  const readCount = (value: unknown) => {
    const count = typeof value === 'bigint' ? Number(value) : nullableNumber(value);
    return count !== null && Number.isSafeInteger(count) && count >= 0 ? count : null;
  };
  // AD is ordered REF, ALT1, ALT2, ... in the mitochondrial report.
  const alleleDepth = row.ad ?? row.aD;
  const alleleCounts = Array.isArray(alleleDepth) ? alleleDepth : s(alleleDepth).split(',');
  const annotationValues = row.annotationValues as MitochondrialVariant['annotationValues'];
  const position = n(row.position);
  const ref = s(row.ref, '-');
  const alt = s(row.alt, '-');
  const hgvs = s(row.mtHgvs ?? annotationValues?.MT_HGVS).trim();
  const isSubstitution = position > 0 && /^[ACGT]$/i.test(ref) && /^[ACGT]$/i.test(alt) && ref !== alt;
  return {
    id: s(row.id),
    position,
    ref,
    alt,
    gene: s(row.mtGene ?? row.gene, '-'),
    heteroplasmy: n(row.heteroplasmy),
    depth: readCount(row.depth),
    altReadCounts: alleleCounts.slice(1).map(readCount),
    hgvs: hgvs && !['.', '-'].includes(hgvs) ? hgvs : isSubstitution ? `m.${position}${ref}>${alt}` : undefined,
    annotationValues,
    mtAssessment: row.mtAssessment as MitochondrialVariant['mtAssessment'],
    pathogenicity: pathogenicity(row),
    associatedDisease: s(row.associatedDisease ?? row.mitophenPhenotypes ?? row.clinvarDn ?? row.clinvarDN, '-'),
    haplogroup: s(row.haplogroup),
    ...normalizeReview(row),
  };
}

export function mapUPD(row: BackendRow): UPDRegion {
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

export function mapROH(row: BackendRow): ROHRegion {
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
