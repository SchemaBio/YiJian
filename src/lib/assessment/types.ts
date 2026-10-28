export const ASSESSMENT_PROFILE = 'germline-browser-assessment-v5-cnv-region';
export interface PhenotypeMatch {
  geneBackground?:{id:string;validity:string;inheritance:string;source?:string};
  gene:string; diseaseId:string; diseaseName?:string; score:number; eligible:boolean;
  matched:{id:string;name?:string}[]; source:string;
}
export interface ReferenceSupplement {
  geneRanking?: PhenotypeMatch[];
  resourceVersion:string; version:string; canonical:Record<string,string|null>;
  matches:Record<string,PhenotypeMatch[]>;
  background:Record<string,{id:string;validity:string;inheritance:string;source?:string}[]>;
  warnings:{id:string;replacement?:string}[]; nextCursor?:number;
}
export type ResultTable = 'snv-indel' | 'cnv-segment' | 'cnv-exon' | 'str' | 'mei' | 'mt' | 'upd' | 'roh';
export type Classification = 'Pathogenic' | 'Likely_Pathogenic' | 'VUS' | 'Likely_Benign' | 'Benign';
export interface Evidence { code: string; strength: 'supporting' | 'moderate' | 'strong' | 'very_strong' | 'standalone'; source: string; note: string; }
// Read-only row results before task-wide candidate selection. Deliberately
// excludes pinning, ranking and fields used to save a completed assessment.
export interface AssessmentPreview {rowId:string;table:ResultTable;gene?:string;classification?:Classification;score:number;criteria:Evidence[];pending:string[]}
export interface HPOTerm { id: string; ancestors: string[]; ic: number; }
export interface Disease {
  id: string; gene: string; hpo: string[]; validity: 'Moderate' | 'Strong' | 'Definitive';
  inheritance: 'AD' | 'AR' | 'XL' | 'MT'; mechanism?: 'loss' | 'gain'; maxAF?: number;
}
export interface Interval { reference: string; chromosome: string; start: number; end: number; }
export interface DosageRecord extends Interval { id: string; gene?: string; hi: number; ts: number; source: string; }
export interface LocusRule extends Interval { id: string; gene: string; motif?: string; pathogenicMin?: number; source: string; }
export interface ReferencePack {
  version: string; reference: string; sha256?: string; licenses: {source: string; license: string; accessedAt: string}[];
  hpo: Record<string, HPOTerm>; diseases: Disease[]; dosage: DosageRecord[];
  str: LocusRule[]; imprinting: LocusRule[];
}
export interface Genotype { gt?: string; dp?: number; gq?: number; ad?: number[]; ps?: string; }
// Sidecar proofs come from versioned, authorized data; raw report strings never
// become these objects through a permissive JSON parse.
export interface RowProof {
  reference: string; transcript?: string; mechanism?: 'loss' | 'gain';
  interval?: Interval;
  qualityPassed?: boolean;
  inheritanceVerified?: 'XL' | 'MT';
  pvs1?: {strength: Evidence['strength']; nmdApplicable: boolean; relevantTranscript: boolean; source: string};
  frequency?: {af: number; an: number; population: string; pass: boolean}[];
  populationRule?: {code: 'PM2' | 'BA1' | 'BS1'; strength: Evidence['strength']; maxAF: number; minAN: number; source: string};
  deNovo?: {code: 'PS2' | 'PM6'; strength: Evidence['strength']; phenotypeApplicable: boolean; source: string};
  trans?: {partnerRowId: string; partnerClassification: Classification; confirmed: boolean; source: string};
  proband?: Genotype; father?: Genotype; mother?: Genotype; pedigreeVerified?: boolean;
  cnv?: {proteinCodingGenes?: number; proteinCodingCountVerified?: boolean; functionalElements?: boolean; source: string};
  establishedDisease?: {classification: Classification; exactIdentity: boolean; source: string};
  upd?: {genotypeSupported: boolean; parent: 'maternal' | 'paternal' | 'unknown'; source: string};
}
export interface AssessmentContext {
  cnvReference?: {sha256:string;version:string;dosage:DosageRecord[]};
  referenceVersion?:string;
  supplement?:ReferenceSupplement;
  taskId: string; attemptId: string; version: string; reference: string; hpo: string[];
  hpoVersion: string; pack: ReferencePack; proofs: Record<string, RowProof>;
  members: {id: string; role: string; sampleId?: string}[];
  availability: string[];
  tables?: ResultTable[];
}
export interface AssessmentRow { coordinateSystem?:'cnr-bed-zero-based-half-open'; id: string; table: ResultTable; values: Record<string, unknown>; }
export interface AutomaticAssessment {
  /** Research triage (0–100), never ACMG evidence points or a probability. */
  priorityScore?:number;
  phenotypeCandidate?:boolean;
  annotationDetails?:{field:string;value:string}[];
  /** Used only to restore the original baseline when supplementary queries fail. */
  legacyPinned?:boolean;
  phenotypeMatch?:PhenotypeMatch;
  phenotypePriority?:boolean;
  referenceVersion?:string;
  phenotypeResource?:string;
  classificationBasis?: 'acmg_evidence' | 'clinvar_reference' | 'population_screening' | 'screening_vus' | 'screening_conflict';
  screeningNotes?: string[];
  profile: string; contextVersion: string; state: 'evaluated' | 'insufficient_evidence';
  classification?: Classification; score: number; criteria: Evidence[]; pending: string[];
  pinned: boolean; pinReasons: string[]; phenotypeScore: number; diseaseId?: string;
  gene?: string; inheritance?: string; familySupport: number; pairId?: string;
  cnvCriteria?: Record<string, unknown>; sectionScores?: Record<string, number>;
  cnvScore?: number; cnvClassification?: Classification;
}
