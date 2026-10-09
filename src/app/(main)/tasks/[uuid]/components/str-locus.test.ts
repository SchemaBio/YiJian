import { describe, expect, it } from 'vitest';
import { parseSTRLocus } from './str-locus';
describe('STR IGV coordinates', () => {
  it('retains point and interval coordinates', () => {
    expect(parseSTRLocus('chrX:1,234-1,345')).toEqual({ chromosome: 'X', position: 1234, endPosition: 1345 });
    expect(parseSTRLocus('1:10')).toEqual({ chromosome: '1', position: 10 });
  });
  it('does not create links for missing or invalid loci', () => {
    for (const value of ['-', 'HTT', 'chr1:0', 'chr1:20-10', 'chr23:10']) expect(parseSTRLocus(value)).toBeNull();
  });
});
