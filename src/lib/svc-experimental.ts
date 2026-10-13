import { LocalizedError } from '@/i18n/errors';
import type { SVCv4Assessment } from './svcv4';
export const SVC_EXPERIMENTAL_COMMIT = 'ef66faff51a265fef7b5c4e6439905f3aa540c46';
export function svcExperimentalInput(draft: SVCv4Assessment): Record<string, unknown> {
  const inputs = draft.inputs;
  const cases = [...(inputs.cases ?? []), ...(inputs.family ? [inputs.family] : [])];
  return {
    upstream_commit: SVC_EXPERIMENTAL_COMMIT, moi: draft.moi,
    ...(draft.geneDiseaseValidity ? { gene_disease_validity: draft.geneDiseaseValidity } : {}),
    ...(inputs.population ? { population: inputs.population } : {}),
    ...(cases.length ? { cases } : {}),
    ...(inputs.family?.id ? { locus_case_id: inputs.family.id } : {}),
    ...(inputs.caseControl ? { case_control: inputs.caseControl } : {}),
    ...(inputs.workflow && inputs.impact ? { variant_impact: { ...inputs.impact, workflow: inputs.workflow } } : {}),
  };
}
// Upstream spans count Unicode characters; browser selections count UTF-16.
export function unicodeSpanToUTF16(text: string, start: number, end: number): [number, number] {
  const points = Array.from(text);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > points.length) throw new LocalizedError("display.invalidTextSpan0f3165");
  return [points.slice(0, start).join('').length, points.slice(0, end).join('').length];
}
