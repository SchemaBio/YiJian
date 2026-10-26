'use client';
import * as React from 'react';
import { useText } from '@/i18n/useText';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import type { CNVAssessment } from '../types';
import { calculateLossTotal } from '../utils/loss-calculator';
import { calculateGainTotal } from '../utils/gain-calculator';
import { cnvAIClauses, cnvAISources, prepareCNVAIReview } from '../utils/cnv-ai';
export function CNVAIReview({ result, assessment, onApply, disabled = false }: {
    result: AIAssistanceResult;
    assessment: CNVAssessment;
    onApply: (criteria: CNVAssessment['criteria']) => void;
    disabled?: boolean;
}) {
    const t = useText();
    const [preview, setPreview] = React.useState(false);
    const review = prepareCNVAIReview(result, assessment);
    const proposal = result.agentProposal as {
        ai_assessment?: {
            cnv_context?: {
                disease_id?: string;
                inheritance?: string;
                rationale?: string;
            };
        };
    } | undefined;
    const [disease, setDisease] = React.useState(assessment.criteria.aiReview?.clinicalContext?.diseaseId ?? proposal?.ai_assessment?.cnv_context?.disease_id ?? '');
    const [moi, setMoi] = React.useState(assessment.criteria.aiReview?.clinicalContext?.inheritance ?? proposal?.ai_assessment?.cnv_context?.inheritance ?? 'unknown');
    const calculate = assessment.cnvType === 'Deletion' ? calculateLossTotal : calculateGainTotal;
    const scoreBefore = calculate(assessment.criteria as never), scoreAfter = calculate(review.criteria as never);
    const selectedCodes = (value: unknown): string[] => {
        if (!value || typeof value !== 'object')
            return [];
        if (Array.isArray(value))
            return value.flatMap(selectedCodes);
        const object = value as Record<string, unknown>;
        return [...(typeof object.selected === 'string' ? [object.selected] : []), ...(typeof object.code === 'string' ? [object.code] : []), ...Object.entries(object).filter(([key]) => key !== 'aiReview').flatMap(([key, item]) => /^4[A-O]$/.test(key) && ((typeof item === 'number' && item > 0) || (item && typeof item === 'object' && Object.values(item).some(v => typeof v === 'number' && v !== 0))) ? [key] : selectedCodes(item))];
    };
    return <div className="mb-3 space-y-2 rounded border border-border-subtle p-3 text-xs">
  <p>{t('assistance.cnvReviewNotice')}</p>
  <div className="flex flex-wrap gap-2"><label>{t('tasks.diseaseIdentifier3697b1')}<input disabled={disabled} value={disease} onChange={e => setDisease(e.target.value)} className="ml-2 rounded border bg-canvas-default p-1"/></label><label>{t('tasks.inheritancePattern5de3fe')}<select disabled={disabled} value={moi} onChange={e => setMoi(e.target.value)} className="ml-2 rounded border bg-canvas-default p-1">{['unknown', 'AD', 'AR', 'XL', 'XLD', 'XLR', 'SD', 'MT'].map(v => <option key={v}>{v}</option>)}</select></label></div>
  {proposal?.ai_assessment?.cnv_context?.rationale && <p>{proposal.ai_assessment.cnv_context.rationale}</p>}
  <ul className="space-y-1">{cnvAIClauses(result).map(c => <li key={c.code}>{c.code} · {t(`assistance.criterionStatus.${({ met: 'met', not_met: 'notMet', not_applicable: 'notApplicable', insufficient_data: 'insufficient', conflicting: 'conflicting' } as Record<string, string>)[c.status] ?? 'insufficient'}`)} · {typeof c.score_hundredths === 'number' ? (c.score_hundredths / 100).toFixed(2) : '—'}<p>{c.override_reason}</p><span>{c.source_ids?.join(', ')}</span></li>)}</ul>
  <ul>{cnvAISources(result).map(s => <li key={s.id}>{/^https:\/\//i.test(s.url) ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent-fg underline">{s.title || s.id}</a> : s.title || s.id} · {s.id}</li>)}</ul>
  <button type="button" className="yj-tool-button" disabled={disabled || !review.applied.length} onClick={() => setPreview(v => !v)}>{t('assistance.cnvReviewAction')}</button>
  {preview && <div role="region" aria-label={t('assistance.cnvReviewAction')} className="space-y-2 border-t pt-2"><p>{t('assistance.cnvReviewReplaceNotice')}</p><p>{t('assistance.cnvReviewCodes', { p0: review.applied.join(', ') })}</p>{!!review.skipped.length && <p>{t('assistance.cnvReviewSkipped', { p0: review.skipped.join(', ') })}</p>}<dl className="space-y-1"><div>{t('assistance.cnvReviewBefore', { p0: selectedCodes(assessment.criteria).join(', ') || '—' })}</div><div>{t('assistance.cnvReviewAfter', { p0: selectedCodes(review.criteria).join(', ') || '—' })}</div><div>{t('assistance.cnvReviewScore', { p0: scoreBefore.totalScore.toFixed(2), p1: scoreAfter.totalScore.toFixed(2) })}</div></dl><button type="button" className="yj-tool-button" disabled={disabled} onClick={() => { onApply({ ...review.criteria, aiReview: { ...review.criteria.aiReview!, clinicalContext: { diseaseId: disease, inheritance: moi } } }); setPreview(false); }}>{t('assistance.cnvReviewConfirm')}</button></div>}
 </div>;
}
