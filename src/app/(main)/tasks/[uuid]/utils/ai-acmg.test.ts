import { describe, expect, it } from 'vitest';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import { aiACMGReviewCandidates } from './ai-acmg';

const result = (evidence: AIAssistanceResult['evidence']): AIAssistanceResult => ({ feature: 'acmg', requestId: 'request-1', model: 'synthetic', summary: 'PM2 满足；这是文本而不是结构化证据', evidence });
describe('structured ACMG AI review candidates', () => {
  it('normalizes met strengths and retains model/request provenance for human review', () => {
    const candidates = aiACMGReviewCandidates(result([{ code: 'PM2', status: 'met', strength: 'Moderate', reason: '复核人群频率' }, { code: 'PVS1', status: 'met', strength: 'VeryStrong', reason: '复核 LoF 机制' }]));
    expect(candidates).toEqual([expect.objectContaining({ code: 'PM2', strength: 'moderate', source: 'sepilens_ai_reviewed', note: expect.stringContaining('request-1') }), expect.objectContaining({ code: 'PVS1', strength: 'very_strong' })]);
  });
  it('excludes non-met statuses and never extracts evidence from prose', () => {
    expect(aiACMGReviewCandidates(result(undefined))).toEqual([]);
    for (const status of ['not_met', 'not_applicable', 'insufficient_data', 'conflicting', undefined]) expect(aiACMGReviewCandidates(result([{ code: 'PM2', status, strength: 'Moderate', reason: 'not counted' }]))).toEqual([]);
  });
  it('rejects ambiguous codes, invalid strengths, missing rationale and experimental results', () => {
    for (const evidence of [
      [{ code: 'UNKNOWN', status: 'met', strength: 'Moderate', reason: 'x' }],
      [{ code: 'PM2', status: 'met', strength: 'invalid', reason: 'x' }],
      [{ code: 'BA1', status: 'met', strength: 'Moderate', reason: 'x' }],
      [{ code: 'BP4', status: 'met', strength: 'VeryStrong', reason: 'x' }],
      [{ code: 'PM2', status: 'met', strength: 'Moderate', reason: '' }],
      [{ code: 'PM2', status: 'met', strength: 'Moderate', reason: 'a' }, { code: 'PM2', status: 'not_met', strength: 'Moderate', reason: 'b' }],
    ]) expect(aiACMGReviewCandidates(result(evidence))).toEqual([]);
    const valid = result([{ code: 'PM2', status: 'met', strength: 'Moderate', reason: 'x' }]);
    expect(aiACMGReviewCandidates({ ...valid, resultKind: 'experimental' })).toEqual([]);
    expect(aiACMGReviewCandidates({ ...valid, feature: 'cnv_loss' })).toEqual([]);
  });
});
