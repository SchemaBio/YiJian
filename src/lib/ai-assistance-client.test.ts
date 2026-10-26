import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpAIAssistanceAdapter } from './ai-assistance-client';
import { api } from './api';
vi.mock('./api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('SepiLens platform adapter', () => {
  it('shows the specific structured-output failure without substituting a baseline', async () => {
    vi.mocked(api.post).mockResolvedValue({ requestId: 'request-invalid', status: 'failed', errorCode: 'AI_OUTPUT_INVALID' });
    await expect(httpAIAssistanceAdapter.generate({ feature: 'acmg', taskId: 'task' }, { requestId: 'key', confirmedCharge: false, signal: new AbortController().signal })).rejects.toThrow('模型输出未通过结构化校验');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
  });
  it('submits once with the idempotency key and polls the platform request', async () => {
    vi.useFakeTimers();
    vi.mocked(api.post).mockResolvedValue({ requestId: 'request', status: 'queued' });
    vi.mocked(api.get).mockResolvedValue({ requestId: 'request', status: 'completed', result: { feature: 'acmg', summary: 'review', agentProposal: { summary: 'review' }, ruleEngineResult: null } });
    const notify = vi.fn();
    const result = httpAIAssistanceAdapter.generate({ feature: 'acmg', taskId: 'task' }, { requestId: 'stable-key', confirmedCharge: false, signal: new AbortController().signal, onRequest: notify });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toMatchObject({ requestId: 'request', feature: 'acmg', summary: 'review', ruleEngineResult: null });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('/v1/ai-assistance/requests', expect.objectContaining({ confirmedCharge: false }), expect.objectContaining({ headers: { 'Idempotency-Key': 'stable-key' } }));
    expect(notify).toHaveBeenCalledWith('request');
    expect(api.get).toHaveBeenCalledWith('/v1/ai-assistance/requests/request', expect.anything());
  });
  it('aborts observation without implicitly cancelling the upstream job', async () => {
    vi.useFakeTimers();vi.mocked(api.post).mockResolvedValue({ requestId: 'request', status: 'running' });
    const controller = new AbortController();
    const result = httpAIAssistanceAdapter.generate({ feature: 'hpo', diagnosis: 'text' }, { requestId: 'key', confirmedCharge: false, signal: controller.signal });
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1);controller.abort();await rejected;
    expect(api.post).toHaveBeenCalledTimes(1);expect(api.get).not.toHaveBeenCalled();
  });
  it('fills specimen and HPO context without inferring variant origin', async () => {
    vi.mocked(api.get).mockResolvedValue({ sample_type: '全血', clinical_diagnosis: { hpoTerms: [{ id: 'HP:0001250' }, { id: 'invalid' }] } });
    expect(await httpAIAssistanceAdapter.getClinicalContext!('task', new AbortController().signal)).toEqual({ sampleType: 'blood', hpoTerms: ['HP:0001250'] });
  });
  it('does not turn an uncertain synchronous outcome into a new model call', async () => {
    vi.mocked(api.post).mockResolvedValue({ requestId: 'request', status: 'uncertain', errorCode: 'upstream_outcome_unknown' });
    await expect(httpAIAssistanceAdapter.generate({ feature: 'hpo' }, { requestId: 'key', confirmedCharge: false, signal: new AbortController().signal })).rejects.toThrow('无法确认上游是否已执行');
    expect(api.post).toHaveBeenCalledTimes(1);expect(api.get).not.toHaveBeenCalled();
  });
});

it('bounds asynchronous CNV submission without retrying or discarding the key', async()=>{
 vi.useFakeTimers();vi.mocked(api.post).mockImplementation((_url,_body,opts)=>new Promise((_resolve,reject)=>opts?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})));
 const result=httpAIAssistanceAdapter.generate({feature:'cnv_loss'},{requestId:'stable-cnv',confirmedCharge:true,signal:new AbortController().signal});const rejected=expect(result).rejects.toMatchObject({safeToRegenerate:false});await vi.advanceTimersByTimeAsync(45000);await rejected;expect(api.post).toHaveBeenCalledTimes(1);expect(api.get).not.toHaveBeenCalled();
});
it('bounds a stalled status read without cancelling the server job',async()=>{
 vi.useFakeTimers();vi.mocked(api.post).mockResolvedValue({requestId:'cnv',status:'running'});vi.mocked(api.get).mockImplementation((_url,opts)=>new Promise((_resolve,reject)=>opts?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})));
 const result=httpAIAssistanceAdapter.generate({feature:'cnv_gain'},{requestId:'same-cnv',confirmedCharge:true,signal:new AbortController().signal});const rejected=expect(result).rejects.toMatchObject({safeToRegenerate:false});await vi.advanceTimersByTimeAsync(33000);await rejected;expect(api.post).toHaveBeenCalledTimes(1);
});
