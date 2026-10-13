import { expect, it } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import { pipelineDisplayName } from './builtin-resources';

it.each(['zh-CN', 'zh-Hant', 'en', 'es-419'] as const)('localizes all four built-in names in %s', locale => {
  const t = createTextTranslator(locale);
  for (const [id, key] of [
    ['builtin-wes-single', 'pipeline.wesSingleSampleAnalysis400a61'],
    ['builtin-wes-family', 'pipeline.wesFamilyAnalysise07024'],
    ['builtin-wes-single-hg38', 'pipeline.wesSingleSampleAnalysisHg188750'],
    ['builtin-wes-family-hg38', 'pipeline.wesFamilyAnalysisHg97410c'],
  ]) {
    expect(pipelineDisplayName(id, 'backend name', t)).toBe(t(key));
  }
});

it('leaves custom pipeline names verbatim even when they match a built-in label', () => {
  expect(pipelineDisplayName('custom', 'WES单样本分析', createTextTranslator('en'))).toBe('WES单样本分析');
});
