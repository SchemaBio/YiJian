'use client';
import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { AppModal } from './AppModal';
import { useAIAssistance } from '@/components/providers/AIAssistanceProvider';
import { AI_FEATURE_LABELS, type AIAssistanceInput, type AIAssistanceResult } from '@/lib/ai-assistance';

export function AIAssistanceAction({ input, disabled = false, onResult, onBusyChange }: {
  input: AIAssistanceInput; disabled?: boolean; onResult: (result: AIAssistanceResult) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const { adapter, settings, deployment, skipConfirmation, setSkipConfirmation } = useAIAssistance();
  const [confirmOpen, setConfirmOpen] = React.useState(false), [remember, setRemember] = React.useState(false);
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
  const running = React.useRef(false);
  const controller = React.useRef<AbortController | null>(null);
  const scope = `${input.taskId ?? ''}:${input.feature}:${String(input.variant?.id ?? '')}`;
  const scopeRef = React.useRef(scope); scopeRef.current = scope;
  const request = React.useRef<{ fingerprint: string; id: string } | undefined>(undefined);
  React.useEffect(() => { setError(''); setConfirmOpen(false); setRemember(false); controller.current?.abort(); running.current = false; setBusy(false); request.current = undefined; }, [scope]);
  React.useEffect(() => () => controller.current?.abort(), []);
  const generate = async (confirmed: boolean) => {
    if (running.current || disabled || !settings.enabled) return;
    running.current = true; setBusy(true); onBusyChange?.(true); setError('');
    const originalScope = scope;
    const nextController = new AbortController(); controller.current = nextController;
    const fingerprint = JSON.stringify(input);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const result = await adapter.generate(input, { requestId: request.current.id, signal: nextController.signal, confirmedCharge: confirmed });
      if (nextController.signal.aborted || scopeRef.current !== originalScope) return;
      if (result.feature !== input.feature) throw new Error('AI 返回的评估类型不匹配，请重试。');
      onResult(result); request.current = undefined;
    } catch (cause) {
      if (!nextController.signal.aborted && scopeRef.current === originalScope) setError(cause instanceof Error ? cause.message : 'AI 生成失败，请稍后重试。');
    } finally {
      if (controller.current === nextController) { running.current = false; setBusy(false); onBusyChange?.(false); }
    }
  };
  const label = AI_FEATURE_LABELS[input.feature];
  const inactiveReason = !settings.enabled ? 'AI 辅助功能未开启，请联系管理员配置' : '';
  return <>
    <button type="button" aria-label={`AI 生成${label}`} title={inactiveReason || `AI 生成${label}${deployment === 'saas' ? ' · 1 积分/次' : ''}`}
      disabled={disabled || busy || !settings.enabled} className="inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-accent-fg transition-colors hover:bg-accent-subtle disabled:opacity-40"
      onClick={() => { setError(''); if (deployment === 'saas' && !skipConfirmation) setConfirmOpen(true); else void generate(deployment === 'saas'); }}>
      {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}
    </button>
    {error && <p role="alert" className="basis-full text-xs leading-relaxed text-danger-fg">{error}</p>}
    <AppModal open={confirmOpen} onOpenChange={setConfirmOpen} title="使用 AI 辅助生成" size="small"
      footer={<><button type="button" onClick={() => setConfirmOpen(false)} className="yj-tool-button">取消</button><button type="button" disabled={disabled || busy} className="inline-flex items-center justify-center rounded-md bg-accent-emphasis px-3 py-2 text-sm font-medium text-fg-on-emphasis disabled:opacity-40" onClick={() => { if (remember) setSkipConfirmation(true); setConfirmOpen(false); void generate(true); }}>确认生成 · 1 积分</button></>}>
      <p className="text-sm leading-relaxed">使用 AI 生成{label}，每次消耗 <strong>1 积分</strong>。</p>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">生成结果供人工复核。只发送本次输入及相关注释。</p>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />本次会话不再提示</label>
      <p className="mt-2 text-xs text-fg-muted">勾选后仍按每次 1 积分计费，仅省略确认弹窗。</p>
    </AppModal>
  </>;
}

const CLASS_LABELS: Record<string, string> = { Pathogenic: '致病', Likely_Pathogenic: '可能致病', VUS: '意义未明', Likely_Benign: '可能良性', Benign: '良性', InsufficientEvidence: '证据不足' };
export function AIResultCard({ result, onUseInterpretation }: { result: AIAssistanceResult; onUseInterpretation?: () => void }) {
  return <section aria-label="AI 辅助建议" className="space-y-3 rounded-lg border border-accent-subtle bg-accent-subtle/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent-fg" />AI 辅助建议</h4>{result.classification && <span className="text-sm font-medium">{CLASS_LABELS[result.classification] ?? result.classification}</span>}</div>
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{result.summary}</p>
    {!!result.evidence?.length && <dl className="space-y-2">{result.evidence.map((item, index) => <div key={`${item.code}-${index}`}><dt className="text-xs font-semibold">{item.code}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-fg-muted">{item.reason}</dd></div>)}</dl>}
    {!!result.warnings?.length && <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-fg-muted">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2"><span className="text-xs text-fg-muted">待人工复核{result.model ? ` · ${result.model}` : ''}</span>{onUseInterpretation && <button type="button" className="yj-tool-button" onClick={onUseInterpretation}>填入人工解读</button>}</div>
  </section>;
}
