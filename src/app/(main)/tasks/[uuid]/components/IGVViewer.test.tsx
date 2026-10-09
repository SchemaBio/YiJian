import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import igv from 'igv/dist/igv.esm.js';
import { IGVViewer, PositionLink } from './IGVViewer';
import { getIGVSnapshot, saveIGVSnapshot } from '../result-api';
import { igvSVGToPNG } from '@/lib/igv-snapshot';
import type { IGVSession } from '../types';

vi.mock('igv/dist/igv.esm.js', () => ({ default: { createBrowser: vi.fn(), removeBrowser: vi.fn() } }));
vi.mock('@schema/ui-kit', () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/shared', () => ({ AppModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../result-api', () => ({ getIGVSession: vi.fn(), getIGVTrackURLs: vi.fn(), getIGVSnapshot: vi.fn(), saveIGVSnapshot: vi.fn() }));

vi.mock('@/lib/igv-snapshot', () => ({ igvSVGToPNG: vi.fn() }));
beforeEach(() => { vi.mocked(getIGVSnapshot).mockResolvedValue({ available: false }); });

const session: IGVSession = { taskUuid: 'task', executionAttemptId: 'attempt', version: 'version', available: true, reference: { available: true, id: 'hg19', fastaURL: '/reference.fa', indexURL: '/reference.fa.fai' }, tracks: [] };
const props = { taskId: 'task', chromosome: '1', position: 10, isOpen: true, onClose: vi.fn(), session };

describe('IGV browser lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses official removal on close and reuses the browser for locus changes', async () => {
    const browser = { search: vi.fn().mockResolvedValue(undefined), loadTrack: vi.fn(), dispose: vi.fn(), toSVG: vi.fn(), removeTrackByName: vi.fn(), updateViews: vi.fn().mockResolvedValue(undefined), currentLoci: vi.fn().mockReturnValue("chr1:1-110") };
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
    const browser = { search: vi.fn(), loadTrack: vi.fn(), dispose: vi.fn(), toSVG: vi.fn(), removeTrackByName: vi.fn(), updateViews: vi.fn().mockResolvedValue(undefined), currentLoci: vi.fn().mockReturnValue("chr1:1-110") };
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

beforeEach(() => vi.clearAllMocks());

it('opens coordinate evidence without also activating the table row', () => {
  const onRow = vi.fn(), onCoordinate = vi.fn();
  render(<div onClick={onRow}><PositionLink chromosome="1" position={10} onClick={onCoordinate} /></div>);
  fireEvent.click(screen.getByRole('button', { name: '1:10' }));
  expect(onCoordinate).toHaveBeenCalledWith('1', 10);
  expect(onRow).not.toHaveBeenCalled();
});
it('hides the empty canvas after initialization fails and restores it on retry', async () => {
  const browser = { search: vi.fn().mockResolvedValue(undefined), loadTrack: vi.fn(), dispose: vi.fn(), toSVG: vi.fn(), removeTrackByName: vi.fn(), updateViews: vi.fn().mockResolvedValue(undefined), currentLoci: vi.fn().mockReturnValue("chr1:1-110") };
  vi.mocked(igv.createBrowser).mockRejectedValueOnce(new Error('参考序列读取失败')).mockResolvedValueOnce(browser);
  const view = render(<IGVViewer {...props} />);
  await screen.findByRole('alert');
  expect(view.container.querySelector('.hidden')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /刷新证据/ }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  await waitFor(() => expect(view.container.querySelector('.hidden')).toBeNull());
  expect(igv.createBrowser).toHaveBeenCalledTimes(2);
});

const bam = { id: 'bam', name: '样本 BAM', type: 'alignment', format: 'bam', available: true, hasIndex: true };
const expired = { ...session, tracks: [{ ...bam, available: false, reason: 'BAM 已超过任务完成后 7 天保留期限，无法复核 reads。' }] };

it('shows saved evidence after BAM expiration without creating a live browser', async () => {
  vi.mocked(getIGVSnapshot).mockResolvedValue({ available: true, url: '/saved.png', reference: 'hg19', createdAt: '2026-10-09T00:00:00Z' });
  render(<IGVViewer {...props} session={expired} />);
  expect(await screen.findByRole('img', { name: /IGV 历史截图/ })).toHaveAttribute('src', '/saved.png');
  expect(screen.getByText(/这是 BAM 保留期间保存的截图/)).toBeInTheDocument();
  expect(igv.createBrowser).not.toHaveBeenCalled();
});

it('retains the BAM retention message when no screenshot exists', async () => {
  render(<IGVViewer {...props} session={expired} />);
  await waitFor(() => expect(getIGVSnapshot).toHaveBeenCalled());
  expect(screen.getByText(/BAM 已超过任务完成后 7 天保留期限/)).toBeInTheDocument();
  expect(screen.queryByRole('img')).toBeNull();
});

it('captures rendered BAM once and does not replace an existing screenshot', async () => {
  const browser = { search: vi.fn().mockResolvedValue(undefined), loadTrack: vi.fn().mockResolvedValue({}), dispose: vi.fn(), toSVG: vi.fn().mockReturnValue('<svg/>'), removeTrackByName: vi.fn(), updateViews: vi.fn().mockResolvedValue(undefined), currentLoci: vi.fn().mockReturnValue('chr1:1-110') };
  vi.mocked(igv.createBrowser).mockResolvedValue(browser);
  const image = new Blob(['png'], { type: 'image/png' });
  vi.mocked(igvSVGToPNG).mockResolvedValue(image);
  vi.mocked(saveIGVSnapshot).mockResolvedValue({ available: true, url: '/saved.png' });
  const view = render(<IGVViewer {...props} session={{ ...session, tracks: [bam] }} />);
  await waitFor(() => expect(saveIGVSnapshot).toHaveBeenCalledTimes(1));
  expect(saveIGVSnapshot).toHaveBeenCalledWith('task', 'chr1:1-110', 'version', image);
  expect(browser.loadTrack).toHaveBeenCalledWith(expect.objectContaining({ sync: true }));
  view.unmount();
  vi.mocked(saveIGVSnapshot).mockClear();
  vi.mocked(getIGVSnapshot).mockResolvedValue({ available: true, url: '/saved.png' });
  render(<IGVViewer {...props} session={{ ...session, tracks: [bam] }} />);
  await waitFor(() => expect(screen.queryByText(/正在加载/)).toBeNull());
  expect(saveIGVSnapshot).not.toHaveBeenCalled();
});

it('never saves a screenshot when IGV silently fails to load a track', async () => {
  const browser = { search: vi.fn().mockResolvedValue(undefined), loadTrack: vi.fn().mockResolvedValue(undefined), dispose: vi.fn(), toSVG: vi.fn(), removeTrackByName: vi.fn(), updateViews: vi.fn().mockResolvedValue(undefined), currentLoci: vi.fn() };
  vi.mocked(igv.createBrowser).mockResolvedValue(browser);
  render(<IGVViewer {...props} session={{ ...session, tracks: [bam] }} />);
  await screen.findByText(/未加载的轨迹/);
  expect(saveIGVSnapshot).not.toHaveBeenCalled();
});

it('does not save a locus that was panned while tracks were loading', async () => {
  const browser = { search: vi.fn().mockResolvedValue(undefined), loadTrack: vi.fn().mockResolvedValue({}), dispose: vi.fn(), toSVG: vi.fn(), removeTrackByName: vi.fn(), updateViews: vi.fn().mockResolvedValue(undefined), currentLoci: vi.fn().mockReturnValue('chr2:1-110') };
  vi.mocked(igv.createBrowser).mockResolvedValue(browser);
  render(<IGVViewer {...props} session={{ ...session, tracks: [bam] }} />);
  await waitFor(() => expect(browser.currentLoci).toHaveBeenCalled());
  expect(saveIGVSnapshot).not.toHaveBeenCalled();
});

it('keeps live BAM visible when screenshot upload fails', async () => {
  const browser = { search: vi.fn().mockResolvedValue(undefined), loadTrack: vi.fn().mockResolvedValue({}), dispose: vi.fn(), toSVG: vi.fn().mockReturnValue('<svg/>'), removeTrackByName: vi.fn(), updateViews: vi.fn().mockResolvedValue(undefined), currentLoci: vi.fn().mockReturnValue('chr1:1-110') };
  vi.mocked(igv.createBrowser).mockResolvedValue(browser);
  vi.mocked(igvSVGToPNG).mockResolvedValue(new Blob(['png']));
  vi.mocked(saveIGVSnapshot).mockRejectedValue(new Error('upload failed'));
  const view = render(<IGVViewer {...props} session={{ ...session, tracks: [bam] }} />);
  await screen.findByText(/截图保存失败/);
  expect(view.container.querySelector('.hidden')).toBeNull();
  expect(igv.removeBrowser).not.toHaveBeenCalled();
});

it('finishes a captured screenshot upload after the viewer closes', async () => {
  const browser = { search: vi.fn().mockResolvedValue(undefined), loadTrack: vi.fn().mockResolvedValue({}), dispose: vi.fn(), toSVG: vi.fn().mockReturnValue('<svg/>'), removeTrackByName: vi.fn(), updateViews: vi.fn().mockResolvedValue(undefined), currentLoci: vi.fn().mockReturnValue('chr1:1-110') };
  vi.mocked(igv.createBrowser).mockResolvedValue(browser);
  let finish!: (blob: Blob) => void;
  vi.mocked(igvSVGToPNG).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  vi.mocked(saveIGVSnapshot).mockResolvedValue({ available: true });
  const view = render(<IGVViewer {...props} session={{ ...session, tracks: [bam] }} />);
  await waitFor(() => expect(browser.toSVG).toHaveBeenCalled());
  view.unmount();
  await act(async () => finish(new Blob(['png'])));
  await waitFor(() => expect(saveIGVSnapshot).toHaveBeenCalledTimes(1));
});
