import type { AIAssistanceResult } from '@/lib/ai-assistance';
import type { CNVAssessment, LossAssessmentCriteria, GainAssessmentCriteria } from '../types';
import rubrics from './cnv-ai-rubrics.json';
import { createDefaultSection4Criteria, createDefaultLossAssessmentCriteria, createDefaultGainAssessmentCriteria } from '../types';
type Clause = {
    code: string;
    status: string;
    score_hundredths?: number;
    source_ids?: string[];
    facts?: Record<string, boolean>;
    override_reason?: string;
};
export function cnvAIClauses(result: AIAssistanceResult): Clause[] {
    const proposal = result.agentProposal as {
        ai_assessment?: {
            criteria?: Clause[];
        };
    } | undefined;
    return Array.isArray(proposal?.ai_assessment?.criteria) ? proposal.ai_assessment.criteria : [];
}
export function cnvAISources(result: AIAssistanceResult): Array<{
    id: string;
    title: string;
    url: string;
    record_exists: boolean;
    identifier_valid: boolean;
}> {
    const p = result.agentProposal as {
        sources?: ReturnType<typeof cnvAISources>;
    } | undefined;
    return p?.sources ?? [];
}
/** Candidates remain unverified until this explicit human review; never copy model totals. */
export function prepareCNVAIReview(result: AIAssistanceResult, assessment: CNVAssessment) {
    const loss = assessment.cnvType === 'Deletion';
    const expected = loss ? 'cnv_loss' : 'cnv_gain';
    const criteria = structuredClone(assessment.criteria);
    const applied: string[] = [];
    const skipped: string[] = [];
    if (result.feature !== expected || !result.requestId || (result.variantId && result.variantId !== assessment.cnvId))
        return { criteria, applied, skipped };
    const defs = loss ? rubrics.loss : rubrics.gain;
    const refs = new Map(cnvAISources(result).filter(s => s.record_exists && s.identifier_valid).map(s => [s.id, s]));
    const groups = new Set<string>();
    const seen = new Set<string>();
    const clinicalSources = new Set<string>();
    const candidates = cnvAIClauses(result);
    // Reject malformed/duplicate or mutually exclusive positive clauses as one proposal.
    for (const c of candidates) {
        if (seen.has(c.code))
            return { criteria, applied: [], skipped: candidates.map(c => c.code) };
        seen.add(c.code);
        if (c.status === 'met') {
            const d = defs.find(d => d.code === c.code);
            if (d?.group) {
                if (groups.has(d.group))
                    return { criteria, applied: [], skipped: candidates.map(c => c.code) };
                groups.add(d.group);
            }
        }
    }
    let resetFour = false;
    for (const c of candidates) {
        if (c.status !== 'met')
            continue;
        const d = defs.find(d => d.code === c.code);
        const n = c.score_hundredths;
        if (!d || !Number.isInteger(n) || n! < d.min || n! > d.max || !c.source_ids?.length || !c.source_ids.every(id => refs.has(id)) || !d.facts.every(f => c.facts?.[f]) || !c.override_reason) {
            skipped.push(c.code);
            continue;
        }
        // A gene-count category does not establish the exact coding-gene count.
        if (c.code.startsWith('3')) {
            skipped.push(c.code);
            continue;
        }
        if (c.code.startsWith('4') && loss && candidates.some(c => c.code === '2A' && c.status === 'met')) {
            skipped.push(c.code);
            continue;
        }
        if (/^[45]/.test(c.code) && c.source_ids.some(id => clinicalSources.has(id))) {
            skipped.push(c.code);
            continue;
        }
        if (c.code.startsWith('1'))
            criteria.section1.selected = c.code as '1A' | '1B';
        else if (c.code.startsWith('2')) {
            if (loss && c.code === '2A')
                criteria.section4 = createDefaultSection4Criteria();
            for (const v of Object.values(criteria.section2)) {
                v.selected = null;
                if ('score' in v)
                    v.score = 0;
            }
            const key = loss ? (c.code === '2H' ? 'hiPredictor' : ['2F', '2G'].includes(c.code) ? 'benignOverlap' : 'hiOverlap') : ['2A', '2B'].includes(c.code) ? 'tsOverlap' : ['2C', '2D', '2E', '2F', '2G'].includes(c.code) ? 'benignOverlap' : 'hiOverlap';
            const group = (criteria.section2 as unknown as Record<string, {
                selected: string | null;
                score?: number;
            }>)[key];
            group.selected = c.code;
            if ('score' in group)
                group.score = n! / 100;
        }
        else if (c.code.startsWith('4')) {
            if (!resetFour) {
                criteria.section4 = createDefaultSection4Criteria();
                criteria.section4.aiReviewed = [];
                resetFour = true;
            }
            criteria.section4.aiReviewed!.push({ code: c.code, scoreHundredths: n!, sourceIds: c.source_ids, reason: c.override_reason });
        }
        else if (c.code.startsWith('5')) {
            for (const v of Object.values(criteria.section5)) {
                v.selected = null;
                v.score = 0;
            }
            const key = c.code === '5A' ? 'deNovo' : ['5B', '5C', '5D'].includes(c.code) ? 'inherited' : c.code === '5E' ? 'nonSegregation' : 'other';
            const group = criteria.section5[key];
            (group as {
                selected: string | null;
            }).selected = c.code;
            group.score = n! / 100;
        }
        else {
            skipped.push(c.code);
            continue;
        }
        if (/^[45]/.test(c.code))
            c.source_ids.forEach(id => clinicalSources.add(id));
        applied.push(c.code);
    }
    if (applied.length)
        criteria.aiReview = { result, appliedCodes: applied, reviewedAt: new Date().toISOString() };
    return { criteria: criteria as LossAssessmentCriteria | GainAssessmentCriteria, applied, skipped };
}
/** Reviewed section 4 scores use no invented family or case counts. */
export function reviewedCNVSection4(items: NonNullable<LossAssessmentCriteria['section4']['aiReviewed']>, kind: 'loss' | 'gain' = 'loss'): number {
    const sums: Record<string, number> = {};
    const seen = new Set<string>();
    for (const item of items) {
        const d = rubrics[kind].find(d => d.code === item.code && d.code.startsWith('4'));
        if (!d || seen.has(item.code) || !Number.isInteger(item.scoreHundredths) || item.scoreHundredths < d.min || item.scoreHundredths > d.max || !item.sourceIds.length)
            return 0;
        seen.add(item.code);
        sums[item.code] = Math.max(d.cap_min, Math.min(d.cap_max, item.scoreHundredths));
    }
    const sum = (keys: string[]) => keys.reduce((n, k) => n + (sums[k] ?? 0), 0);
    return (Math.max(-30, Math.min(90, sum(['4A', '4B', '4C', '4D']))) + Math.min(45, sum(['4F', '4G', '4H'])) + Math.min(45, sum(['4L', '4M'])) + sum(['4E', '4I', '4J', '4K', '4N', '4O'])) / 100;
}


/** Automatically prepare a complete editable calculator draft. Unknown evidence
 * uses neutral form defaults, never a fabricated clinical observation. */
export function autofillCNVAssessment(result: AIAssistanceResult, assessment: CNVAssessment) {
    const expected = assessment.cnvType === 'Deletion' ? 'cnv_loss' : 'cnv_gain';
    if (!result.requestId || result.feature !== expected || (result.variantId && result.variantId !== assessment.cnvId)) return null;
    if (assessment.criteria.aiReview?.result.requestId === result.requestId) return null;
    const defaults = assessment.cnvType === 'Deletion' ? createDefaultLossAssessmentCriteria() : createDefaultGainAssessmentCriteria();
    const fill = (fallback: unknown, current: unknown): unknown => {
        if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) return current ?? fallback;
        const saved = current && typeof current === 'object' ? current as Record<string, unknown> : {};
        return { ...saved, ...Object.fromEntries(Object.entries(fallback).map(([key, value]) => [key, fill(value, saved[key])])) };
    };
    const seed = { ...assessment, criteria: fill(defaults, assessment.criteria) as CNVAssessment['criteria'] };
    const review = prepareCNVAIReview(result, seed);
    const criteria = review.criteria;
    const defaultedFields: string[] = [];
    if (!criteria.section1.selected) defaultedFields.push('section1');
    if (!Object.values(criteria.section2).some(v => v.selected)) defaultedFields.push('section2');
    if (criteria.section3.confirmed !== true) {
        criteria.section3 = { geneCount: 0, confirmed: false, defaulted: true };
        defaultedFields.push('section3');
    }
    if (!criteria.section4.aiReviewed?.length) defaultedFields.push('section4');
    if (!Object.values(criteria.section5).some(v => v.selected)) {
        criteria.section5.other = { selected: '5F', score: 0 };
        defaultedFields.push('section5');
    }
    const proposal = result.agentProposal as { ai_assessment?: { cnv_context?: { disease_id?: string; inheritance?: string } } } | undefined;
    criteria.aiReview = {
        result, appliedCodes: review.applied, skippedCodes: review.skipped,
        autoFilled: true, defaultedFields, reviewedAt: new Date().toISOString(),
        clinicalContext: {
            diseaseId: proposal?.ai_assessment?.cnv_context?.disease_id ?? assessment.criteria.aiReview?.clinicalContext?.diseaseId ?? '',
            inheritance: proposal?.ai_assessment?.cnv_context?.inheritance ?? assessment.criteria.aiReview?.clinicalContext?.inheritance ?? 'unknown',
        },
    };
    return criteria;
}
