import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { CNVExonPlot } from './CNVExonPlot';
import { loadCNR, exonSignals } from '../utils/cnv-signal';
import type { CNVExon } from '../types';

vi.mock('@/components/shared', () => ({ AppModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../utils/cnv-signal', () => ({ loadCNR: vi.fn(), exonSignals: vi.fn() }));
const variant = { gene: 'BRCA1', chromosome: '1', transcript: 'NM_001000' } as CNVExon;
beforeEach(() => { vi.resetAllMocks(); });

it('announces a read failure and restores the chart after retry', async () => {
  vi.mocked(loadCNR).mockRejectedValueOnce(new Error('读取失败')).mockResolvedValueOnce([]);
  vi.mocked(exonSignals).mockReturnValue(new Map([['NM_001000', [
    { exon: '1', start: 10, end: 20, cn: 1, log2: -1, bins: 1 },
  ]]]));
  render(<CNVExonPlot taskId="task" variant={variant} isOpen onClose={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('读取失败');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重新读取' }));
  await screen.findByRole('img', { name: /1 个外显子/ });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(loadCNR).toHaveBeenCalledTimes(2);
});

it('shows missing annotation as a neutral status without inventing a chart', async () => {
  vi.mocked(loadCNR).mockResolvedValue([]);
  vi.mocked(exonSignals).mockReturnValue(new Map());
  render(<CNVExonPlot taskId="task" variant={variant} isOpen onClose={vi.fn()} />);
  await screen.findByText(/CNR 中没有此基因/);
  expect(screen.getByRole('status')).toHaveTextContent('无法绘制逐外显子 CN');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
