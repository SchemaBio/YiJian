import { ncbiGeneURL } from '../utils/ncbi-gene';

export function GeneLinks({ genes, annotationValues }: { genes: string | string[]; annotationValues?: Record<string, string> }) {
  const symbols = [...new Set((Array.isArray(genes) ? genes : [genes]).flatMap(value => value.split(/[;,|&]/)).map(value => value.trim()).filter(value => value && !/^(?:\.|-|na|n\/a|null)$/i.test(value)))];
  if (!symbols.length) return <span className="text-fg-muted">—</span>;
  const geneId = symbols.length === 1 ? ['NCBI_Gene_ID', 'Entrez_Gene_ID', 'EntrezGene_ID', 'HPO_Gene'].map(field => annotationValues?.[field]).find(value => value && /^\d+$/.test(value.trim())) : undefined;
  return <span className="yj-gene-links">{symbols.map(symbol => <a key={symbol} href={ncbiGeneURL(symbol, geneId)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" title={`${symbol} · NCBI Gene`} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>{symbol}</a>)}</span>;
}
