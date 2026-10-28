import {afterEach,expect,it,vi} from 'vitest';
import {ASSESSMENT_BATCH_SIZE} from './transport';
import type {AssessmentContext,AssessmentRow,AutomaticAssessment} from './types';

const context=():AssessmentContext=>({taskId:'fixture',attemptId:'attempt',version:'fixed',reference:'hg19',hpo:[],hpoVersion:'v1',members:[],availability:[],proofs:{},pack:{version:'fixture',reference:'hg19',licenses:[],hpo:{},diseases:[],dosage:[],str:[],imprinting:[]}});
afterEach(()=>vi.unstubAllGlobals());

it('evaluates and drains 55,393 rows without one full-result message',async()=>{
  const postMessage=vi.fn();
  const scope={postMessage,onmessage:undefined as undefined|((event:MessageEvent)=>void)};
  vi.stubGlobal('self',scope);
  await import('./worker');
  let sequence=0;
  const rpc=(action:string,payload?:unknown)=>{
    scope.onmessage!({data:{id:++sequence,action,payload}} as MessageEvent);
    const response=postMessage.mock.calls.at(-1)![0];
    expect(response.error).toBeUndefined();
    return response.value;
  };
  rpc('init',context());
  const total=55393,start=performance.now();
  for(let offset=0;offset<total;offset+=ASSESSMENT_BATCH_SIZE){
    const batch=Array.from({length:Math.min(ASSESSMENT_BATCH_SIZE,total-offset)},(_,i):AssessmentRow=>({id:String(offset+i),table:'snv-indel',values:{Type:'SNP',Transcript:'ENST1',Consequence:'missense_variant',AlphaMissense_AM:.99}}));
    expect(rpc('batch',batch)).toBe(offset+batch.length);
  }
  expect(rpc('finish')).toBe(total);
  let count=0;
  while(count<total){
    const batch=rpc('drain') as {rowId:string;assessment:AutomaticAssessment}[];
    expect(batch.length).toBeGreaterThan(0);expect(batch.length).toBeLessThanOrEqual(ASSESSMENT_BATCH_SIZE);
    for(const entry of batch){
      expect(entry.rowId).toBe(String(count++));
      expect(entry.assessment.classification).toBe('VUS');
      expect(entry.assessment.pinned).toBe(false);
    }
  }
  console.info(JSON.stringify({fixture:'worker-55393',milliseconds:Math.round(performance.now()-start),maxResponseRows:ASSESSMENT_BATCH_SIZE}));
},30000);
it('publishes bounded read-only row previews before global selection',async()=>{
 vi.resetModules();
 const postMessage=vi.fn();const scope={postMessage,onmessage:undefined as undefined|((event:MessageEvent)=>void)};
 vi.stubGlobal('self',scope);await import('./worker');
 let id=0;const rpc=(action:string,payload?:unknown)=>{scope.onmessage!({data:{id:++id,action,payload}} as MessageEvent);const response=postMessage.mock.calls.at(-1)![0];expect(response.error).toBeUndefined();return response.value;};
 rpc('init',context());
 const rows=Array.from({length:25},(_,i):AssessmentRow=>({id:String(i),table:'snv-indel',values:{Type:'SNP',Transcript:'ENST1',Consequence:'missense_variant',AlphaMissense_AM:.99}}));
 const value=rpc('batch-preview',rows);
 expect(value.processed).toBe(25);expect(value.preview).toHaveLength(20);expect(value.preview[0].rowId).toBe('5');
 for(const preview of value.preview){expect(preview.classification).toBe('VUS');expect(preview).not.toHaveProperty('pinned');expect(preview).not.toHaveProperty('phenotypePriority');}
 expect(rpc('batch-preview',[]).preview).toEqual([]);
 expect(rpc('finish')).toBe(25);const completed=rpc('drain');expect(completed).toHaveLength(25);expect(completed[0].assessment).toHaveProperty('pinned');
});
