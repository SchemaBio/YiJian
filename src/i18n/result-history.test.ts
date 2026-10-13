import { expect, it } from 'vitest';
import { createTextTranslator } from './text';
import { locales } from './locales';
import { resultHistoryReason } from './result-history';
import { formatPopulationFrequency } from '@/app/(main)/tasks/[uuid]/utils/snv-annotations';

it.each(locales)('localizes missing frequencies and fixed historical reasons in %s', locale => {
  const t = createTextTranslator(locale);
  expect(formatPopulationFrequency(undefined, t)).toBe(t('history.notProvided071fb2'));
  expect(formatPopulationFrequency('0&.&2', t)).toBe(`0 & ${t('history.notProvided071fb2')} & ${t('history.notProvided071fb2')}`);
  expect(resultHistoryReason('手动置顶', t)).toBe(t('display.pinManually095c04'));
  expect(resultHistoryReason('取消置顶', t)).toBe(t('tasks.unpincfb5cd'));
  expect(resultHistoryReason('更新复核状态', t)).toBe(t('display.updateReviewStatus0720c7'));
  expect(resultHistoryReason(undefined, t)).toBe(t('tasks.noReasonProvidedcb9c56'));
  expect(resultHistoryReason('手动置顶，因为该位点与患者表型相关', t)).toBe('手动置顶，因为该位点与患者表型相关');
});
