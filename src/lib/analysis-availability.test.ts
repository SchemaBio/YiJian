import { expect, it } from 'vitest';
import { isFamilyAnalysis } from './analysis-availability';
import { createTextTranslator } from '@/i18n/text';

it('recognizes builtins, organization family pipelines and historical task templates', () => {
  for (const value of [{id:'builtin-wes-family'},{id:'builtin-wes-family-hg38'},{id:'custom',baseType:'wes_family'},{template:'trio'},{template:'germline_trio'}]) {
    expect(isFamilyAnalysis(value)).toBe(true);
  }
  for (const value of [{id:'builtin-wes-single'},{baseType:'vcf_annotation'},{template:'vcf2anno'},{template:'baseline_fix'}]) {
    expect(isFamilyAnalysis(value)).toBe(false);
  }
});

it.each(['zh-CN','zh-Hant','en','es-419'] as const)('localizes unavailable family analysis in %s', locale => {
  expect(createTextTranslator(locale)('familyAnalysis.unavailable')).not.toBe('familyAnalysis.unavailable');
});
