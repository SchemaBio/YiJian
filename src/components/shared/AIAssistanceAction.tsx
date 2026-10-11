'use client';
import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { AppModal } from './AppModal';
import { useAIAssistance } from '@/components/providers/AIAssistanceProvider';
import { AIRequestError, AI_FEATURE_LABELS, type AIClinicalContext, type AIAssistanceInput, type AIAssistanceResult } from '@/lib/ai-assistance';

export function AIAssistanceAction({ input, disabled = false, onResult, onBusyChange }: {
  input: AIAssistanceInput; disabled?: boolean; onResult: (result: AIAssistanceResult) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const { adapter, settings, deployment, skipConfirmation, setSkipConfirmation } = useAIAssistance();
  const [confirmOpen, setConfirmOpen] = React.useState(false), [remember, setRemember] = React.useState(false);
  const [busy, setBusy] = React.useState(false), [error, setError] = React.useState('');
  const [contextOpen, setContextOpen] = React.useState(false);
  const [context, setContext] = React.useState<AIClinicalContext>({ diseaseId: '', inheritance: '', sampleType: '', variantOrigin: 'unknown' });
  const [reference, setReference] = React.useState(input.reference ?? '');
  const [serverRequestId, setServerRequestId] = React.useState('');
  const [cancelling, setCancelling] = React.useState(false);
  const experimental = input.feature === 'svcv4';
  const charge = deployment === 'saas' && settings.billingEnabled === true && !experimental && settings.capabilities?.[input.feature]?.billingEnabled !== false;
  const featureCapability = settings.capabilities?.[input.feature];
  const unavailable = !settings.enabled || !settings.connected || !settings.configured || featureCapability?.enabled === false;
  const contextRequired = input.feature !== 'hpo' && !!settings.capabilities;
  const isSNV = input.feature === 'acmg' || input.feature === 'svcv4';
  const running = React.useRef(false);
  const controller = React.useRef<AbortController | null>(null);
  const scope = `${input.taskId ?? ''}:${input.feature}:${String(input.variant?.id ?? '')}`;
  const scopeRef = React.useRef(scope); scopeRef.current = scope;
  const request = React.useRef<{ fingerprint: string; id: string } | undefined>(undefined);
  React.useEffect(() => { setError(''); setConfirmOpen(false); setContextOpen(false); setRemember(false); controller.current?.abort(); running.current = false; setBusy(false); setServerRequestId(''); setCancelling(false); request.current = undefined;
    const calculator = input.calculator as { draft?: { diseaseId?: string; moi?: string }; diseaseId?: string; inheritance?: string } | undefined;
    setContext(input.clinicalContext ?? { diseaseId: calculator?.draft?.diseaseId ?? calculator?.diseaseId ?? '', inheritance: calculator?.draft?.moi ?? calculator?.inheritance ?? String(input.variant?.inheritanceMode ?? ''), sampleType: '', variantOrigin: 'unknown' });
    setReference(input.reference ?? '');
  // Draft edits are read when generating; reset the supplemental context only
  // when the selected task/variant changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);
  React.useEffect(() => { if (input.reference) setReference(input.reference); }, [input.reference]);
  React.useEffect(() => {
    if (!input.taskId || !adapter.getClinicalContext) return;
    const abort = new AbortController();
    void adapter.getClinicalContext(input.taskId, abort.signal).then(value => {
      if (!abort.signal.aborted) setContext(previous => ({ ...previous, sampleType: previous.sampleType || value.sampleType || '', hpoTerms: previous.hpoTerms ?? value.hpoTerms }));
    }).catch(() => undefined);
    return () => abort.abort();
  }, [scope, adapter, input.taskId]);
  React.useEffect(() => () => controller.current?.abort(), []);
  const generate = async (confirmed: boolean) => {
    if (running.current || disabled || unavailable) return;
    running.current = true; setBusy(true); onBusyChange?.(true); setError('');
    const originalScope = scope;
    const nextController = new AbortController(); controller.current = nextController;
    const prepared = contextRequired ? { ...input, reference, clinicalContext: context } : input;
    const fingerprint = JSON.stringify(prepared);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    try {
      const result = await adapter.generate(prepared, { requestId: request.current.id, signal: nextController.signal, confirmedCharge: confirmed, onRequest: id => { if (!nextController.signal.aborted && scopeRef.current === originalScope) setServerRequestId(id); } });
      if (nextController.signal.aborted || scopeRef.current !== originalScope) return;
      if (result.feature !== input.feature) throw new Error('AI 返回的评估类型不匹配，请重试。');
      onResult(result); request.current = undefined;
    } catch (cause) {
      if (!nextController.signal.aborted && scopeRef.current === originalScope && cause instanceof AIRequestError && cause.safeToRegenerate) request.current = undefined;
      if (!nextController.signal.aborted && scopeRef.current === originalScope) setError(cause instanceof Error ? cause.message : 'AI 生成失败，请稍后重试。');
    } finally {
      if (controller.current === nextController) { running.current = false; setBusy(false); setServerRequestId(''); setCancelling(false); onBusyChange?.(false); }
    }
  };
  const label = AI_FEATURE_LABELS[input.feature];
  const inactiveReason = !settings.enabled ? 'AI 辅助功能未开启，请联系管理员配置' : !settings.connected ? 'AI 服务暂不可用' : !settings.configured ? 'AI 模型尚未配置' : featureCapability?.enabled === false ? featureCapability.reason ?? '该引擎尚未开放' : '';
  const continueGeneration = () => { if (charge && !skipConfirmation) setConfirmOpen(true); else void generate(charge); };
  const missingContext = !reference || !context.sampleType || (isSNV && (!context.diseaseId.trim() || !context.inheritance.trim())) || (experimental && context.variantOrigin !== 'germline_confirmed');
  return <>
    <IconActionButton loading={busy} action="ai" variant="ghost" type="button" label={`AI 生成${label}`} hint={inactiveReason || `AI 生成${label}${deployment === 'saas' ? charge ? ' · 1 积分/次' : ' · 联调期间不扣费' : ''}`}
      disabled={disabled || busy || unavailable} className="inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-accent-fg transition-colors hover:bg-accent-subtle disabled:opacity-40"
      onClick={() => { setError(''); if (contextRequired && (missingContext || experimental)) setContextOpen(true); else continueGeneration(); }} />
    {inactiveReason && <span className="text-xs text-fg-muted">{inactiveReason}</span>}
    {deployment === 'saas' && !charge && !inactiveReason && <span className="text-xs text-fg-muted">联调期间不扣费</span>}
    {busy && serverRequestId && adapter.cancel && <ActionButton loading={cancelling} loadingLabel="取消中…" variant="ghost" type="button" disabled={cancelling} className="yj-tool-button" onClick={async () => { setCancelling(true); try { await adapter.cancel!(serverRequestId); } catch { setError('取消请求失败，请重试。'); setCancelling(false); } }}>取消</ActionButton>}
    {error && <p role="alert" className="basis-full text-xs leading-relaxed text-danger-fg">{error}</p>}
    <AppModal open={contextOpen} onOpenChange={setContextOpen} title="补充 AI 评估上下文" size="small" footer={<><ActionButton variant="ghost" type="button" className="yj-tool-button" onClick={() => setContextOpen(false)}>取消</ActionButton><ActionButton variant="ghost" type="button" className="yj-tool-button" disabled={missingContext} onClick={() => { setContextOpen(false); continueGeneration(); }}>继续</ActionButton></>}>
      <div className="space-y-3 text-sm">
        <p className="text-xs text-fg-muted">补充本次评估所需信息。来源未确认时保持“未确认”，不会修改样本或计算器。</p>
        {experimental && <p role="note" className="text-xs text-warning-fg">SVC 草案实验仅供研究与工程对照，输入未核验，禁止临床用途且不结算积分。需明确确认胚系来源才可执行；不会自动确认。</p>}
        {!input.reference && <label className="block">参考基因组<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={reference} onChange={event => setReference(event.target.value)}><option value="">请选择</option><option value="hg19">GRCh37 / hg19</option><option value="hg38">GRCh38 / hg38</option></select></label>}
        {isSNV && <><label className="block">疾病标识<input className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.diseaseId} onChange={event => setContext({ ...context, diseaseId: event.target.value })} placeholder="例如 MONDO 或 OMIM 标识" /></label><label className="block">遗传模式<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.inheritance} onChange={event => setContext({ ...context, inheritance: event.target.value })}><option value="">请选择</option>{['AD', 'AR', 'XL', 'XLD', 'XLR', 'MT', 'unknown'].map(value => <option key={value} value={value}>{value}</option>)}</select></label></>}
        <label className="block">样本类型<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.sampleType} onChange={event => setContext({ ...context, sampleType: event.target.value })}><option value="">请选择</option>{[['blood', '血液'], ['saliva', '唾液'], ['buccal', '口腔拭子'], ['fibroblast', '成纤维细胞'], ['tissue', '组织'], ['other', '其他'], ['unknown', '未知']].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label className="block">变异来源<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.variantOrigin} onChange={event => setContext({ ...context, variantOrigin: event.target.value as AIClinicalContext['variantOrigin'] })}><option value="unknown">未确认</option><option value="germline_confirmed">已确认胚系</option></select></label>
      </div>
    </AppModal>
    <AppModal open={confirmOpen} onOpenChange={setConfirmOpen} title="使用 AI 辅助生成" size="small"
      footer={<><ActionButton variant="ghost" type="button" onClick={() => setConfirmOpen(false)} className="yj-tool-button">取消</ActionButton><button type="button" disabled={disabled || busy} className="inline-flex items-center justify-center rounded-md bg-accent-emphasis px-3 py-2 text-sm font-medium text-fg-on-emphasis disabled:opacity-40" onClick={() => { if (remember) setSkipConfirmation(true); setConfirmOpen(false); void generate(true); }}>确认生成 · 1 积分</button></>}>
      <p className="text-sm leading-relaxed">使用 AI 生成{label}，每次消耗 <strong>1 积分</strong>。</p>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">生成结果供人工复核。只发送本次输入及相关注释。</p>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />本次会话不再提示</label>
      <p className="mt-2 text-xs text-fg-muted">勾选后仍按每次 1 积分计费，仅省略确认弹窗。</p>
    </AppModal>
  </>;
}

const CLASS_LABELS: Record<string, string> = { Pathogenic: '致病', Likely_Pathogenic: '可能致病', VUS: '意义未明', Likely_Benign: '可能良性', Benign: '良性', InsufficientEvidence: '证据不足' };
export function AIResultCard({ result, onUseInterpretation }: { result: AIAssistanceResult; onUseInterpretation?: () => void }) {
  const rule = result.ruleEngineResult && typeof result.ruleEngineResult === 'object' ? result.ruleEngineResult as Record<string, unknown> : undefined;
  const reviewer = result.reviewerDecision && typeof result.reviewerDecision === 'object' ? result.reviewerDecision as Record<string, unknown> : undefined;
  const score = rule?.total_score ?? rule?.totalScore ?? rule?.score;
  return <section aria-label="AI 辅助建议" className="space-y-3 rounded-lg border border-accent-subtle bg-accent-subtle/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent-fg" />AI 辅助建议</h4>{result.classification && <span className="text-sm font-medium">{CLASS_LABELS[result.classification] ?? result.classification}</span>}</div>
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{result.summary}</p>
    {result.resultKind && <p className="text-xs text-fg-muted">{result.resultKind === 'experimental' ? '草案实验 · 输入未核验 · 禁止临床用途 · 不计费' : result.resultKind === 'evidence_only' ? '证据整理建议 · 无正式规则分类' : result.resultKind === 'production' ? '模型建议与规则结果 · 待人工审核' : `结果类型：${result.resultKind}`}</p>}
    {result.experimentalResult && <dl className="space-y-1 text-xs"><div>实验版本：{String(result.experimentalResult.version ?? '未知')}</div><div>草案分类：{String(result.experimentalResult.classification ?? '未评定')} · 分值 {String(result.experimentalResult.total_points ?? 'ND')}</div><div>规则散列：{String(result.experimentalResult.ruleset_hash ?? '未知')}</div></dl>}
    {rule && <div className="rounded border border-border-subtle p-2 text-xs"><span className="font-medium">规则引擎结果</span><span className="ml-2">{result.classification ? CLASS_LABELS[result.classification] ?? result.classification : '无分类'}{typeof score === 'number' || typeof score === 'string' ? ` · 分值 ${score}` : ''}</span></div>}
    {reviewer && <div className="text-xs text-fg-muted">人工判定：{String(reviewer.classification ?? reviewer.decision ?? '待复核')}{typeof reviewer.reason === 'string' ? ` · ${reviewer.reason}` : ''}</div>}
    {!!result.evidence?.length && <dl className="space-y-2">{result.evidence.map((item, index) => <div key={`${item.code}-${index}`}><dt className="text-xs font-semibold">{item.code}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-fg-muted">{item.reason}</dd></div>)}</dl>}
    {!!result.warnings?.length && <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-fg-muted">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2"><span className="text-xs text-fg-muted">待人工复核{result.model ? ` · ${result.model}` : ''}</span>{onUseInterpretation && result.resultKind !== 'experimental' && !result.experimentalResult && <ActionButton variant="ghost" type="button" className="yj-tool-button" onClick={onUseInterpretation}>填入人工解读</ActionButton>}</div>
  </section>;
}
