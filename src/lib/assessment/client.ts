'use client';
import {api} from '../api';
import type {AssessmentContext, AssessmentRow, AutomaticAssessment, ResultTable} from './types';
export interface AssessmentStatus {taskId:string;state:'loading'|'ready'|'error'|'cancelled';phase?:'context'|'evaluate'|'finalize'|'transfer';table?:ResultTable;processed:number;pinned?:number;pinnedByTable?:Record<string,number>;version?:string;packVersion?:string;pending?:string[];reassessmentAvailable?:boolean;error?:string;}
interface Entry {table:ResultTable;rowId:string;assessment:AutomaticAssessment}
interface Envelope {active?:AssessmentContext;latestVersion:string;reassessmentAvailable:boolean}
interface Session {worker:Worker;promise:Promise<Entry[]>;byRow?:Map<string,AutomaticAssessment>;context?:AssessmentContext;status:AssessmentStatus;controller:AbortController;timer?:ReturnType<typeof setTimeout>}
const sessions=new Map<string,Session>();
const publish=(session:Session,update:Partial<AssessmentStatus>)=>{if(sessions.get(session.status.taskId)!==session)return;session.status={...session.status,...update};window.dispatchEvent(new CustomEvent('yijian:assessment-status',{detail:session.status}));};
export function assessmentStatus(taskId:string){return sessions.get(taskId)?.status;}
export async function assessmentForRow(taskId:string,rowId:string){const session=sessions.get(taskId);if(!session||session.status.state!=='ready')return undefined;return session.byRow?.get(rowId);}
export async function assessTask(taskId:string,read:(context:AssessmentContext,table:ResultTable,consume:(rows:AssessmentRow[])=>Promise<void>,signal:AbortSignal)=>Promise<void>,signal:AbortSignal) {
  const current=sessions.get(taskId);if(current)return current.promise;
  const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
  const controller=new AbortController();
  let sequence=0;
  let fatalError:Error|undefined;
  const pending=new Map<number,{resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  worker.onmessage=event=>{const call=pending.get(event.data.id);if(!call)return;clearTimeout(call.timer);pending.delete(event.data.id);if(event.data.error)call.reject(new Error(event.data.error));else call.resolve(event.data.value);};
  const rejectAll=(message='初评已取消')=>{fatalError=new Error(message);for(const call of pending.values()){clearTimeout(call.timer);call.reject(fatalError);}pending.clear();worker.terminate();};
  worker.onerror=()=>{rejectAll('本地初评工作线程启动或运行失败，请检查浏览器限制后重试');};controller.signal.addEventListener('abort',()=>rejectAll(),{once:true});
  worker.onmessageerror=()=>rejectAll('本地初评数据传输失败，请重试');
  const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted)controller.abort();
  const rpc=(action:string,payload?:unknown)=>new Promise<unknown>((resolve,reject)=>{if(fatalError||controller.signal.aborted){reject(fatalError??new Error('初评已取消'));return;}const id=++sequence;const timer=setTimeout(()=>rejectAll('本地初评工作线程响应超时，可重试本地初评'),30000);pending.set(id,{resolve,reject,timer});try{worker.postMessage({id,action,payload});}catch{rejectAll('本地初评数据传输失败，请重试');}});
  const session:Session={worker,controller,promise:Promise.resolve([]),status:{taskId,state:'loading',phase:'context',processed:0}};sessions.set(taskId,session);publish(session,{});
  session.promise=(async()=>{
    const envelope=await api.get<Envelope>(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/context`,{signal:controller.signal});
    const context=envelope.active??await api.post<AssessmentContext>(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/context`,{},{signal:controller.signal});
    session.context=context;
    publish(session,{version:context.version,packVersion:context.pack.version,pending:context.availability,reassessmentAvailable:envelope.reassessmentAvailable});
    await rpc('init',context);
    for(const table of context.tables??[]){
      if(controller.signal.aborted)throw new Error('初评已取消');
      publish(session,{phase:'evaluate',table});
      await read(context,table,async rows=>{const processed=await rpc('batch',rows) as number;publish(session,{processed});},controller.signal);
    }
    publish(session,{phase:'finalize'});
    const total=await rpc('finish') as number;
    if(total!==session.status.processed)throw new Error('本地初评记录数不一致，请重试');
    const result:Entry[]=[];
    publish(session,{phase:'transfer'});
    while(result.length<total){
      const batch=await rpc('drain') as Entry[];
      if(!batch.length||result.length+batch.length>total)throw new Error('本地初评结果传输不完整，请重试');
      for(const entry of batch)result.push(entry);
    }
    session.byRow=new Map(result.map(entry=>[entry.rowId,entry.assessment]));
    const pinnedByTable:Record<string,number>={};for(const row of result)if(row.assessment.pinned)pinnedByTable[row.table]=(pinnedByTable[row.table]??0)+1;
    publish(session,{state:'ready',pinned:result.filter(x=>x.assessment.pinned).length,pinnedByTable});
    const poll=async()=>{if(controller.signal.aborted||document.visibilityState==='hidden'){if(!controller.signal.aborted)session.timer=setTimeout(poll,60000);return;}try{const next=await api.get<Envelope>(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/context`,{params:{check:'1'},signal:controller.signal});if(!controller.signal.aborted)publish(session,{reassessmentAvailable:next.latestVersion!==context.version});}catch{/* Existing interpretations remain valid during a check failure. */}if(!controller.signal.aborted)session.timer=setTimeout(poll,60000);};
    session.timer=setTimeout(poll,60000);
    controller.signal.addEventListener('abort',()=>{clearTimeout(session.timer);},{once:true});
    return result;
  })().catch(error=>{if(controller.signal.aborted){publish(session,{state:'cancelled',error:undefined});return [];}publish(session,{state:'error',error:error instanceof Error?error.message:'初评失败'});throw error;}).finally(()=>{signal.removeEventListener('abort',abort);worker.terminate();});
  return session.promise;
}
export async function reassessTask(taskId:string){
  const old=sessions.get(taskId);if(!old?.context)throw new Error('当前评估尚未就绪');
  await api.post(`/v1/tasks/${encodeURIComponent(taskId)}/results/assessment/context`,{expectedVersion:old.context.version});
  old.controller.abort();sessions.delete(taskId);
}
export function clearAssessments(){for(const session of sessions.values())session.controller.abort();sessions.clear();}
export function invalidateAssessment(taskId:string){const session=sessions.get(taskId);session?.controller.abort();sessions.delete(taskId);}
export function cancelAssessment(taskId:string){const session=sessions.get(taskId);if(session?.status.state!=='loading')return;session.controller.abort();publish(session,{state:'cancelled',error:undefined});}
