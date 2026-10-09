const sampleFixture = {id:'detail-preview',internal_id:'DEMO-示例样本',gender:'male',age:10,sample_type:'全血',hpo_terms:[{id:'HP:0000001',name:'合成表型名称'}],batch:'DEMO-2026',matched_pair:{r1_path:'/synthetic/DEMO_R1.fastq.gz',r2_path:'/synthetic/DEMO_R2.fastq.gz'},clinical_diagnosis:{mainDiagnosis:'合成诊断，仅用于界面检查',symptoms:['合成症状'],hpoTerms:[{id:'HP:0000001',name:'合成表型名称'}]},created_at:'2026-10-08T09:00:00Z',updated_at:'2026-10-08T09:00:00Z'};
const pedigreeFixture = {id:'preview-family',name:'FAM-示例',disease:'合成家系 · 用于布局检查',note:'不含真实患者资料',proband_member_id:'child',updated_at:'2026-10-08T09:00:00Z',members:[{id:'father',name:'父亲',gender:'male',relation:'father',affected_status:'unaffected',generation:0,position:0},{id:'mother',name:'母亲',gender:'female',relation:'mother',affected_status:'unaffected',generation:0,position:1},{id:'child',name:'先证者',gender:'male',relation:'proband',affected_status:'affected',generation:1,position:0,father_id:'father',mother_id:'mother',phenotypes:['合成表型']} ]};
export class ApiError extends Error { status = 500; }
const views: any[] = [];
let reportReadFails = false;
export const previewReportFailure = () => { reportReadFails = true; };
const pageReadFailures = new Set<string>();
export const previewPageFailure = (scope: 'dashboard' | 'billing' | 'pedigree') => { pageReadFailures.add(scope); };
const transactions = ['recharge','pre_deduction','deduction','refund','failure_refund','adjust','download'].map((type,i)=>({id:i+1,type,org_id:'preview',amount:[1000,-75,-20,55,75,10,-1][i],balance_after:1000,description:'合成账单 · 仅用于界面预览',created_by:1,created_at:'2026-10-08T09:00:00Z'}));
export const api = {
  get: async (url: string, options?: any) => {
    for(const [scope,suffix] of [['dashboard','/dashboard/stats'],['billing','/billing/transactions']]) {
      if(url.endsWith(suffix) && pageReadFailures.delete(scope)) throw new Error('合成预览：页面数据读取失败');
    }
    if(url.endsWith('/v1/gene-lists')) return [{id:'synthetic-genes',name:'合成遗传病候选基因',disease_category:'合成疾病分类',description:'仅用于界面检查',genes:['BRCA1','SCN1A','COL1A1'],category:'important',scope:'personal',can_maintain:true,revision:1,created_at:'2026-10-08T09:00:00Z',updated_at:'2026-10-08T09:00:00Z'}];
    if(url.endsWith('/v1/data/config')) return {provider:'s3',retention_days:7,temporary:true,download_allowed:false,max_file_size_bytes:100_000_000_000};
    if(url.endsWith('/v1/upload/files/stats')) return {total:3,total_bytes:3_000_000_000};
    if(url.endsWith('/report-generations')) return ['ready','failed','pending'].map((state,i)=>({id:'synthetic-report-'+i,state,createdAt:'2026-10-08T09:00:00Z',errorCode:state==='failed'?'SYNTHETIC_TIMEOUT':'',contractVersion:'report-snapshot-v2'}));
    if(url.endsWith('/downloads/active')) return [{id:'synthetic-quote',kind:'bam',filename:'DEMO-合成样本.bam',size_bytes:1_000_000_000,credits:1,charged_at:'2026-10-08T09:00:00Z',expires_at:'2026-10-10T00:00:00Z'}];
    if(url.endsWith('/downloads')) return {attempt_id:'preview-attempt',zip_status:'ready',zip:{id:'synthetic-zip',filename:'DEMO-合成结果.zip',size_bytes:1000000,credits:1},bams:[{id:'synthetic-bam',filename:'DEMO-合成样本.bam',size_bytes:1_000_000_000,credits:1,role:'proband'}],missing:['mt_vcf'],bam_status:'available'};
    if(url.endsWith('/v1/report-templates') && reportReadFails) { reportReadFails=false; throw new Error('合成预览：报告服务读取失败'); }
    if(url.endsWith('/v1/samples')) return [sampleFixture];
    if(url.endsWith('/v1/samples/detail-preview')) return sampleFixture;
    if(url.endsWith('/v1/pedigrees')) return [pedigreeFixture];
    if(url.endsWith('/v1/pedigrees/preview-family')) { if(pageReadFailures.delete('pedigree')) throw new Error('合成预览：家系详情读取失败'); return pedigreeFixture; }
    if(url.endsWith('/v1/report-templates')) return [{id:'preview-report',name:'合成遗传病报告',description:'用于界面检查的报告服务',apiEndpoint:'https://example.invalid/reports/generate',hasApiKey:true,isActive:true,canMaintain:true,revision:1,contractVersion:'report-snapshot-v2',updatedAt:'2026-10-08T09:00:00Z'}];
    if(url.endsWith('/v1/users/pending')) return [{id:'preview-pending',name:'待审批示例',email:'pending@example.invalid',org_id:'preview-org',system_role:'ORG_USER',approval_status:'pending',is_active:false,created_at:'2026-10-08T09:00:00Z'}];
    if(url.endsWith('/v1/users')) return {items:[{id:'preview-user',name:'示例用户',email:'user@example.invalid',org_id:'preview-org',system_role:'ORG_USER',approval_status:'approved',is_active:true,created_at:'2026-10-08T09:00:00Z'}],total:1,total_pages:1};
    if(url.endsWith('/v1/admin/orgs')) return [{id:'preview-org',name:'示例实验室',slug:'preview-lab',max_concurrent_tasks:5,balance_alert_threshold:100,storage_quota_bytes:30*1024**3,is_active:true}];
    if(url.endsWith('/v1/admin/stats')) return {organizations:{total:1,active:1,suspended:0},tasks:{running:1,completed:3,failed:1,today_created:3,today_finished:2},credits:{total_consumed_today:42,total_consumed_month:120,total_recharged_today:0,total_recharged_month:1000,orgs_low_balance:0},top_orgs:[{org_id:'preview-org',org_name:'示例实验室',balance:1000,task_count:5,credits_used_today:42}],recent_tasks:['completed','running','failed','cancelled'].map((status,i)=>({id:'preview-task-'+i,name:'合成分析任务 '+(i+1),org_name:'示例实验室',status,created_at:'2026-10-08T09:00:00Z'}))};
    if(url.endsWith('/v1/data/assets')) { const items=['read1','read2','bed'].filter(type=>!options?.params?.read_type||type===options.params.read_type).map((read_type)=>({id:'preview-asset-'+read_type,file_name:'合成样本_'+read_type+(read_type==='bed'?'.bed':'.fastq.gz'),read_type,reference_genome:'GRCh38',status:'completed',validation_status:'valid',file_size:read_type==='bed'?1000000:1024**3,provider:'s3',source:'upload',expires_at:read_type==='bed'?undefined:'2026-10-15T09:00:00Z',created_at:'2026-10-08T09:00:00Z',updated_at:'2026-10-08T09:00:00Z'})); return {items,total:items.length,page:1,page_size:100,total_pages:1}; }
    if(url.endsWith('/v1/pipelines')) return {items:[{id:'preview-pipeline',name:'合成 WES 流程',base_type:'wes_single',version:'v2.1',reference_genome:'hg38',bed_file:'合成 WES BED（hg38）',cnv_baseline:'合成 WES CNV 基线（hg38）',status:'active',created_at:'2026-10-08T09:00:00Z'}],total:1};
    if(url.endsWith('/views')) return views;
    if(url.endsWith('/dashboard/stats')) return {totalSamples:12,pendingTasks:8,waitingDataTasks:4,runningTasks:4,completedTasks:8,failedTasks:4};
    if(url.endsWith('/billing/balance')) return {org_id:'preview',balance:1000};
    if(url.endsWith('/billing/config')) return {credits_per_minute:1,credit_rate_multiplier:1,download_credits:1,min_balance:0,cnv_baseline_credits_per_gib:2};
    if(url.endsWith('/billing/transactions')) return {items:transactions,total:transactions.length,page:1,page_size:20,total_pages:1};
    return [];
  },
  put: async (url: string, body: any) => { if (url.endsWith('/views')) { const current = views.find(item => item.name === body.name); if (current) Object.assign(current, { stateJson: JSON.stringify(body.state), version: current.version + 1 }); else views.push({ name: body.name, stateJson: JSON.stringify(body.state), version: 1 }); return; } throw new Error('预览不写入生产服务'); },
  post: async () => { throw new Error('预览不提交任务'); }, delete: async () => { throw new Error('预览不删除任务'); },
};
export const clearAuthSession = () => {};
export const clearLegacyAuthTokens = () => {};

export const MULTIPART_PART_SIZE_BYTES = 32 * 1024 * 1024;
export const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;
const blockedUpload = async (..._args: any[]): Promise<any> => { throw new Error('隔离预览禁止上传或修改数据'); };
export const completeMultipartUpload = blockedUpload, confirmUpload = blockedUpload, initMultipartUpload = blockedUpload, presignMultipartParts = blockedUpload, getDataAssetUploadStatus = blockedUpload, recordMultipartPart = blockedUpload, requestPairedUploadJob = blockedUpload, requestPresignedUploadUrl = blockedUpload, startUpload = blockedUpload, uploadPartToCOS = blockedUpload, uploadToCOS = blockedUpload, retryS3Upload = blockedUpload;
export const abortMultipartUpload = blockedUpload, deleteUploadJob = blockedUpload;
export const localUploadURL = (..._args: any[]) => { throw new Error('隔离预览禁止上传'); };
export class UploadCancelledError extends Error {}
export const isUploadCancelled = (error: unknown) => error instanceof UploadCancelledError;
