import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createTextTranslator } from '@/i18n/text';
import { screeningNoteText } from './assessment-display';
import { VariantAssessmentOverview } from '@/app/(main)/tasks/[uuid]/components/VariantAssessmentOverview';
import type { SNVIndel } from '@/app/(main)/tasks/[uuid]/types';

const state = vi.hoisted(() => ({ locale: 'en' as 'en' | 'es-419' | 'zh-Hant' }));
vi.mock('@/components/providers/LocaleProvider', () => ({ useAppLocale: () => state.locale }));
afterEach(cleanup);

it.each(['en', 'es-419', 'zh-Hant'] as const)('localizes overview controls and retains clinical adoption values in %s', locale => {
  state.locale = locale;
  const t = createTextTranslator(locale);
  const adopt = vi.fn();
  const variant = { id: 'demo', clinvarSignificance: 'Pathogenic', adoptedACMG: { source: 'database' }, automaticAcmg: { classification: 'Pathogenic', score: 0, screeningNotes: ['gnomAD：总体 AF=0.000001，东亚 AF=0；稀有', '采用 ClinVar 已知结论作为快速初评参考，不转换为 PP5/BP6 或 ACMG 积分'] } } as SNVIndel;
  const { container } = render(<VariantAssessmentOverview variant={variant} onCalculator={vi.fn()} onAdoptSource={adopt} />);
  expect(screen.getByText(t('assessmentDisplay.manual'))).toBeVisible();
  expect(screen.getAllByText(t('assessmentDisplay.noAI')).length).toBeGreaterThan(0);
  expect(screen.getByText(t('assessmentDisplay.switchHint'))).toBeVisible();
  if (locale !== 'zh-Hant') expect(container.textContent).not.toMatch(/[\u4e00-\u9fff]/);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(t('assessmentDisplay.database')) }));
  expect(adopt).toHaveBeenCalledWith('database', 'Pathogenic');
});

it('preserves arbitrary clinical narrative while translating known screening notes', () => {
  const t = createTextTranslator('en');
  expect(screeningNoteText('患者自述的中文病史', t)).toBe('患者自述的中文病史');
  expect(screeningNoteText('gnomAD：总体 AF=未提供，东亚 AF=0；报告 AF 为 0（不能等同已核验缺失）', t)).toContain('not verified absence');
});
