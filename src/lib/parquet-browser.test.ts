import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {api} from './api';
import {getSNVIndels} from '@/app/(main)/tasks/[uuid]/result-api';
import {assessmentStatus,cancelAssessment} from './assessment/client';
import {clearBrowserResults,queryBrowserParquet} from './parquet-browser';

vi.mock('./api',()=>({api:{get:vi.fn(),post:vi.fn()},ApiError:class extends Error{}}));
vi.mock('./parquet-runtime',()=>({awaitWorkerStartup:vi.fn().mockResolvedValue(undefined),configureBrowserRuntime:vi.fn().mockResolvedValue(undefined)}));
const mocks=vi.hoisted(()=>({query:vi.fn(),send:vi.fn(),close:vi.fn(),registerFileBuffer:vi.fn(),terminate:vi.fn()}));
vi.mock('@duckdb/duckdb-wasm',()=>({
 selectBundle:vi.fn().mockResolvedValue({mainModule:'test.wasm',mainWorker:'test.worker.js'}),VoidLogger:class{},
 AsyncDuckDB:class{
  instantiate=vi.fn(); registerFileBuffer=mocks.registerFileBuffer; dropFile=vi.fn(); terminate=mocks.terminate;
  connect=vi.fn().mockResolvedValue({query:mocks.query,send:mocks.send,close:mocks.close,cancelSent:vi.fn().mockResolvedValue(true)});
 },
}));
class FakeWorker extends EventTarget {terminate=vi.fn();postMessage=vi.fn();}
const dataset={dataset:{id:'data',executionAttemptId:'attempt',dataVersion:'v1',objectSha256:'00'.repeat(32),rows:2},url:'https://example.invalid/result',columns:['Gene'],aliases:{Gene:['gene']}};
beforeEach(()=>{
 vi.stubGlobal('Worker',FakeWorker);
 vi.stubGlobal('crypto',{subtle:{digest:vi.fn().mockResolvedValue(new Uint8Array(32).buffer)}});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,headers:{get:()=>null},arrayBuffer:async()=>new Uint8Array([1]).buffer}));
 mocks.query.mockResolvedValue(undefined);
 mocks.send.mockImplementation(async(sql:string)=>{
  const rows=sql==='DESCRIBE source'?[{column_name:'Gene'}]:sql.startsWith('SELECT count')?[{n:2}]:[
   {Gene:'BRCA1',__row_id:'row-1',file_row_number:0,__version:3,__acmg:null,__adjustments:JSON.stringify({reported:true,pinned:false,interpretation:'已保存的解读',acmgOverride:'VUS'})},
   {Gene:'SCN1A',__row_id:'row-2',file_row_number:1,__version:0,__acmg:null,__adjustments:null},
  ];
  return (async function*(){yield {toArray:()=>rows.map(row=>({toJSON:()=>row}))};})();
 });
 vi.mocked(api.get).mockImplementation(async(url,options)=>{
  if(url.endsWith('/browser'))return dataset;
  if(url.endsWith('/adjustments'))return {revision:3,items:[{rowId:'row-1',version:3,adjustments:{reported:true,pinned:false,interpretation:'已保存的解读',acmgOverride:'VUS'}}]};
  if(url.endsWith('/assessment/context'))return new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('signal is aborted without reason','AbortError')),{once:true}));
  throw new Error('Unexpected endpoint');
 });
});
afterEach(async()=>{await clearBrowserResults();vi.clearAllMocks();vi.unstubAllGlobals();});
it('keeps the loaded table queryable with saved interpretation after cancelling assessment',async()=>{
 const pending=queryBrowserParquet('task','snv-indel',{offset:0,limit:20});
 await vi.waitFor(()=>expect(assessmentStatus('task')?.state).toBe('loading'));
 cancelAssessment('task');
 const page=await pending;
 expect(page.total).toBe(2);
 expect(page.items[0]).toMatchObject({gene:'BRCA1',reported:true,pinned:false,interpretation:'已保存的解读',acmgOverride:'VUS',adjustmentVersion:3});
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
