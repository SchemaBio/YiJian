import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistanceProvider } from '@/components/providers/AIAssistanceProvider';
import { AIAssistanceAction, AIResultCard } from './AIAssistanceAction';
import { pendingAIAssistanceAdapter, type AIAssistanceAdapter, type AIAssistanceInput, type AIAssistanceResult } from '@/lib/ai-assistance';

function adapter(enabled = true): AIAssistanceAdapter {
  return { getSettings: vi.fn().mockResolvedValue({ enabled, connected: true, configured: true, billingEnabled: true, capabilities: { hpo: { enabled, mode: 'candidate', billingEnabled: true } } }), saveSettings: vi.fn(),
    generate: vi.fn(async input => ({ feature: input.feature, classification: 'VUS', summary: '需要人工复核', hpoTerms: [] })) };
}

it('shows the running spinner to the left of the cancel button label', async () => {
  const client = adapter();
  let complete!: (result: AIAssistanceResult) => void;
  client.cancel = vi.fn().mockResolvedValue(undefined);
  client.generate = vi.fn((_input, options) => {
    options.onRequest?.('running-hpo');
    return new Promise<AIAssistanceResult>(resolve => { complete = resolve; });
  });
  render(<AIAssistanceProvider deployment="opensource" adapter={client}><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '合成描述' }} onResult={vi.fn()} /></AIAssistanceProvider>);
  const button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(screen.queryByRole('button', { name: 'AI 生成HPO 候选术语' })).not.toBeInTheDocument();
  const cancel = screen.getByRole('button', { name: '取消' });
  expect(cancel.firstElementChild).toHaveClass('animate-spin');
  expect(cancel).toBeEnabled();
  await act(async () => { complete({ feature: 'hpo', summary: 'done', hpoTerms: [] }); });
  expect(screen.getByRole('button', { name: 'AI 生成HPO 候选术语' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
});
beforeEach(() => sessionStorage.clear());

it('confirms production HPO pricing independently of other AI rollout switches and remembers only this session and identity', async () => {
  const client = adapter();
  client.getSettings = vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true, billingEnabled: false, capabilities: { hpo: { enabled: true, billingEnabled: true, mode: 'candidate' } } });
  const panel = (scope: string) => <AIAssistanceProvider deployment="saas" adapter={client} scope={scope}><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '合成表型' }} onResult={vi.fn()} /></AIAssistanceProvider>;
  const first = render(panel('user:org'));
  let button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
  await waitFor(() => expect(button).toBeEnabled());
  expect(screen.queryByText('联调期间不扣费')).not.toBeInTheDocument();
  fireEvent.click(button);
  expect(screen.getByRole('dialog')).toHaveTextContent('1 积分');
  fireEvent.click(screen.getByLabelText('本次浏览器会话内，此功能不再提示'));
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(client.generate).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('yijian:ai-charge-confirmation:v2:user:org:hpo')).toBeNull();
  fireEvent.click(button);
  fireEvent.click(screen.getByRole('button', { name: '确认生成 · 1 积分' }));
  await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(1));
  expect(client.generate).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ confirmedCharge: true }));
  first.unmount();
  const reopened = render(panel('user:org'));
  button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(client.generate).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ confirmedCharge: true }));
  reopened.unmount();
  const other = render(panel('other-user:other-org'));
  button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);expect(screen.getByRole('dialog')).toBeVisible();
  other.unmount();sessionStorage.clear();
  render(panel('user:org'));
  button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);expect(screen.getByRole('dialog')).toBeVisible();
  expect(client.generate).toHaveBeenCalledTimes(2);
});

describe('AI generation confirmation and lifecycle', () => {
  it('keeps experimental results out of clinical interpretation adoption', () => {
    render(<AIResultCard result={{feature:'svcv4',summary:'草案评分',resultKind:'experimental',experimentalResult:{version:'locked',classification:'likely_pathogenic',total_points:'8',clinical_use:'forbidden',inputs_verified:false}}} onUseInterpretation={vi.fn()} />);
    expect(screen.getByText(/禁止临床用途/)).toBeVisible();
    expect(screen.getByText(/实验版本：locked/)).toBeVisible();
    expect(screen.queryByRole('button',{name:'填入人工解读'})).not.toBeInTheDocument();
  });
  it('requires SaaS confirmation and cancellation never invokes the adapter', async () => {
    const client = adapter();
    render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '癫痫' }} onResult={vi.fn()} /></AIAssistanceProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'AI 生成HPO 候选术语' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成HPO 候选术语' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText(/每次消耗/)).toHaveTextContent('1 积分');
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(client.generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成HPO 候选术语' }));
    fireEvent.click(screen.getByRole('button', { name: '确认生成 · 1 积分' }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledWith(expect.objectContaining({ feature: 'hpo' }), expect.objectContaining({ requestId: expect.any(String), confirmedCharge: true })));
  });

  it('keeps HPO and ACMG session confirmations separate and remembers each independently', async () => {
    const client=adapter();
    render(<AIAssistanceProvider deployment="saas" adapter={client} scope="user:org"><AIAssistanceAction input={{feature:'hpo',diagnosis:'合成表型'}} onResult={vi.fn()} /><AIAssistanceAction input={{feature:'acmg',taskId:'task',variant:{id:'row'},reference:'hg19'}} onResult={vi.fn()} /></AIAssistanceProvider>);
    const hpo=screen.getByRole('button',{name:'AI 生成HPO 候选术语'}),acmg=screen.getByRole('button',{name:'AI 生成ACMG 现版建议'});
    await waitFor(()=>expect(hpo).toBeEnabled());
    fireEvent.click(hpo);fireEvent.click(screen.getByLabelText('本次浏览器会话内，此功能不再提示'));fireEvent.click(screen.getByRole('button',{name:'确认生成 · 1 积分'}));await waitFor(()=>expect(client.generate).toHaveBeenCalledTimes(1));
    fireEvent.click(acmg);expect(screen.getByRole('dialog')).toBeVisible();expect(client.generate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:'取消'}));expect(sessionStorage.getItem('yijian:ai-charge-confirmation:v2:user:org:acmg')).toBeNull();
    fireEvent.click(acmg);fireEvent.click(screen.getByLabelText('本次浏览器会话内，此功能不再提示'));fireEvent.click(screen.getByRole('button',{name:'确认生成 · 1 积分'}));await waitFor(()=>expect(client.generate).toHaveBeenCalledTimes(2));
    fireEvent.click(hpo);await waitFor(()=>expect(client.generate).toHaveBeenCalledTimes(3));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(acmg);await waitFor(()=>expect(client.generate).toHaveBeenCalledTimes(4));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sessionStorage.getItem('yijian:ai-charge-confirmation:v2:user:org:hpo')).toBe('1');expect(sessionStorage.getItem('yijian:ai-charge-confirmation:v2:user:org:acmg')).toBe('1');
    expect(client.generate).toHaveBeenLastCalledWith(expect.objectContaining({feature:'acmg'}),expect.objectContaining({confirmedCharge:true}));
  });

  it('keeps the open source entry disabled until enabled and does not ask for credits', async () => {
    const client = adapter(false);
    const view = render(<AIAssistanceProvider deployment="opensource" adapter={client}><AIAssistanceAction input={{ feature: 'acmg', variant: { id: 'A' } }} onResult={vi.fn()} /></AIAssistanceProvider>);
    expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' })).toBeDisabled();
    const ready = adapter();
    view.rerender(<AIAssistanceProvider deployment="opensource" adapter={ready}><AIAssistanceAction input={{ feature: 'acmg', variant: { id: 'A' } }} onResult={vi.fn()} /></AIAssistanceProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' }));
    await waitFor(() => expect(ready.generate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirmedCharge: false })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('suppresses duplicate clicks and ignores a late response for another variant', async () => {
    let finish!: (result: AIAssistanceResult) => void;
    const client = adapter(); client.generate = vi.fn(() => new Promise<AIAssistanceResult>(resolve => { finish = resolve; }));
    const receive = vi.fn();
    const panel = (id: string) => <AIAssistanceProvider deployment="opensource" adapter={client}><AIAssistanceAction input={{ feature: 'acmg', variant: { id } }} onResult={receive} /></AIAssistanceProvider>;
    const view = render(panel('A'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' }));
    expect(client.generate).toHaveBeenCalledTimes(1);
    view.rerender(panel('B'));
    await act(async () => finish({ feature: 'acmg', summary: 'A 的结果' }));
    expect(receive).not.toHaveBeenCalled();
  });

  it('reuses the request ID after a network error, but starts a new request for changed inputs', async () => {
    const client = adapter(); client.generate = vi.fn().mockRejectedValue(new Error('网络中断'));
    const input: AIAssistanceInput = { feature: 'svcv4', variant: { id: 'A' }, calculator: { disease: '疾病1' } };
    const panel = (value: AIAssistanceInput) => <AIAssistanceProvider deployment="opensource" adapter={client}><AIAssistanceAction input={value} onResult={vi.fn()} /></AIAssistanceProvider>;
    const view = render(panel(input));
    const button = screen.getByRole('button', { name: 'AI 生成SVC v4.0 草案实验' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button); await screen.findByText('网络中断');
    fireEvent.click(button); await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(client.generate).mock.calls;
    expect(calls[0][1].requestId).toBe(calls[1][1].requestId);
    await waitFor(() => expect(button).toBeEnabled());
    view.rerender(panel({ ...input, calculator: { disease: '疾病2' } }));
    fireEvent.click(button); await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(3));
    expect(calls[2][1].requestId).not.toBe(calls[0][1].requestId);
  });

  it('never generates a fake verdict when the backend has not been connected', async () => {
    const receive = vi.fn();
    render(<AIAssistanceProvider deployment="saas" adapter={pendingAIAssistanceAdapter}><AIAssistanceAction input={{ feature: 'cnv_loss', variant: { id: 'A' } }} onResult={receive} /></AIAssistanceProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'AI 生成CNV Loss 建议' })).toBeDisabled());
    expect(screen.getByText('AI 服务暂不可用')).toBeInTheDocument();
    expect(receive).not.toHaveBeenCalled();
  });

  it('blocks SaaS HPO when production billing is unavailable instead of offering a free generation', async () => {
    const client = adapter(); client.getSettings = vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true, billingEnabled: false, capabilities: { hpo: { enabled: true }, svcv4: { enabled: false, reason: 'SVC 尚未开放' } } });
    render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '癫痫' }} onResult={vi.fn()} /><AIAssistanceAction input={{ feature: 'svcv4' }} onResult={vi.fn()} /></AIAssistanceProvider>);
    const button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
    await waitFor(() => expect(screen.getByText('HPO 积分计费尚未就绪，请联系管理员。')).toBeInTheDocument());
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'AI 生成SVC v4.0 草案实验' })).toBeDisabled();
    expect(screen.getByText('SVC 尚未开放')).toBeInTheDocument();
    fireEvent.click(button);
    expect(client.generate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('联调期间不扣费')).not.toBeInTheDocument();
  });

  it('does not display disabled status text inline and provides it via button hover hint instead', async () => {
    const client = adapter(false);
    render(<AIAssistanceProvider deployment="opensource" adapter={client}><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '癫痫' }} onResult={vi.fn()} /></AIAssistanceProvider>);
    const button = await screen.findByRole('button', { name: 'AI 生成HPO 候选术语' });
    expect(button).toBeDisabled();
    expect(screen.queryByText(/AI 辅助功能未开启/i, { selector: '.text-xs' })).not.toBeInTheDocument();
    expect(screen.getByText(/AI 辅助功能未开启/i)).toBeInTheDocument();
  });
  it('confirms SVC pricing before generation without a clinical-context form or sample fetch', async () => {
    const client = adapter();
    client.getClinicalContext = vi.fn();
    client.getSettings = vi.fn().mockResolvedValue({ enabled:true, connected:true, configured:true, billingEnabled:true, capabilities:{svcv4:{enabled:true,mode:'experimental',billingEnabled:true}} });
    render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{feature:'svcv4',mode:'experimental',taskId:'task',reference:'hg38',variant:{id:'A'}}} onResult={vi.fn()}/></AIAssistanceProvider>);
    const button=screen.getByRole('button',{name:'AI 生成SVC v4.0 草案实验'});
    await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);
    expect(client.generate).not.toHaveBeenCalled();expect(screen.getByRole('dialog')).toHaveTextContent('1 积分');fireEvent.click(screen.getByRole('button',{name:'确认生成 · 1 积分'}));
    await waitFor(()=>expect(client.generate).toHaveBeenCalledWith(expect.objectContaining({feature:'svcv4',mode:'experimental'}),expect.objectContaining({confirmedCharge:true})));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(client.getClinicalContext).not.toHaveBeenCalled();
    expect(vi.mocked(client.generate).mock.calls[0][0].clinicalContext).toBeUndefined();
  });
  it('charges for ACMG without requiring supplemental clinical context', async () => {
    const client = adapter(); client.getSettings = vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true, billingEnabled: true, capabilities: { acmg: { enabled: true } } });
    render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{ feature: 'acmg', taskId: 'task', reference: 'hg38', variant: { id: 'A' } }} onResult={vi.fn()} /></AIAssistanceProvider>);
    const button = screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' }); await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    expect(screen.getByRole('dialog')).toHaveTextContent('每次消耗');
    expect(client.generate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('疾病标识')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认生成 · 1 积分' }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(1));
    expect(vi.mocked(client.generate).mock.calls[0][0].clinicalContext).toBeUndefined();
  });
});

it('uses per-feature ACMG production price and requires one-credit confirmation',async()=>{
 const client=adapter();client.getSettings=vi.fn().mockResolvedValue({enabled:true,connected:true,configured:true,billingEnabled:false,capabilities:{acmg:{enabled:true,mode:'candidate',billingEnabled:true}}});
 render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{feature:'acmg',taskId:'task',variant:{id:'row'},reference:'hg19'}} onResult={vi.fn()} /></AIAssistanceProvider>);
 const button=screen.getByRole('button',{name:'AI 生成ACMG 现版建议'});await waitFor(()=>expect(button).toBeEnabled());
 expect(screen.queryByText(/联调期间/)).not.toBeInTheDocument();fireEvent.click(button);expect(screen.getByRole('dialog')).toHaveTextContent('1 积分');expect(client.generate).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'确认生成 · 1 积分'}));await waitFor(()=>expect(client.generate).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({confirmedCharge:true})));
});
it('does not run SaaS ACMG for free when production billing is unavailable',async()=>{
 const client=adapter();client.getSettings=vi.fn().mockResolvedValue({enabled:true,connected:true,configured:true,billingEnabled:false,capabilities:{acmg:{enabled:true,mode:'candidate',billingEnabled:false}}});
 render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{feature:'acmg',taskId:'task'}} onResult={vi.fn()} /></AIAssistanceProvider>);
 await waitFor(()=>expect(client.getSettings).toHaveBeenCalled());expect(screen.getByRole('button',{name:'AI 生成ACMG 现版建议'})).toBeDisabled();expect(screen.queryByText(/联调期间/)).not.toBeInTheDocument();expect(client.generate).not.toHaveBeenCalled();
});

it('does not reuse a legacy shared preference for first-time ACMG confirmation',async()=>{
 sessionStorage.setItem('yijian:ai-charge-confirmation:user:org','1');
 const client=adapter();render(<AIAssistanceProvider deployment="saas" adapter={client} scope="user:org"><AIAssistanceAction input={{feature:'acmg',taskId:'task',variant:{id:'A'}}} onResult={vi.fn()} /></AIAssistanceProvider>);
 const button=screen.getByRole('button',{name:'AI 生成ACMG 现版建议'});await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);expect(screen.getByRole('dialog')).toBeVisible();expect(client.generate).not.toHaveBeenCalled();
});

it.each(['hpo','acmg','svcv4'] as const)('keeps the first %s fee prompt independent of both other features',async feature=>{
 const labels={hpo:'AI 生成HPO 候选术语',acmg:'AI 生成ACMG 现版建议',svcv4:'AI 生成SVC v4.0 草案实验'};
 for(const other of ['hpo','acmg','svcv4'])if(other!==feature)sessionStorage.setItem('yijian:ai-charge-confirmation:v2:user:org:'+other,'1');
 const client=adapter();client.getSettings=vi.fn().mockResolvedValue({enabled:true,connected:true,configured:true,billingEnabled:true,capabilities:{[feature]:{enabled:true,billingEnabled:true}}});
 render(<AIAssistanceProvider deployment="saas" adapter={client} scope="user:org"><AIAssistanceAction input={{feature,mode:feature==='svcv4'?'experimental':undefined,taskId:'task',diagnosis:'synthetic'}} onResult={vi.fn()} /></AIAssistanceProvider>);
 const button=screen.getByRole('button',{name:labels[feature]});await waitFor(()=>expect(button).toBeEnabled());fireEvent.click(button);expect(screen.getByRole('dialog')).toBeVisible();expect(client.generate).not.toHaveBeenCalled();
});
