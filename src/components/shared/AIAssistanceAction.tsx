'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { AppModal } from './AppModal';
import { useAIAssistance } from '@/components/providers/AIAssistanceProvider';
import { AIRequestError, AI_FEATURE_LABELS, type AIClinicalContext, type AIAssistanceInput, type AIAssistanceResult } from '@/lib/ai-assistance';

export function AIAssistanceAction({ input, disabled = false, onResult, onBusyChange }: {
  input: AIAssistanceInput; disabled?: boolean; onResult: (result: AIAssistanceResult) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const t = useText();
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
      if (result.feature !== input.feature) throw new Error(t("assistance.aiReturnedAMismatchedAssessmentTypeRetry053edf"));
      onResult(result); request.current = undefined;
    } catch (cause) {
      if (!nextController.signal.aborted && scopeRef.current === originalScope && cause instanceof AIRequestError && cause.safeToRegenerate) request.current = undefined;
      if (!nextController.signal.aborted && scopeRef.current === originalScope) setError(cause instanceof Error ? errorText(cause, t) : t("assistance.aiGenerationFailedRetryLater8bf8b5"));
    } finally {
      if (controller.current === nextController) { running.current = false; setBusy(false); setServerRequestId(''); setCancelling(false); onBusyChange?.(false); }
    }
  };
  const label = t(AI_FEATURE_LABELS[input.feature]);
  const inactiveReason = !settings.enabled ? t("assistance.aiAssistanceIsDisabledAskAnAdministratorfe2e3b") : !settings.connected ? t("assistance.aiServiceUnavailable6c7c68") : !settings.configured ? t("assistance.aiModelNotConfigured138bde") : featureCapability?.enabled === false ? featureCapability.reason ?? t("assistance.thisEngineIsNotAvailableYetfc2caa") : '';
  const continueGeneration = () => { if (charge && !skipConfirmation) setConfirmOpen(true); else void generate(charge); };
  const missingContext = !reference || !context.sampleType || (isSNV && (!context.diseaseId.trim() || !context.inheritance.trim())) || (experimental && context.variantOrigin !== 'germline_confirmed');
  return <>
    <IconActionButton loading={busy} action="ai" variant="ghost" type="button" label={t("assistance.aiGenerated7d0bf", {p0: String(label)})} hint={inactiveReason || t("assistance.aiGeneratedb4967", {p0: String(label), p1: String(deployment === 'saas' ? charge ? ` ${t('· 1 积分/次')}` : ` ${t('· 联调期间不扣费')}` : '')})}
      disabled={disabled || busy || unavailable} className="inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-accent-fg transition-colors hover:bg-accent-subtle disabled:opacity-40"
      onClick={() => { setError(''); if (contextRequired && (missingContext || experimental)) setContextOpen(true); else continueGeneration(); }} />
    {inactiveReason && <span className="text-xs text-fg-muted">{inactiveReason}</span>}
    {deployment === 'saas' && !charge && !inactiveReason && <span className="text-xs text-fg-muted">{t("assistance.noChargeDuringIntegrationTestinge54a18")}</span>}
    {busy && serverRequestId && adapter.cancel && <ActionButton loading={cancelling} loadingLabel={t("assistance.cancelingb3f55e")} variant="ghost" type="button" disabled={cancelling} className="yj-tool-button" onClick={async () => { setCancelling(true); try { await adapter.cancel!(serverRequestId); } catch { setError(t("assistance.unableToCancelRequestRetryfca412")); setCancelling(false); } }}>{t("admin.cancel4d0b46")}</ActionButton>}
    {error && <p role="alert" className="basis-full text-xs leading-relaxed text-danger-fg">{error}</p>}
    <AppModal open={contextOpen} onOpenChange={setContextOpen} title={t("assistance.addAiAssessmentContext8bae3f")} size="small" footer={<><ActionButton variant="ghost" type="button" className="yj-tool-button" onClick={() => setContextOpen(false)}>{t("admin.cancel4d0b46")}</ActionButton><ActionButton variant="ghost" type="button" className="yj-tool-button" disabled={missingContext} onClick={() => { setContextOpen(false); continueGeneration(); }}>{t("assistance.continue1fc1af")}</ActionButton></>}>
      <div className="space-y-3 text-sm">
        <p className="text-xs text-fg-muted">{t("assistance.provideInformationForThisAssessmentLeaveUnknown56a7e7")}</p>
        {experimental && <p role="note" className="text-xs text-warning-fg">{t("assistance.svcDraftExperimentsAreForResearchAndc4f6a1")}</p>}
        {!input.reference && <label className="block">{t("pipeline.referenceGenome903ba5")}<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={reference} onChange={event => setReference(event.target.value)}><option value="">{t("assistance.select382f4b")}</option><option value="hg19">GRCh37 / hg19</option><option value="hg38">GRCh38 / hg38</option></select></label>}
        {isSNV && <><label className="block">{t("tasks.diseaseIdentifier3697b1")}<input className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.diseaseId} onChange={event => setContext({ ...context, diseaseId: event.target.value })} placeholder={t("assistance.forExampleMondoOrOmimIdentifier9d3090")} /></label><label className="block">{t("tasks.inheritancePattern5de3fe")}<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.inheritance} onChange={event => setContext({ ...context, inheritance: event.target.value })}><option value="">{t("assistance.select382f4b")}</option>{['AD', 'AR', 'XL', 'XLD', 'XLR', 'MT', 'unknown'].map(value => <option key={value} value={value}>{value}</option>)}</select></label></>}
        <label className="block">{t("samples.sampleType686c81")}<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.sampleType} onChange={event => setContext({ ...context, sampleType: event.target.value })}><option value="">{t("assistance.select382f4b")}</option>{[['blood', t("assistance.blood9e4ab2")], ['saliva', t("samples.saliva0a538a")], ['buccal', t("assistance.buccalSwabbd0405")], ['fibroblast', t("assistance.fibroblastsae3611")], ['tissue', t("samples.tissuea3540e")], ['other', t("samples.other1a26ed")], ['unknown', t("samples.unknownd9c32a")]].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label className="block">{t("assistance.variantOrigin3b25d9")}<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.variantOrigin} onChange={event => setContext({ ...context, variantOrigin: event.target.value as AIClinicalContext['variantOrigin'] })}><option value="unknown">{t("assistance.unconfirmed0642fa")}</option><option value="germline_confirmed">{t("assistance.confirmedGermline35ccdd")}</option></select></label>
      </div>
    </AppModal>
    <AppModal open={confirmOpen} onOpenChange={setConfirmOpen} title={t("assistance.generateWithAiAssistance080e66")} size="small"
      footer={<><ActionButton variant="ghost" type="button" onClick={() => setConfirmOpen(false)} className="yj-tool-button">{t("admin.cancel4d0b46")}</ActionButton><button type="button" disabled={disabled || busy} className="inline-flex items-center justify-center rounded-md bg-accent-emphasis px-3 py-2 text-sm font-medium text-fg-on-emphasis disabled:opacity-40" onClick={() => { if (remember) setSkipConfirmation(true); setConfirmOpen(false); void generate(true); }}>{t("assistance.confirmGenerationCredit23464d")}</button></>}>
      <p className="text-sm leading-relaxed">{t("assistance.generateWithAi61271c")}{label}{t("assistance.eachGenerationCosts1acbf6")}<strong>{t("assistance.credit07b109")}</strong>。</p>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">{t("assistance.generatedResultsRequireManualReviewOnlyThisb946e6")}</p>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />{t("assistance.doNotAskAgainThisSession556519")}</label>
      <p className="mt-2 text-xs text-fg-muted">{t("assistance.eachGenerationStillCostsCreditOnlyThe1adeb6")}</p>
    </AppModal>
  </>;
}

const CLASS_LABELS: Record<string, string> = { Pathogenic: '致病', Likely_Pathogenic: '可能致病', VUS: '意义未明', Likely_Benign: '可能良性', Benign: '良性', InsufficientEvidence: '证据不足' };
export function AIResultCard({ result, onUseInterpretation }: { result: AIAssistanceResult; onUseInterpretation?: () => void }) {
  const t = useText();
  const rule = result.ruleEngineResult && typeof result.ruleEngineResult === 'object' ? result.ruleEngineResult as Record<string, unknown> : undefined;
  const reviewer = result.reviewerDecision && typeof result.reviewerDecision === 'object' ? result.reviewerDecision as Record<string, unknown> : undefined;
  const score = rule?.total_score ?? rule?.totalScore ?? rule?.score;
  return <section aria-label={t("assistance.aiSuggestions89d49e")} className="space-y-3 rounded-lg border border-accent-subtle bg-accent-subtle/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent-fg" />{t("assistance.aiSuggestions89d49e")}</h4>{result.classification && <span className="text-sm font-medium">{translateUI(CLASS_LABELS[result.classification] ?? result.classification, t)}</span>}</div>
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{result.summary}</p>
    {result.resultKind && <p className="text-xs text-fg-muted">{result.resultKind === 'experimental' ? t("assistance.draftExperimentUnverifiedInputNoClinicalUsea555f8") : result.resultKind === 'evidence_only' ? t("assistance.evidenceOrganizationSuggestionsNoFormalRuleClassificationfc1f1f") : result.resultKind === 'production' ? t("assistance.modelSuggestionsAndRuleResultsManualReview74dad3") : t("assistance.resultTyped3bde1", {p0: String(result.resultKind)})}</p>}
    {result.experimentalResult && <dl className="space-y-1 text-xs"><div>{t("assistance.experimentVersiona4948a")}{String(result.experimentalResult.version ?? t("samples.unknownd9c32a"))}</div><div>{t("assistance.draftClassificationdb633c")}{String(result.experimentalResult.classification ?? t("tasks.notAssessedd94e42"))} {t("assistance.score016cf6")}{String(result.experimentalResult.total_points ?? 'ND')}</div><div>{t("assistance.ruleHash93cea6")}{String(result.experimentalResult.ruleset_hash ?? t("samples.unknownd9c32a"))}</div></dl>}
    {rule && <div className="rounded border border-border-subtle p-2 text-xs"><span className="font-medium">{t("assistance.ruleEngineResulte92c5b")}</span><span className="ml-2">{result.classification ? t(CLASS_LABELS[result.classification] ?? result.classification) : t("assistance.noClassificationf11956")}{typeof score === 'number' || typeof score === 'string' ? t("assistance.score02fb3a", {p0: String(score)}) : ''}</span></div>}
    {reviewer && <div className="text-xs text-fg-muted">{t("assistance.manualDecision88c9c3")}{String(reviewer.classification ?? reviewer.decision ?? t("assistance.awaitingReview4607ba"))}{typeof reviewer.reason === 'string' ? ` · ${reviewer.reason}` : ''}</div>}
    {!!result.evidence?.length && <dl className="space-y-2">{result.evidence.map((item, index) => <div key={`${item.code}-${index}`}><dt className="text-xs font-semibold">{item.code}</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-fg-muted">{item.reason}</dd></div>)}</dl>}
    {!!result.warnings?.length && <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-fg-muted">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2"><span className="text-xs text-fg-muted">{t("assistance.awaitingManualReview32c3fb")}{result.model ? ` · ${result.model}` : ''}</span>{onUseInterpretation && result.resultKind !== 'experimental' && !result.experimentalResult && <ActionButton variant="ghost" type="button" className="yj-tool-button" onClick={onUseInterpretation}>{t("assistance.insertIntoInterpretationb2b77e")}</ActionButton>}</div>
  </section>;
}
