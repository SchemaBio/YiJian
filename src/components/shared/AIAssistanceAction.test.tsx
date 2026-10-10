import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIAssistanceProvider } from '@/components/providers/AIAssistanceProvider';
import { AIAssistanceAction } from './AIAssistanceAction';
import { AI_NOT_CONNECTED, pendingAIAssistanceAdapter, type AIAssistanceAdapter, type AIAssistanceInput, type AIAssistanceResult } from '@/lib/ai-assistance';

function adapter(enabled = true): AIAssistanceAdapter {
  return { getSettings: vi.fn().mockResolvedValue({ enabled, connected: true, configured: true }), saveSettings: vi.fn(),
    generate: vi.fn(async input => ({ feature: input.feature, classification: 'VUS', summary: '需要人工复核', hpoTerms: [] })) };
}
beforeEach(() => sessionStorage.clear());

describe('AI generation confirmation and lifecycle', () => {
  it('requires SaaS confirmation and cancellation never invokes the adapter', async () => {
    const client = adapter();
    render(<AIAssistanceProvider deployment="saas" adapter={client}><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '癫痫' }} onResult={vi.fn()} /></AIAssistanceProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成HPO 表型术语' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByText(/每次消耗/)).toHaveTextContent('1 积分');
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(client.generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成HPO 表型术语' }));
    fireEvent.click(screen.getByRole('button', { name: '确认生成 · 1 积分' }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledWith(expect.objectContaining({ feature: 'hpo' }), expect.objectContaining({ requestId: expect.any(String), confirmedCharge: true })));
  });

  it('shares session suppression between HPO and CNV, without bypassing the charge acknowledgement', async () => {
    const client = adapter();
    render(<AIAssistanceProvider deployment="saas" adapter={client} scope="user:org"><AIAssistanceAction input={{ feature: 'hpo', diagnosis: '癫痫' }} onResult={vi.fn()} /><AIAssistanceAction input={{ feature: 'cnv_gain', taskId: 'task', variant: { id: 'A' } }} onResult={vi.fn()} /></AIAssistanceProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成HPO 表型术语' }));
    fireEvent.click(screen.getByLabelText('本次会话不再提示'));
    fireEvent.click(screen.getByRole('button', { name: '确认生成 · 1 积分' }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成CNV Gain 判决' }));
    await waitFor(() => expect(client.generate).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(client.generate).toHaveBeenLastCalledWith(expect.objectContaining({ feature: 'cnv_gain' }), expect.objectContaining({ confirmedCharge: true }));
    expect(sessionStorage.getItem('yijian:ai-charge-confirmation:user:org')).toBe('1');
  });

  it('keeps the open source entry disabled until enabled and does not ask for credits', async () => {
    const client = adapter(false);
    const view = render(<AIAssistanceProvider deployment="opensource" adapter={client}><AIAssistanceAction input={{ feature: 'acmg', variant: { id: 'A' } }} onResult={vi.fn()} /></AIAssistanceProvider>);
    expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版判决' })).toBeDisabled();
    const ready = adapter();
    view.rerender(<AIAssistanceProvider deployment="opensource" adapter={ready}><AIAssistanceAction input={{ feature: 'acmg', variant: { id: 'A' } }} onResult={vi.fn()} /></AIAssistanceProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版判决' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成ACMG 现版判决' }));
    await waitFor(() => expect(ready.generate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ confirmedCharge: false })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('suppresses duplicate clicks and ignores a late response for another variant', async () => {
    let finish!: (result: AIAssistanceResult) => void;
    const client = adapter(); client.generate = vi.fn(() => new Promise<AIAssistanceResult>(resolve => { finish = resolve; }));
    const receive = vi.fn();
    const panel = (id: string) => <AIAssistanceProvider deployment="opensource" adapter={client}><AIAssistanceAction input={{ feature: 'acmg', variant: { id } }} onResult={receive} /></AIAssistanceProvider>;
    const view = render(panel('A'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'AI 生成ACMG 现版判决' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成ACMG 现版判决' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成ACMG 现版判决' }));
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
    const button = screen.getByRole('button', { name: 'AI 生成ACMG SVC v4.0版判决' });
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
    fireEvent.click(screen.getByRole('button', { name: 'AI 生成CNV Loss 判决' }));
    fireEvent.click(screen.getByRole('button', { name: '确认生成 · 1 积分' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(AI_NOT_CONNECTED);
    expect(receive).not.toHaveBeenCalled();
  });
});
