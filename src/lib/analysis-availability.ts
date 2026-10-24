// Identify the supported parent-child trio workflows.
export function isFamilyAnalysis(value: {
  id?: string; baseType?: string; basePipeline?: string; basePipelineId?: string; template?: string;
} | undefined | null): boolean {
  if (!value) return false;
  return value.baseType === 'wes_family' || value.basePipeline === 'wes_family'
    || value.template === 'trio' || value.template === 'germline_trio'
    || [value.id, value.basePipelineId].some(id => /^builtin-wes-family(?:-hg19|-hg38)?$/.test(id ?? ''));
}

export function isFamilyAnalysisUnavailable(_value: Parameters<typeof isFamilyAnalysis>[0]): boolean { return false; }
