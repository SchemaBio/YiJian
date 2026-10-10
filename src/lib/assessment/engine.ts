import { ASSESSMENT_PROFILE, type AssessmentContext, type AssessmentRow, type AutomaticAssessment, type Classification, type Disease, type DosageRecord, type Evidence, type Genotype, type Interval, type RowProof } from './types';
import { createDefaultGainAssessmentCriteria, createDefaultLossAssessmentCriteria } from '@/app/(main)/tasks/[uuid]/types';
import { calculateLossTotal } from '@/app/(main)/tasks/[uuid]/utils/loss-calculator';
import { calculateGainTotal } from '@/app/(main)/tasks/[uuid]/utils/gain-calculator';
import { screenSNV } from './snv-screen';

const pathogenic = (s?: string) => s === 'Pathogenic' || s === 'Likely_Pathogenic';
const number = (v: unknown): number | undefined => v === undefined || v === null || String(v).trim() === '' || v === '.' || !Number.isFinite(Number(v)) ? undefined : Number(v);
const text = (v: unknown) => v === undefined || v === null || v === '.' ? '' : String(v).trim();
const chromosome = (v: unknown) => text(v).replace(/^chr/i, '').replace(/^M$/, 'MT');
const read = (v: Record<string, unknown>, ...keys: string[]) => keys.map(k => v[k]).find(x => x !== undefined && x !== null && x !== '.');
const points = { supporting: 1, moderate: 2, strong: 4, very_strong: 8, standalone: 0 };
// A context is immutable for the life of its Worker. Share expensive phenotype
// matches across rows rather than scanning the entire disease catalogue per row.
const indexes = new WeakMap<AssessmentContext, {genes:Map<string,Disease[]>; dosage:Map<string,DosageRecord[]>; matches:Map<Disease,ReturnType<typeof phenotypeMatch>>}>();
function index(ctx:AssessmentContext) {
  let value=indexes.get(ctx);
  if(!value){value={genes:new Map(),dosage:new Map(),matches:new Map()};for(const disease of ctx.pack.diseases){if(!['Moderate','Strong','Definitive'].includes(disease.validity))continue;const group=value.genes.get(disease.gene)??[];group.push(disease);value.genes.set(disease.gene,group);}for(const record of ctx.pack.dosage){if(record.reference!==ctx.reference)continue;const key=chromosome(record.chromosome),group=value.dosage.get(key)??[];group.push(record);value.dosage.set(key,group);}indexes.set(ctx,value);}
  return value;
}
function cachedMatch(ctx:AssessmentContext,disease:Disease){const cache=index(ctx).matches;let value=cache.get(disease);if(!value){value=phenotypeMatch(ctx,disease);cache.set(disease,value);}return value;}
export function classifyEvidence(criteria: Evidence[]): {score: number; classification?: Classification} {
  if (!criteria.length) return {score: 0};
  if (criteria.some(e => !/^(PVS1|PS[1-4]|PM[1-6]|PP[1-5]|BA1|BS[1-4]|BP[1-7])$/.test(e.code) || !(e.strength in points) || (e.strength === 'standalone' && e.code !== 'BA1') || (e.code === 'BA1' && e.strength !== 'standalone'))) throw new Error('证据代码或强度无效');
  if(criteria.some(e=>e.code.startsWith('B')&&e.strength==='very_strong'))throw new Error('良性证据不支持 Very Strong 强度');
  if (new Set(criteria.map(x => x.code)).size !== criteria.length) throw new Error('重复证据');
  if (criteria.some(x => x.code === 'PP3') && criteria.some(x => x.code === 'BP4')) throw new Error('预测证据互斥');
  if (criteria.some(x => x.code === 'BA1')) {
    if (criteria.length !== 1) throw new Error('BA1 与其他证据冲突');
    return {score: 0, classification: 'Benign'};
  }
  const score = criteria.reduce((n, e) => n + points[e.strength] * (e.code.startsWith('B') ? -1 : 1), 0);
  return {score, classification: score >= 10 ? 'Pathogenic' : score >= 6 ? 'Likely_Pathogenic' : score <= -7 ? 'Benign' : score <= -1 ? 'Likely_Benign' : 'VUS'};
}
export function genotypeUsable(g?: Genotype) {
  return !!g?.gt && /^(0|1)([|/](0|1))?$/.test(g.gt) && Number.isFinite(g.dp) && Number.isFinite(g.gq) && (g.dp ?? -1) >= 10 && (g.gq ?? -1) >= 20;
}
const alleles = (g?: Genotype) => g?.gt?.split(/[|/]/).map(Number) ?? [];
const usableAD=(g?:Genotype)=>!!g?.ad&&g.ad.length>=2&&g.ad.every(n=>Number.isInteger(n)&&n>=0)&&g.ad.reduce((a,b)=>a+b,0)>=10;
const alt = (g?: Genotype) => genotypeUsable(g) && usableAD(g) && alleles(g).some(x => x > 0) && (g?.ad?.[1] ?? -1) >= 3;
const ref = (g?: Genotype) => genotypeUsable(g) && usableAD(g) && alleles(g).every(x => x === 0) && g!.ad![0]>=10 && g!.ad![1] <= 1 && g!.ad![1] / g!.ad!.reduce((a,b) => a+b,0) <= 0.02;

export function phenotypeMatch(ctx: AssessmentContext, disease: Disease) {
  const sample = [...new Set(ctx.hpo)].filter(id => ctx.pack.hpo[id]);
  const target = disease.hpo.filter(id => ctx.pack.hpo[id]);
  if (!sample.length || !target.length) return {score: 0, eligible: false};
  const similarity = (a: string, b: string) => {
    const aa = ctx.pack.hpo[a], bb = ctx.pack.hpo[b];
    const ancestors = new Set([b, ...bb.ancestors]);
    const ic = Math.max(0, ...[a, ...aa.ancestors].filter(x => ancestors.has(x)).map(x => ctx.pack.hpo[x]?.ic ?? 0));
    return aa.ic + bb.ic > 0 ? Math.min(1, 2 * ic / (aa.ic + bb.ic)) : 0;
  };
  const forward = sample.map(a => Math.max(...target.map(b => similarity(a,b))));
  const reverse = target.map(b => Math.max(...sample.map(a => similarity(a,b))));
  const score = (forward.reduce((a,b) => a+b,0) / forward.length + reverse.reduce((a,b) => a+b,0) / reverse.length) / 2;
  const informative = sample.filter((a,i) => forward[i] >= 0.5 && ctx.pack.hpo[a].ic >= 2);
  const specific = sample.some((a,i) => forward[i] >= 0.5 && ctx.pack.hpo[a].ic >= 4);
  return {score, eligible: score >= 0.5 && (informative.length >= 2 || specific)};
}
function interval(row: AssessmentRow, reference: string): Interval | undefined {
  // Only explicit normalized half-open coordinates may match reference resources.
  // Report coordinates have different conventions and cannot be guessed.
  const declared = row.values.__validatedInterval as Interval | undefined;
  if (declared && declared.reference === reference && Number.isInteger(declared.start) && Number.isInteger(declared.end) && declared.start >= 0 && declared.end > declared.start) return {...declared, chromosome: chromosome(declared.chromosome)};
  return undefined;

}
const overlaps = (a: Interval, b: Interval) => a.reference === b.reference && a.chromosome === chromosome(b.chromosome) && a.start < b.end && b.start < a.end;
const contains = (a: Interval, b: Interval) => a.reference === b.reference && a.chromosome === chromosome(b.chromosome) && a.start <= b.start && a.end >= b.end;
function quality(row: AssessmentRow, p?: RowProof) {
  if (p?.qualityPassed === false) return false;
  if (row.table === 'snv-indel') return alt(p?.proband) && (p?.qualityPassed===true || text(read(row.values,'Filter','FILTER','filter'))==='PASS');
  if (p?.qualityPassed === true) return true;
  const filter = text(read(row.values,'Filter','FILTER','filter'));
  // A missing filter is unknown. Normal CN does not represent an event.
  return filter === 'PASS' && (row.table !== 'mt' || (number(read(row.values,'Depth','depth')) ?? -1) >= 10);
}
function frequencies(row: AssessmentRow, p?: RowProof) {
  const reliable=p?.frequency?.filter(f => f.pass && Number.isFinite(f.an) && f.an > 0 && Number.isFinite(f.af) && f.af >= 0 && f.af <= 1)??[];
  // A bare AF without coverage or an ancestry population cannot establish
  // rarity. Missing EAS is not a zero, even when a global AF is present.
  if(!reliable.some(f=>f.population.toLowerCase()==='eas')||!reliable.some(f=>['global','grpmax','popmax'].includes(f.population.toLowerCase())))return [];
  return reliable.map(f=>f.af);
}
function inheritance(d: Disease, p?: RowProof): {eligible: boolean; support: number; pairId?: string} {
  if(d.inheritance==='MT')return {eligible:p?.inheritanceVerified==='MT'&&p.qualityPassed===true,support:p?.inheritanceVerified==='MT'?1:0};
  if (!alt(p?.proband)) return {eligible:false,support:0};
  if (d.inheritance === 'AR') {
    if (alleles(p?.proband).length === 2 && alleles(p?.proband).every(x => x > 0)) return {eligible:true,support:1};
    if (p?.trans?.confirmed) return {eligible:true,support:2,pairId:p.trans.partnerRowId};
    return {eligible:false,support:0};
  }
  if (d.inheritance === 'AD') {
    if (p?.pedigreeVerified && ref(p.father) && ref(p.mother)) return {eligible:true,support:2};
    // An inherited variant is not rejected because parents lack recorded phenotype.
    return {eligible:true,support:0};
  }
  return {eligible:p?.inheritanceVerified === d.inheritance,support:p?.inheritanceVerified === d.inheritance ? 1 : 0};
}
function snv(row: AssessmentRow, p: RowProof | undefined, result: AutomaticAssessment) {
  const v = row.values;
  const transcript = text(v.Transcript), prediction = number(v.AlphaMissense_AM);
  if (text(v.Type) === 'SNP' && text(v.Consequence).split('&').includes('missense_variant') && transcript && !/[&,;]/.test(transcript) && prediction !== undefined && prediction >= 0 && prediction <= 1) {
    const n = prediction >= .990 ? 4 : prediction >= .906 ? 2 : prediction >= .792 ? 1 : prediction < .100 ? -2 : prediction < .170 ? -1 : 0;
    if (n) result.criteria.push({code:n>0?'PP3':'BP4',strength:Math.abs(n)===4?'strong':Math.abs(n)===2?'moderate':'supporting',source:'AlphaMissense calibrated thresholds',note:`${transcript}: ${prediction}`});
  } else result.pending.push('计算证据缺少唯一转录本或适用的错义分值');
  if (p?.pvs1 && p.mechanism === 'loss' && p.transcript === transcript && p.pvs1.nmdApplicable && p.pvs1.relevantTranscript && /stop_gained|frameshift_variant|splice_acceptor_variant|splice_donor_variant/.test(text(v.Consequence))) {
    result.criteria.push({code:'PVS1',strength:p.pvs1.strength,source:p.pvs1.source,note:'疾病 LoF、转录本、NMD 及外显子适用性已核验'});
  } else result.pending.push('PVS1：疾病机制、转录本/NMD 前提待核验');
  const rule = p?.populationRule, fs = p?.frequency?.filter(f => f.pass && Number.isFinite(f.af) && f.af>=0 && f.af<=1 && Number.isFinite(f.an) && f.an>0 && f.an >= (rule?.minAN ?? Infinity));
  if (rule && Number.isFinite(rule.minAN) && rule.minAN>0 && Number.isFinite(rule.maxAF) && rule.maxAF>=0 && rule.maxAF<=1 && fs?.length && fs.some(f=>f.population.toLowerCase()==='eas') && fs.some(f=>['global','grpmax','popmax'].includes(f.population.toLowerCase()))) {
    const max = Math.max(...fs.map(f=>f.af));
    if ((rule.code === 'PM2' && max <= rule.maxAF) || (rule.code !== 'PM2' && max >= rule.maxAF)) result.criteria.push({code:rule.code,strength:rule.strength,source:rule.source,note:'疾病特定阈值及全球/东亚覆盖满足前提'});
  } else result.pending.push('人群计分缺少疾病阈值、AC/AN 或东亚覆盖');
  if (p?.deNovo?.phenotypeApplicable && quality(row,p) && ref(p.father) && ref(p.mother) && (p.deNovo.code === 'PM6' || p.pedigreeVerified)) result.criteria.push({code:p.deNovo.code,strength:p.deNovo.strength,source:p.deNovo.source,note:'父母位点质量及表型适用性已核验'});
  if (p?.trans?.confirmed && pathogenic(p.trans.partnerClassification) && quality(row,p)) result.criteria.push({code:'PM3',strength:'moderate',source:p.trans.source,note:'已确认与致病/可能致病等位基因反式；非两个 VUS 推断'});
  try {Object.assign(result,classifyEvidence(result.criteria));} catch {result.criteria=[];result.pending.push('自动证据冲突，需要人工核对');}
}
function cnv(row: AssessmentRow, ctx: AssessmentContext, p: RowProof | undefined, result: AutomaticAssessment) {
  const type=text(read(row.values,'Type','CNV_Type','Col4','type')).toUpperCase();
  const loss=['DEL','DELETION','LOSS'].includes(type), gain=['DUP','DUPLICATION','GAIN','AMPLIFICATION'].includes(type);
  if (!loss && !gain) {result.pending.push('未确认缺失或扩增类型');return;}
  const region=interval(row,ctx.reference); if (!region) {result.pending.push('参考/区间身份不完整');return;}
  const criteria=loss?createDefaultLossAssessmentCriteria():createDefaultGainAssessmentCriteria();
  criteria.section3.confirmed=false;criteria.section5.other={selected:null,score:0};
  if (p?.cnv?.functionalElements !== undefined) criteria.section1.selected=p.cnv.functionalElements?'1A':'1B';
  const dosage=(index(ctx).dosage.get(region.chromosome)??[]).filter(d=>contains(region,d) && (loss?d.hi:d.ts)===3);
  if (dosage.length) {
    if (loss) (criteria as ReturnType<typeof createDefaultLossAssessmentCriteria>).section2.hiOverlap={selected:'2A',score:1};
    else (criteria as ReturnType<typeof createDefaultGainAssessmentCriteria>).section2.tsOverlap={selected:'2A',score:1};
  }
  if (p?.cnv?.proteinCodingCountVerified && Number.isInteger(p.cnv.proteinCodingGenes) && p.cnv.proteinCodingGenes! >= 0) criteria.section3={confirmed:true,geneCount:p.cnv.proteinCodingGenes!};
  else result.pending.push('Section 3：蛋白编码基因计数未核验');
  const computed=loss?calculateLossTotal(criteria as ReturnType<typeof createDefaultLossAssessmentCriteria>):calculateGainTotal(criteria as ReturnType<typeof createDefaultGainAssessmentCriteria>);
  result.cnvCriteria=criteria as unknown as Record<string,unknown>;result.sectionScores=computed.sectionScores as unknown as Record<string,number>;result.cnvScore=computed.totalScore;
  if (dosage.length || p?.cnv?.functionalElements !== undefined || criteria.section3.confirmed) {result.classification=computed.classification;result.cnvClassification=computed.classification;result.score=computed.totalScore;}
  result.pending.push('部分重叠、病例及遗传条款未满足前提时保持未选');
}
export function evaluateRow(row: AssessmentRow, ctx: AssessmentContext): AutomaticAssessment {
  const result: AutomaticAssessment={profile:ASSESSMENT_PROFILE,contextVersion:ctx.version,state:'insufficient_evidence',score:0,criteria:[],pending:[],pinned:false,pinReasons:[],phenotypeScore:0,familySupport:0};
  const p0=ctx.proofs[row.id], p=p0?.reference===ctx.reference?p0:undefined;
  if (p?.interval) row={...row,values:{...row.values,__validatedInterval:p.interval}};
  result.gene=text(read(row.values,'Gene','MTGene','MT_Gene',...(row.table==='cnv-exon'?['Col5']:[]),'gene')).split(/[&,;]/)[0] || undefined;
  if (row.table==='snv-indel') { snv(row,p,result); screenSNV(row.values,result); }
  else if (row.table==='cnv-segment'||row.table==='cnv-exon') cnv(row,ctx,p,result);
  else if (quality(row,p) && p?.establishedDisease?.exactIdentity) result.classification=p.establishedDisease.classification;
  if (row.table==='str' && quality(row,p)) {
    const locus=interval(row,ctx.reference), motif=text(read(row.values,'Repeat_Unit','RepeatUnit','repeatUnit'));
    const rule=locus && ctx.pack.str.find(r=>r.reference===ctx.reference && r.chromosome===locus.chromosome && r.start===locus.start && r.motif===motif);
    const values=[read(row.values,'Allele1_Repeats','Allele1','allele1Repeats'),read(row.values,'Allele2_Repeats','Allele2','allele2Repeats')];
    if (rule?.pathogenicMin !== undefined && values.some(v=>(number(v)??-1)>=rule.pathogenicMin!)) {result.pinned=true;result.pinReasons.push('疾病阈值');}
    else result.pending.push('重复次数跨阈值或缺少已核验位点/疾病阈值');
  }
  if (pathogenic(result.classification) && quality(row,p)) {result.pinned=true;result.pinReasons.push('致病初评');}
  if (!quality(row,p)) result.pending.push('质量未通过或必要质量信息缺失，不自动置顶');
  if (ctx.hpo.length && result.gene && quality(row,p) && !['Benign','Likely_Benign'].includes(result.classification??'')) {
    for (const disease of index(ctx).genes.get(result.gene)??[]) {
      const match=cachedMatch(ctx,disease); if (!match.eligible) continue;
      const fs=frequencies(row,p), family=inheritance(disease,p);
      const rare=fs.length>0 && Math.max(...fs)<= (disease.maxAF ?? (disease.inheritance==='AR'?.001:.0001));
      const mechanism=['cnv-segment','cnv-exon','mei'].includes(row.table) ? !!disease.mechanism && p?.mechanism===disease.mechanism : true;
      if (!rare || !family.eligible || !mechanism) continue;
      if (match.score>result.phenotypeScore) {result.phenotypeScore=match.score;result.diseaseId=disease.id;result.inheritance=disease.inheritance;result.familySupport=family.support;result.pairId=family.pairId;}
    }
  }
  if (row.table==='upd') {
    const region=interval(row,ctx.reference), imprints=region?ctx.pack.imprinting.filter(r=>overlaps(region,r)):[],imprint=imprints.length>0;
    if (imprint && p?.upd?.genotypeSupported && p.upd.parent!=='unknown' && quality(row,p)) {result.pinned=true;result.pinReasons.push('疾病相关 UPD');}
    else if (imprint && ctx.hpo.length) {
      result.pending.push('印记区域相关，但仅 ROH 推测不能确认 UPD');
      if(quality(row,p)&&imprints.some(r=>r.gene===result.gene))for(const disease of index(ctx).genes.get(result.gene??'')??[]){
        const match=cachedMatch(ctx,disease);if(match.eligible&&match.score>result.phenotypeScore){result.phenotypeScore=match.score;result.diseaseId=disease.id;result.pinReasons.push('疑似 UPD，未确认');}
      }
    }
  }
  if (result.classification || result.pinned) result.state='evaluated';
  if (!ctx.pack.licenses.length) result.pending.push('本地参考证据包尚未发布');
  return result;
}
// This function runs after all rows have been evaluated. It never selects the
// first page, and a paired candidate is admitted or rejected as one group.
export function selectCandidates(rows: {row:AssessmentRow;assessment:AutomaticAssessment}[],context?:AssessmentContext) {
  const candidates=rows.filter(x=>x.assessment.phenotypeScore>=.5 && !x.assessment.pinned).sort((a,b)=>b.assessment.phenotypeScore-a.assessment.phenotypeScore||b.assessment.familySupport-a.assessment.familySupport||a.row.id.localeCompare(b.row.id));
  const genes=new Set<string>(), admitted=new Set<string>();let n=0;
  const byID=new Map(rows.map(x=>[x.row.id,x]));
  for (const item of candidates) {
    if (admitted.has(item.row.id)) continue;
    const gene=item.assessment.gene!;if (!genes.has(gene)&&genes.size>=20)continue;
    const pair=item.assessment.pairId?byID.get(item.assessment.pairId):undefined;
    if(item.assessment.pairId && (!pair || pair.row.id===item.row.id || pair.assessment.pairId!==item.row.id || pair.assessment.phenotypeScore<.5 || pair.assessment.gene!==gene || pair.assessment.diseaseId!==item.assessment.diseaseId))continue;
    const group=pair?[item,pair]:[item];const count=group.filter(x=>!admitted.has(x.row.id)&&!x.assessment.pinned).length;if(n+count>100)continue;
    genes.add(gene);n+=count;
    for(const x of group){admitted.add(x.row.id);x.assessment.pinned=true;x.assessment.state='evaluated';x.assessment.pinReasons.push('表型候选');if(x.assessment.familySupport>0)x.assessment.pinReasons.push('家系候选');}
  }
  if(context)for(const x of rows.filter(x=>x.row.table==='roh')){
    const region=context.proofs[x.row.id]?.interval;
    if(!region || context.proofs[x.row.id]?.qualityPassed!==true)continue;
    const linked=rows.find(y=>y.row.table==='snv-indel'&&y.assessment.pinned&&y.assessment.inheritance==='AR'&&alleles(context.proofs[y.row.id]?.proband).length===2&&alleles(context.proofs[y.row.id]?.proband).every(a=>a===1)&&!!context.proofs[y.row.id]?.interval&&contains(region,context.proofs[y.row.id].interval!));
    if(linked && !x.assessment.pinned && n<100){n++;x.assessment.pinned=true;x.assessment.pinReasons=['家系候选：区间内存在相关 AR 纯合候选'];x.assessment.state='evaluated';}
  }
  return rows;
}
