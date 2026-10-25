import { ident } from './parquet-browser-sql';

export type SNVZygosity = 'Reference' | 'Heterozygous' | 'Homozygous' | 'Hemizygous' | 'Unknown';
export interface SNVSampleMetrics {
  genotype?: string;
  zygosity: SNVZygosity;
  alleleFrequency?: number;
  vafSource?: 'reported' | 'ad';
  alleleDepth?: string;
}
function text(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const result = String(value).trim();
  return result && !['.', './.', '.|.', 'NA', 'N/A'].includes(result) ? result : undefined;
}
function fraction(value: unknown): number | undefined {
  const raw = text(value);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : undefined;
}
export function sampleZygosity(label: unknown, genotype: unknown): SNVZygosity {
  const value = text(label)?.toLowerCase();
  if (value?.includes('hemi')) return 'Hemizygous';
  const gt = text(genotype);
  if (gt && /^\d+(?:[|/]\d+)*$/.test(gt)) {
    const alleles = gt.split(/[|/]/).map(Number);
    if (alleles.every(a => a === 0)) return 'Reference';
    if (alleles.length === 1) return 'Hemizygous';
    return alleles.every(a => a === alleles[0]) ? 'Homozygous' : 'Heterozygous';
  }
  if (['wt', 'ref', 'reference', 'hom_ref', 'homozygous_reference'].includes(value ?? '')) return 'Reference';
  if (value?.includes('het')) return 'Heterozygous';
  if (value?.includes('hom')) return 'Homozygous';
  return 'Unknown';
}
export function readSNVSample(row: Record<string, unknown>, role: '' | 'father' | 'mother' = ''): SNVSampleMetrics {
  const suffix = role ? '_'+role : '';
  const genotype = text(row['Genotype'+suffix] ?? (!role ? row.genotype : undefined));
  const ad = row['AD'+suffix] ?? (!role ? row.ad : undefined);
  const alleleDepth = Array.isArray(ad) ? ad.join(',') : text(ad);
  const vaf = fraction(row['VAF'+suffix] ?? (!role ? row.vaf ?? row.alleleFrequency : undefined));
  const result: SNVSampleMetrics = {genotype, zygosity: sampleZygosity(row['Zygosity'+suffix] ?? (!role ? row.zygosity : undefined), genotype), alleleFrequency:vaf, vafSource:vaf === undefined ? undefined : 'reported', alleleDepth};
  // AD has one reference count and one count per ALT. Only infer a scalar
  // frequency when the source identifies an unambiguous biallelic record.
  if (vaf === undefined && alleleDepth && /^\d+ *, *\d+$/.test(alleleDepth) && !String(row.Alt ?? row.alt ?? '').includes(',')) {
    const counts = alleleDepth.split(',').map(Number);
    const total = counts[0]+counts[1];
    if (counts.every(Number.isSafeInteger) && Number.isSafeInteger(total) && total > 0) {
      result.alleleFrequency = counts[1]/total;
      result.vafSource = 'ad';
    }
  }
  return result;
}

// Materialize the same value in the browser so sorting and numeric filters
// operate on the displayed frequency. Original VAF and AD columns stay intact.
export function sampleVafSQL(raw: string[], role: '' | 'father' | 'mother' = ''): string {
  const suffix = role ? '_'+role : '';
  const vaf = raw.includes('VAF'+suffix) ? `TRY_CAST(${ident('VAF'+suffix)} AS DOUBLE)` : 'NULL';
  const valid = `CASE WHEN ${vaf} BETWEEN 0 AND 1 THEN ${vaf} END`;
  if (!raw.includes('AD'+suffix)) return valid;
  const ad = `TRIM(CAST(${ident('AD'+suffix)} AS VARCHAR))`;
  const ref = `TRY_CAST(split_part(${ad}, ',', 1) AS DOUBLE)`;
  const alt = `TRY_CAST(split_part(${ad}, ',', 2) AS DOUBLE)`;
  const sum = `(${ref}+${alt})`;
  const biallelic = raw.includes('Alt') ? `AND NOT contains(COALESCE(CAST(${ident('Alt')} AS VARCHAR), ''), ',')` : '';
  return `COALESCE(${valid}, CASE WHEN regexp_full_match(${ad}, '[0-9]+ *, *[0-9]+') AND ${sum}>0 AND ${sum}<=9007199254740991 ${biallelic} THEN ${alt}/${sum} END)`;
}


export type SampleColumnRoles = Record<'proband' | 'father' | 'mother', '' | 'father' | 'mother'>;
export function sampleRoleSQL(raw: string[], roles: SampleColumnRoles | undefined, relation='source'): string | undefined {
  if (!roles) return undefined;
  if (Object.keys(roles).length!==3 || !['proband','father','mother'].every(role=>Object.hasOwn(roles,role)) || new Set(Object.values(roles)).size!==3 || !Object.values(roles).every(value=>['','father','mother'].includes(value))) throw new Error('Invalid sample role mapping');
  const assignments:string[]=[];
  for(const role of ['proband','father','mother'] as const){
    const destination=role==='proband'?'':'_'+role;
    const source=roles[role]?'_'+roles[role]:'';
    for(const field of ['Genotype','Zygosity','PhaseSet','Depth','AD','VAF','GQ','PL']){
      if(raw.includes(field+destination)) assignments.push(ident(field+destination)+'='+(raw.includes(field+source)?ident(field+source):'NULL'));
    }
  }
  return assignments.length ? `UPDATE ${ident(relation)} SET ${assignments.join(', ')}` : undefined;
}
