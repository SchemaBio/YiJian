import * as React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CNVRegionPlot } from './CNVRegionPlot';
import { getCNVSegments } from '../result-api';
import type { CNVSegment } from '../types';

vi.mock('@schema/ui-kit', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/components/shared', () => ({
  AppModal: ({ children }: { children: React.ReactNode }) => {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => { const timer = setTimeout(() => setMounted(true), 50); return () => clearTimeout(timer); }, []);
    return mounted ? <div>{children}</div> : null;
  },
}));
vi.mock('../result-api', () => ({ getCNVSegments: vi.fn(async () => ({ data: [segment], total: 1, version: 'fixture' })) }));
vi.mock('../utils/cnv-signal', () => ({ loadCNR: vi.fn(async () => []), normalizeContig: (value: string) => value }));
const segment: CNVSegment = { id: 'region', chromosome: '1', startPosition: 100000, endPosition: 150000, length: 50000, type: 'Deletion', copyNumber: 1, copyRatio: 0.5, log2Ratio: -1, genes: [], confidence: null, pinned: false, reported: false, reviewed: false };

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('draws and observes the canvas when the modal mounts after data has loaded', async () => {
  vi.useFakeTimers();
  const observe = vi.fn(), disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect = disconnect; });
  const context = Object.fromEntries(['scale', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText', 'setLineDash', 'save', 'rect', 'clip', 'arc', 'fill', 'restore'].map(key => [key, vi.fn()]));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const props = { taskId: 'task', variant: segment, isOpen: true, onClose: vi.fn() };
  const view = render(<CNVRegionPlot {...props} />);
  await act(async () => {});
  expect(context.stroke).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  expect(view.container.querySelector('canvas')).not.toBeNull();
  expect(context.stroke).toHaveBeenCalled();
  expect(observe).toHaveBeenCalledWith(view.container.querySelector('canvas')?.parentElement);
  view.rerender(<CNVRegionPlot {...props} isOpen={false} />);
  expect(disconnect).toHaveBeenCalled();
});

it('distinguishes an empty window from a failed query and supports retry', async () => {
  vi.mocked(getCNVSegments).mockRejectedValueOnce(new Error('区域读取失败')).mockResolvedValueOnce({ data: [], total: 0, version: 'fixture', page: 1, pageSize: 200 });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  render(<CNVRegionPlot taskId="task" variant={segment} isOpen onClose={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('区域读取失败');
  expect(screen.queryByText('当前窗口没有可绘制的 Region 或 CNR 信号')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByText('当前窗口没有可绘制的 Region 或 CNR 信号');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(document.querySelector('canvas')).toBeNull();
});
