import { describe, it, expect } from 'vitest';
import { prepareCNVAIReview, reviewedCNVSection4, autofillCNVAssessment } from './cnv-ai';
import { calculateLossTotal } from './loss-calculator';
import { calculateGainTotal } from './gain-calculator';
import { createDefaultLossAssessmentCriteria, createDefaultGainAssessmentCriteria, type CNVAssessment } from '../types';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import rubrics from './cnv-ai-rubrics.json';
function fixture(loss = true) { const criteria = loss ? createDefaultLossAssessmentCriteria() : createDefaultGainAssessmentCriteria(); criteria.section3.confirmed = false; criteria.section5.other.selected = null; return { cnvType: loss ? 'Deletion' : 'Amplification', criteria } as CNVAssessment; }
function result(code: string, score: number, loss = true): AIAssistanceResult { const d = (loss ? rubrics.loss : rubrics.gain).find(d => d.code === code)!; return { requestId: 'req-1', feature: loss ? 'cnv_loss' : 'cnv_gain', summary: 'review', agentProposal: { sources: [{ id: 'PMID-1', record_exists: true, identifier_valid: true, title: 'synthetic', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }], ai_assessment: { classification: 'Benign', criteria: [{ code, status: 'met', score_hundredths: score, source_ids: ['PMID-1'], facts: Object.fromEntries(d.facts.map(f => [f, true])), override_reason: 'synthetic source' }] } } }; }
describe('CNV AI human review', () => {
    it.each([true, false])('maps the correct dosage framework and recomputes, loss=%s', loss => { const a = fixture(loss); const p = prepareCNVAIReview(result('2A', 100, loss), a); expect(p.applied).toEqual(['2A']); expect((loss ? calculateLossTotal : calculateGainTotal)(p.criteria as never).totalScore).toBe(1); expect(a.criteria.section2.hiOverlap.selected).toBeNull(); expect(p.criteria.aiReview?.result.requestId).toBe('req-1'); });
    it('keeps an explicit zero rather than substituting a default', () => { const p = prepareCNVAIReview(result('2F', 0, false), fixture(false)); expect(calculateGainTotal(p.criteria as never).totalScore).toBe(0); });
    it('never invents coding gene counts from category scores', () => { const p = prepareCNVAIReview(result('3C', 90), fixture()); expect(p.applied).toEqual([]); expect(p.skipped).toContain('3C'); expect(p.criteria.section3.confirmed).toBe(false); });
    it('rejects wrong engine, bad bounds, references and conflicting clauses', () => { const a = fixture(); expect(prepareCNVAIReview(result('2A', 100, false), a).applied).toHaveLength(0); expect(prepareCNVAIReview(result('2A', 101), a).applied).toHaveLength(0); const bad = result('2A', 100); (bad.agentProposal as any).sources = []; expect(prepareCNVAIReview(bad, a).applied).toHaveLength(0); const conflict = result('2A', 100); (conflict.agentProposal as any).ai_assessment.criteria.push((result('2B', 0).agentProposal as any).ai_assessment.criteria[0]); expect(prepareCNVAIReview(conflict, a).applied).toHaveLength(0); });
    it('stores literature scores without fabricated cases, caps shared groups and restores audit', () => { const p = prepareCNVAIReview(result('4A', 45), fixture()); expect(p.criteria.section4.deNovo['4A'].confirmedCount).toBe(0); expect(calculateLossTotal(p.criteria as never).totalScore).toBe(.45); expect(JSON.parse(JSON.stringify(p.criteria)).aiReview.appliedCodes).toEqual(['4A']); expect(reviewedCNVSection4([{ code: '4L', scoreHundredths: 45, sourceIds: ['a'], reason: 'a' }, { code: '4M', scoreHundredths: 30, sourceIds: ['b'], reason: 'b' }])).toBe(.45); });
    it('missing evidence does not populate any scoring fields', () => { const x = result('2A', 100); (x.agentProposal as any).ai_assessment.criteria[0].status = 'insufficient_data'; expect(prepareCNVAIReview(x, fixture()).applied).toEqual([]); });
});

describe('CNV automatic calculator defaults', () => {
 it.each([true,false])('fills and calculates without evidence, loss=%s', loss=>{
  const r=result('2A',100,loss);(r.agentProposal as any).ai_assessment.criteria[0].status='insufficient_data';
  const a=fixture(loss);const c=autofillCNVAssessment(r,a)!;
  expect(c.aiReview?.autoFilled).toBe(true);expect(c.section5.other.selected).toBe('5F');
  expect(c.section3).toEqual({geneCount:0,confirmed:false,defaulted:true});
  expect((loss?calculateLossTotal:calculateGainTotal)(c as never)).toMatchObject({totalScore:0,classification:'VUS'});
  expect(autofillCNVAssessment(r,{...a,criteria:c})).toBeNull();
  expect(JSON.parse(JSON.stringify(c)).aiReview.defaultedFields).toContain('section3');
 });
 it('fills supported evidence, retains manual counts and blocks another variant',()=>{
  const a=fixture();a.cnvId='A';a.criteria.section3={geneCount:35,confirmed:true};
  const r={...result('2A',100),variantId:'A'};const c=autofillCNVAssessment(r,a)!;
  expect(c.section2.hiOverlap.selected).toBe('2A');expect(c.section3.geneCount).toBe(35);
  expect(calculateLossTotal(c as never).totalScore).toBe(1.9);
  expect(autofillCNVAssessment({...r,variantId:'B'},a)).toBeNull();
 });
});
