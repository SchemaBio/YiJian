import { expect, it } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import { igvDisplayText, localizeIGVNavigation } from './igv-display';

it.each([
  ['en', 'Proband BAM', 'Joint variant VCF', 'Target regions BED'],
  ['zh-Hant', '先證者 BAM', '聯合變異 VCF', '目標區域 BED'],
  ['es-419', 'BAM del caso índice', 'VCF de variantes conjuntas', 'BED de regiones objetivo'],
] as const)('localizes standard track labels in %s and preserves sample-defined names', (locale, bam, vcf, bed) => {
  const t = createTextTranslator(locale);
  expect(igvDisplayText('先证者 BAM', t)).toBe(bam);
  expect(igvDisplayText('联合变异 VCF', t)).toBe(vcf);
  expect(igvDisplayText('目标区域 BED', t)).toBe(bed);
  expect(igvDisplayText('患者自定义 BAM', t)).toBe('患者自定义 BAM');
  expect(igvDisplayText('BAM 索引缺失', t)).toBe(t('igvDisplay.bamIndex'));
});

it('translates IGV navigation controls without changing track content', () => {
  const container = document.createElement('div');
  container.innerHTML = '<div class="igv-navbar"><div class="igv-navbar-button">cursor guide</div><div class="igv-navbar-button">Sample Names</div></div><div>Sample Names</div>';
  localizeIGVNavigation(container, createTextTranslator('zh-CN'));
  expect(container.querySelector('.igv-navbar-button')).toHaveTextContent('光标引导线');
  expect(container.querySelectorAll('.igv-navbar-button')[1]).toHaveAttribute('aria-label', '样本名称');
  expect(container.lastElementChild).toHaveTextContent('Sample Names');
});
