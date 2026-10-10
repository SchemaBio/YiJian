import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CNVDetailPanel } from './CNVDetailPanel';
import type { CNVSegment } from '../types';
import { getResultRowAdjustmentHistory } from '../result-api';
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('./CNVRegionPlot', () => ({ CNVRegionPlot: () => null }));
vi.mock('./CNVExonPlot', () => ({ CNVExonPlot: () => null }));
vi.mock('../result-api', () => ({ getResultRowAdjustmentHistory: vi.fn().mockResolvedValue([]) }));
const variant: CNVSegment = { id: 'A', chromosome: '1', startPosition: 100, endPosition: 200, length: 100, type: 'Deletion', copyNumber: 1, copyRatio: 0.5, log2Ratio: -1, genes: ['GENE'], confidence: null, pinned: false, reviewed: false, reported: false, interpretation: '旧解读' };

describe('CNV interpretation tabs', () => {
  it('retains a draft across tabs, shows history and saves through the existing callback', async () => {
    vi.mocked(getResultRowAdjustmentHistory).mockResolvedValue([{ id: 'event', actor: '医生', createdAt: '', before: { interpretation: '旧解读' }, after: { interpretation: '新解读' }, reason: '人工核验' }]);
    const save = vi.fn().mockResolvedValue(undefined);
    render(<CNVDetailPanel taskId="task" variantType="segment" variant={variant} isOpen onClose={vi.fn()} onSaveInterpretation={save} />);
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['注释', '证据', '评定', '人工解读', '变更记录']);
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    const editor = screen.getByRole('textbox', { name: 'CNV 人工解读' });
    fireEvent.change(editor, { target: { value: '待复核的 CNV 解读' } });
    fireEvent.click(screen.getByRole('tab', { name: '变更记录' }));
    expect(await screen.findByText('人工核验')).toBeVisible();
    expect(getResultRowAdjustmentHistory).toHaveBeenCalledWith('task', 'cnv-segment', 'A', expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('tab', { name: '人工解读' }));
    expect(editor).toHaveValue('待复核的 CNV 解读');
    fireEvent.click(screen.getByRole('button', { name: '保存人工解读' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(variant, '待复核的 CNV 解读'));
  });
});
