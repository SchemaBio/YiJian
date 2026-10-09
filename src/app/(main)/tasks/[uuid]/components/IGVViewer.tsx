'use client';

import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Tooltip } from '@schema/ui-kit';
import { AppModal } from '@/components/shared';
import type { IGVSession, IGVTrackDescriptor, IGVTrackURL } from '../types';
import { getIGVSession, getIGVTrackURLs } from '../result-api';

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
    return async () => {
      const value = (await this.ensure(trackId)).indexURL;
      if (!value) throw new Error('该轨迹缺少索引');
      return value;
    };
  }

  private async ensure(trackId: string): Promise<IGVTrackURL> {
    // A track can be requested after a coalesced request has already copied
    // its pending ID list. Loop once more in that case so it starts the next
    // batch instead of receiving an artificial "not returned" error.
    for (;;) {
      if (this.controller.signal.aborted) throw new Error('IGV 查看器已关闭');
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
      if (!this.pending.has(trackId)) throw new Error('轨迹授权未返回');
    }
  }
}

export function formatChromosome(chromosome: string): string {
  const normalized = chromosome.trim();
  if (/^chr/i.test(normalized)) return normalized;
  if (/^(MT|M)$/i.test(normalized)) return 'chrM';
  return `chr${normalized}`;
}

function trackConfiguration(track: IGVTrackDescriptor, resolver: SignedTrackResolver): IGVTrackConfig {
  return {
    type: track.type as IGVTrackConfig['type'],
    format: track.format as IGVTrackConfig['format'],
    name: track.name,
    url: resolver.url(track.id),
    ...(track.hasIndex ? { indexURL: resolver.indexURL(track.id) } : {}),
    ...(track.type === 'alignment' ? { height: 180 } : {}),
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
  };
}

function staticGeneTrack(session: IGVSession): IGVTrackConfig | null {
  const reference = session.reference;
  if (!reference.geneTrackURL) return null;
  return {
    type: 'annotation',
    format: 'gff3',
    name: '基因注释',
    url: reference.geneTrackURL,
    ...(reference.geneTrackIndexURL ? { indexURL: reference.geneTrackIndexURL } : {}),
  };
}

export function IGVViewer({ taskId, chromosome, position, endPosition, isOpen, onClose, session: suppliedSession, flanking = 100 }: IGVViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const browserRef = React.useRef<import('igv').IGVBrowser | null>(null);
  const resolverRef = React.useRef<SignedTrackResolver | null>(null);
  const [loadedSession, setLoadedSession] = React.useState<IGVSession | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [trackErrors, setTrackErrors] = React.useState<string[]>([]);
  const [reloadToken, setReloadToken] = React.useState(0);
  const session = suppliedSession ?? loadedSession;

  const locus = React.useMemo(() => {
    const start = Math.max(1, Math.min(position, endPosition ?? position) - flanking);
    const end = Math.max(position, endPosition ?? position) + flanking;
    return `${formatChromosome(chromosome)}:${start}-${end}`;
  }, [chromosome, endPosition, flanking, position]);
  const locusRef = React.useRef(locus);
  locusRef.current = locus;

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
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '无法读取测序证据');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isOpen, suppliedSession, taskId, reloadToken]);

  React.useEffect(() => {
    if (!isOpen || !session || !containerRef.current) return;
    const reference = referenceConfiguration(session);
    if (!session.available || !reference) {
      setError(session.reason || '该执行没有可判读的参考序列或测序证据');
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
		  throw new Error('IGV ESM 模块未提供浏览器初始化接口');
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
          ...tracks.map(track => trackConfiguration(track, resolver)),
        ];
        for (const configuration of configurations) {
          if (!active) {
            await dispose();
            return;
          }
          try {
            await browser.loadTrack(configuration);
          } catch {
            failures.push(configuration.name || '未命名轨迹');
          }
          if (!active) {
            await dispose();
            return;
          }
        }
        if (!active) return;
        setTrackErrors(failures);
        setLoading(false);
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : '无法初始化 IGV 测序证据');
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      void dispose();
    };
  }, [isOpen, reloadToken, session, taskId]);

  React.useEffect(() => {
    if (!isOpen || !browserRef.current) return;
    void browserRef.current.search(locus).catch(() => setError('无法定位到该参考序列区间'));
  }, [isOpen, locus]);

  if (!isOpen) return null;

  const unavailableTracks = session?.tracks.filter(track => !track.available && track.format !== 'cnr') ?? [];
  return (
    <AppModal open={isOpen} onOpenChange={open => !open && onClose()} title="IGV 测序证据" size="large" className="!z-[80] !w-[min(1100px,94vw)] !max-w-none">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-canvas-subtle px-2 py-1 text-fg-default">{locus}</span>
        <span className="text-fg-muted">{session?.reference.id || '参考未知'}</span>
        <button
          type="button"
          onClick={() => setReloadToken(value => value + 1)}
          disabled={loading}
          className="yj-tool-button ml-auto"
        >
          <RefreshCw className="h-4 w-4" /> 刷新证据
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-danger-emphasis bg-danger-subtle p-3 text-sm text-danger-fg">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {(trackErrors.length > 0 || unavailableTracks.length > 0) && (
        <div className="mb-3 rounded-lg border border-warning-emphasis bg-warning-subtle p-3 text-sm text-warning-fg">
          {trackErrors.length > 0 && <p>未加载的轨迹：{trackErrors.join('、')}。</p>}
          {unavailableTracks.map(track => <p key={track.id}>{track.name}：{track.reason || '不可用'}。</p>)}
        </div>
      )}

      <div className={error && !loading && !browserRef.current ? 'hidden' : 'relative h-[min(480px,58dvh)] min-h-[260px] overflow-auto rounded-lg border border-border-default bg-canvas-default'}>
        <div ref={containerRef} className="min-h-[260px] w-full min-w-[640px]" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas-default/80">
            <div className="flex items-center gap-3 text-sm text-fg-muted"><div className="h-5 w-5 animate-spin rounded-full border-b-2 border-accent-emphasis" />正在加载参考和轨迹…</div>
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
  return (
    <Tooltip content="在当前任务的 IGV 证据中查看" placement="top" variant="nav">
      <button onClick={event => { event.stopPropagation(); onClick(chromosome, position); }} className="text-left text-accent-fg hover:underline">
        {label ?? `${chromosome}:${position}`}
      </button>
    </Tooltip>
  );
}
