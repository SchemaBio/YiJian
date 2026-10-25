import type { AIAssistanceResult } from '@/lib/ai-assistance';
import type { ACMGEvidenceEntry } from '../types';

const CODES = new Set('PVS1 PS1 PS2 PS3 PS4 PM1 PM2 PM3 PM4 PM5 PM6 PP1 PP2 PP3 PP4 PP5 BA1 BS1 BS2 BS3 BS4 BP1 BP2 BP3 BP4 BP5 BP6 BP7'.split(' '));
const STRENGTHS: Record<string, ACMGEvidenceEntry['strength']> = { supporting: 'supporting', moderate: 'moderate', strong: 'strong', verystrong: 'very_strong', standalone: 'standalone' };

/** Only structured, unambiguous met candidates may seed a human review draft.
 * This does not approve rule evidence or save a classification. */
export function aiACMGReviewCandidates(result: AIAssistanceResult): ACMGEvidenceEntry[] {
  if (result.feature !== 'acmg' || result.resultKind === 'experimental' || result.experimentalResult) return [];
  const items = result.evidence ?? [];
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.code, (counts.get(item.code) ?? 0) + 1);
  return items.flatMap(item => {
    const strength = STRENGTHS[String(item.strength ?? '').replace(/[\s_-]/g, '').toLowerCase()];
    if (item.status !== 'met' || !CODES.has(item.code) || counts.get(item.code) !== 1 || !strength || !item.reason?.trim()) return [];
    if (item.code === 'BA1' ? strength !== 'standalone' : strength === 'standalone' || (item.code.startsWith('B') && strength === 'very_strong')) return [];
    return [{ code: item.code, strength, source: 'sepilens_ai_reviewed', note: [`SepiLens AI candidate; human-reviewed on save`, result.requestId ? `AI request: ${result.requestId}` : '', result.model ? `Model: ${result.model}` : '', result.generatedAt ? `Generated: ${result.generatedAt}` : '', item.reason].filter(Boolean).join('\n') }];
  });
}
