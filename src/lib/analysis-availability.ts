// Family analysis is intentionally unavailable in both deployment editions.
// Keep historical data and the workflow implementation available for release.
export function isFamilyAnalysis(value: {
  id?: string; baseType?: string; basePipeline?: string; basePipelineId?: string; template?: string;
} | undefined | null): boolean {
  if (!value) return false;
  return value.baseType === 'wes_family' || value.basePipeline === 'wes_family'
    || value.template === 'trio' || value.template === 'germline_trio'
    || [value.id, value.basePipelineId].some(id => /^builtin-wes-family(?:-hg38)?$/.test(id ?? ''));
}
