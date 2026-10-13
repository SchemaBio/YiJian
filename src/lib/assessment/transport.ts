// Keep wide report annotations in DuckDB. These are the only raw fields read
// by the evaluator; normalized intervals and quality proofs come from context.
export const ASSESSMENT_FIELDS = [
  'Gene','Genes','genes','MTGene','MT_Gene','Col5','gene','Filter','FILTER','filter',
  'Transcript','AlphaMissense_AM','Type','Consequence','CNV_Type','Col4','type',
  'GnomAD_AF','GnomAD_AF_EAS','gnomAD_AF','gnomAD_AF_EAS','gnomadAF','gnomadEasAF',
  'ClinVar_Sig','ClinVar_CLNSIG','ClinVar_RevStat','ClinVar_Star','clinvarSignificance','clinvarReviewStatus',
  'ClinVar_DN','HGNC_ID','MAX_AF','Genotype','GQ','AD','VAF','Quality','Impact','Location',
  'GenCC_moi_curie','GenCC_disease_title','GenCC_moi_title','GenCC_disease_original_curie','GenCC_assertion_criteria_url',
  'Pangolin_Gain','Pangolin_Loss','Pangolin_AN','EVOScore','EVOScore_AN','GnomAD_nhomalt_XX','GnomAD_nhomalt_XY',
  'Depth','depth','Repeat_Unit','RepeatUnit','repeatUnit',
  'Allele1_Repeats','Allele1','allele1Repeats','Allele2_Repeats','Allele2','allele2Repeats',
] as const;
export const ASSESSMENT_BATCH_SIZE = 1000;
