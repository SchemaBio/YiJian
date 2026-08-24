/**
 * 历史检出 - 类型定义
 */

// ============ ACMG分类 ============
export type ACMGClassification =
  | 'Pathogenic'
  | 'Likely_Pathogenic'
  | 'VUS'
  | 'Likely_Benign'
  | 'Benign';

// ============ 通用检出记录 ============
export interface DetectionRecord {
  recordId: string;              // 记录唯一ID
  taskId: string;                // 任务UUID
  taskName: string;              // 任务名称
  pipeline: string;              // 流程名称
  pipelineVersion: string;       // 流程版本
  sampleId: string;              // 样本UUID
  internalId: string;            // 内部编号
  reviewedAt: string;            // 审核时间
  reviewedBy: string;            // 审核人
	 executionAttemptId?: string;
	 variantFingerprint?: string;
	 referenceGenome?: string;
	 action?: 'REVIEWED' | 'REVOKED';
	 timestampKnown?: boolean;
}

export interface ReviewEvent {
  id: string;
  taskUuid: string;
  executionAttemptId: string;
  importBatchId?: number;
  variantType: string;
  variantId: string;
  variantFingerprint: string;
  historyGroupKey?: string;
  action: 'REVIEWED' | 'REVOKED';
  actorEmail?: string;
  referenceGenome?: string;
  occurredAt?: string;
  timestampKnown: boolean;
  recordedAt: string;
}

// ============ SNP/Indel分组位点 ============
export interface GroupedSNVIndel {
  groupId: string;
  gene: string;
  hgvsc: string;
  hgvsp: string;
  transcript: string;
  acmgClassification: ACMGClassification;
  consequence: string;
  rsId?: string;
  clinvarId?: string;
  gnomadAF?: number;
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  records: DetectionRecord[];
	 referenceGenome?: string;
	 hasUnknownReviewTime?: boolean;
}

// ============ CNV片段分组位点 ============
export type CNVType = 'Amplification' | 'Deletion' | 'Normal';

export interface GroupedCNVSegment {
  groupId: string;
  chromosome: string;
  startPosition: number;
  endPosition: number;
  length: number;
  type: CNVType;
  copyNumber: number;
  genes: string[];
  confidence: number;
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  records: DetectionRecord[];
	 referenceGenome?: string;
	 hasUnknownReviewTime?: boolean;
}

// ============ CNV外显子分组位点 ============
export interface GroupedCNVExon {
  groupId: string;
  gene: string;
  transcript: string;
  exon: string;
  chromosome: string;
  startPosition: number;
  endPosition: number;
  type: CNVType;
  copyNumber: number;
  ratio: number;
  confidence: number;
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  records: DetectionRecord[];
	 referenceGenome?: string;
	 hasUnknownReviewTime?: boolean;
}

// ============ STR分组位点 ============
export type STRStatus = 'Normal' | 'Premutation' | 'FullMutation';

export interface GroupedSTR {
  groupId: string;
  gene: string;
  transcript: string;
  locus: string;
  repeatUnit: string;
  normalRangeMin: number;
  normalRangeMax: number;
  status: STRStatus;
  minRepeatCount: number;        // 最小重复次数
  maxRepeatCount: number;        // 最大重复次数
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  records: DetectionRecord[];
	 referenceGenome?: string;
	 hasUnknownReviewTime?: boolean;
}

// ============ MEI分组位点 ============
export type MEIType = 'LINE1' | 'Alu' | 'SVA' | 'Unknown';

export interface GroupedMEI {
  groupId: string;
  chromosome: string;
  position: number;
  gene: string;
  meiType: MEIType;
  strand: '+' | '-';
  length: number;
  impact?: string;
  acmgClassification?: ACMGClassification;
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  records: DetectionRecord[];
	 referenceGenome?: string;
	 hasUnknownReviewTime?: boolean;
}

// ============ 线粒体变异分组位点 ============
export type MitochondrialPathogenicity =
  | 'Pathogenic'
  | 'Likely_Pathogenic'
  | 'VUS'
  | 'Likely_Benign'
  | 'Benign';

export interface GroupedMTVariant {
  groupId: string;
  position: number;
  ref: string;
  alt: string;
  gene: string;
  pathogenicity: MitochondrialPathogenicity;
  associatedDisease: string;
  haplogroup?: string;
  minHeteroplasmy: number;       // 最小异质性
  maxHeteroplasmy: number;       // 最大异质性
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  records: DetectionRecord[];
	 referenceGenome?: string;
	 hasUnknownReviewTime?: boolean;
}

// ============ UPD分组位点 ============
export type UPDType = 'Isodisomy' | 'Heterodisomy';
export type ParentOfOrigin = 'Maternal' | 'Paternal' | 'Unknown';

export interface GroupedUPDRegion {
  groupId: string;
  chromosome: string;
  startPosition: number;
  endPosition: number;
  length: number;
  type: UPDType;
  genes: string[];
  parentOfOrigin?: ParentOfOrigin;
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  records: DetectionRecord[];
	 referenceGenome?: string;
	 hasUnknownReviewTime?: boolean;
}

// ============ 标签页类型 ============
export type HistoryTabType =
  | 'snv-indel'
  | 'cnv-segment'
  | 'cnv-exon'
  | 'str'
  | 'mei'
  | 'mt'
  | 'upd';

export interface HistoryTabConfig {
  id: HistoryTabType;
  label: string;
}

export const HISTORY_TAB_CONFIGS: HistoryTabConfig[] = [
  { id: 'snv-indel', label: 'SNP/InDel' },
  { id: 'cnv-segment', label: 'CNV(Region)' },
  { id: 'cnv-exon', label: 'CNV(Exon)' },
  { id: 'str', label: '动态突变' },
  { id: 'mei', label: 'MEI' },
  { id: 'mt', label: '线粒体' },
  { id: 'upd', label: 'UPD' },
];

// ============ 表格筛选状态 ============
export interface HistoryTableFilterState {
  searchQuery: string;
  filters: Record<string, string | string[]>;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  page: number;
  pageSize: number;
	includeRevoked?: boolean;
}

export const DEFAULT_HISTORY_FILTER_STATE: HistoryTableFilterState = {
  searchQuery: '',
  filters: {},
  page: 1,
  pageSize: 20,
	includeRevoked: false,
};

// ============ 分页结果 ============
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
