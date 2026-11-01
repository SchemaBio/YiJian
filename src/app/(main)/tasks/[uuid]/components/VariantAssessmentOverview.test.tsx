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
