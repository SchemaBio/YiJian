import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { VariantAssessmentOverview } from './VariantAssessmentOverview';
import type { SNVIndel } from '../types';

it('keeps reference and screening Pathogenic visible when AI has insufficient evidence', () => {
  const open = vi.fn();
  const variant = {id:'public-example',gene:'MYH3',chromosome:'17',position:10544634,ref:'C',alt:'T',clinvarSignificance:'Pathogenic',acmgClassification:'Pathogenic',automaticAcmg:{classification:'Pathogenic',profile:'screening',screeningNotes:['ClinVar reference, not scored evidence']}} as SNVIndel;
  render(<VariantAssessmentOverview variant={variant} ai={{feature:'acmg',summary:'More evidence required',suggestedClassification:'insufficient_data',evidence:[{code:'PM2',status:'insufficient_data',reason:'Coverage not established'}]}} onCalculator={open} onInterpretation={vi.fn()} />);
  expect(screen.getByText('数据库参考')).toBeVisible();
  expect(screen.getAllByText('Pathogenic')).toHaveLength(3);
  expect(screen.getByText('证据不足，待补充')).toBeVisible();
  expect(screen.getByText('Coverage not established')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'进入计算器'}));
  expect(open).toHaveBeenCalledTimes(1);
});

it('displays manual reviewer assessment and cleans up AI pending warnings once human confirms data', () => {
  const variant = {
    id: 'confirmed-example',
    gene: 'BRCA1',
    chromosome: '17',
    position: 41276045,
    ref: 'G',
    alt: 'T',
    clinvarSignificance: 'VUS',
    acmgClassification: 'Pathogenic',
    acmgAssessmentSource: 'manual_evidence',
    acmgEvidence: [{ code: 'PVS1', strength: 'very_strong', source: 'manual' }, { code: 'PM2', strength: 'moderate', source: 'manual' }],
    automaticAcmg: { classification: 'VUS', score: 0, profile: 'screening', screeningNotes: ['自动初评基线'] },
  } as SNVIndel;

  render(
    <VariantAssessmentOverview
      variant={variant}
      ai={{
        feature: 'acmg',
        summary: 'AI 辅助历史草案',
        suggestedClassification: 'insufficient_data',
        evidence: [{ code: 'PM2', status: 'insufficient_data', reason: 'Coverage not established' }],
      }}
      onCalculator={vi.fn()}
      onInterpretation={vi.fn()}
    />
  );

  // 验证四轨与决策条
  expect(screen.getByText('数据库参考')).toBeVisible();
  expect(screen.getByText('本地快速初评')).toBeVisible();
  expect(screen.getByText('AI 证据建议')).toBeVisible();
  expect(screen.getAllByText('人工评估').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('已完成人工复核并转入正式评估')).toBeVisible();

  // 关键验证：数据确认后，AI 的缺失条目与差异警告绝不污染总览
  expect(screen.queryByText('Coverage not established')).not.toBeInTheDocument();
  expect(screen.queryByText(/已有参考结论仍然保留/)).not.toBeInTheDocument();
});

it('supports 4-card selection and displays 缺失 instead of . or -', () => {
  const adopt = vi.fn();
  const emptyVariant = {
    id: 'empty-example',
    gene: 'TP53',
    chromosome: '17',
    position: 7578406,
    ref: 'C',
    alt: 'T',
    clinvarSignificance: '.',
    clinvarDisease: '-',
    automaticAcmg: { classification: 'Likely_Pathogenic', score: 6, profile: 'screening' },
  } as SNVIndel;

  render(
    <VariantAssessmentOverview
      variant={emptyVariant}
      onCalculator={vi.fn()}
      onInterpretation={vi.fn()}
      onAdoptSource={adopt}
    />
  );

  // 数据库参考为 . 时显示“缺失”
  expect(screen.getAllByText('缺失').length).toBeGreaterThanOrEqual(1);
  expect(screen.queryByText(/^\.$/)).not.toBeInTheDocument();

  // 默认采用本地快速初评
  expect(screen.getAllByText('本地快速初评').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('Likely Pathogenic').length).toBeGreaterThanOrEqual(1);

  // 点击“人工评估”卡片进行切换
  fireEvent.click(screen.getByRole('button', { name: /人工评估/ }));
  expect(adopt).toHaveBeenCalledWith('manual', undefined);
});
