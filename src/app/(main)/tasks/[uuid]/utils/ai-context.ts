import type { SNVIndel, CNVSegment, CNVExon } from '../types';

/** Send variant evidence only, without storage URLs, sample IDs or reads. */
export function aiVariantContext(variant: SNVIndel | CNVSegment | CNVExon): Record<string, unknown> {
  const allowed = ['id', 'gene', 'genes', 'chromosome', 'position', 'startPosition', 'endPosition', 'ref', 'alt', 'variantType', 'zygosity', 'transcript', 'hgvsc', 'hgvsp', 'consequence', 'clinvarSignificance', 'clinvarReviewStatus', 'clinvarStars', 'clinvarDisease', 'gnomadAF', 'gnomadEasAF', 'alphaMissenseScore', 'pangolinGain', 'pangolinLoss', 'evoScore', 'diseaseAssociation', 'inheritanceMode', 'type', 'copyNumber', 'copyRatio', 'confidence', 'iscnCandidate', 'exon'];
  const source = variant as unknown as Record<string, unknown>;
  const samples = Object.fromEntries(['proband','father','mother'].flatMap(role => {
    const value = source[role] as Record<string,unknown> | undefined;
    if (!value) return [];
    return [[role,Object.fromEntries(['genotype','zygosity','alleleDepth','alleleFrequency','vafSource'].filter(key=>value[key]!==undefined).map(key=>[key,value[key]]))]];
  }));
  return { ...(Object.keys(samples).length ? {sampleGenotypes:samples} : {}), ...Object.fromEntries([...allowed, 'clinvarId', 'rsId', 'depth', 'alleleFrequency', 'maxAF', 'gnomadNhomaltXX', 'gnomadNhomaltXY', 'pangolinAnnotation', 'evoAnnotation', 'alphaMissenseClass', 'pubmedIds', 'omimId'].filter(key => source[key] !== undefined).map(key => [key, source[key]])),
    annotationValues: Object.fromEntries(Object.entries(variant.annotationValues ?? {}).filter(([key]) => !/(password|token|secret|api.?key|sample.?id|patient.?name|file.?path|fastq|bam.?path|cram.?path)/i.test(key))) };
}
