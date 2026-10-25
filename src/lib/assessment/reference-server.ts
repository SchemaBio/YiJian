import { Worker } from 'node:worker_threads';
import path from 'node:path';
import type { ReferenceSupplement } from './types';

type Request = {genes:string[];hpo:string[];cursor?:number;resourceVersion?:string;rank?:boolean};
let worker: Worker | undefined, sequence=0;
const pending=new Map<number,{resolve:(value:ReferenceSupplement)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
function fail(error:Error){for(const call of pending.values()){clearTimeout(call.timer);call.reject(error);}pending.clear();const old=worker;worker=undefined;void old?.terminate();}
export function queryReferences(request:Request):Promise<ReferenceSupplement>{
  if(pending.size>=8)return Promise.reject(new Error('REFERENCE_QUEUE_FULL'));
  if(!worker){
    worker=new Worker(path.join(process.cwd(),'scripts/phenotype/reference-worker.cjs'),{workerData:{directory:process.env.YIJIAN_REFERENCE_DIR||'/app/data'},resourceLimits:{maxOldGenerationSizeMb:48,maxYoungGenerationSizeMb:8}});
    worker.unref();
    worker.on('message',({id,value,error})=>{const call=pending.get(id);if(!call)return;clearTimeout(call.timer);pending.delete(id);if(error)call.reject(new Error(error));else call.resolve(value);});
    const current=worker;
    worker.on('error',error=>{if(worker===current)fail(error);});worker.on('exit',code=>{if(worker===current)fail(new Error(`REFERENCE_WORKER_EXIT_${code}`));});
  }
  return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>fail(new Error('REFERENCE_TIMEOUT')),30000);pending.set(id,{resolve,reject,timer});worker!.postMessage({id,request});});
}
