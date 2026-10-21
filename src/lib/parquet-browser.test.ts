import {afterAll,afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {api} from './api';
import {getSNVIndels} from '@/app/(main)/tasks/[uuid]/result-api';
import {assessmentStatus,cancelAssessment} from './assessment/client';
import {clearBrowserResults,queryBrowserParquet} from './parquet-browser';

vi.mock('./api',()=>({api:{get:vi.fn(),post:vi.fn(),download:vi.fn()},ApiError:class extends Error{}}));
vi.mock('./parquet-runtime',()=>({awaitWorkerStartup:vi.fn().mockResolvedValue(undefined),configureBrowserRuntime:vi.fn().mockResolvedValue(undefined)}));
const mocks=vi.hoisted(()=>({query:vi.fn(),send:vi.fn(),close:vi.fn(),registerFileBuffer:vi.fn(),terminate:vi.fn()}));
vi.mock('@duckdb/duckdb-wasm',()=>({
 selectBundle:vi.fn().mockResolvedValue({mainModule:'test.wasm',mainWorker:'test.worker.js'}),VoidLogger:class{},
 AsyncDuckDB:class{
  instantiate=vi.fn(); registerFileBuffer=mocks.registerFileBuffer; dropFile=vi.fn(); terminate=mocks.terminate;
  connect=vi.fn().mockResolvedValue({query:mocks.query,send:mocks.send,close:mocks.close,cancelSent:vi.fn().mockResolvedValue(true)});
 },
}));
class FakeWorker extends EventTarget {
 terminate=vi.fn();
 onmessage:((event:MessageEvent)=>void)|null=null;
 postMessage=vi.fn((message:{id:number;action:string})=>{
  if(message.action==='init')queueMicrotask(()=>this.onmessage?.(new MessageEvent('message',{data:{id:message.id,value:null}})));
 });
}
const dataset={dataset:{id:'data',executionAttemptId:'attempt',dataVersion:'v1',objectSha256:'00'.repeat(32),rows:2},url:'https://example.invalid/result',columns:['Gene'],aliases:{Gene:['gene']}};
const originalAny=Object.getOwnPropertyDescriptor(AbortSignal,'any');
beforeAll(()=>{
 if(!AbortSignal.any)Object.defineProperty(AbortSignal,'any',{configurable:true,value:(signals:AbortSignal[])=>{
  const controller=new AbortController();
  for(const signal of signals){if(signal.aborted)controller.abort();else signal.addEventListener('abort',()=>controller.abort(),{once:true});}
  return controller.signal;
 }});
});
afterAll(()=>{if(originalAny)Object.defineProperty(AbortSignal,'any',originalAny);else Reflect.deleteProperty(AbortSignal,'any');});
beforeEach(()=>{
 vi.stubGlobal('Worker',FakeWorker);
 vi.stubGlobal('crypto',{subtle:{digest:vi.fn().mockResolvedValue(new Uint8Array(32).buffer)}});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,headers:{get:()=>null},arrayBuffer:async()=>new Uint8Array([1]).buffer}));
 mocks.query.mockResolvedValue(undefined);
 mocks.send.mockImplementation(async(sql:string)=>{
  const rows=sql.startsWith('DESCRIBE ')?[{column_name:'Gene'}]:sql.startsWith('SELECT count')?[{n:2}]:[
   {Gene:'BRCA1',__row_id:'row-1',file_row_number:0,__version:3,__acmg:null,__adjustments:JSON.stringify({focused:true,pinned:false,interpretation:'已保存的解读',acmgOverride:'VUS'})},
   {Gene:'SCN1A',__row_id:'row-2',file_row_number:1,__version:0,__acmg:null,__adjustments:null},
  ];
  const records=rows.map(row=>({toJSON:()=>({...row})}));
  return (async function*(){yield Object.assign(records,{toArray:()=>records});})();
 });
 vi.mocked(api.get).mockImplementation(async(url,options)=>{
  if(url.endsWith('/browser'))return dataset;
  if(url.endsWith('/adjustments'))return {revision:3,items:[{rowId:'row-1',version:3,adjustments:{focused:true,pinned:false,interpretation:'已保存的解读',acmgOverride:'VUS'}}]};
  if(url.endsWith('/assessment/context'))return new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('signal is aborted without reason','AbortError')),{once:true}));
  throw new Error('Unexpected endpoint');
 });
});
afterEach(async()=>{await clearBrowserResults();vi.clearAllMocks();vi.unstubAllGlobals();window.__YIJIAN_CONFIG__=undefined;});
it('downloads self-hosted descriptors with query parameters through the real authenticated API client',async()=>{
 const url='/v1/tasks/local-task/results/tables/snv-indel/browser/file?attemptId=attempt&datasetVersion=v1';
 vi.mocked(api.get).mockResolvedValueOnce({...dataset,transport:'api',url});
 window.__YIJIAN_CONFIG__={API_URL:'/api',BACKEND:'octopus'};
 const actual=await vi.importActual<typeof import('./api')>('./api');
 vi.mocked(api.download).mockImplementation(actual.api.download);
 vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([1]),{headers:{'Content-Type':'application/vnd.apache.parquet'}}));
 const pending=queryBrowserParquet('local-task','snv-indel',{offset:0,limit:20});
 await vi.waitFor(()=>expect(assessmentStatus('local-task')?.state).toBe('loading'));
 cancelAssessment('local-task');
 await expect(pending).resolves.toMatchObject({total:2});
 expect(api.download).toHaveBeenCalledWith(url.split('?')[0],undefined,expect.objectContaining({method:'GET',params:{attemptId:'attempt',datasetVersion:'v1'}}));
 expect(fetch).toHaveBeenCalledWith('/api'+url,expect.objectContaining({method:'GET',credentials:'include',signal:expect.any(AbortSignal)}));
});
it.each([
 '/v1/tasks/another-task/results/tables/snv-indel/browser/file?attemptId=attempt&datasetVersion=v1',
 '/v1/tasks/local-task/results/tables/snv-indel/browser/file?attemptId=old-attempt&datasetVersion=v1',
 '/v1/tasks/local-task/results/tables/snv-indel/browser/file?attemptId=attempt&datasetVersion=old-version',
 '/v1/tasks/local-task/results/tables/snv-indel/browser/file?attemptId=attempt&attemptId=other&datasetVersion=v1',
])('rejects an API descriptor outside the pinned task and dataset scope: %s',async(url)=>{
 vi.mocked(api.get).mockResolvedValueOnce({...dataset,transport:'api',url});
 await expect(queryBrowserParquet('local-task','snv-indel',{offset:0,limit:20})).rejects.toThrow();
 expect(api.download).not.toHaveBeenCalled();
 expect(fetch).not.toHaveBeenCalled();
});
it.each(['api','signed'] as const)('reads other result tables during assessment using %s transport',async(transport)=>{
 vi.stubGlobal('Worker',class extends FakeWorker{
  entries:{table:string;rowId:string;assessment:object}[]=[];
  postMessage=vi.fn((message:{id:number;action:string;payload?:unknown})=>{
   let value:unknown=null;
   if(message.action==='batch'){
    this.entries.push(...(message.payload as {table:string;id:string}[]).map(row=>({table:row.table,rowId:row.id,assessment:{}})));
    value=this.entries.length;
   }
   if(message.action==='finish')value=this.entries.length;
   if(message.action==='drain')value=this.entries;
   queueMicrotask(()=>this.onmessage?.(new MessageEvent('message',{data:{id:message.id,value}})));
  });
 });
 window.__YIJIAN_CONFIG__={API_URL:'/api',BACKEND:'octopus'};
 const actual=await vi.importActual<typeof import('./api')>('./api');
 vi.mocked(api.download).mockImplementation(actual.api.download);
 vi.mocked(fetch).mockImplementation(async()=>new Response(new Uint8Array([1])));
 const url='/v1/tasks/cross-table-task/results/tables/cnv-segment/browser/file?attemptId=attempt&datasetVersion=cnv-version';
 const originalGet=vi.mocked(api.get).getMockImplementation()!;
 vi.mocked(api.get).mockImplementation(async(endpoint,options)=>{
  if(endpoint.endsWith('/cnv-segment/browser'))return {...dataset,dataset:{...dataset.dataset,dataVersion:'cnv-version'},...(transport==='api'?{transport,url}:{url:'https://example.invalid/cnv'})};
  if(endpoint.endsWith('/assessment/context'))return {active:{attemptId:'attempt',version:'assessment-v1',pack:{version:'pack-v1'},availability:[],tables:['snv-indel','cnv-segment'],hpo:[]}};
  return originalGet(endpoint,options);
 });
 const pending=queryBrowserParquet('cross-table-task','snv-indel',{offset:0,limit:20});
 await expect(pending).resolves.toMatchObject({total:2});
 expect(assessmentStatus('cross-table-task')).toMatchObject({state:'ready',processed:4});
 expect(mocks.registerFileBuffer.mock.calls.some(([name])=>String(name).startsWith('assessment-cnv-segment-'))).toBe(true);
 if(transport==='api'){
  expect(api.download).toHaveBeenCalledWith(url.split('?')[0],undefined,expect.objectContaining({method:'GET',params:{attemptId:'attempt',datasetVersion:'cnv-version'}}));
  expect(fetch).toHaveBeenCalledWith('/api'+url,expect.objectContaining({credentials:'include'}));
 }else{
  expect(api.download).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith('https://example.invalid/cnv',expect.objectContaining({credentials:'omit'}));
 }
 expect(mocks.query).toHaveBeenCalledWith('DROP TABLE assessment_source');
});
it('sorts page identities before hydration and preserves the chosen order',async()=>{
 const original=mocks.send.getMockImplementation()!;
 mocks.send.mockImplementation(async(sql:string)=>{
  if(sql.startsWith('SELECT t.file_row_number '))return (async function*(){yield {toArray:()=>[1,0].map(file_row_number=>({toJSON:()=>({file_row_number})}))};})();
  return original(sql);
 });
 const pending=queryBrowserParquet('sorted-task','snv-indel',{offset:0,limit:20,sort:'Gene',direction:'desc'});
 await vi.waitFor(()=>expect(assessmentStatus('sorted-task')?.state).toBe('loading'));
 cancelAssessment('sorted-task');
 const page=await pending;
 expect(page.items.map(row=>row.gene)).toEqual(['SCN1A','BRCA1']);
 const sqls=mocks.send.mock.calls.map(([sql])=>String(sql));
 const selection=sqls.find(sql=>sql.startsWith('SELECT t.file_row_number '))!;
 expect(selection).toContain('ORDER BY');
 expect(selection).not.toContain('t.*');
 const hydrated=sqls.find(sql=>sql.startsWith('SELECT t.*'))!;
 expect(hydrated).toContain('file_row_number IN (1,0)');
 expect(hydrated).not.toContain('ORDER BY');
});
it('projects the adopted draft without overwriting legacy evidence or the VUS filter category',async()=>{
 const overlay={acmgOverride:'Pathogenic',acmgEvidence:[],activeAcmgVersion:'svcv4',svcv4Assessment:{revision:'fixed',confirmed:true,result:{classification:'VUS',vusSubclass:'VUS-high',score:4}}};
 mocks.send.mockImplementation(async(sql:string)=>{
  const rows=sql==='DESCRIBE source'?[{column_name:'Gene'}]:sql.startsWith('SELECT count')?[{n:2}]:[{Gene:'BRCA1',__row_id:'row-1',file_row_number:0,__version:3,__acmg:null,__adjustments:JSON.stringify(overlay)}];
  return (async function*(){yield {toArray:()=>rows.map(row=>({toJSON:()=>row}))};})();
 });
 const pending=queryBrowserParquet('draft-task','snv-indel',{offset:0,limit:20});
 await vi.waitFor(()=>expect(assessmentStatus('draft-task')?.state).toBe('loading'));
 cancelAssessment('draft-task');
 const page=await pending;
 expect(page.items[0]).toMatchObject({activeAcmgVersion:'svcv4',acmgClassification:'VUS',acmgVusSubclass:'VUS-high',acmgScore:4,pinned:false,acmgOverride:'Pathogenic',acmgEvidence:[]});
 const mapped=await getSNVIndels('draft-task',{searchQuery:'',filters:{},page:1,pageSize:20});
 expect(mapped.data[0]).toMatchObject({acmgClassification:'VUS',legacyAcmgClassification:'Pathogenic',acmgVusSubclass:'VUS-high'});
});
it('keeps the loaded table queryable with saved interpretation after cancelling assessment',async()=>{
 const pending=queryBrowserParquet('task','snv-indel',{offset:0,limit:20});
 await vi.waitFor(()=>expect(assessmentStatus('task')?.state).toBe('loading'));
 cancelAssessment('task');
 const page=await pending;
 expect(page.total).toBe(2);
 expect(page.items[0]).toMatchObject({gene:'BRCA1',focused:true,pinned:false,interpretation:'已保存的解读',acmgOverride:'VUS',adjustmentVersion:3});
 expect(page.items[1]).toMatchObject({gene:'SCN1A',pinned:false,automaticAssessment:undefined});
 expect(mocks.close).not.toHaveBeenCalled();
 expect(mocks.terminate).not.toHaveBeenCalled();
 expect(mocks.registerFileBuffer.mock.calls.some(([file])=>file==='automatic.jsonl')).toBe(false);
 await expect(queryBrowserParquet('task','snv-indel',{offset:0,limit:20})).resolves.toMatchObject({total:2});
 const mapped=await getSNVIndels('task',{searchQuery:'',filters:{},page:1,pageSize:20});
 expect(mapped.data[1].automaticAcmg).toBeUndefined();
 expect(mapped.data[1].acmgCriteria).toBeUndefined();
 expect(mapped.data[0].interpretation).toBe('已保存的解读');
 expect(assessmentStatus('task')?.state).toBe('cancelled');
});
