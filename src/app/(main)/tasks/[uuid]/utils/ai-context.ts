import type { SNVIndel, CNVSegment, CNVExon } from '../types';

/** Send variant evidence only, without storage URLs, sample IDs or reads. */
export function aiVariantContext(variant: SNVIndel | CNVSegment | CNVExon): Record<string, unknown> {
  const allowed = ['id', 'gene', 'genes', 'chromosome', 'position', 'startPosition', 'endPosition', 'ref', 'alt', 'variantType', 'zygosity', 'transcript', 'hgvsc', 'hgvsp', 'consequence', 'clinvarSignificance', 'clinvarReviewStatus', 'clinvarStars', 'clinvarDisease', 'gnomadAF', 'gnomadEasAF', 'alphaMissenseScore', 'pangolinGain', 'pangolinLoss', 'evoScore', 'diseaseAssociation', 'inheritanceMode', 'type', 'copyNumber', 'copyRatio', 'confidence', 'iscnCandidate', 'exon'];
  const source = variant as unknown as Record<string, unknown>;
  return { ...Object.fromEntries(allowed.filter(key => source[key] !== undefined).map(key => [key, source[key]])),
    annotationValues: Object.fromEntries(Object.entries(variant.annotationValues ?? {}).filter(([key]) => /^(ClinVar|GnomAD|gnomAD|GenCC|AlphaMissense|Pangolin|EVOScore|HI_|TS_|OMIM|ISCN|HGNC|Cytoband)/.test(key))) };
}
