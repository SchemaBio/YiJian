export { HistoryWorkerClient } from '../../src/app/(main)/history/history-client';
const now='2026-10-08T09:00:00Z';
const tasks={'preview-task':{uuid:'preview-task',name:'合成历史分析任务',sampleId:'preview-sample',internalId:'DEMO-0001',currentAttempt:'preview-attempt',pipeline:'Schema WES'}};
const rows=Array.from({length:6},(_,i)=>({id:`preview-report-${i}`,revision:1,table:'snv-indel',taskUuid:'preview-task',attemptId:'preview-attempt',groupKey:`preview-locus-${i}`,reference:'hg38',identityKnown:true,fields:{chromosome:'1',position:String(100000+i*100),ref:'A',alt:'G',gene:['BRCA1','SCN1A','COL1A1','CFTR','DMD','FBN1'][i],gnomadAF:'0.00001',transcript:'合成转录本'},reported:true,classification:['Pathogenic','Likely_Pathogenic','VUS','Likely_Benign','Benign',''][i],reportedClassification:'VUS',firstReportedAt:now,lastReportedAt:now,reportedBy:'合成操作者',updatedAt:now,adjustmentVersion:1,currentSource:true}));
export const syncReports=async(table:string,cursor:string)=>({rows:cursor?[]:rows.filter(row=>row.table===table),tasks,cursor:'complete',complete:true,watermark:1});
export const reportDetail=async(id:string)=>({row:rows.find(row=>row.id===id),events:[]});
