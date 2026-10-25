import { locales } from '@/i18n/locales';
import { createTextTranslator } from '@/i18n/text';

type Term = [labels: string[], values: string[]];
const classifications: Term[] = [
  [['致病'], ['Pathogenic']],
  [['可能致病'], ['Likely_Pathogenic', 'Likely pathogenic', 'Likely-pathogenic']],
  [['意义未明', '意义不明'], ['VUS', 'Uncertain significance']],
  [['可能良性'], ['Likely_Benign', 'Likely benign', 'Likely-benign']],
  [['良性'], ['Benign']],
];
const dictionaries: Record<string, Term[]> = {
  classification: classifications,
  zygosity: [[['杂合'], ['Het', 'Heterozygous']], [['纯合'], ['Hom', 'Homozygous']], [['半合', '半合子'], ['Hemi', 'Hemizygous']], [['tasks.referenceGenotype'], ['WT', 'Reference', 'HomRef']]],
  str: [[['正常'], ['Normal']], [['前突变'], ['Premutation']], [['全突变'], ['FullMutation', 'Full mutation']]],
  upd: [[['等位UPD', '同源UPD'], ['Isodisomy']], [['异位UPD', '异源UPD'], ['Heterodisomy']]],
  parent: [[['母源'], ['Maternal', 'Mother']], [['父源'], ['Paternal', 'Father']]],
  confidence: [[['高'], ['HIGH']], [['中'], ['MEDIUM']], [['低'], ['LOW']]],
  cnv: [[['重复', '扩增'], ['DUP', 'Amplification']], [['缺失'], ['DEL', 'Deletion']], [['正常'], ['Normal']]],
  variant: [[['插入'], ['INS', 'Insertion']], [['缺失'], ['DEL', 'Deletion']], [['复杂'], ['MNP', 'Complex']]],
  insertion: [[['插入'], ['insertion', 'insert']], [['缺失'], ['deletion', 'delete']], [['复杂'], ['complex']]],
  mei: [[['LINE-1'], ['LINE1', 'LINE-1', 'L1']]],
  impact: [[['外显子区'], ['exonic']], [['内含子区'], ['intronic']], [["5'UTR"], ['UTR5']], [["3'UTR"], ['UTR3']], [['基因间区'], ['intergenic']]],
  boolean: [[['是'], ['true']], [['否'], ['false']]],
};
const translators = locales.map(createTextTranslator);

function dictionary(table: string, column: string): Term[] {
  const field = column.replaceAll('_', '').toLowerCase();
  if (['acmgclassification', 'cnvclassification', 'clinvarsig', 'pathogenicity', 'clinvarsignificance'].includes(field)) return dictionaries.classification;
  if (['zygosity','zygosityfather','zygositymother','fatherzygosity','motherzygosity'].includes(field)) return dictionaries.zygosity;
  if (['strstatus', 'status'].includes(field) && table === 'str') return dictionaries.str;
  if (['parentoforigin', 'parentorigin'].includes(field)) return dictionaries.parent;
  if (['confidencelabel', 'confidence', 'col18'].includes(field) && table === 'cnv-exon') return dictionaries.confidence;
  if (['pinned', 'focused', 'reviewed'].includes(field)) return dictionaries.boolean;
  if (['type', 'varianttype', 'updtype', 'col4'].includes(field)) {
    if (table.startsWith('cnv-')) return dictionaries.cnv;
    if (table === 'upd') return dictionaries.upd;
    if (table === 'snv-indel') return dictionaries.variant;
  }
  if (['insertiontype', 'eventtype'].includes(field) && table === 'mei') return dictionaries.insertion;
  if (['tetype', 'tefamily', 'meitype'].includes(field) && table === 'mei') return dictionaries.mei;
  if (field === 'impact' && table === 'mei') return dictionaries.impact;
  return [];
}

/** Resolve complete display labels from any supported language, never arbitrary business text.
 * Keep all equivalent source spellings because reports can use short or long enum values.
 * Missing-value placeholders deliberately use the dedicated presence operators instead.
 */
export function resultFilterValue(table: string, column: string, value: string | string[], operator = 'equals'): string | string[] {
  const terms = dictionary(table, column);
  const expand = (input: string): string[] => {
    const key = input.trim().toLowerCase();
    for (const [labels, values] of terms) {
      const names = [...values, ...labels.flatMap(label => translators.map(t => t(label)))];
      if (names.some(name => name.toLowerCase() === key)) return values;
    }
    if (key && ['contains', 'not_contains'].includes(operator)) {
      const matching = terms.flatMap(([labels, values]) => labels
        .some(label => translators.some(t => t(label).toLowerCase().includes(key))) ? values : []);
      if (matching.length) return [input, ...matching];
    }
    return [input];
  };
  const values = [...new Set((Array.isArray(value) ? value : [value]).flatMap(expand))];
  return !Array.isArray(value) && values.length === 1 ? values[0] : values;
}
