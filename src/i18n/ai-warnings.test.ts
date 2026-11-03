import { expect, it } from 'vitest';
import { locales } from './locales';
import { createTextTranslator } from './text';
import { aiWarningsForDisplay } from './ai-warnings';

const literature = '外部文献检索不可用，以下建议未完成文献核验；不可将检索失败理解为没有相关证据。';
const adoption = '模型建议、规则结果与人工判定分别保存；本结果尚未由人工采纳。';

it.each(locales)('localizes fixed AI warnings in %s while preserving model text', locale => {
  const t = createTextTranslator(locale);
  expect(aiWarningsForDisplay([literature, adoption, 'Patient-specific text'], t))
    .toEqual([t('assistance.aiResultNotAdoptedWarning'), 'Patient-specific text']);
  if (locale !== 'zh-CN') {
    expect(aiWarningsForDisplay([adoption], t)[0]).not.toBe(adoption);
  }
});
