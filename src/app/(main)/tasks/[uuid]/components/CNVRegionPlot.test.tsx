import * as React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CNVRegionPlot } from './CNVRegionPlot';
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
