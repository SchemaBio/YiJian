import type { DemoManifest } from './source';
import { DemoSource } from './source';
import { fieldType } from '@/lib/parquet-browser-sql';
import { mapSNV, mapCNVExon, mapCNVSegment, mapSTR, mapMT, type BackendRow } from '@/app/(main)/tasks/[uuid]/result-mappers';
import type { TableFilterState, PaginatedResult, ResultContext, AnalysisTaskDetail, CNVAssessment } from '@/app/(main)/tasks/[uuid]/types';
import type { SampleDetail } from '@/app/(main)/samples/types';

const aliases: Record<string,string> = {gene:'Gene',chromosome:'Chromosome',position:'Position',startPosition:'Start',endPosition:'End',ref:'Ref',alt:'Alt',variantType:'Type',type:'Type',zygosity:'Genotype',depth:'Depth',alleleFrequency:'VAF',gnomadAF:'GnomAD_AF',gnomadEasAF:'GnomAD_AF_EAS',clinvarSignificance:'ClinVar_Sig',hgvsc:'HGVS_c',hgvsp:'HGVS_p',transcript:'Transcript',consequence:'Consequence',copyNumber:'Copy_Number',log2Ratio:'Log2_Ratio',confidence:'Confidence',status:'STR_Status',repeatUnit:'Repeat_Unit',repeatCount:'Allele1_Repeats',heteroplasmy:'Heteroplasmy',pathogenicity:'ClinVar_Sig'};
const tableIDs:Record<string,string>={'snv-indel':'snv-indel','cnv-exon':'cnv-gene','cnv-segment':'cnv-region',str:'str',mt:'mt'};
export function demoBackendRow(raw:Record<string,unknown>,table:string,version:string):BackendRow {
  const row:BackendRow={...raw,id:`${version}:${table}:${raw.__demo_ordinal}`,annotationValues:Object.fromEntries(Object.entries(raw).filter(([k])=>k!=='__demo_ordinal').map(([k,v])=>[k,v==null?'':String(v)]))};
  for(const [alias,column] of Object.entries(aliases))if(column in raw)row[alias]=raw[column];
  Object.assign(row,{rsId:raw.dbSNP,clinvarDn:raw.ClinVar_DN,clinvarRevStat:raw.ClinVar_RevStat,maxAF:raw.MAX_AF,gnomadNhomaltXX:raw.GnomAD_nhomalt_XX,gnomadNhomaltXY:raw.GnomAD_nhomalt_XY,pangolinGain:raw.Pangolin_Gain,pangolinLoss:raw.Pangolin_Loss,pangolinAN:raw.Pangolin_AN,evoScore:raw.EVOScore,evoScoreAN:raw.EVOScore_AN,alphaMissenseAM:raw.AlphaMissense_AM,alphaMissenseAMC:raw.AlphaMissense_AMC,diseaseAssociation:raw.GenCC_disease_title,genccMoi:raw.GenCC_moi_title,exonCount:raw.Exon_Count,confidenceLabel:raw.Confidence,dosageGenes:raw.Dosage_Genes,genccADGenes:raw.GenCC_AD_Genes,iscnCandidate:raw.ISCN,normalRangeMax:raw.Normal_Max,repeatCount:Math.max(Number(raw.Allele1_Repeats)||0,Number(raw.Allele2_Repeats)||0),ad:raw.AD,mtHgvs:raw.MT_HGVS,mtGene:raw.MT_Gene,associatedDisease:raw.Mitophen_Phenotypes,clinvarSignificance:raw.ClinVar_Sig});
  if(table.startsWith('cnv-') && raw.Classification && raw.Total_Score!==undefined)row.cnvAssessment={id:`snapshot:${row.id}`,cnvId:row.id,cnvType:raw.Type==='DUP'?'Amplification':raw.Type==='DEL'?'Deletion':'Normal',criteria:{},totalScore:Number(raw.Total_Score),classification:raw.Classification,isAutoCalculated:true,isUserModified:false,createdAt:'',updatedAt:''} as CNVAssessment;
  return row;
}

export function workspaceServices(engine:DemoSource,manifest:DemoManifest) {
 const readOnly=async():Promise<never>=>{throw new Error('Public demo results are immutable');};
 async function page<T>(table:string,state:TableFilterState,mapper:(row:BackendRow)=>T,signal?:AbortSignal):Promise<PaginatedResult<T>> {
  signal?.throwIfAborted();
  const id=tableIDs[table], file=manifest.files.find(f=>f.id===id);
  if(!file) return {data:[],total:0,page:state.page,pageSize:state.pageSize};
  const sort=state.sortColumn ? (aliases[state.sortColumn]??state.sortColumn) : '';
  const filters=[...(state.columnFilters??[])];
  let impossible=false;
  for(const [alias,value] of Object.entries(state.filters)) {
   if(!value || !value.length)continue;
   const column=aliases[alias]??alias;
   if(!file.columns.includes(column)){impossible=true;continue;}
   filters.push({column,operator:Array.isArray(value)?'in':'equals',value});
  }
  const result=await engine.query(id,{page:state.page,pageSize:state.pageSize,search:state.searchQuery,chromosome:'',sort:file.columns.includes(sort)?sort:'',descending:state.sortDirection==='desc',columnFilters:filters,impossible});
  signal?.throwIfAborted();
  return {data:result.rows.map(row=>mapper(demoBackendRow(row,table,manifest.version))),total:result.total,page:state.page,pageSize:state.pageSize,columns:file.columns,columnTypes:Object.fromEntries(file.columns.map(c=>[c,fieldType(c.toLowerCase())])),columnAliases:Object.fromEntries(file.columns.map(c=>[c,Object.keys(aliases).filter(a=>aliases[a]===c)])),version:manifest.version,fieldProfileVersion:manifest.version};
 }
 return {
  getSNVIndels:(_:string,s:TableFilterState,signal?:AbortSignal)=>page('snv-indel',s,mapSNV,signal),
  getCNVExons:(_:string,s:TableFilterState,signal?:AbortSignal)=>page('cnv-exon',s,mapCNVExon,signal),
  getCNVSegments:(_:string,s:TableFilterState,signal?:AbortSignal)=>page('cnv-segment',s,mapCNVSegment,signal),
  getSTRs:(_:string,s:TableFilterState,signal?:AbortSignal)=>page('str',s,mapSTR,signal),
  getMitochondrialVariants:(_:string,s:TableFilterState,signal?:AbortSignal)=>page('mt',s,mapMT,signal),
  getGeneLists:async()=>[], focusVariant:readOnly,pinVariant:readOnly,saveResultRowAdjustment:readOnly,saveCNVAssessment:readOnly,
 };
}

export function demoWorkspaceContext(m:DemoManifest):ResultContext {
 const qc=m.qc as Record<string,Record<string,number>>;
 const fastp=m.qc.fastp as {after_filtering:Record<string,number>};
 const before=(m.qc.fastp as {before_filtering:Record<string,number>}).before_filtering;
 const values:Record<string,number|undefined>={beforeTotalReads:before.total_reads,totalReads:fastp.after_filtering.total_reads,mappedReads:qc.xamdst.mapped_reads,mappedReadsFraction:qc.xamdst.mapped_reads_fraction/100,targetDataFraction:qc.xamdst.target_data_fraction_all/100,averageDepth:qc.xamdst.average_depth,dedupDepth:qc.xamdst.average_depth_rmdup,coverageGt02Avg:qc.xamdst.coverage_gt_0_2_avg/100,coverageGte30x:qc.xamdst.coverage_gte_30x/100,meanTargetCoverage:qc.hs_metrics.mean_target_coverage,pctTargetBases30x:qc.hs_metrics.pct_target_bases_30x,duplicateRate:qc.sambamba.percent_duplication,q30Rate:fastp.after_filtering.q30_rate,gcContent:fastp.after_filtering.gc_content,insertSizeMedian:qc.xamdst.insert_size_median,mtAverageDepth:qc.mt_xamdst.mt_average_depth,mtCoverageGt0x:qc.mt_xamdst.mt_coverage_gt_0x/100};
 const fractions=new Set(['mappedReadsFraction','targetDataFraction','coverageGt02Avg','coverageGte30x','pctTargetBases30x','duplicateRate','q30Rate','gcContent','mtCoverageGt0x']);
 return {taskUuid:'demo',executionAttemptId:m.version,importStatus:'success',state:'ready',version:m.version,reference:{available:false,declaredId:m.source.reference,reason:'Demo · IGV unavailable'},members:[{id:'demo-sample',sampleId:'demo-sample',role:'proband'}],types:Object.fromEntries(['snv-indel','cnv-exon','cnv-segment','str','mt'].map(t=>[t,{total:m.files.find(f=>f.id===tableIDs[t])?.rows??0,reviewed:0,focused:0}])),qc:[{memberId:'demo-sample',memberRole:'proband',sampleId:'demo-sample',declaredGender:m.sample.sex,metrics:Object.entries(values).map(([key,value])=>({key,value:value??null,unit:fractions.has(key)?'fraction':undefined,source:'Static demo snapshot'}))}],permissions:{canReview:false,canFocus:false},capabilities:['qc','snv_indel','cnv','str','mt']};
}
export function demoSample(m:DemoManifest):SampleDetail {
 return {id:'demo-sample',internalId:'DEMO_HG002_MYH3',gender:m.sample.sex==='male'?'male':'unknown',age:m.sample.age,sampleType:'全血',batch:'DEMO',matchedPair:null,matchStatus:'unmatched',matchMode:'',autoMatchEnabled:false,remark:'',clinicalDiagnosis:{mainDiagnosis:'',symptoms:[],hpoTerms:m.sample.hpo},submissionInfo:{submissionDate:'',sampleCollectionDate:'',sampleReceiveDate:''},projectInfo:{projectId:'demo',projectName:'WES',testItems:[]},familyHistory:{},analysisTasks:[],createdAt:'',updatedAt:''};
}
export function demoTask(m:DemoManifest):AnalysisTaskDetail {
 return {id:'demo',name:'HG002 · MYH3',sampleId:'demo-sample',internalId:'DEMO_HG002_MYH3',pipeline:'WES_Single',pipelineVersion:'builtin-v1',status:'completed',createdAt:'',createdBy:'Demo'};
}
