import { describe, expect, it } from 'vitest';
import { transcriptLocation } from './snv-annotations';
import type { SNVIndel } from '../types';

const variant = (annotationValues: Record<string, string>) => ({ annotationValues } as SNVIndel);
describe('selected transcript location', () => {
  it('parses exon and intron report locations with totals', () => {
    expect(transcriptLocation(variant({ Location: 'Exon 2/20' }))).toMatchObject({ label: 'Exon2', exonNumber: '2', exonTotal: '20', intronTotal: '19', intronTotalDerived: true });
    expect(transcriptLocation(variant({ Location: 'Intron 4/8' }))).toMatchObject({ label: 'Intron4', intronNumber: '4', intronTotal: '8', exonTotal: '9', exonTotalDerived: true });
  });
  it('preserves ranges and never converts missing or distance-only data to a numbered exon', () => {
    expect(transcriptLocation(variant({ Location: 'Exon 2-3/20' })).label).toBe('Exon2-3');
    expect(transcriptLocation(variant({ Location: 'Distance: 100' }))).toMatchObject({ label: '—', exonTotal: undefined, intronTotal: undefined });
    expect(transcriptLocation(variant({ Location: '.' })).label).toBe('—');
  });
  it('uses explicit annotations without overwriting an intron zero total', () => {
    expect(transcriptLocation(variant({ EXON: '1/1' }))).toMatchObject({ label: 'Exon1', exonTotal: '1', intronTotal: '0' });
  });
});
