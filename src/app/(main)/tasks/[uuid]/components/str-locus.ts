export function parseSTRLocus(locus: string): { chromosome: string; position: number; endPosition?: number } | null {
  const match = /^(?:chr)?([1-9]|1[0-9]|2[0-2]|X|Y|M|MT):([\d,]+)(?:-([\d,]+))?$/i.exec(locus.trim());
  if (!match) return null;
  const position = Number(match[2].replaceAll(',', ''));
  const endPosition = match[3] ? Number(match[3].replaceAll(',', '')) : undefined;
  if (!Number.isSafeInteger(position) || position < 1 || (endPosition !== undefined && (!Number.isSafeInteger(endPosition) || endPosition < position))) return null;
  return { chromosome: match[1].toUpperCase(), position, ...(endPosition !== undefined ? { endPosition } : {}) };
}
