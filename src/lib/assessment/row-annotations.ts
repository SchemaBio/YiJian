import type { AssessmentRow } from './types';
const present=(value:unknown)=>value!==null&&value!==undefined&&value!=='.'&&String(value).trim()!=='';
export function annotationGenes(row:AssessmentRow):string[]{
  const keys=['Gene','Genes','gene','genes','MTGene','MT_Gene',...(row.table==='cnv-exon'?['Col5']:[])];
  const values=keys.map(key=>row.values[key]).filter(present);
  const genes=values.flatMap(value=>Array.isArray(value)?value.map(String):String(value).split(/[&,;|]/)).map(value=>value.trim()).filter(value=>/^[A-Za-z0-9_.:-]+$/.test(value));
  const hgnc=String(row.values.HGNC_ID??'').split(/[&,;|]/).map(value=>value.trim()).filter(value=>/^HGNC:\d+$/.test(value));
  return [...new Set([...genes,...hgnc])];
}
