import { describe, expect, it, vi } from 'vitest';
import { formatPopulationFrequency, optionalAnnotationNumber, sourceAnnotation } from './snv-annotations';
import { getSNVIndels } from '../result-api';
import { DEFAULT_FILTER_STATE } from '../types';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));

describe('workflow SNV annotations', () => {
  it('shows population AF as a fraction and preserves missing values and zero', () => {
    expect(formatPopulationFrequency(0.0012)).toBe('0.0012');
    expect(formatPopulationFrequency(0)).toBe('0');
    expect(formatPopulationFrequency(undefined)).toBe('未提供');
    expect(formatPopulationFrequency('.')).toBe('未提供');
    expect(formatPopulationFrequency('0.001&0.00002')).toBe('0.001 & 0.00002');
    expect(optionalAnnotationNumber(null)).toBeUndefined();
    expect(optionalAnnotationNumber('0.9&0.7')).toBeUndefined();
  });

  it('maps actual prediction fields and never infers ACMG from ClinVar', async () => {
    vi.mocked(api.post).mockResolvedValue({ total: 1, items: [{
      id: 'stable-id', vaf: 0.5, clinvarSignificance: 'Pathogenic', acmgClassification: '',
      gnomadAF: null, gnomadEasAF: 0, pangolinGain: 0.7, pangolinAN: 'High likelihood',
      evoScore: -12, evoScoreAN: 'Pathogenic', alphaMissenseAM: null,
      annotationValues: { AlphaMissense_AM: '0.9&0.7', AlphaMissense_AMC: 'likely_pathogenic' },
    }] });
    const result = await getSNVIndels('task', DEFAULT_FILTER_STATE);
    const variant = result.data[0];
    expect(variant.acmgClassification).toBeUndefined();
    expect(variant.gnomadAF).toBeUndefined();
    expect(variant.gnomadEasAF).toBe(0);
    expect(variant.pangolinAnnotation).toBe('High likelihood');
    expect(variant.evoAnnotation).toBe('Pathogenic');
    expect(sourceAnnotation(variant, 'AlphaMissense_AM', variant.alphaMissenseScore)).toBe('0.9&0.7');
  });
});
