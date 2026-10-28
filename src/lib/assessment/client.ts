'use client';
import { LocalizedError } from '@/i18n/errors';

import {api} from '../api';
import { assessmentCacheKey, readAssessmentCache, writeAssessmentCache, removeAssessmentCache, setAssessmentCacheScope } from './cache';
export { setAssessmentCacheScope } from './cache';
import type {AssessmentContext, AssessmentRow, AutomaticAssessment, ResultTable, PhenotypeMatch,ReferenceSupplement} from './types';
import { loadCNVReference } from './cnv-reference';
import { loadReferences, referenceGenes } from './reference-client';
import {optimizedAssessment,assessmentTimer} from './optimization';
import {preparedBatchPipeline} from './pipeline';
import type {AssessmentPreview} from './types';
export interface AssessmentStatus {preview?:AssessmentPreview[];geneRanking?:PhenotypeMatch[];taskId:string;state:'checking'|'loading'|'ready'|'error'|'cancelled';phase?:'context'|'evaluate'|'finalize'|'transfer';table?:ResultTable;processed:number;pinned?:number;pinnedByTable?:Record<string,number>;version?:string;packVersion?:string;pending?:string[];reassessmentAvailable?:boolean;error?:string;errorKey?:string;}
interface Entry {table:ResultTable;rowId:string;assessment:AutomaticAssessment}
interface Envelope {active?:AssessmentContext;latestVersion:string;reassessmentAvailable:boolean}
interface Session {promise:Promise<Entry[]>;byRow?:Map<string,AutomaticAssessment>;context?:AssessmentContext;status:AssessmentStatus;controller:AbortController;timer?:ReturnType<typeof setTimeout>}
const sessions=new Map<string,Session>();
const publish=(session:Session,update:Partial<AssessmentStatus>)=>{if(sessions.get(session.status.taskId)!==session)return;session.status={...session.status,...update};window.dispatchEvent(new CustomEvent('yijian:assessment-status',{detail:session.status}));};
export function assessmentStatus(taskId:string){return sessions.get(taskId)?.status;}
export async function assessmentForRow(taskId:string,rowId:string){const session=sessions.get(taskId);if(!session||session.status.state!=='ready')return undefined;return session.byRow?.get(rowId);}
export async function assessTask(taskId:string,read:(context:AssessmentContext,table:ResultTable,consume:(rows:AssessmentRow[])=>Promise<void>,signal:AbortSignal)=>Promise<void>,signal:AbortSignal) {
  const current=sessions.get(taskId);if(current)return current.promise;
  let worker: Worker | undefined;
  const controller=new AbortController();
  const optimized=optimizedAssessment();
  const timing=assessmentTimer();
  const totalDone=timing.start('total');
  const firstReadableDone=timing.start('first_readable');let readable=false;
  const markReadable=(rows:number)=>{if(!readable){readable=true;firstReadableDone(rows);}};
  const measure=async<T,>(phase:string,run:()=>Promise<T>)=>{const done=timing.start(phase);try{return await run();}finally{done();}};
  let sequence=0;
  let fatalError:Error|undefined;
  const pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  const rejectAll=(message='初评已取消')=>{fatalError=new LocalizedError(message);for(const call of pending.values()){clearTimeout(call.timer);call.reject(fatalError);}pending.clear();worker?.terminate();};
  controller.signal.addEventListener('abort',()=>rejectAll(),{once:true});
  const startWorker=()=>{
    worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  worker.onmessage=event=>{const call=pending.get(event.data.id);if(!call)return;clearTimeout(call.timer);pending.delete(event.data.id);if(event.data.error)call.reject(event.data.errorKey ? new LocalizedError(event.data.errorKey) : new Error(event.data.error));else call.resolve(event.data.value);};
  worker.onerror=()=>{rejectAll('本地初评工作线程启动或运行失败，请检查浏览器限制后重试');};
  worker.onmessageerror=()=>rejectAll('本地初评数据传输失败，请重试');
  };
  const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted)controller.abort();
  const rpc=(action:string,payload?:unknown)=>new Promise<unknown>((resolve,reject)=>{if(fatalError||controller.signal.aborted){reject(fatalError??new LocalizedError("display.initialAssessmentCanceledf56bc8"));return;}const id=++sequence;const timer=setTimeout(()=>rejectAll('本地初评工作线程响应超时，可重试本地初评'),30000);pending.set(id,{resolve,reject,timer});try{if(!worker)throw new Error("Assessment worker not initialized");worker.postMessage({id,action,payload});}catch{rejectAll('本地初评数据传输失败，请重试');}});
  const session:Session={controller,promise:Promise.resolve([]),status:{taskId,state:'checking',phase:'context',processed:0}};sessions.set(taskId,session);publish(session,{});
  const scheduleContextCheck=(context:AssessmentContext)=>{
    const poll=async()=>{if(controller.signal.aborted||document.visibilityState==='hidden'){if(!controller.signal.aborted)session.timer=setTimeout(poll,60000);return;}try{const next=await api.get<Envelope>(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/context`,{params:{check:'1'},signal:controller.signal});if(!controller.signal.aborted)publish(session,{reassessmentAvailable:next.latestVersion!==context.version});}catch{/* Existing interpretations remain valid during a check failure. */}if(!controller.signal.aborted)session.timer=setTimeout(poll,60000);};
    session.timer=setTimeout(poll,60000);
    controller.signal.addEventListener('abort',()=>{clearTimeout(session.timer);},{once:true});
  };
  session.promise=(async()=>{
    const contextDone=timing.start('context');
    const envelope=await api.get<Envelope>(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/context`,{signal:controller.signal});
    const authorized=envelope.active??await api.post<AssessmentContext>(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/context`,{},{signal:controller.signal});
    const context={...authorized};
    contextDone();
    const earlyKey=optimized?await measure('cache_key',()=>assessmentCacheKey(context)):null;
    const earlyCached=earlyKey?await measure('cache_read',()=>readAssessmentCache(earlyKey)):null;
    let cnvReferenceFailed=false;
    if(!earlyCached&&context.tables?.includes('cnv-segment'))try{
      context.cnvReference=await measure('cnv_reference',()=>loadCNVReference(context,controller.signal));
    }catch(cause){
      if(controller.signal.aborted)throw cause;
      cnvReferenceFailed=true;context.availability=[...context.availability,'cnvLocal.referenceUnavailable'];
    }
    session.context=context;
    publish(session,{version:context.version,packVersion:context.referenceVersion?`${context.pack.version} · HPO/HGNC/ClinGen ${context.referenceVersion}`:context.pack.version,pending:context.availability,reassessmentAvailable:envelope.reassessmentAvailable});
    const cacheKey = earlyKey??await assessmentCacheKey(context);
    const cached = optimized?earlyCached:await readAssessmentCache(cacheKey);
    if (controller.signal.aborted) throw controller.signal.reason;
    if (cached) {
      session.byRow = new Map(cached.map(entry => [entry.rowId, entry.assessment]));
      const pinnedByTable: Record<string, number> = {};
      for (const row of cached) if (row.assessment.pinned) pinnedByTable[row.table] = (pinnedByTable[row.table] ?? 0) + 1;
      publish(session, { state: 'ready', processed: cached.length, pinned: cached.filter(row => row.assessment.pinned).length, pinnedByTable });
      scheduleContextCheck(context);
      markReadable(cached.length);
      if(context.referenceVersion&&context.hpo.length)void loadReferences(context,[],controller.signal,true).then(ranking=>{
        if(!controller.signal.aborted)publish(session,{geneRanking:ranking.geneRanking??[]});
      }).catch(()=>{if(!controller.signal.aborted)publish(session,{pending:[...context.availability,'phenotype.unavailable']});});
      return cached;
    }
    startWorker();
    publish(session,{state:'loading'});
    let referencesFailed=false;
    const ranking=async()=>{if(context.referenceVersion&&context.hpo.length)try{
      const ranking=await loadReferences(context,[],controller.signal,true);
      if(!controller.signal.aborted&&(!optimized||!referencesFailed))publish(session,{geneRanking:ranking.geneRanking??[]});
    }catch(cause){
      if(controller.signal.aborted||cause instanceof Error&&cause.message==='REFERENCE_VERSION_CHANGED')throw cause;
      if(!optimized)referencesFailed=true;
      publish(session,{geneRanking:[],pending:[...context.availability,'phenotype.unavailable']});
    }};
    if(optimized)void ranking().catch(cause=>{if(!controller.signal.aborted)publish(session,{geneRanking:[],pending:[...context.availability,'phenotype.unavailable'],...(cause instanceof Error&&cause.message==='REFERENCE_VERSION_CHANGED'?{reassessmentAvailable:true}:{})});});
    else await ranking();
    await rpc('init',context);
    const seenGenes=new Set<string>();
    if(optimized){
      type Prepared={rows:AssessmentRow[];supplement?:ReferenceSupplement;unavailable?:boolean};
      const pipeline=preparedBatchPipeline(async(rows:AssessmentRow[]):Promise<Prepared>=>{
        if(controller.signal.aborted)throw controller.signal.reason;
        if(context.referenceVersion&&context.hpo.length&&!referencesFailed){
          const genes=referenceGenes(rows,context).filter(gene=>!seenGenes.has(gene));
          for(const gene of genes)seenGenes.add(gene);
          if(genes.length)try{return {rows,supplement:await measure('gene_reference',()=>loadReferences(context,genes,controller.signal))};}
          catch(cause){if(controller.signal.aborted||cause instanceof Error&&cause.message==='REFERENCE_VERSION_CHANGED')throw cause;return {rows,unavailable:true};}
        }
        return {rows};
      },async({rows,supplement,unavailable})=>{
        if(unavailable&&!referencesFailed){referencesFailed=true;await rpc('references-unavailable');publish(session,{preview:undefined,geneRanking:[],pending:[...context.availability,'phenotype.unavailable']});}
        if(supplement&&!referencesFailed){await rpc('references',supplement);if(supplement.warnings.length)publish(session,{pending:[...context.availability,'phenotype.invalidHPO',...supplement.warnings.map(w=>`${w.id}${w.replacement?' → '+w.replacement:''}`)]});}
        const batch=await measure('worker_evaluate',()=>rpc('batch-preview',rows)) as {processed:number;preview:AssessmentPreview[]};
        if(!Number.isSafeInteger(batch.processed)||!Array.isArray(batch.preview)||batch.preview.length>20)throw new Error('Invalid provisional assessment response');
        publish(session,{processed:batch.processed,preview:batch.preview});
        if(batch.preview.length)markReadable(batch.preview.length);
      },controller.signal);
      try{
        for(const table of context.tables??[]){
          publish(session,{phase:'evaluate',table});
          await measure('read_and_prepare',()=>read(context,table,rows=>pipeline.push(rows),controller.signal));
          await pipeline.finish();
        }
      }finally{pipeline.stop();await pipeline.finish().catch(()=>undefined);}
    }else{
    for(const table of context.tables??[]){
      if(controller.signal.aborted)throw new LocalizedError("display.initialAssessmentCanceledf56bc8");
      publish(session,{phase:'evaluate',table});
      await read(context,table,async rows=>{
        if(context.referenceVersion && context.hpo.length && !referencesFailed){
          const genes=referenceGenes(rows,context).filter(gene=>!seenGenes.has(gene));
          if(genes.length)try{
            const supplemental=await loadReferences(context,genes,controller.signal);
            await rpc('references',supplemental);for(const gene of genes)seenGenes.add(gene);
            if(supplemental.warnings.length)publish(session,{pending:[...context.availability,'phenotype.invalidHPO',...supplemental.warnings.map(w=>`${w.id}${w.replacement?' → '+w.replacement:''}`)]});
          }catch(cause){
            if(controller.signal.aborted || cause instanceof Error&&cause.message==='REFERENCE_VERSION_CHANGED')throw cause;
            referencesFailed=true;await rpc('references-unavailable');
            publish(session,{geneRanking:[],pending:[...context.availability,'phenotype.unavailable']});
          }
        }
        const processed=await rpc('batch',rows) as number;publish(session,{processed});
      },controller.signal);
    }
    }
    publish(session,{phase:'finalize'});
    const total=await measure('worker_finalize',()=>rpc('finish')) as number;
    if(total!==session.status.processed)throw new LocalizedError("display.localAssessmentRecordCountMismatchRetrydbbb0d");
    const result:Entry[]=[];
    publish(session,{phase:'transfer'});
    while(result.length<total){
      const batch=await measure('worker_transfer',()=>rpc('drain')) as Entry[];
      if(!batch.length||result.length+batch.length>total)throw new LocalizedError("display.localAssessmentResultTransferIncompleteRetry025832");
      for(const entry of batch)result.push(entry);
    }
    if (!referencesFailed && !cnvReferenceFailed && !controller.signal.aborted) await measure('cache_write',()=>writeAssessmentCache(cacheKey, result));
    session.byRow=new Map(result.map(entry=>[entry.rowId,entry.assessment]));
    const pinnedByTable:Record<string,number>={};for(const row of result)if(row.assessment.pinned)pinnedByTable[row.table]=(pinnedByTable[row.table]??0)+1;
    publish(session,{state:'ready',preview:undefined,pinned:result.filter(x=>x.assessment.pinned).length,pinnedByTable});
    scheduleContextCheck(context);
    markReadable(result.length);
    return result;
  })().catch(error=>{if(controller.signal.aborted){publish(session,{state:'cancelled',preview:undefined,error:undefined});return [];}publish(session,{state:'error',preview:undefined,error:error instanceof Error?error.message:'初评失败',errorKey:error instanceof LocalizedError?error.messageKey:undefined});throw error;}).finally(()=>{signal.removeEventListener('abort',abort);worker?.terminate();totalDone(session.status.processed);if(optimized)window.dispatchEvent(new CustomEvent('yijian:assessment-timing',{detail:timing.timings}));});
  return session.promise;
}
export async function reassessTask(taskId:string){
  await removeAssessmentCache(taskId);
  const old=sessions.get(taskId);if(!old?.context)throw new LocalizedError("display.assessmentNotReady28ef38");
  await api.post(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/context`,{expectedVersion:old.context.version});
  old.controller.abort();sessions.delete(taskId);
}
export function clearAssessments(){for(const session of sessions.values())session.controller.abort();sessions.clear();}
export function invalidateAssessment(taskId:string){void removeAssessmentCache(taskId);const session=sessions.get(taskId);session?.controller.abort();sessions.delete(taskId);}
export function cancelAssessment(taskId:string){const session=sessions.get(taskId);if(!session || !['checking','loading'].includes(session.status.state))return;session.controller.abort();publish(session,{state:'cancelled',preview:undefined,error:undefined});}

if (typeof window !== "undefined") window.addEventListener("schema:auth-expired", () => { clearAssessments(); void removeAssessmentCache(); });
