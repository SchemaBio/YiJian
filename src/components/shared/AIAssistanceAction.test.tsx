import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistanceProvider } from '@/components/providers/AIAssistanceProvider';
import { AIAssistanceAction, AIResultCard } from './AIAssistanceAction';
import { pendingAIAssistanceAdapter, type AIAssistanceAdapter, type AIAssistanceInput, type AIAssistanceResult } from '@/lib/ai-assistance';

function adapter(enabled = true): AIAssistanceAdapter {
  return { getSettings: vi.fn().mockResolvedValue({ enabled, connected: true, configured: true, billingEnabled: true }), saveSettings: vi.fn(),
    generate: vi.fn(async input => ({ feature: input.feature, classification: 'VUS', summary: '需要人工复核', hpoTerms: [] })) };
}
beforeEach(() => sessionStorage.clear());

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

  it('shares session suppression between HPO and CNV, without bypassing the charge acknowledgement', async () => {
    const client = adapter();
    render(<AIAssistanceProvider deployment="saas" adapter={client} scope="user:org"><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '癫痫' }} onResult={vi.fn()} /><AIAssistanceAction input={{ feature: 'cnv_gain', taskId: 'task', variant: { id: 'A' } }} onResult={vi.fn()} /></AIAssistanceProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'AI 生成HPO 候选术语' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成HPO 候选术语' }));
    fireEvent.click(screen.getByLabelText('本次会话不再提示'));
    fireEvent.click(screen.getByRole('button', { name: '确认生成 · 1 积分' }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成CNV Gain 建议' }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(client.generate).toHaveBeenLastCalledWith(expect.objectContaining({ feature: 'cnv_gain' }), expect.objectContaining({ confirmedCharge: true }));
    expect(sessionStorage.getItem('yijian:ai-charge-confirmation:user:org')).toBe('1');
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
    expect(screen.getByText('AI 服务暂不可用', { selector: '.text-xs' })).toBeVisible();
    expect(receive).not.toHaveBeenCalled();
  });

  it('does not ask for payment during integration and obeys engine capability gates', async () => {
    const client = adapter(); client.getSettings = vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true, billingEnabled: false, capabilities: { hpo: { enabled: true }, svcv4: { enabled: false, reason: 'SVC 尚未开放' } } });
    render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '癫痫' }} onResult={vi.fn()} /><AIAssistanceAction input={{ feature: 'svcv4' }} onResult={vi.fn()} /></AIAssistanceProvider>);
    const button = screen.getByRole('button', { name: 'AI 生成HPO 候选术语' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByRole('button', { name: 'AI 生成SVC v4.0 草案实验' })).toBeDisabled();
    expect(screen.getByText('SVC 尚未开放', { selector: '.text-xs' })).toBeVisible();
    fireEvent.click(button);
    await waitFor(() => expect(client.generate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirmedCharge: false })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('collects missing clinical context before payment without inventing germline origin', async () => {
    const client = adapter(); client.getSettings = vi.fn().mockResolvedValue({ enabled: true, connected: true, configured: true, billingEnabled: true, capabilities: { acmg: { enabled: true } } });
    render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{ feature: 'acmg', taskId: 'task', reference: 'hg38', variant: { id: 'A' } }} onResult={vi.fn()} /></AIAssistanceProvider>);
    const button = screen.getByRole('button', { name: 'AI 生成ACMG 现版建议' }); await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    expect(screen.getByRole('dialog')).toHaveTextContent('补充 AI 评估上下文');
    expect(client.generate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('疾病标识'), { target: { value: 'MONDO:1' } }); fireEvent.change(screen.getByLabelText('遗传模式'), { target: { value: 'AD' } }); fireEvent.change(screen.getByLabelText('样本类型'), { target: { value: 'blood' } });
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('每次消耗');
    fireEvent.click(screen.getByRole('button', { name: '确认生成 · 1 积分' }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledWith(expect.objectContaining({ clinicalContext: expect.objectContaining({ diseaseId: 'MONDO:1', inheritance: 'AD', sampleType: 'blood', variantOrigin: 'unknown' }) }), expect.anything()));
  });
});
