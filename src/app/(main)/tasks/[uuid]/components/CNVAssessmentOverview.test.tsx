import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CNVAssessmentOverview } from './CNVAssessmentOverview';
import type { CNVSegment, CNVAssessment } from '../types';
import type { AIAssistanceResult } from '@/lib/ai-assistance';

const mockVariant: CNVSegment = {
  id: 'seg-1',
  chromosome: '1',
  startPosition: 1000,
  endPosition: 2000,
  length: 1000,
  type: 'Deletion',
  copyNumber: 1,
  copyRatio: 0.5,
  log2Ratio: -1.0,
  genes: ['TEST1'],
  confidence: null,
  pinned: false,
  reviewed: false,
  focused: false,
  automaticAssessment: {
    state: 'evaluated',
    score: 0.9,
    profile: 'cnv_loss_2020',
    criteria: [{ code: '1A', strength: 'standalone', source: 'rule', note: '' }],
    pending: [],
    classification: 'Likely_Pathogenic',
  } as any,
};

const mockAssessment: CNVAssessment = {
  id: 'assess-1',
  cnvId: 'seg-1',
  cnvType: 'Deletion',
  totalScore: 1.0,
  classification: 'Pathogenic',
  sectionScores: {
    section1: 0,
    section2: 1.0,
    section3: 0,
    section4: 0,
    section5: 0,
  },
  criteria: {} as any,
  isAutoCalculated: false,
  isUserModified: true,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

describe('CNVAssessmentOverview', () => {
  it('renders all four comparison cards correctly', () => {
    const onClingen = vi.fn();
    const onAdoptSource = vi.fn();

    render(
      <CNVAssessmentOverview
        variant={mockVariant}
        assessment={mockAssessment}
        onClingen={onClingen}
        onAdoptSource={onAdoptSource}
      />
    );

    // 4 cards headings
    expect(screen.getByText('数据库参考')).toBeInTheDocument();
    expect(screen.getAllByText('本地快速初评').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/AI.*证据建议/)).toBeInTheDocument();
    expect(screen.getAllByText('ClinGen评估').length).toBeGreaterThanOrEqual(1);

    // Database card missing fallback
    expect(screen.getByText('暂无可引用的数据库直接致病性结论')).toBeInTheDocument();

    // Quick evaluation shows Likely Pathogenic
    expect(screen.getAllByText('可能致病').length).toBeGreaterThan(0);
    expect(screen.getByText(/依据: 1A/)).toBeInTheDocument();

    // ClinGen card shows Pathogenic
    expect(screen.getAllByText('致病').length).toBeGreaterThan(0);
  });

  it('triggers onClingen when clicking calculator buttons', () => {
    const onClingen = vi.fn();
    render(
      <CNVAssessmentOverview
        variant={mockVariant}
        assessment={mockAssessment}
        onClingen={onClingen}
      />
    );

    const buttons = screen.getAllByRole('button', { name: /ClinGen评估/ });
    fireEvent.click(buttons[0]);
    expect(onClingen).toHaveBeenCalled();
  });

  it('triggers onAdoptSource when clicking cards', () => {
    const onAdoptSource = vi.fn();
    render(
      <CNVAssessmentOverview
        variant={mockVariant}
        assessment={mockAssessment}
        onClingen={vi.fn()}
        onAdoptSource={onAdoptSource}
      />
    );

    // Click quick baseline card
    const quickCard = screen.getByRole('button', { name: '选择本地快速初评采用' });
    fireEvent.click(quickCard);
    expect(onAdoptSource).toHaveBeenCalledWith('quick', 'Likely_Pathogenic');

    // Click clingen card
    const clingenCard = screen.getByRole('button', { name: '选择ClinGen评估采用' });
    fireEvent.click(clingenCard);
    expect(onAdoptSource).toHaveBeenCalledWith('clingen', 'Pathogenic');
  });

  it('displays AI clauses cleanly when AI result is provided', () => {
    const aiResult: AIAssistanceResult = {
      requestId: 'req-123',
      variantId: 'seg-1',
      feature: 'cnv_loss',
      summary: 'CNV proposal',
      suggestedClassification: 'Pathogenic',
      agentProposal: {
        ai_assessment: {
          criteria: [
            { code: '1A', status: 'verified', score_hundredths: 0 },
            { code: '2E', status: 'verified', score_hundredths: 90 },
            { code: '3A', status: 'insufficient_data' }, // Should be excluded from summary
          ],
        },
      },
    };

    render(
      <CNVAssessmentOverview
        variant={mockVariant}
        ai={aiResult}
        onClingen={vi.fn()}
      />
    );

    // AI card displays conclusion and only valid evidence items
    expect(screen.getByText('依据: 1A, 2E')).toBeInTheDocument();
    expect(screen.queryByText(/3A/)).not.toBeInTheDocument();
  });
});
