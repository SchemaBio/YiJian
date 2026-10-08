import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {api} from '../api';
import {assessTask,assessmentStatus,clearAssessments,invalidateAssessment,cancelAssessment} from './client';
import type {AssessmentContext} from './types';
vi.mock('../api',()=>({api:{get:vi.fn(),post:vi.fn()}}));

let worker:FakeWorker;
class FakeWorker {
  onmessage?: (event:MessageEvent)=>void;
  onerror?:()=>void;
  onmessageerror?:()=>void;
  terminate=vi.fn();
  postMessage=vi.fn(({id,action}:{id:number;action:string})=>queueMicrotask(()=>this.onmessage?.({data:{id,value:action==='finish'?0:true}} as MessageEvent)));
  constructor(){worker=this;}
}
const context:AssessmentContext={taskId:'task',attemptId:'attempt',version:'v',reference:'hg19',hpo:[],hpoVersion:'v',members:[],availability:[],proofs:{},tables:[],pack:{version:'pack',reference:'hg19',licenses:[],hpo:{},diseases:[],dosage:[],str:[],imprinting:[]}};
beforeEach(()=>{vi.stubGlobal('Worker',FakeWorker);vi.mocked(api.get).mockResolvedValue({active:context,latestVersion:'v',reassessmentAvailable:false});});
afterEach(()=>{clearAssessments();vi.clearAllMocks();vi.unstubAllGlobals();});
it('rejects immediately if the worker crashes while context is loading, and allows retry',async()=>{
  let resolve!:(value:unknown)=>void;
  vi.mocked(api.get).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const pending=assessTask('task',vi.fn(),new AbortController().signal);
  worker.onerror!();
  resolve({active:context});
  await expect(pending).rejects.toThrow('工作线程启动或运行失败');
  expect(worker.postMessage).not.toHaveBeenCalled();
  expect(assessmentStatus('task')?.state).toBe('error');
  invalidateAssessment('task');
  await expect(assessTask('task',vi.fn(),new AbortController().signal)).resolves.toEqual([]);
  expect(assessmentStatus('task')?.state).toBe('ready');
});
it('does not publish ready after receiving incomplete drain results',async()=>{
  // Simulate a worker that reports one processed record and then loses its output.
  vi.mocked(api.get).mockResolvedValue({active:{...context,tables:['snv-indel']}});
  const next=assessTask('task',async(_context,_table,consume)=>consume([]),new AbortController().signal);
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
  expect(worker.terminate).toHaveBeenCalled();
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
