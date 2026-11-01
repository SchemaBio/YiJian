import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CNVDetailPanel } from './CNVDetailPanel';
import type { CNVSegment } from '../types';
import { getResultRowAdjustmentHistory } from '../result-api';

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('./CNVRegionPlot', () => ({
  CNVRegionPlot: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <button onClick={onClose}>测试关闭区域图</button> : null,
}));
vi.mock('./CNVExonPlot', () => ({
  CNVExonPlot: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <button onClick={onClose}>测试关闭外显子图</button> : null,
}));
vi.mock('../result-api', () => ({ getResultRowAdjustmentHistory: vi.fn().mockResolvedValue([]) }));

const variant: CNVSegment = {
  id: 'A',
  chromosome: '1',
  startPosition: 100,
  endPosition: 200,
  length: 100,
  type: 'Deletion',
  copyNumber: 1,
  copyRatio: 0.5,
  log2Ratio: -1,
  genes: ['GENE'],
  confidence: null,
  pinned: false,
  reviewed: false,
  focused: false,
  interpretation: '旧解读',
};

describe('CNV interpretation tabs', () => {
  it('opens the plot with the inspector, preserves it when the inspector closes, and allows reopening', () => {
    const props = { taskId: 'task', variantType: 'segment' as const, variant, isOpen: true, onClose: vi.fn() };
    const view = render(<CNVDetailPanel {...props} />);
    expect(screen.getByRole('button', { name: '测试关闭区域图' })).toBeInTheDocument();
    const open = screen.getByRole('button', { name: '区域信号图' });
    expect(open).toHaveTextContent('区域信号图');
    expect(open.querySelector('svg')).not.toBeNull();
    const close = screen.getByRole('button', { name: '关闭' });
    expect(open.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '测试关闭区域图' }));
    expect(screen.queryByRole('button', { name: '测试关闭区域图' })).not.toBeInTheDocument();
    fireEvent.click(open);
    view.rerender(<CNVDetailPanel {...props} isOpen={false} />);
    expect(screen.getByRole('button', { name: '测试关闭区域图' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '变异详情' })).not.toBeInTheDocument();
  });

  it('renders all 7 tabs and supports manual interpretation saving and history viewing', async () => {
    vi.mocked(getResultRowAdjustmentHistory).mockResolvedValue([
      { id: 'event', actor: '医生', createdAt: '', before: { interpretation: '旧解读' }, after: { interpretation: '新解读' }, reason: '人工核验' },
    ]);
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <CNVDetailPanel
        taskId="task"
        variantType="segment"
        variant={variant}
        isOpen
        onClose={vi.fn()}
        onSaveInterpretation={save}
      />
    );

    // Verify 7 tabs
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      '评估总览',
      '注释',
      '证据',
      'AI评估',
      'ClinGen评估',
      '人工解读',
      '变更记录',
    ]);

    // Go to manual interpretation tab
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    const editor = screen.getByRole('textbox', { name: 'CNV 人工解读' });
    fireEvent.change(editor, { target: { value: '待复核的 CNV 解读' } });

    // Go to history tab
    fireEvent.click(screen.getByRole('tab', { name: '变更记录' }));
    expect(await screen.findByText('人工核验')).toBeVisible();
    expect(getResultRowAdjustmentHistory).toHaveBeenCalledWith('task', 'cnv-segment', 'A', expect.any(AbortSignal));

    // Return to interpretation tab and save
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    expect(editor).toHaveValue('待复核的 CNV 解读');
    fireEvent.click(screen.getByRole('button', { name: '保存人工解读' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(variant, '待复核的 CNV 解读'));
  });

  it('navigates directly to ClinGen assessment when initialSection is clingen', () => {
    render(
      <CNVDetailPanel
        taskId="task"
        variantType="segment"
        variant={variant}
        isOpen
        onClose={vi.fn()}
        initialSection="clingen"
      />
    );

    const clingenTab = screen.getByRole('tab', { name: 'ClinGen评估' });
    expect(clingenTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByText(/Section 1/).length).toBeGreaterThan(0);
  });

  it('switches to ClinGen tab when clicking Enter ClinGen button from overview', () => {
    render(
      <CNVDetailPanel
        taskId="task"
        variantType="segment"
        variant={variant}
        isOpen
        onClose={vi.fn()}
      />
    );

    // Default tab is overview
    const overviewTab = screen.getByRole('tab', { name: '评估总览' });
    expect(overviewTab).toHaveAttribute('aria-selected', 'true');

    // Click "进入ClinGen评估 →"
    const enterButton = screen.getByRole('button', { name: /进入ClinGen评估/ });
    fireEvent.click(enterButton);

    const clingenTab = screen.getByRole('tab', { name: 'ClinGen评估' });
    expect(clingenTab).toHaveAttribute('aria-selected', 'true');
  });

  it('allows four-way adoption switching from overview cards', async () => {
    const onSaveVersioned = vi.fn().mockResolvedValue(undefined);
    render(
      <CNVDetailPanel
        taskId="task"
        variantType="segment"
        variant={variant}
        isOpen
        onClose={vi.fn()}
        onSaveVersionedAssessment={onSaveVersioned}
      />
    );

    // Click quick baseline card
    const quickCard = screen.getByRole('button', { name: '选择本地快速初评采用' });
    fireEvent.click(quickCard);

    await waitFor(() => {
      expect(onSaveVersioned).toHaveBeenCalledWith(
        variant,
        expect.objectContaining({
          adoptedCNV: expect.objectContaining({ source: 'quick' }),
        }),
        expect.stringContaining('本地快速初评')
      );
    });
  });
});
