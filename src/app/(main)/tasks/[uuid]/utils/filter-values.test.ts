import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/locales';
import { createTextTranslator } from '@/i18n/text';
import { resultFilterValue } from './filter-values';
import { ACMG_CONFIG } from '../result-api';

describe('language-independent result filters', () => {
  it.each(locales)('resolves visible enum labels and restored filters in %s', locale => {
    const t = createTextTranslator(locale);
    const cases = [
      ['snv-indel', 'acmgClassification', '良性', 'Benign'],
      ['snv-indel', 'acmgClassification', '可能良性', 'Likely_Benign'],
      ['snv-indel', 'Zygosity', '杂合', 'Het'],
      ['snv-indel', 'Zygosity', '半合', 'Hemi'],
      ['snv-indel', 'Type', '插入', 'INS'],
      ['str', 'STR_Status', '前突变', 'Premutation'],
      ['upd', 'Type', '等位UPD', 'Isodisomy'],
      ['upd', 'Parent_Of_Origin', '母源', 'Maternal'],
      ['cnv-exon', 'Col18', '高', 'HIGH'],
      ['cnv-segment', 'Col4', '缺失', 'DEL'],
      ['mt', 'ClinVar_Sig', '良性', 'Benign'],
      ['mei', 'Insertion_Type', '插入', 'insertion'],
      ['mei', 'Impact', '外显子区', 'exonic'],
      ['snv-indel', 'reported', '是', 'true'],
    ];
    for (const [table, column, label, expected] of cases) {
      const value = resultFilterValue(table, column, t(label));
      expect(Array.isArray(value) ? value : [value]).toContain(expected);
    }
    for (const [value, config] of Object.entries(ACMG_CONFIG)) {
      expect(t(config.label)).toBe(value);
    }
  });

  it('keeps business text, partial keywords, numeric ranges and missing placeholders intact', () => {
    expect(resultFilterValue('snv-indel', 'Gene', '良性')).toBe('良性');
    expect(resultFilterValue('snv-indel', 'HGVS_c', 'c.123A>G')).toBe('c.123A>G');
    expect(resultFilterValue('snv-indel', 'acmgClassification', 'Ben')).toBe('Ben');
    expect(resultFilterValue('cnv-exon', 'Col7', '高')).toBe('高');
    expect(resultFilterValue('snv-indel', 'Zygosity', '未提供')).toBe('未提供');
    expect(resultFilterValue('snv-indel', 'Position', ['1', '20'])).toEqual(['1', '20']);
  });

  it('expands multi-value selections without discarding unrecognized terms', () => {
    expect(resultFilterValue('snv-indel', 'acmgClassification', ['良性', 'VUS', 'custom'])).toEqual(['Benign', 'VUS', 'Uncertain significance', 'custom']);
  });
  it('matches translated partial keywords for both inclusion and exclusion', () => {
    for (const operator of ['contains', 'not_contains']) {
      expect(resultFilterValue('snv-indel', 'acmgClassification', '良', operator)).toEqual(expect.arrayContaining(['Benign', 'Likely_Benign']));
      expect(resultFilterValue('snv-indel', 'Type', '插', operator)).toEqual(expect.arrayContaining(['INS', 'Insertion']));
    }
    expect(resultFilterValue('snv-indel', 'acmgClassification', '良', 'equals')).toBe('良');
  });
});
