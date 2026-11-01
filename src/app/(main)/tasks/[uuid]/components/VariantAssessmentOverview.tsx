'use client';
import { useText } from '@/i18n/useText';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import type { SNVIndel } from '../types';

export function VariantAssessmentOverview({ variant, ai, svcAI, aiError, onCalculator, onInterpretation }: {
  variant: SNVIndel; ai?: AIAssistanceResult; svcAI?: AIAssistanceResult; aiError?: string; onCalculator: () => void; onInterpretation: () => void;
}) {
  const t = useText();
  const label = (value?: string | null) => !value ? '—' : value === 'insufficient_data' ? t('variantAssessment.insufficient') : value.replaceAll('_', ' ');
  const selected = variant.activeAcmgVersion === 'svcv4';
  const cards = [
    { title: t('variantAssessment.database'), value: label(variant.clinvarSignificance), detail: [variant.clinvarReviewStatus, variant.clinvarDisease, variant.clinvarId].filter(Boolean).join(' · ') },
    { title: t('variantAssessment.quick'), value: label(variant.automaticAcmg?.classification), detail: variant.automaticAcmg?.screeningNotes?.join(' ') || variant.automaticAcmg?.profile },
    { title: t('variantAssessment.ai'), value: ai ? label(ai.suggestedClassification || ai.classification) : t('variantAssessment.notRun'), detail: ai ? [ai.model, ai.generatedAt].filter(Boolean).join(' · ') : '' },
    { title: t('variantAssessment.current'), value: label(variant.acmgClassification), detail: [(selected ? t('variantAssessment.svcDraft') : t('tasks.currentAcmgEdition8379ee')), variant.adoptedACMG?.savedAt ?? (selected ? variant.svcv4SavedAt : variant.acmgSavedAt), variant.acmgAssessmentSource].filter(Boolean).join(' · ') },
  ];
  if (svcAI) cards.splice(3,0,{title:t('variantAssessment.ai')+' · SVC v4',value:label(svcAI.suggestedClassification || svcAI.classification),detail:t('variantAssessment.svcDraft')});
  return <div className="space-y-4">
    <p className="text-xs leading-relaxed text-fg-muted">{t('variantAssessment.workflow')}</p>
    <div className="grid gap-3 sm:grid-cols-2">{cards.map(card => <section key={card.title} className="rounded-lg border border-border-subtle bg-canvas-default p-3"><h4 className="text-xs font-medium text-fg-muted">{card.title}</h4><p className="mt-2 text-sm font-semibold">{card.value}</p><p className="mt-1 break-words text-xs text-fg-muted">{card.detail}</p></section>)}</div>
    {aiError && <p role="alert" className="rounded border border-danger-emphasis/30 p-3 text-sm text-danger-fg">{t("variantAssessment.executionFailed")} · {aiError}</p>}
    <p className="text-sm text-fg-muted">{t('variantAssessment.referenceNotice')}</p>
    {ai && (ai.suggestedClassification === 'insufficient_data' || ai.classification === 'insufficient_data' || ai.suggestedClassification !== variant.automaticAcmg?.classification) && <p role="note" className="rounded border border-warning-emphasis/30 bg-warning-subtle p-3 text-sm">{t('variantAssessment.difference')}</p>}
    {ai && <section className="space-y-2"><h4 className="text-sm font-semibold">{t('variantAssessment.missing')}</h4><ul className="space-y-2 text-xs text-fg-muted">{ai.evidence?.filter(e => e.status !== 'met').map(e => <li key={e.code}><strong>{e.code}</strong> · <span>{e.reason}</span></li>)}{ai.warnings?.map((warning, i) => <li key={i}>{warning}</li>)}</ul></section>}
    <div className="flex flex-wrap gap-3"><button type="button" className="rounded-md bg-accent-emphasis px-3 py-2 text-sm text-fg-on-emphasis" onClick={onCalculator}>{t('variantAssessment.openCalculator')}</button><button type="button" className="text-sm text-accent-fg" onClick={onInterpretation}>{t('variantAssessment.next')}</button></div>
  </div>;
}
