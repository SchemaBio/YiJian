export * from '../../src/app/(main)/tasks/[uuid]/result-api';
let regionReadFailure = new URLSearchParams(location.search).get('previewFailure') === 'region';
const genes = ['BRCA1', 'SCN1A', 'COL1A1', 'CFTR', 'DMD', 'FBN1', 'GBA1', 'ATP7B'];
const rows = Array.from({ length: 55393 }, (_, i) => ({ id: `demo-snv-${i}`, gene: genes[i % genes.length], chromosome: String(i % 22 + 1), position: 100000 + i * 37, ref: 'A', alt: 'G', variantType: 'SNV', zygosity: 'Heterozygous', transcript: `NM_${String(1000 + i % 50).padStart(6, '0')}`, hgvsc: `c.${i % 600 + 1}A>G`, hgvsp: `p.(Lys${i % 200 + 1}Arg)`, consequence: 'missense_variant', acmgClassification: i % 6 === 0 ? 'Likely_Pathogenic' : 'VUS', acmgCriteria: i % 6 === 0 ? ['PM2', 'PP3'] : [], gnomadAF: 0.0001, clinvarSignificance: i === 0 ? 'Pathogenic/Likely_pathogenic' : 'Uncertain_significance', pinned: i < 3, reported: false, interpretation: '', alleleFrequency: 0.48, depth: 132, annotationValues: { Gene: genes[i % genes.length], Position: String(100000 + i * 37), VAF: '0.48', Depth: '132', GnomAD_AF: '0.0001', ClinVar_Sig: i === 0 ? 'Pathogenic/Likely_pathogenic' : 'Uncertain_significance', GenCC_disease_title: '示例疾病关联 A；示例疾病关联 B', GenCC_moi_title: '常染色体显性', GenCC_moi_curie: 'HP:0000006', GenCC_disease_original_curie: '示例疾病标识 A；示例疾病标识 B' }, automaticAcmg: { score: i % 6 === 0 ? 6 : 2, classification: i % 6 === 0 ? 'Likely_Pathogenic' : 'VUS', criteria: [{ code: 'PM2', strength: 'supporting', source: 'gnomAD' }], pending: ['缺少家系证据'], profile: 'acmg-snv-points-v2' } }));
const columns = ['Gene', 'Chromosome', 'Position', 'VAF', 'Depth', 'GnomAD_AF', 'ClinVar_Sig'];
export const getSNVIndels = async (_task: string, state: any) => {
  let filtered = rows.filter(row => !state.searchQuery || `${row.gene} ${row.chromosome}:${row.position}`.toLowerCase().includes(state.searchQuery.toLowerCase()));
  if (state.filters.acmgClassification) filtered = filtered.filter(row => row.acmgClassification === state.filters.acmgClassification);
  for (const filter of state.columnFilters || []) filtered = filtered.filter(row => { const value = row.annotationValues[filter.column] ?? row[filter.column]; return filter.operator === 'equals' ? String(value) === filter.value : filter.operator === 'contains' ? String(value).includes(filter.value) : filter.operator === 'lte' ? Number(value) <= Number(filter.value) : true; });
  if (state.sortColumn) filtered.sort((a, b) => String(a[state.sortColumn] ?? '').localeCompare(String(b[state.sortColumn] ?? ''), undefined, { numeric: true }) * (state.sortDirection === 'desc' ? -1 : 1));
  return { data: filtered.slice((state.page - 1) * state.pageSize, state.page * state.pageSize), total: filtered.length, page: state.page, pageSize: state.pageSize, columns, columnTypes: { Gene: 'text', Position: 'number', VAF: 'number', Depth: 'number', GnomAD_AF: 'number' } };
};
export const getGeneLists = async () => [];
export const getResultRowAdjustmentHistory = async () => [];
export const getResultContext = async (taskUuid: string) => ({ taskUuid, executionAttemptId: 'preview-attempt', importStatus: 'success', state: 'ready', version: 'preview-v1', reference: { declaredId: 'hg38', available: true }, members: previewMembers, types: { 'snv-indel': { total: 55393, reported: 4 }, 'cnv-segment': { total: 64732, reported: 1 }, 'cnv-exon': { total: 18414, reported: 0 }, mt: { total: 3, reported: 0 }, str: { total: 3, reported: 0 }, mei: { total: 3, reported: 0 }, upd: { total: 3, reported: 0 }, roh: { total: 3, reported: 0 } }, qc: previewQC, permissions: { canReview: true, canReport: true } });
export const pinVariant = async () => {};
export const reportVariant = async () => {};
export const saveResultRowAdjustment = async (_task: string, _table: string, id: string, version: number, adjustments: any) => { const row = rows.find(row => row.id === id); if (row) Object.assign(row, adjustments, { acmgClassification: adjustments.acmgOverride || row.acmgClassification }); return { adjustment: { version: version + 1, adjustments } }; };
export const exportEffectiveTable = async (_task: string, _table: string, state: any) => ({ blob: new Blob(['Gene,Position\nBRCA1,100000']), filename: 'preview.csv' });

const cnvs = Array.from({ length: 64732 }, (_, i) => ({ id: `demo-cnv-${i}`, chromosome: String(i % 22 + 1), startPosition: 100000 + i * 1000, endPosition: 150000 + i * 1000, length: 50000, type: i % 2 ? 'Amplification' : 'Deletion', copyNumber: i % 2 ? 3 : 1, copyRatio: i % 2 ? 1.5 : 0.5, log2Ratio: i % 2 ? 0.585 : -1, genes: [genes[i % 8]], gene: genes[i % 8], transcript: 'NM_001000', exon: '3–5', ratio: 0.5, confidence: 0.96, confidenceLabel: 'HIGH', pinned: false, reported: false, reviewed: false, annotationValues: {} }));
function cnvPage(total: number, state: any) {
  let filtered = cnvs.slice(0, total);
  for (const filter of state.columnFilters ?? []) {
    const key = { Chromosome: 'chromosome', Start: 'startPosition', End: 'endPosition' }[filter.column];
    if (key) filtered = filtered.filter(row => filter.operator === 'equals' ? String(row[key]) === filter.value : filter.operator === 'lt' ? Number(row[key]) < Number(filter.value) : filter.operator === 'gt' ? Number(row[key]) > Number(filter.value) : true);
  }
  return { data: filtered.slice((state.page - 1) * state.pageSize, state.page * state.pageSize), total: filtered.length, page: state.page, pageSize: state.pageSize, version: 'preview-v1', columns: ['Chromosome', 'Start', 'End', 'Copy_Ratio'], columnTypes: { Copy_Ratio: 'number' } };
}
export const getCNVSegments = async (_task: string, state: any) => {
  if (state.columnFilters?.some((filter: any) => filter.column === 'Start') && new URLSearchParams(location.search).get('previewFailure') === 'region') {
    if (regionReadFailure) { regionReadFailure = false; throw new Error('合成预览：区域查询失败'); }
    return { data: [], total: 0, page: state.page, pageSize: state.pageSize, version: 'preview-v1' };
  }
  const page = cnvPage(64732, state); return { ...page, data: page.data.map(({ gene, transcript, exon, ratio, ...segment }) => segment) }; };
export const getCNVExons = async (_task: string, state: any) => cnvPage(18414, state);

export const saveCNVAssessment = async (_task: string, _type: string, id: string, assessment: any, version = 0) => { const saved = { ...assessment, cnvId: id, isUserModified: true, updatedAt: new Date().toISOString(), adjustmentVersion: version + 1 }; const row = cnvs.find(row => row.id === id); if (row) Object.assign(row, { assessment: saved }); return saved; };

const mitochondrialRows = [0.15, 0.55, 0.9].map((heteroplasmy, i) => ({ id: `demo-mt-${i}`, position: 3243 + i * 100, ref: 'A', alt: 'G', gene: 'MT-TL1', heteroplasmy, pathogenicity: i === 0 ? 'VUS' : 'Likely_Pathogenic', associatedDisease: '合成示例疾病关联，用于布局检查', haplogroup: '示例单倍群', pinned: false, reported: false, annotationValues: {} }));
export const getMitochondrialVariants = async (_task: string, state: any) => syntheticPage(mitochondrialRows, state);

const reviewStatus = { pinned: false, reported: false, annotationValues: {} };
const strRows = ['Normal', 'Premutation', 'FullMutation'].map((status, i) => ({ ...reviewStatus, id: `demo-str-${i}`, gene: ['HTT', 'FMR1', 'DMPK'][i], transcript: 'NM_000000', locus: `合成位点 ${i + 1}`, repeatUnit: 'CAG', repeatCount: [20, 60, 100][i], normalRangeMin: 5, normalRangeMax: 35, status }));
const meiRows = ['LINE1', 'Alu', 'SVA'].map((meiType, i) => ({ ...reviewStatus, id: `demo-mei-${i}`, chromosome: String(i + 1), position: 200000 + i * 10000, meiType, insertionType: 'insertion', strand: '+', length: 300, gene: genes[i], transcript: 'NM_000000', impact: 'intronic', zygosity: 'Heterozygous', supportingReads: 25, totalReads: 100, frequency: 0.0001, acmgClassification: 'VUS', diseaseAssociation: '合成示例疾病关联' }));
const updRows = ['Isodisomy', 'Heterodisomy', 'Unknown'].map((type, i) => ({ ...reviewStatus, id: `demo-upd-${i}`, chromosome: String(i + 1), startPosition: 100000, endPosition: 5100000, length: 5000000, type, genes: genes.slice(0, i + 1), parentOfOrigin: ['Maternal', 'Paternal', 'Unknown'][i] }));
const rohRows = [80, 95, 100].map((homozygosity, i) => ({ ...reviewStatus, id: `demo-roh-${i}`, chromosome: String(i + 1), startPosition: 100000, endPosition: 5100000, length: 5000000, sizeMb: 5, variantCount: 100 + i, homozygosity, genes: genes.slice(0, i + 1) }));
function syntheticPage(rows: any[], state: any) {
  let filtered = rows.filter(row => !state.searchQuery || Object.values(row).join(' ').toLowerCase().includes(state.searchQuery.toLowerCase()));
  for (const [key, value] of Object.entries(state.filters ?? {})) if (value) filtered = filtered.filter(row => row[key] === value);
  return { data: filtered.slice((state.page - 1) * state.pageSize, state.page * state.pageSize), total: filtered.length, page: state.page, pageSize: state.pageSize, columns: [] };
}
export const getSTRs = async (_task: string, state: any) => syntheticPage(strRows, state);
export const getMEIs = async (_task: string, state: any) => syntheticPage(meiRows, state);
export const getUPDRegions = async (_task: string, state: any) => syntheticPage(updRows, state);
export const getROHRegions = async (_task: string, state: any) => syntheticPage(rohRows, state);

let evidenceMode: 'ready' | 'unavailable' | 'failed' = 'ready';
export function previewEvidence(mode: typeof evidenceMode) { evidenceMode = mode; }
const evidenceURL = (filename: string) => new URL(`../../.gotmp/style-preview-evidence/${filename}`, import.meta.url).href;
export const getIGVSession = async (taskUuid: string) => {
  if (evidenceMode === 'failed') { evidenceMode = 'ready'; throw new Error('合成预览：测序证据读取失败，可刷新重试'); }
  return { taskUuid, executionAttemptId: 'preview-attempt', version: 'preview-v1', available: evidenceMode === 'ready', reason: evidenceMode === 'unavailable' ? '合成预览：当前执行未提供测序证据' : undefined,
    reference: { id: 'synthetic-preview', available: true, fastaURL: evidenceURL('reference.fa'), indexURL: evidenceURL('reference.fa.fai'), geneTrackURL: evidenceURL('genes.gff3') },
    tracks: evidenceMode === 'ready' ? [{ id: 'synthetic-cnr', name: '合成 CNR 信号', type: 'annotation', format: 'cnr', hasIndex: false, available: true }] : [] };
};
export const getIGVTrackURLs = async (_task: string, _version: string, ids: string[]) => ({ expiresAt: new Date(Date.now() + 600000).toISOString(), tracks: ids.map(id => ({ id, url: evidenceURL('signals.cnr') })) });
const previewMembers = ['proband', 'father', 'mother'].map((role, i) => ({ id: `synthetic-member-${i}`, role, sampleId: `SYNTHETIC-${i + 1}` }));
const previewQC = previewMembers.map((member, i) => ({ memberId: member.id, memberRole: member.role, sampleId: member.sampleId, declaredGender: i === 2 ? 'female' : 'male', predictedGender: i === 1 ? 'female' : i === 2 ? 'female' : 'male', genderComparison: i === 1 ? 'mismatch' : 'match', sryCutoff: 10, metrics: [
  { key: 'sryCount', value: i === 0 ? 25 : 2, source: 'synthetic' },
  { key: 'totalReads', value: 85000000, source: 'synthetic' },
  { key: 'averageDepth', value: i === 0 ? 75 : 120, unit: 'depth', source: 'synthetic' },
  { key: 'mappedReadsFraction', value: 0.98, unit: 'fraction', source: 'synthetic' },
  { key: 'q30Rate', value: 0.9, unit: 'fraction', source: 'synthetic' },
  { key: 'duplicateRate', value: 0.15, unit: 'fraction', source: 'synthetic' },
] }));
