import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VariantDetailPanel } from './VariantDetailPanel';
import type { SNVIndel } from '../types';

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('../result-api', async importOriginal => ({
  ...await importOriginal<typeof import('../result-api')>(),
  getResultRowAdjustmentHistory: vi.fn().mockResolvedValue([]),
}));

const variant = (id: string) => ({ id, gene: id, chromosome: '1', position: 100,
  ref: 'A', alt: 'G', variantType: 'SNV', zygosity: 'Heterozygous', pinned: false, reviewed: false, alleleFrequency: 0.5, depth: 100,
  transcript: 'NM_001000', hgvsc: 'c.1A>G', hgvsp: 'p.(Lys1Arg)', consequence: 'missense_variant',
  reported: false, interpretation: '', acmgCriteria: [], annotationValues: {},
}) as SNVIndel;

describe('same-screen interpretation', () => {
  it('retains an interpretation draft when visiting evidence and returning', async () => {
    render(<VariantDetailPanel taskId="task" variant={variant('A')} isOpen onClose={vi.fn()} onSaveInterpretation={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '评定' }));
    const editor = screen.getByPlaceholderText('请输入您对该变异的解读分析...');
    fireEvent.change(editor, { target: { value: '待复核的解读' } });
    fireEvent.click(screen.getByRole('tab', { name: '证据' }));
    expect(editor).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: '评定' }));
    expect(editor).toBeVisible();
    expect(editor).toHaveValue('待复核的解读');
    await waitFor(() => expect(screen.getByText('暂无调整记录')).toBeInTheDocument());
  });

  it('does not clear another variant’s reason when an earlier save completes', async () => {
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const props = { taskId: 'task', isOpen: true, onClose: vi.fn(), onSaveInterpretation: save };
    const { rerender } = render(<VariantDetailPanel {...props} variant={variant('A')} />);
    fireEvent.click(screen.getByRole('tab', { name: '评定' }));
    fireEvent.change(screen.getByPlaceholderText('请输入您对该变异的解读分析...'), { target: { value: 'A 解读' } });
    fireEvent.change(screen.getByPlaceholderText('本次调整理由（保存时必填）'), { target: { value: 'A 理由' } });
    fireEvent.click(screen.getByRole('button', { name: '保存人工解读' }));
    expect(save).toHaveBeenCalled();
    rerender(<VariantDetailPanel {...props} variant={variant('B')} />);
    fireEvent.click(screen.getByRole('tab', { name: '评定' }));
    const reason = screen.getByPlaceholderText('本次调整理由（保存时必填）');
    fireEvent.change(reason, { target: { value: 'B 理由' } });
    finish();
    await waitFor(() => expect(reason).toHaveValue('B 理由'));
  });
});
