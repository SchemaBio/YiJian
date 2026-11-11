import { expect, it } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import { pipelineDisplayName } from './builtin-resources';
import { normalizeTask, normalizeTaskDetail } from './tasks';

it.each(['zh-CN', 'zh-Hant', 'en', 'es-419'] as const)('localizes all four built-in names in %s', locale => {
  const t = createTextTranslator(locale);
  for (const [id, key] of [
    ['builtin-wes-single', 'pipeline.wesSingleSampleAnalysis400a61'],
    ['builtin-wes-family', 'pipeline.wesFamilyAnalysise07024'],
    ['builtin-wes-single-hg19', 'pipeline.wesSingleSampleAnalysis400a61'],
    ['builtin-wes-family-hg19', 'pipeline.wesFamilyAnalysise07024'],
    ['builtin-wes-single-hg38', 'pipeline.wesSingleSampleAnalysisHg188750'],
    ['builtin-wes-family-hg38', 'pipeline.wesFamilyAnalysisHg97410c'],
  ]) {
    expect(pipelineDisplayName(id, 'backend name', t)).toBe(id.endsWith('hg38')?t(key):t(key)+'_hg19');
  }
});

it('uses saved pipeline identities for existing tasks while preserving custom names', () => {
  const t = createTextTranslator('en');
  const raw = {pipelineId:'builtin-wes-single-hg19', pipeline:'WES单样本分析_hg19', name:'WES单样本分析_hg19'};
  const list = normalizeTask(raw);
  const detail = normalizeTaskDetail(raw);
  expect(pipelineDisplayName(list.pipelineId!, list.pipeline, t)).toBe('WES single-sample analysis_hg19');
  expect(pipelineDisplayName(list.pipelineId!, list.name || list.pipeline, t)).toBe('WES single-sample analysis_hg19');
  expect(pipelineDisplayName(detail.pipelineId!, detail.pipeline, t)).toBe('WES single-sample analysis_hg19');
  expect(pipelineDisplayName(detail.pipelineId!, detail.name, t)).toBe('WES single-sample analysis_hg19');
  const custom = normalizeTask({pipelineId:'custom-uuid',pipeline:raw.pipeline, name:raw.name});
  expect(pipelineDisplayName(custom.pipelineId!,custom.pipeline,t)).toBe(raw.pipeline);
  expect(pipelineDisplayName(custom.pipelineId!,custom.name || custom.pipeline,t)).toBe(raw.name);
  expect(pipelineDisplayName('',raw.pipeline,t)).toBe(raw.pipeline);
});

it('leaves custom pipeline names verbatim even when they match a built-in label', () => {
  expect(pipelineDisplayName('custom', 'WES单样本分析', createTextTranslator('en'))).toBe('WES单样本分析');
});

it('localizes the CNV calibration workflow in task lists and preserves user task names', () => {
  const t = createTextTranslator('en');
  const raw = {template:'baseline_fix', pipeline:'CNV 基线校正流程', name:'CNV 基线校正流程'};
  const task = normalizeTask(raw);
  expect(pipelineDisplayName('', task.pipeline, t, task.template)).toBe('CNV baseline calibration workflow');
  expect(pipelineDisplayName('', task.name || task.pipeline, t, task.template)).toBe('CNV baseline calibration workflow');
  const detail = normalizeTaskDetail(raw);
  expect(pipelineDisplayName('', detail.name || detail.pipeline, t, detail.template)).toBe('CNV baseline calibration workflow');
  expect(pipelineDisplayName('', 'My baseline', t, task.template)).toBe('My baseline');
  expect(pipelineDisplayName('custom', task.pipeline, t)).toBe(task.pipeline);
});
