'use client';
import { useBusinessPermissions } from '@/components/providers/BusinessPermissionProvider';
import { LocalizedError } from '@/i18n/errors';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { Tooltip } from '@schema/ui-kit';
import { AppModal } from '@/components/shared';
import type { IGVSession, IGVTrackDescriptor, IGVTrackURL } from '../types';
import { getIGVSession, getIGVTrackURLs, getIGVSnapshot, saveIGVSnapshot, type IGVSnapshot } from '../result-api';
import { IGVTrackLayout } from '@/lib/igv-layout';
import { igvSVGToPNG } from '@/lib/igv-snapshot';

export interface IGVViewerProps {
  taskId: string;
  chromosome: string;
  position: number;
  endPosition?: number;
  isOpen: boolean;
  onClose: () => void;
  session?: IGVSession | null;
  flanking?: number;
}

export interface IGVReferenceConfig {
  id: string;
  fastaURL: string;
  indexURL: string;
  cytobandURL?: string;
  aliasURL?: string;
}

export interface IGVTrackConfig {
  type: 'alignment' | 'variant' | 'annotation' | 'wig';
  name: string;
  url?: string | (() => Promise<string>);
  indexURL?: string | (() => Promise<string>);
  format?: 'bam' | 'vcf' | 'cram' | 'gff3' | 'bed' | 'bigwig';
  height?: number;
  color?: string;
  [key: string]: unknown;
}

const signedURLRefreshLeadMs = 60_000;

class SignedTrackResolver {
  private readonly controller = new AbortController();
  close() { this.controller.abort(); this.cache.clear(); this.pending.clear(); }
  private readonly cache = new Map<string, { value: IGVTrackURL; expiresAt: number }>();
  private pending = new Set<string>();
  private pendingRequest: Promise<void> | null = null;

  constructor(private readonly taskId: string, private readonly version: string) {}

  url(trackId: string): () => Promise<string> {
    return async () => (await this.ensure(trackId)).url;
  }

  indexURL(trackId: string): () => Promise<string> {
    return async (t: TextTranslator = chineseText) => {
      const value = (await this.ensure(trackId)).indexURL;
      if (!value) throw new Error(t("tasks.thisTrackHasNoIndexc19b1a"));
      return value;
    };
  }

  private async ensure(trackId: string): Promise<IGVTrackURL> {
    // A track can be requested after a coalesced request has already copied
    // its pending ID list. Loop once more in that case so it starts the next
    // batch instead of receiving an artificial "not returned" error.
    for (;;) {
      if (this.controller.signal.aborted) throw new LocalizedError("display.igvViewerClosed0d74e7");
      const cached = this.cache.get(trackId);
      if (cached && cached.expiresAt - Date.now() > signedURLRefreshLeadMs) return cached.value;
      this.pending.add(trackId);
      if (!this.pendingRequest) {
        this.pendingRequest = Promise.resolve().then(async () => {
          const ids = [...this.pending];
          this.pending.clear();
          try {
            const response = await getIGVTrackURLs(this.taskId, this.version, ids, this.controller.signal);
            const expiresAt = Date.parse(response.expiresAt);
            for (const track of response.tracks) {
              this.cache.set(track.id, {
                value: track,
                expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 9 * 60_000,
              });
            }
          } finally {
            this.pendingRequest = null;
          }
        });
      }
      await this.pendingRequest;
      const refreshed = this.cache.get(trackId);
      if (refreshed) return refreshed.value;
      if (!this.pending.has(trackId)) throw new LocalizedError("display.trackAuthorizationNotReturned99b034");
    }
  }
}

export function formatChromosome(chromosome: string): string {
  const normalized = chromosome.trim();
  const name = normalized.replace(/^chr/i, '').toUpperCase();
  if (/^(MT|M)$/.test(name)) return 'chrM';
  return `chr${name}`;
}

function trackConfiguration(track: IGVTrackDescriptor, resolver: SignedTrackResolver, authenticated = false): IGVTrackConfig {
  return {
    sync: true,
    type: track.type as IGVTrackConfig['type'],
    format: track.format as IGVTrackConfig['format'],
    name: track.name,
    url: resolver.url(track.id),
    ...(track.hasIndex ? { indexURL: resolver.indexURL(track.id) } : {}),
    ...(track.type === 'alignment' ? { height: 180 } : {}),
    ...(authenticated ? {withCredentials: true} : {}),
  };
}

function referenceConfiguration(session: IGVSession) {
  const reference = session.reference;
  if (!reference.id || !reference.fastaURL || !reference.indexURL) return null;
  return {
    id: reference.id,
    fastaURL: reference.fastaURL,
    indexURL: reference.indexURL,
    aliasURL: reference.aliasURL,
    cytobandURL: reference.cytobandURL,
    ...(session.transport === 'api' ? {withCredentials: true} : {}),
  };
}

function staticGeneTrack(session: IGVSession): IGVTrackConfig | null {
  const reference = session.reference;
  if (!reference.geneTrackURL) return null;
  return {
    sync: true,
    type: 'annotation',
    format: 'gff3',
    name: '基因注释',
    url: reference.geneTrackURL,
    ...(reference.geneTrackIndexURL ? { indexURL: reference.geneTrackIndexURL } : {}),
  };
}

export function IGVViewer({ taskId, chromosome, position, endPosition, isOpen, onClose, session: suppliedSession, flanking = 100 }: IGVViewerProps) {
  const { hasPermission } = useBusinessPermissions();
  const canSaveSnapshot = hasPermission('interpretation_reports.manage');
  const t = useText();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerNode,setContainerNode]=React.useState<HTMLDivElement|null>(null);
  const attachContainer=React.useCallback((node:HTMLDivElement|null)=>{containerRef.current=node;setContainerNode(node);},[]);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const trackLayout = React.useRef(new IGVTrackLayout());
  const browserRef = React.useRef<import('igv').IGVBrowser | null>(null);
  const resolverRef = React.useRef<SignedTrackResolver | null>(null);
  const [loadedSession, setLoadedSession] = React.useState<IGVSession | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [trackErrors, setTrackErrors] = React.useState<string[]>([]);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => { if (!isOpen) setExpanded(false); }, [isOpen]);
  const [snapshotState, setSnapshotState] = React.useState<{ key: string; value: IGVSnapshot } | null>(null);
  const [snapshotNotice, setSnapshotNotice] = React.useState('');
  const [snapshotLoading, setSnapshotLoading] = React.useState(false);
  const [tracksReady, setTracksReady] = React.useState(false);
  const navigationQueue = React.useRef<Promise<void>>(Promise.resolve());
  const session = suppliedSession ?? loadedSession;

  const locus = React.useMemo(() => {
    const start = Math.max(1, Math.min(position, endPosition ?? position) - flanking);
    const end = Math.max(position, endPosition ?? position) + flanking;
    return `${formatChromosome(chromosome)}:${start}-${end}`;
  }, [chromosome, endPosition, flanking, position]);
  const locusRef = React.useRef(locus);
  locusRef.current = locus;

  const snapshotKey = `${taskId}/${session?.executionAttemptId ?? ''}/${locus}/${reloadToken}`;
  const snapshot = snapshotState?.key === snapshotKey ? snapshotState.value : null;
  const liveBAM = !!session?.tracks.some(track => track.format === 'bam' && track.available);
  const showSnapshot = !liveBAM && !!snapshot?.available;

  React.useLayoutEffect(() => {
    if (!isOpen) return;
    const viewport=viewportRef.current,content=containerRef.current;
    let frame=0;
    const schedule=()=>{
      if(frame)return;
      frame=requestAnimationFrame(()=>{
        const browser=browserRef.current;
        if(browser&&viewport&&content){
          if(expanded&&!showSnapshot)trackLayout.current.fit(browser,viewport.clientHeight,content.getBoundingClientRect().height);
          else trackLayout.current.restore(browser);
        }
        frame=0;
      });
    };
    const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(schedule);
    if(viewport)observer?.observe(viewport);
    if(content)observer?.observe(content);
    window.addEventListener('resize',schedule);
    // IGV's existing listener recalculates horizontal dimensions. Our observer
    // independently fits vertical sample viewports after layout settles.
    window.dispatchEvent(new Event('resize'));schedule();
    return()=>{observer?.disconnect();window.removeEventListener('resize',schedule);if(frame)cancelAnimationFrame(frame);};
  },[expanded,isOpen,loading,showSnapshot,containerNode]);

  React.useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setSnapshotLoading(true);
    setSnapshotNotice('');
    void getIGVSnapshot(taskId, locus, controller.signal).then(value => {
      if (!controller.signal.aborted) setSnapshotState({ key: snapshotKey, value });
    }).catch(() => {
      if (!controller.signal.aborted) setSnapshotNotice(t("tasks.screenshotLookupFailedRefreshAndRetry6359dc"));
    }).finally(() => {
      if (!controller.signal.aborted) setSnapshotLoading(false);
    });
    return () => controller.abort();
  }, [isOpen, taskId, locus, snapshotKey]);

  React.useEffect(() => {
    setLoadedSession(null);
    setError(null);
  }, [taskId]);

  React.useEffect(() => {
    if (!isOpen || suppliedSession) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setLoadedSession(null);
    void getIGVSession(taskId, controller.signal)
      .then(value => {
        if (!controller.signal.aborted) setLoadedSession(value);
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToReadSequencingEvidence890a11"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isOpen, suppliedSession, taskId, reloadToken]);

  React.useEffect(() => {
    setTracksReady(false);
    if (!isOpen || !session || !containerNode) return;
    if (session.tracks.some(track => track.format === 'bam') && !liveBAM) {
      setLoading(false);
      setError(null);
      setTrackErrors([]);
      return;
    }
    const reference = referenceConfiguration(session);
    if (!session.available || !reference) {
      setLoading(false);
      setError(session.reason || t("tasks.thisExecutionHasNoInterpretableReferenceSequence8c1466"));
      return;
    }

    let active = true;
    let createdBrowser: import('igv').IGVBrowser | null = null;
    let igvAPI: typeof import('igv').default | null = null;
    const removed = new Set<import('igv').IGVBrowser>();
    setLoading(true);
    setError(null);
    setTrackErrors([]);
    const resolver = new SignedTrackResolver(taskId, session.version);
    resolverRef.current = resolver;

    const dispose = async () => {
      resolver.close();
      const current = createdBrowser;
      if (!current || removed.has(current)) return;
      removed.add(current);
      try {
        if (igvAPI) igvAPI.removeBrowser(current);
        else current.dispose();
      } catch {
        // dispose is best effort during modal close and Strict Mode replays.
      }
      if (browserRef.current === current) browserRef.current = null;
    };

    void (async () => {
      try {
        const igvModule = await import('igv/dist/igv.esm.js');
        const igv = igvModule.default;
        igvAPI = igv;
        if (!active || !containerRef.current) return;
		if (typeof igv?.createBrowser !== 'function') {
		  throw new Error(t("tasks.igvEsmModuleHasNoBrowserInitializationd4c184"));
		}
		const browser = await igv.createBrowser(containerRef.current, { reference, locus: locusRef.current, tracks: [] });
        createdBrowser = browser;
        if (!active) {
          await dispose();
          return;
        }
        browserRef.current = browser;
        const failures: string[] = [];
        const tracks = session.tracks.filter(track => track.available && track.format !== 'cnr');
        const geneTrack = staticGeneTrack(session);
        const configurations: IGVTrackConfig[] = [
          ...(geneTrack ? [geneTrack] : []),
          ...tracks.map(track => trackConfiguration(track, resolver, session.transport === 'api')),
        ];
        for (const configuration of configurations) {
          if (!active) {
            await dispose();
            return;
          }
          try {
            const loaded = await browser.loadTrack(configuration);
            if (!loaded) failures.push(configuration.name || t("tasks.unnamedTrackf0ccb4"));
          } catch {
            failures.push(configuration.name || t("tasks.unnamedTrackf0ccb4"));
          }
          if (!active) {
            await dispose();
            return;
          }
        }
        if (!active) return;
        setTrackErrors(failures);
        setTracksReady(failures.length === 0);
        setLoading(false);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToInitializeIgvEvidence1bdd82"));
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      void dispose();
    };
  }, [isOpen, reloadToken, session, taskId, liveBAM, containerNode]);

  React.useEffect(() => {
    const browser = browserRef.current;
    if (!isOpen || !browser || loading) return;
    const controller = new AbortController();
    // Serialize searches: an older navigation must not repaint a newer locus.
    navigationQueue.current = navigationQueue.current.catch(() => {}).then(async () => {
      if (controller.signal.aborted) return;
      try {
        await browser.search(locus);
        if (controller.signal.aborted || browserRef.current !== browser) return;
        if (!canSaveSnapshot || !tracksReady || !liveBAM || !session || !snapshot || snapshot.available || snapshotLoading) return;
        await browser.updateViews();
        if (controller.signal.aborted || browserRef.current !== browser || locusRef.current !== locus) return;
        // Large regions show a zoom-in placeholder instead of reads.
        if (Math.abs((endPosition ?? position) - position) + 2 * flanking > 30000) return;
        const visibleMessages = containerRef.current?.querySelectorAll<HTMLElement>('.igv-viewport-message, .igv-zoom-in-notice-container');
        if (visibleMessages && [...visibleMessages].some(item => item.textContent && getComputedStyle(item).display !== 'none')) throw new Error(t("tasks.trackHasNotRenderedSuccessfully905d97"));
        const displayedLocus = browser.currentLoci();
        const expected = /^([^:]+):(\d+)-(\d+)$/.exec(locus);
        const actual = typeof displayedLocus === 'string' ? /^([^:]+):([\d.]+)-([\d.]+)$/.exec(displayedLocus) : null;
        // The user may pan during loading. Never label that image as the requested locus.
        if (!actual || !expected || formatChromosome(actual[1]) !== expected[1] || Math.abs(Number(actual[2]) - Number(expected[2])) > 1 || Math.abs(Number(actual[3]) - Number(expected[3])) > 1) return;
        const svg = browser.toSVG();
        // The serialized image is immutable. Upload in the background so navigation
        // and closing the modal do not interrupt a screenshot already captured.
        void igvSVGToPNG(svg).then(image => saveIGVSnapshot(taskId, locus, session.version, image)).then(value => {
          if (!controller.signal.aborted) {
            setSnapshotState({ key: snapshotKey, value });
            setSnapshotNotice(t("tasks.screenshotSavedAvailableAfterBamExpiry9fa891"));
          }
        }).catch(() => {
          if (!controller.signal.aborted) setSnapshotNotice(t("tasks.screenshotSaveFailedRefreshAndRetryLive4bedf4"));
        });
      } catch {
        if (!controller.signal.aborted) setSnapshotNotice(t("tasks.screenshotSaveFailedRefreshAndRetryLive4bedf4"));
      }
    });
    return () => controller.abort();
  }, [isOpen, locus, loading, tracksReady, liveBAM, snapshot, snapshotLoading, snapshotKey, taskId, session, endPosition, position, flanking, canSaveSnapshot]);

  if (!isOpen) return null;

  const unavailableTracks = session?.tracks.filter(track => !track.available && track.format !== 'cnr') ?? [];
  return (
    <AppModal open={isOpen} onOpenChange={open => !open && onClose()} title={t("tasks.igvSequencingEvidencefca9b1")} size="large" headerActions={<button type="button" aria-label={t(expanded ? 'igvSize.restore' : 'igvSize.expand')} title={t(expanded ? 'igvSize.restore' : 'igvSize.expand')} aria-pressed={expanded} onClick={() => setExpanded(value => !value)} className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted hover:bg-canvas-subtle hover:text-fg-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-emphasis">
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>} className={expanded ? '!z-[80] !flex !flex-col !overflow-hidden !h-[100dvh] !w-screen !max-h-[100dvh] !max-w-none max-sm:!max-w-none !rounded-none' : '!z-[80] !w-[min(1100px,94vw)] !max-w-none'} bodyClassName={expanded ? '!flex !min-h-0 !max-h-none !flex-1 !flex-col !overflow-hidden [&>*:not([data-igv-viewport])]:shrink-0' : undefined}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-canvas-subtle px-2 py-1 text-fg-default">{locus}</span>
        <span className="text-fg-muted">{session?.reference.id || t("tasks.unknownReference15bf46")}</span>
        <ActionButton action="refresh" variant="ghost"
          type="button"
          onClick={() => setReloadToken(value => value + 1)}
          disabled={loading}
          className="yj-tool-button ml-auto"
        >
           {t("tasks.refreshEvidence5a53e4")}</ActionButton>
      </div>

      {error && !showSnapshot && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-danger-emphasis bg-danger-subtle p-3 text-sm text-danger-fg">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!showSnapshot && (trackErrors.length > 0 || unavailableTracks.length > 0) && (
        <div className="mb-3 rounded-lg border border-warning-emphasis bg-warning-subtle p-3 text-sm text-warning-fg">
          {trackErrors.length > 0 && <p>{t("tasks.unloadedTracks6bea53")}{trackErrors.join('、')}。</p>}
          {unavailableTracks.map(track => <p key={track.id}>{track.name}：{track.reason || t("tasks.unavailablebeff4a")}。</p>)}
        </div>
      )}

      {snapshotNotice && <p role="status" className="mb-3 text-sm text-fg-muted">{snapshotNotice}</p>}
      {showSnapshot && (
        <div className="space-y-3">
          <p className="rounded-lg bg-warning-subtle p-3 text-sm text-warning-fg">{t("tasks.screenshotSavedDuringBamRetentionReadsCannot452197")}{snapshot?.createdAt && t("tasks.savedAt5aa49b", {p0: String(new Date(snapshot.createdAt).toLocaleString(t.locale))})} · {snapshot?.reference}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={snapshot?.url} alt={t("tasks.historicalIgvScreenshota10645", {p0: String(locus)})} className="h-auto w-full rounded-lg border border-border-default" onError={() => { setSnapshotState({ key: snapshotKey, value: { available: false } }); setSnapshotNotice(t("tasks.unableToLoadScreenshotRefreshAndRetryd9aecf")); }} />
        </div>
      )}
      <div ref={viewportRef} data-igv-viewport className={showSnapshot || (!liveBAM && unavailableTracks.some(track => track.format === 'bam')) || (error && !loading && !browserRef.current) ? 'hidden' : `relative ${expanded ? 'min-h-0 flex-1' : 'h-[min(480px,58dvh)] min-h-[260px]'} overflow-auto rounded-lg border border-border-default bg-canvas-default`}>
        <div ref={attachContainer} className={`${expanded ? 'min-h-0' : 'min-h-[260px]'} w-full min-w-[640px]`} />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas-default/80">
            <div className="flex items-center gap-3 text-sm text-fg-muted"><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-accent-emphasis" />{t("tasks.loadingReferenceAndTracks02e5bf")}</div>
          </div>
        )}
      </div>
    </AppModal>
  );
}

interface PositionLinkProps {
  chromosome: string;
  position: number;
  label?: string;
  onClick: (chromosome: string, position: number) => void;
}

export function PositionLink({ chromosome, position, label, onClick }: PositionLinkProps) {
  const t = useText();
  return (
    <Tooltip content={t("tasks.viewInThisTaskIgvEvidence7d29a6")} placement="top" variant="nav">
      <button onClick={event => { event.stopPropagation(); onClick(chromosome, position); }} className="text-left text-accent-fg hover:underline">
        {label ?? `${chromosome}:${position}`}
      </button>
    </Tooltip>
  );
}
