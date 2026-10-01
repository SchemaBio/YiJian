import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import igv from 'igv/dist/igv.esm.js';
import { IGVViewer } from './IGVViewer';
import type { IGVSession } from '../types';

vi.mock('igv/dist/igv.esm.js', () => ({ default: { createBrowser: vi.fn(), removeBrowser: vi.fn() } }));
vi.mock('@schema/ui-kit', () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/shared', () => ({ AppModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../result-api', () => ({ getIGVSession: vi.fn(), getIGVTrackURLs: vi.fn() }));

const session: IGVSession = { taskUuid: 'task', executionAttemptId: 'attempt', version: 'version', available: true, reference: { available: true, id: 'hg19', fastaURL: '/reference.fa', indexURL: '/reference.fa.fai' }, tracks: [] };
const props = { taskId: 'task', chromosome: '1', position: 10, isOpen: true, onClose: vi.fn(), session };

describe('IGV browser lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses official removal on close and reuses the browser for locus changes', async () => {
    const browser = { search: vi.fn().mockResolvedValue(undefined), loadTrack: vi.fn(), dispose: vi.fn(), toSVG: vi.fn(), removeTrackByName: vi.fn() };
    vi.mocked(igv.createBrowser).mockResolvedValue(browser);
    const view = render(<IGVViewer {...props} />);
    await waitFor(() => expect(igv.createBrowser).toHaveBeenCalledTimes(1));
    await act(async () => {});
    view.rerender(<IGVViewer {...props} position={20} />);
    await waitFor(() => expect(browser.search).toHaveBeenCalled());
    expect(igv.createBrowser).toHaveBeenCalledTimes(1);
    view.rerender(<IGVViewer {...props} isOpen={false} />);
    expect(igv.removeBrowser).toHaveBeenCalledTimes(1);
    expect(igv.removeBrowser).toHaveBeenCalledWith(browser);
    expect(browser.dispose).not.toHaveBeenCalled();
  });
  it('removes a late initialization after unmount exactly once', async () => {
    let resolve!: (browser: import('igv').IGVBrowser) => void;
    const browser = { search: vi.fn(), loadTrack: vi.fn(), dispose: vi.fn(), toSVG: vi.fn(), removeTrackByName: vi.fn() };
    vi.mocked(igv.createBrowser).mockReturnValue(new Promise(value => { resolve = value; }));
    const view = render(<IGVViewer {...props} />);
    await waitFor(() => expect(igv.createBrowser).toHaveBeenCalled());
    view.unmount();
    await act(async () => resolve(browser));
    expect(igv.removeBrowser).toHaveBeenCalledTimes(1);
    expect(igv.removeBrowser).toHaveBeenCalledWith(browser);
    expect(browser.loadTrack).not.toHaveBeenCalled();
  });
});
