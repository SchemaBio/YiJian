import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {api} from '../api';
import { readAssessmentCache, writeAssessmentCache } from './cache';
vi.mock('./cache', () => ({ assessmentCacheKey: vi.fn(async () => 'scoped-key'), readAssessmentCache: vi.fn(async () => null), writeAssessmentCache: vi.fn(async () => {}), removeAssessmentCache: vi.fn(async () => {}), setAssessmentCacheScope: vi.fn() }));
import {assessTask,assessmentStatus,clearAssessments,invalidateAssessment,cancelAssessment} from './client';
import type {AssessmentContext} from './types';
vi.mock('./reference-client',()=>({loadReferences:vi.fn(),referenceGenes:vi.fn(()=>[])}));
import {loadReferences} from './reference-client';
vi.mock('./cnv-reference',()=>({loadCNVReference:vi.fn()}));
import {loadCNVReference} from './cnv-reference';
vi.mock('../api',()=>({api:{get:vi.fn(),post:vi.fn()}}));

let worker:FakeWorker;
let workers:FakeWorker[]=[];
class FakeWorker {
  onmessage?: (event:MessageEvent)=>void;
  onerror?:()=>void;
  onmessageerror?:()=>void;
  terminate=vi.fn();
  postMessage=vi.fn(({id,action}:{id:number;action:string})=>queueMicrotask(()=>this.onmessage?.({data:{id,value:action==='finish'?0:true}} as MessageEvent)));
  constructor(){worker=this;workers.push(this);}
}
const context:AssessmentContext={taskId:'task',attemptId:'attempt',version:'v',reference:'hg19',hpo:[],hpoVersion:'v',members:[],availability:[],proofs:{},tables:[],pack:{version:'pack',reference:'hg19',licenses:[],hpo:{},diseases:[],dosage:[],str:[],imprinting:[]}};
beforeEach(()=>{workers=[];vi.stubGlobal('Worker',FakeWorker);vi.mocked(api.get).mockResolvedValue({active:context,latestVersion:'v',reassessmentAvailable:false});});
afterEach(()=>{clearAssessments();vi.clearAllMocks();vi.unstubAllGlobals();});
it('does not create a worker while checking authorized context and allows retry after a crash',async()=>{
  let resolve!:(value:unknown)=>void;
  vi.mocked(api.get).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const pending=assessTask('task',vi.fn(),new AbortController().signal);
  expect(workers).toHaveLength(0);
  expect(assessmentStatus('task')?.state).toBe('checking');
  resolve({active:context});
  await vi.waitFor(()=>expect(workers).toHaveLength(1));
  // First empty evaluation completed; explicitly retry with a stalled worker.
  await pending;
  invalidateAssessment('task');
  const read=vi.fn(async()=>{});
  vi.mocked(api.get).mockResolvedValue({active:{...context,tables:['snv-indel']}});
  const failed=assessTask('task',async()=>{worker.onerror!();throw new Error('reader stopped');},new AbortController().signal);
  await expect(failed).rejects.toThrow();
  expect(assessmentStatus('task')?.state).toBe('error');
  invalidateAssessment('task');
  vi.mocked(api.get).mockResolvedValue({active:context});
  await expect(assessTask('task',read,new AbortController().signal)).resolves.toEqual([]);
  expect(assessmentStatus('task')?.state).toBe('ready');
});
it('does not publish ready after receiving incomplete drain results',async()=>{
  // Simulate a worker that reports one processed record and then loses its output.
  vi.mocked(api.get).mockResolvedValue({active:{...context,tables:['snv-indel']}});
  const next=assessTask('task',async(_context,_table,consume)=>{await new Promise(r=>setTimeout(r,75));await consume([]);},new AbortController().signal);
  await vi.waitFor(()=>expect(workers).toHaveLength(1));
  worker.postMessage.mockImplementation(({id,action})=>queueMicrotask(()=>worker.onmessage?.({data:{id,value:action==='drain'?[]:1}} as MessageEvent)));
  await expect(next).rejects.toThrow('结果传输不完整');
  expect(assessmentStatus('task')?.state).toBe('error');
});

it('cancels a pending context request without leaking its AbortError into result loading',async()=>{
  vi.mocked(api.get).mockImplementationOnce((_url, options)=>new Promise((_resolve,reject)=>{
    options?.signal?.addEventListener('abort',()=>reject(new DOMException('signal is aborted without reason','AbortError')),{once:true});
  }));
  const pending=assessTask('task',vi.fn(),new AbortController().signal);
  cancelAssessment('task');
  expect(assessmentStatus('task')?.state).toBe('cancelled');
  await expect(pending).resolves.toEqual([]);
  expect(assessmentStatus('task')?.error).toBeUndefined();
  expect(workers).toHaveLength(0);
  // Opening another result type must not silently restart the cancelled run.
  await expect(assessTask('task',vi.fn(),new AbortController().signal)).resolves.toEqual([]);
  expect(api.get).toHaveBeenCalledTimes(1);
});
it('discards a partially processed baseline on cancellation and permits explicit retry',async()=>{
  vi.mocked(api.get).mockResolvedValue({active:{...context,tables:['snv-indel']}});
  const pending=assessTask('task',async(_context,_table,consume,signal)=>{
    await consume([]);
    cancelAssessment('task');
    throw signal.reason;
  },new AbortController().signal);
  await expect(pending).resolves.toEqual([]);
  expect(assessmentStatus('task')?.state).toBe('cancelled');
  invalidateAssessment('task');
  vi.mocked(api.get).mockResolvedValue({active:context});
  await expect(assessTask('task',vi.fn(),new AbortController().signal)).resolves.toEqual([]);
  expect(assessmentStatus('task')?.state).toBe('ready');
});

it('reuses persisted results only after fetching the authorized current context', async () => {
 vi.mocked(readAssessmentCache).mockResolvedValueOnce([]);
 const read = vi.fn();
 await expect(assessTask('task', read, new AbortController().signal)).resolves.toEqual([]);
 expect(api.get).toHaveBeenCalledWith('/v1/tasks/task/results/assessment/context', expect.anything());
 expect(read).not.toHaveBeenCalled();
 expect(workers).toHaveLength(0);
 expect(assessmentStatus('task')?.state).toBe('ready');
});

it('reopens a completed task without reading variants or creating another worker',async()=>{
 const read=vi.fn();await assessTask('task',read,new AbortController().signal);
 expect(workers).toHaveLength(1);expect(writeAssessmentCache).toHaveBeenCalled();
 clearAssessments();vi.mocked(readAssessmentCache).mockResolvedValueOnce([]);
 await assessTask('task',read,new AbortController().signal);
 expect(workers).toHaveLength(1);expect(read).not.toHaveBeenCalled();expect(assessmentStatus('task')?.state).toBe('ready');
});
it('keeps cached interpretations when ranking refresh fails and still checks for changed context',async()=>{
 vi.useFakeTimers();
 try{
 vi.mocked(api.get).mockResolvedValue({active:{...context,hpo:['HP:1'],referenceVersion:'r'},latestVersion:'v',reassessmentAvailable:false});
 vi.mocked(readAssessmentCache).mockResolvedValueOnce([]);vi.mocked(loadReferences).mockRejectedValueOnce(new Error('offline'));
 await assessTask('task',vi.fn(),new AbortController().signal);
 await vi.advanceTimersByTimeAsync(1);
 expect(assessmentStatus('task')?.state).toBe('ready');expect(workers).toHaveLength(0);
 vi.mocked(api.get).mockResolvedValue({latestVersion:'changed'});
 await vi.advanceTimersByTimeAsync(60000);
 expect(assessmentStatus('task')?.reassessmentAvailable).toBe(true);
 }finally{clearAssessments();vi.useRealTimers();}
});

it('adds a pinned CNV resource to the local cache context without mutating the active snapshot',async()=>{
 const active={...context,tables:['cnv-segment' as const]};vi.mocked(api.get).mockResolvedValue({active,latestVersion:'v'});
 vi.mocked(loadCNVReference).mockResolvedValue({sha256:'cnv-hash',version:'cnv-v1',dosage:[]});
 await assessTask('task',vi.fn(),new AbortController().signal);
 expect(active).not.toHaveProperty('cnvReference');expect(loadCNVReference).toHaveBeenCalledTimes(1);expect(writeAssessmentCache).toHaveBeenCalled();
});
it('does not cache an assessment when CNV public resource validation fails',async()=>{
 const active={...context,tables:['cnv-segment' as const]};vi.mocked(api.get).mockResolvedValue({active,latestVersion:'v'});vi.mocked(loadCNVReference).mockRejectedValue(new Error('checksum mismatch'));
 await assessTask('task',vi.fn(),new AbortController().signal);
 expect(writeAssessmentCache).not.toHaveBeenCalled();expect(assessmentStatus('task')?.pending).toContain('cnvLocal.referenceUnavailable');expect(active.availability).toEqual([]);
});
