/** NCBI Gene's exact symbol field, constrained to Homo sapiens (taxid 9606).
 * https://www.ncbi.nlm.nih.gov/books/NBK3841/table/EntrezGene.T.fields_used_to_categorize_i/
 */
export function ncbiGeneURL(symbol: string, geneId?: string): string {
  if (geneId && /^\d+$/.test(geneId.trim())) return `https://www.ncbi.nlm.nih.gov/gene/${geneId.trim()}`;
  return `https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(`"${symbol.trim().replaceAll('"', '')}"[sym] AND 9606[taxid]`)}`;
}
