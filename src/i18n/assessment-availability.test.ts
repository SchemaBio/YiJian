import { expect, it } from 'vitest';
import { locales } from './locales';
import { createTextTranslator } from './text';

const notices = [
  ['本地证据包未发布；疾病、表型及家系规则不会推断缺失证据', 'evidencePackUnavailable'],
  ['归档尚未提供经核验的 GQ、亲缘及相位证据；相关家系条款保持未选', 'familyProofsUnavailable'],
  ['当前归档没有先证者 GQ；依赖家系质量的候选及 ACMG 家系证据保持未选', 'probandGQUnavailable'],
  ['STR 疾病阈值包未配置；不会根据报告中的未核验阈值自动置顶', 'strThresholdsUnavailable'],
  ['印记区域证据包未配置；UPD 规则保持证据不足', 'imprintingEvidenceUnavailable'],
];

it.each(locales)('translates saved assessment availability notices in %s', locale => {
  const t = createTextTranslator(locale);
  for (const [saved, key] of notices) {
    expect(t(saved)).toBe(t(`assessmentAvailability.${key}`));
    if (locale !== 'zh-CN') expect(t(saved)).not.toBe(saved);
    if (locale === 'en' || locale === 'es-419') expect(t(saved)).not.toMatch(/[\u4e00-\u9fff]/);
  }
  expect(t('Patient-specific evidence text')).toBe('Patient-specific evidence text');
});
