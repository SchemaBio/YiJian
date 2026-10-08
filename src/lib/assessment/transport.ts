// Keep wide report annotations in DuckDB. These are the only raw fields read
// by the evaluator; normalized intervals and quality proofs come from context.
export const ASSESSMENT_FIELDS = [
  'Gene','MTGene','MT_Gene','Col5','gene','Filter','FILTER','filter',
  'Transcript','AlphaMissense_AM','Type','Consequence','CNV_Type','Col4','type',
  'Depth','depth','Repeat_Unit','RepeatUnit','repeatUnit',
  'Allele1_Repeats','Allele1','allele1Repeats','Allele2_Repeats','Allele2','allele2Repeats',
] as const;
export const ASSESSMENT_BATCH_SIZE = 1000;
