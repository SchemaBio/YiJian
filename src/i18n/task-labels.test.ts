import { expect, it } from 'vitest';
import { locales } from './locales';
import { createTextTranslator } from './text';
import { reportErrorText, taskStageText, taskStatusText } from './task-labels';

it.each(locales)('translates known codes in %s without guessing unknown backend text', locale => {
  const t = createTextTranslator(locale);
  expect(taskStatusText('running', t)).toBe(t('admin.running594249'));
  expect(taskStatusText('custom_status', t)).toBe('custom_status');
  expect(reportErrorText('REPORT_FILE_INVALID', t)).toBe(t('runtime.reportFileInvalid'));
  expect(reportErrorText('NEW_BACKEND_ERROR', t)).toBe('NEW_BACKEND_ERROR');
  const stage = {code:'alignment',label:'Custom workflow stage'};
  expect(taskStageText(stage,'germline-v2-progress-1','germline_trio',t)).toBe(t('runtime.trioAlignment'));
  expect(taskStageText(stage,'custom-profile','germline_trio',t)).toBe(stage.label);
  expect(taskStageText({code:'unknown',label:'患者自定义文本'},'germline-v2-progress-1',undefined,t)).toBe('患者自定义文本');
});
