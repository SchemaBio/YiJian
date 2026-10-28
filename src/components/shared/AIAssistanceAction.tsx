'use client';
import { prepareAIRequestInput } from '@/lib/ai-request-input';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';

import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { AppModal } from './AppModal';
import { useAIAssistance } from '@/components/providers/AIAssistanceProvider';
import { AIRequestError, AI_FEATURE_LABELS, type AIClinicalContext, type AIAssistanceInput, type AIAssistanceResult } from '@/lib/ai-assistance';
import { notifyBillingUpdated } from '@/lib/billing';

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
  const featureCapability = settings.capabilities?.[input.feature];
  const hpoProduction = deployment === 'saas' && input.feature === 'hpo';
  const charge = deployment === 'saas' && (featureCapability?.billingEnabled ?? settings.billingEnabled) === true;
  const billingUnavailable = deployment === 'saas' && (input.feature === 'hpo' || input.feature === 'acmg' || input.feature === 'svcv4' || input.feature === 'cnv_gain' || input.feature === 'cnv_loss') && !charge;
  const unavailable = !settings.enabled || !settings.connected || !settings.configured || featureCapability?.enabled === false || billingUnavailable;
  const contextRequired = false;
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
    if (input.feature === 'acmg' || input.feature === 'svcv4' || !input.taskId || !adapter.getClinicalContext) return;
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
    try {
      let prepared: AIAssistanceInput;
      try {
        prepared = prepareAIRequestInput(contextRequired ? { ...input, reference, clinicalContext: context } : input);
        const fingerprint = JSON.stringify(prepared);
        if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      } catch {
        throw new AIRequestError('assistance.assessmentInputUnavailable', true);
      }
      const result = await adapter.generate(prepared, { requestId: request.current!.id, signal: nextController.signal, confirmedCharge: confirmed, onRequest: id => { if (!nextController.signal.aborted && scopeRef.current === originalScope) setServerRequestId(id); } });
      if (nextController.signal.aborted || scopeRef.current !== originalScope) return;
      if (result.feature !== input.feature) throw new Error(t("assistance.aiReturnedAMismatchedAssessmentTypeRetry053edf"));
      onResult(result); request.current = undefined;
    } catch (cause) {
      if (!nextController.signal.aborted && scopeRef.current === originalScope && cause instanceof AIRequestError && cause.safeToRegenerate) request.current = undefined;
      if (!nextController.signal.aborted && scopeRef.current === originalScope) setError(cause instanceof Error ? errorText(cause, t) : t("assistance.aiGenerationFailedRetryLater8bf8b5"));
    } finally {
      if (controller.current === nextController) { running.current = false; setBusy(false); setServerRequestId(''); setCancelling(false); onBusyChange?.(false); if (charge) notifyBillingUpdated(); }
    }
  };
  const label = t(AI_FEATURE_LABELS[input.feature]);
  const inactiveReason = !settings.enabled ? t("assistance.aiAssistanceIsDisabledAskAnAdministratorfe2e3b") : !settings.connected ? t("assistance.aiServiceUnavailable6c7c68") : !settings.configured ? t("assistance.aiModelNotConfigured138bde") : featureCapability?.enabled === false ? (featureCapability.reason === 'cnv_ai_unavailable' ? t('assistance.cnvNotAvailable') : featureCapability.reason) ?? t("assistance.thisEngineIsNotAvailableYetfc2caa") : billingUnavailable ? t(input.feature === 'cnv_gain' || input.feature === 'cnv_loss' ? 'assistance.cnvBillingNotReady' : input.feature === 'hpo' ? 'assistance.hpoBillingNotReady' : input.feature === 'svcv4' ? 'assistance.svcBillingNotReady' : 'assistance.acmgBillingNotReady') : '';
  const continueGeneration = () => { if (charge && !skipConfirmation(input.feature)) setConfirmOpen(true); else void generate(charge); };
  const missingContext = !reference || !context.sampleType || (!context.diseaseId.trim() || !context.inheritance.trim()) || (experimental && context.variantOrigin !== 'germline_confirmed');
  return <>
    {!(busy && serverRequestId && adapter.cancel) && <IconActionButton loading={busy} action="ai" variant="ghost" type="button" label={t("assistance.aiGenerated7d0bf", {p0: String(label)})} hint={inactiveReason || t("assistance.aiGeneratedb4967", {p0: String(label), p1: String(deployment === 'saas' ? charge ? ` ${t('· 1 积分/次')}` : ` ${t('assistance.noChargeDuringIntegrationTesting4f1828')}` : '')})}
      disabled={disabled || busy || unavailable} className="yj-ai-generation-button inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-accent-fg transition-colors hover:bg-accent-subtle disabled:opacity-40"
      onClick={() => { setError(''); if (contextRequired && (missingContext || experimental)) setContextOpen(true); else continueGeneration(); }} />}
    {deployment === 'saas' && !hpoProduction && !charge && !inactiveReason && <span className="text-xs text-fg-muted">{t("assistance.noChargeDuringIntegrationTestinge54a18")}</span>}
    {busy && serverRequestId && adapter.cancel && <button type="button" disabled={cancelling} aria-busy={cancelling || undefined} className="yj-tool-button text-xs" onClick={async () => { setCancelling(true); try { await adapter.cancel!(serverRequestId); } catch { setError(t("assistance.unableToCancelRequestRetryfca412")); setCancelling(false); } }}>
      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
      {cancelling ? t("assistance.cancelingb3f55e") : t("admin.cancel4d0b46")}
    </button>}
    {error && <p role="alert" className="basis-full text-xs leading-relaxed text-danger-fg">{error}</p>}
    <AppModal open={contextOpen} onOpenChange={setContextOpen} title={t("assistance.addAiAssessmentContext8bae3f")} size="small" footer={<><ActionButton variant="ghost" type="button" className="yj-tool-button" onClick={() => setContextOpen(false)}>{t("admin.cancel4d0b46")}</ActionButton><ActionButton variant="ghost" type="button" className="yj-tool-button" disabled={missingContext} onClick={() => { setContextOpen(false); continueGeneration(); }}>{t("assistance.continue1fc1af")}</ActionButton></>}>
      <div className="space-y-3 text-sm">
        <p className="text-xs text-fg-muted">{t("assistance.provideInformationForThisAssessmentLeaveUnknown56a7e7")}</p>
        {experimental && <p role="note" className="text-xs text-warning-fg">{t("assistance.svcDraftExperimentsAreForResearchAndc4f6a1")}</p>}
        {!input.reference && <label className="block">{t("pipeline.referenceGenome903ba5")}<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={reference} onChange={event => setReference(event.target.value)}><option value="">{t("assistance.select382f4b")}</option><option value="hg19">GRCh37 / hg19</option><option value="hg38">GRCh38 / hg38</option></select></label>}
        {contextRequired && <><label className="block">{t("tasks.diseaseIdentifier3697b1")}<input className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.diseaseId} onChange={event => setContext({ ...context, diseaseId: event.target.value })} placeholder={t("assistance.forExampleMondoOrOmimIdentifier9d3090")} /></label><label className="block">{t("tasks.inheritancePattern5de3fe")}<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.inheritance} onChange={event => setContext({ ...context, inheritance: event.target.value })}><option value="">{t("assistance.select382f4b")}</option>{['AD', 'AR', 'XL', 'XLD', 'XLR', 'MT', 'unknown'].map(value => <option key={value} value={value}>{value}</option>)}</select></label></>}
        <label className="block">{t("samples.sampleType686c81")}<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.sampleType} onChange={event => setContext({ ...context, sampleType: event.target.value })}><option value="">{t("assistance.select382f4b")}</option>{[['blood', t("assistance.blood9e4ab2")], ['saliva', t("samples.saliva0a538a")], ['buccal', t("assistance.buccalSwabbd0405")], ['fibroblast', t("assistance.fibroblastsae3611")], ['tissue', t("samples.tissuea3540e")], ['other', t("samples.other1a26ed")], ['unknown', t("samples.unknownd9c32a")]].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
        <label className="block">{t("assistance.variantOrigin3b25d9")}<select className="mt-1 w-full rounded border border-border-default bg-canvas-default p-2" value={context.variantOrigin} onChange={event => setContext({ ...context, variantOrigin: event.target.value as AIClinicalContext['variantOrigin'] })}><option value="unknown">{t("assistance.unconfirmed0642fa")}</option><option value="germline_confirmed">{t("assistance.confirmedGermline35ccdd")}</option></select></label>
      </div>
    </AppModal>
    <AppModal open={confirmOpen} onOpenChange={setConfirmOpen} title={t("assistance.generateWithAiAssistance080e66")} size="small"
      footer={<><ActionButton variant="ghost" type="button" onClick={() => setConfirmOpen(false)} className="yj-tool-button">{t("admin.cancel4d0b46")}</ActionButton><button type="button" disabled={disabled || busy} className="inline-flex items-center justify-center rounded-md bg-accent-emphasis px-3 py-2 text-sm font-medium text-fg-on-emphasis disabled:opacity-40" onClick={() => { if (remember) setSkipConfirmation(input.feature, true); setConfirmOpen(false); void generate(true); }}>{t("assistance.confirmGenerationCredit23464d")}</button></>}>
      <p className="text-sm leading-relaxed">{t("assistance.generateWithAi61271c")}{label}{t("assistance.eachGenerationCosts1acbf6")}<strong>{t("assistance.credit07b109")}</strong>。</p>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">{t("assistance.generatedResultsRequireManualReviewOnlyThisb946e6")}</p>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />{t("assistance.doNotAskAgainThisSession556519")}</label>
      <p className="mt-2 text-xs text-fg-muted">{t("assistance.eachGenerationStillCostsCreditOnlyThe1adeb6")}</p>
    </AppModal>
  </>;
}

const CLASS_LABELS: Record<string, string> = { Pathogenic: '致病', Likely_Pathogenic: '可能致病', VUS: '意义未明', Likely_Benign: '可能良性', Benign: '良性', InsufficientEvidence: '证据不足' };
function classificationLabel(value: string): string {
  const normalized = value.replace(/[^a-z]/gi, '').toLowerCase();
  const aliases: Record<string, string> = { pathogenic: 'Pathogenic', likelypathogenic: 'Likely_Pathogenic', vus: 'VUS', uncertainsignificance: 'VUS', uncertainsignificancevus: 'VUS', variantofuncertainsignificance: 'VUS', likelybenign: 'Likely_Benign', benign: 'Benign' };
  return normalized === 'insufficientdata' ? 'assistance.verifiedEvidenceInsufficient' : CLASS_LABELS[aliases[normalized] ?? value] ?? value;
}
const STATUS_KEYS: Record<string, string> = { met: 'met', not_met: 'notMet', not_applicable: 'notApplicable', insufficient_data: 'insufficient', conflicting: 'conflicting' };
export function AIResultCard({ result, onUseInterpretation, onReviewEvidence, humanReviewSaved = false, statusLabel }: { result: AIAssistanceResult; onUseInterpretation?: () => void; onReviewEvidence?: () => void; humanReviewSaved?: boolean; statusLabel?: string }) {
  const t = useText();
  const rule = result.ruleEngineResult && typeof result.ruleEngineResult === 'object' ? result.ruleEngineResult as Record<string, unknown> : undefined;
  const reviewer = result.reviewerDecision && typeof result.reviewerDecision === 'object' ? result.reviewerDecision as Record<string, unknown> : undefined;
  const score = rule?.total_score ?? rule?.totalScore ?? rule?.score;
  const ruleCriteria = Array.isArray(rule?.criteria) ? rule.criteria as Array<Record<string, unknown>> : [];
  const proposal = result.agentProposal && typeof result.agentProposal === 'object' ? result.agentProposal as Record<string, unknown> : undefined;
  const reconciled = Array.isArray(proposal?.reconciliation) ? proposal.reconciliation as Array<Record<string, unknown>> : [];
  const quality=proposal?.evidence_quality as {version?:string;criteria?:{code:string;status:string}[]}|undefined;
  return <section aria-label={t("assistance.aiSuggestions89d49e")} className="space-y-3 rounded-lg border border-accent-subtle bg-accent-subtle/20 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent-fg" />{t("assistance.aiSuggestions89d49e")}</h4>{result.classification && result.feature !== 'acmg' && <span className="text-sm font-medium">{t(classificationLabel(result.classification))}</span>}</div>
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{result.summary}</p>
    {quality?.version==='evidence-quality-v1' && <div className="text-xs text-fg-muted"><p>{t('assessmentQuality.title')}</p><ul>{quality.criteria?.map((item,index)=><li key={`${item.code}-${index}`}>{item.code}: {t(`assessmentQuality.${['supported','pending_review','insufficient_data','conflicting'].includes(item.status)?item.status:'pending_review'}`)}</li>)}</ul></div>}
    {result.suggestedClassification && <p className="text-sm">{t('assistance.aiCandidateClassification')}{t(classificationLabel(result.suggestedClassification))}</p>}
    {result.resultKind && <p className="text-xs text-fg-muted">{result.resultKind === 'experimental' ? t("assistance.draftExperimentUnverifiedInputNoClinicalUsea555f8") : result.resultKind === 'evidence_only' ? t("assistance.evidenceOrganizationSuggestionsNoFormalRuleClassificationfc1f1f") : result.resultKind === 'production' ? t("assistance.modelSuggestionsAndRuleResultsManualReview74dad3") : t("assistance.resultTyped3bde1", {p0: String(result.resultKind)})}</p>}
    {result.experimentalResult && <dl className="space-y-1 text-xs"><div>{t("assistance.experimentVersiona4948a")}{String(result.experimentalResult.version ?? t("samples.unknownd9c32a"))}</div><div>{t("assistance.draftClassificationdb633c")}{String(result.experimentalResult.classification ?? t("tasks.notAssessedd94e42"))} {t("assistance.score016cf6")}{String(result.experimentalResult.total_points ?? 'ND')}</div><div>{t("assistance.ruleHash93cea6")}{String(result.experimentalResult.ruleset_hash ?? t("samples.unknownd9c32a"))}</div></dl>}
    {rule && <div className="rounded border border-border-subtle p-2 text-xs"><span className="font-medium">{t(result.feature === 'acmg' ? 'assistance.acmgRuleCheck' : 'assistance.ruleEngineResulte92c5b')}</span><span className="ml-2">{result.classification ? t(classificationLabel(result.classification)) : t("assistance.noClassificationf11956")}{typeof score === 'number' || typeof score === 'string' ? t("assistance.score02fb3a", {p0: String(score)}) : ''}</span></div>}
    {reviewer && !humanReviewSaved && <div className="text-xs text-fg-muted">{t("assistance.manualDecision88c9c3")}{String(reviewer.classification ?? reviewer.decision ?? t("assistance.awaitingReview4607ba"))}{typeof reviewer.reason === 'string' ? ` · ${reviewer.reason}` : ''}</div>}
    {!!result.evidence?.length && <dl className="space-y-2">{result.evidence.map((item, index) => {
      const checked = ruleCriteria.find(criterion => criterion.code === item.code);
      const decision = reconciled.find(criterion => criterion.code === item.code);
      const status = typeof checked?.status === 'string' ? checked.status : undefined;
      return <div key={`${item.code}-${index}`} className="rounded border border-border-subtle p-2"><dt className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span>{item.code}</span>{item.status && <span className="rounded bg-canvas-inset px-1.5 py-0.5 font-normal">{STATUS_KEYS[item.status] ? t(`assistance.criterionStatus.${STATUS_KEYS[item.status]}`) : item.status}</span>}{item.strength && <span className="font-normal text-fg-muted">{item.strength}</span>}</dt><dd className="mt-1 space-y-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-fg-muted"><p>{item.reason}</p>{result.feature === 'acmg' && status && <p>{t('assistance.criterionRuleStatus', { p0: STATUS_KEYS[status] ? t(`assistance.criterionStatus.${STATUS_KEYS[status]}`) : status })}{typeof checked?.reason === 'string' ? ` · ${checked.reason}` : ''}</p>}{result.feature === 'acmg' && decision?.accepted === false && <p>{t('assistance.criterionNotAccepted')}</p>}</dd></div>;
    })}</dl>}
    {result.feature === 'acmg' && <p className="text-xs text-fg-muted">{t('assistance.acmgHumanReviewNotice')}</p>}
    {!!result.warnings?.length && <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-fg-muted">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2"><span className="text-xs text-fg-muted">{statusLabel ?? t(humanReviewSaved ? "assistance.acmgHumanReviewSaved" : "assistance.awaitingManualReview32c3fb")}{result.model ? ` · ${result.model}` : ''}</span><div className="flex flex-wrap gap-2">{onReviewEvidence && (result.feature === 'acmg' || result.feature === 'cnv_gain' || result.feature === 'cnv_loss') && result.resultKind !== 'experimental' && !result.experimentalResult && <ActionButton variant="primary" type="button" className="yj-tool-button" onClick={onReviewEvidence}>{t(result.feature === 'acmg' ? 'assistance.acmgReviewAction' : 'assistance.cnvReviewAction')}</ActionButton>}{onUseInterpretation && result.resultKind !== 'experimental' && !result.experimentalResult && <ActionButton variant="ghost" type="button" className="yj-tool-button" onClick={onUseInterpretation}>{t("assistance.insertIntoInterpretationb2b77e")}</ActionButton>}</div></div>
  </section>;
}
