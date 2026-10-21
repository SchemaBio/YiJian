import { describe, expect, it, vi } from 'vitest';
import { clinvarReviewStars, formatPopulationFrequency, formatPredictionLabel, optionalAnnotationNumber, sourceAnnotation } from './snv-annotations';
import { getSNVIndels } from '../result-api';
import { DEFAULT_FILTER_STATE } from '../types';
import { queryBrowserParquet } from '@/lib/parquet-browser';

vi.mock('@/lib/parquet-browser',()=>({queryBrowserParquet:vi.fn(),exportBrowserParquet:vi.fn(),updateBrowserOverlay:vi.fn()}));

describe('workflow SNV annotations', () => {
  it('capitalizes prediction labels without changing their annotation values or separators', () => {
    expect(formatPredictionLabel('likely_pathogenic')).toBe('Likely_pathogenic');
    expect(formatPredictionLabel('likely_benign&ambiguous|likely_pathogenic')).toBe('Likely_benign&Ambiguous|Likely_pathogenic');
    expect(formatPredictionLabel('Ambiguous')).toBe('Ambiguous');
    expect(formatPredictionLabel(undefined)).toBeUndefined();
  });
  it.each([
    ['practice_guideline', '4'],
    ['reviewed_by_expert_panel', '3'],
    ['criteria_provided,_multiple_submitters,_no_conflicts', '2'],
    ['criteria_provided&_multiple_submitters&_no_conflicts', '2'],
    ['criteria_provided,_single_submitter', '1'],
    ['conflicting_classifications_of_pathogenicity', '1'],
    ['practice_guideline&reviewed_by_expert_panel&_single_submitter', '4'],
    ['reviewed_by_expert_panel&_multiple_submitters', '3'],
    ['Reviewed by expert panel', '3'],
    ['no_assertion_criteria_provided', undefined],
    ['no_classification_provided', undefined],
    ['.', undefined],
    ['', undefined],
    [undefined, undefined],
  ])('derives review stars from %s as %s', (status, stars) => {
    expect(clinvarReviewStars(status)).toBe(stars);
  });
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
    vi.mocked(queryBrowserParquet).mockResolvedValue({ total: 1,rowCount:1,columns:[],columnTypes:{},fieldProfileVersion:'parquet-fields-v2',version:'hash',attemptId:'attempt',offset:0,limit:20, items: [{
      id: 'stable-id', vaf: 0.5, clinvarSignificance: 'Pathogenic', acmgClassification: '',
      clinvarStar: '.', clinvarRevStat: 'reviewed_by_expert_panel',
      gnomadAF: null, gnomadEasAF: 0, pangolinGain: 0.7, pangolinAN: 'High likelihood',
      evoScore: -12, evoScoreAN: 'Pathogenic', alphaMissenseAM: null,
      annotationValues: { AlphaMissense_AM: '0.9&0.7', AlphaMissense_AMC: 'likely_pathogenic' },
    }] });
    const result = await getSNVIndels('task', DEFAULT_FILTER_STATE);
    const variant = result.data[0];
    expect(variant.acmgClassification).toBeUndefined();
    expect(variant.clinvarStars).toBe('3');
    expect(variant.gnomadAF).toBeUndefined();
    expect(variant.gnomadEasAF).toBe(0);
    expect(variant.pangolinAnnotation).toBe('High likelihood');
    expect(variant.evoAnnotation).toBe('Pathogenic');
    expect(sourceAnnotation(variant, 'AlphaMissense_AM', variant.alphaMissenseScore)).toBe('0.9&0.7');
  });
});
