'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { CNVPlotWindow, type CNVPlotAnchor } from './CNVPlotWindow';
import { useTheme } from '@schema/ui-kit';
import { getCNVSegments } from '../result-api';
import {loadCNR, normalizeContig as contig, type CNRBin} from '../utils/cnv-signal';
import { DEFAULT_FILTER_STATE } from '../types';
import type { CNVSegment } from '../types';

// Region rows are merged genomic bins, not the original CNR target probes.
export function CNVRegionPlot({ taskId, variant, isOpen, onClose, anchor }: {
  taskId: string; variant: CNVSegment; isOpen: boolean; onClose: () => void; anchor?: CNVPlotAnchor;
}) {
  const t = useText();
  const { resolvedTheme } = useTheme();
  const [cnr, setCNR] = React.useState<CNRBin[]>([]);
  const [cnrStatus, setCNRStatus] = React.useState('');
  const [cnrLoading, setCNRLoading] = React.useState(false);
  const [flankKB, setFlankKB] = React.useState(100);
  const [rows, setRows] = React.useState<CNVSegment[]>([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  const [width, setWidth] = React.useState(800);
  const [hover, setHover] = React.useState<CNVSegment | null>(null);
  const [holder, setHolder] = React.useState<HTMLDivElement | null>(null);
  const [canvas, setCanvas] = React.useState<HTMLCanvasElement | null>(null);
  const start = Math.max(0, variant.startPosition - flankKB * 1000);
  const end = variant.endPosition + flankKB * 1000;
  React.useEffect(() => {
    if(!isOpen)return;
    const controller=new AbortController(); setCNRLoading(true); setCNR([]);setCNRStatus(t("tasks.readingOriginalCnrb04198"));
    void (async()=>{
      const bins=await loadCNR(taskId,variant.attemptId,controller.signal);
      if(!controller.signal.aborted){setCNR(bins);setCNRStatus(t("tasks.originalCnrLoadedValidBins9c1d04", {p0: String(bins.length.toLocaleString(t.locale))}));}
    })().catch(()=>{if(!controller.signal.aborted)setCNRStatus(t("tasks.originalCnrUnavailableMergedRegionSignalLoads50eb44"));}).finally(()=>{if(!controller.signal.aborted)setCNRLoading(false);});
    return ()=>controller.abort();
  },[taskId,variant.attemptId,isOpen,retry]);
  React.useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setRows([]); setError(''); setLoading(true); setHover(null);
    void (async () => {
      const collected: CNVSegment[] = [];
      let version: string | undefined;
      // Query the full browser dataset within this region, independently of
      // the table's visible page or active filters. Never query server SQL.
      for (let page = 1; ; page++) {
        const result = await getCNVSegments(taskId, { ...DEFAULT_FILTER_STATE,
          page, pageSize: 200, columnFilters: [
            { column: 'Chromosome', operator: 'equals', value: variant.chromosome },
            { column: 'Start', operator: 'lt', value: String(end) },
            { column: 'End', operator: 'gt', value: String(start) },
          ],
        }, controller.signal);
        if (controller.signal.aborted) return;
        if (page > 1 && version !== result.version) throw new Error(t("tasks.dataVersionChangedReopenTheRegionPlotfcdb26"));
        version = result.version;
        if (result.total > 50000) throw new Error(t("tasks.windowExceedsMergedRegionsNarrowTheWindow8918f2"));
        if(variant.attemptId && result.data.some(row=>row.attemptId && row.attemptId!==variant.attemptId))throw new Error(t("tasks.executionVersionChangedReopenTheRegionPlot5a985f"));
        collected.push(...result.data);
        if (collected.length >= result.total) break;
        if (!result.data.length) throw new Error(t("tasks.incompleteRegionDataRetry01ea6f"));
      }
      if (!controller.signal.aborted) setRows(collected.sort((a,b) => a.startPosition - b.startPosition));
    })().catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? errorText(reason, t) : t("tasks.unableToReadRegionData7ee398")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [taskId, variant.chromosome, variant.attemptId, start, end, isOpen, retry]);
  React.useEffect(() => {
    if (!isOpen || !holder) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, Math.floor(entries[0].contentRect.width))));
    observer.observe(holder); return () => observer.disconnect();
  }, [isOpen, holder]);
  const valid = React.useMemo(() => rows.filter(row => row.log2Ratio !== null && Number.isFinite(row.log2Ratio)), [rows]);
  const bins = React.useMemo(()=>cnr.filter(bin=>contig(bin.chromosome)===contig(variant.chromosome)&&bin.start<end&&bin.end>start),[cnr,variant.chromosome,start,end]);
  const minimum = bins.reduce((value,bin)=>Math.min(value,bin.log2),Math.min(-1.5, ...valid.map(row => row.log2Ratio!)));
  const maximum = bins.reduce((value,bin)=>Math.max(value,bin.log2),Math.max(1, ...valid.map(row => row.log2Ratio!)));
  const x = (position: number) => 54 + (position - start) / Math.max(1, end-start) * (width - 74);
  const y = (ratio: number) => 20 + (maximum-ratio) / (maximum-minimum) * 210;
  React.useEffect(() => {
    if (!isOpen || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const node = canvas; node.width = width*dpr; node.height = 270*dpr;
    node.style.width = `${width}px`; node.style.height = '270px';
    const ctx = node.getContext('2d'); if (!ctx) return;
    const style=getComputedStyle(node);
    const color=(token:string,fallback:string)=>style.getPropertyValue(token).trim()||fallback;
    ctx.scale(dpr,dpr); ctx.fillStyle = color('--color-canvas-default','#ffffff'); ctx.fillRect(0,0,width,270);
    ctx.fillStyle = color('--color-warning-subtle','#fff5cc'); ctx.fillRect(x(variant.startPosition),20, Math.max(1,x(variant.endPosition)-x(variant.startPosition)),210);
    ctx.font = '11px sans-serif';
    for (let i=0;i<=4;i++) {
      const value = minimum+(maximum-minimum)*i/4;
      ctx.strokeStyle = color('--color-border-default','#e5e7eb'); ctx.beginPath(); ctx.moveTo(54,y(value)); ctx.lineTo(width-20,y(value)); ctx.stroke();
      ctx.fillStyle=color('--color-fg-muted','#57606a'); ctx.textAlign='right'; ctx.fillText(formatNumericString(value.toFixed(2), t.locale),48,y(value)+4);
      const position=start+(end-start)*i/4; ctx.textAlign='center'; ctx.fillText(`${formatNumericString((position/1e6).toFixed(3), t.locale)} Mb`,x(position),251);
    }
    ctx.strokeStyle='#9ca3af'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(54,y(0)); ctx.lineTo(width-20,y(0)); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.beginPath(); ctx.rect(54,20,width-74,210); ctx.clip();
    ctx.fillStyle='#94a3b8'; ctx.globalAlpha=0.55;
    for(const bin of bins){ctx.beginPath();ctx.arc(x((bin.start+bin.end)/2),y(bin.log2),1.5,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
    for (const row of valid) {
      ctx.strokeStyle = row.type==='Deletion' ? '#2563eb' : row.type==='Amplification' ? '#dc2626' : '#64748b';
      ctx.lineWidth = row.id===variant.id ? 3 : 1.5;
      ctx.beginPath(); ctx.moveTo(x(row.startPosition),y(row.log2Ratio!)); ctx.lineTo(x(row.endPosition),y(row.log2Ratio!)); ctx.stroke();
      ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(x((row.startPosition+row.endPosition)/2),y(row.log2Ratio!),2.5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore(); ctx.fillStyle=color('--color-fg-default','#374151'); ctx.textAlign='left'; ctx.fillText('log2 ratio',4,12);
  }, [isOpen,width,valid,bins,start,end,minimum,maximum,variant,resolvedTheme,canvas,t]);
  if (!isOpen) return null;
  return <CNVPlotWindow anchor={anchor} open={isOpen} onClose={onClose} title={t("tasks.cnvRegionSignalc094e5", {p0: String(variant.chromosome)})}>
      <div className="my-3 flex flex-wrap items-center gap-3 text-xs"><label className="flex items-center gap-2">{t("tasks.extendBothSidesOfSelectedIntervalb19aed")}<input aria-label={t("tasks.windowFlankExtensionInKb061876")} type="number" min="0" max="100000" value={flankKB} onChange={e => {const v=Number(e.target.value);if(Number.isFinite(v)&&v>=0&&v<=100000)setFlankKB(v);}} className="w-24 rounded border border-border-default bg-canvas-default px-2 py-1" />kb</label><span>{start.toLocaleString(t.locale)}–{end.toLocaleString(t.locale)}{t("tasks.windowa132ec")}{(end-start).toLocaleString(t.locale)} bp）</span></div>
      <p className="mb-2 text-xs text-fg-muted">{t("tasks.linesShowMergedRegionLogDotsTheir78b6f7")}</p>
      <p className="mb-2 text-xs text-fg-muted">{cnrStatus}{t("tasks.currentWindow3186cc")}{bins.length.toLocaleString(t.locale)} {t("tasks.originalBins37b316")}</p>
      <div ref={setHolder}>{loading ? <p role="status" className="py-20 text-center text-sm">{t("tasks.readingRegionSignal840da7")}</p> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}<ActionButton permission={null} action="retry" variant="ghost" type="button" className="yj-tool-button" onClick={()=>setRetry(v=>v+1)}>{t("pipeline.retrye2d53a")}</ActionButton></div> : valid.length === 0 && bins.length === 0 ? <div role="status" className="rounded-md border border-border-default bg-canvas-subtle px-4 py-10 text-center text-sm text-fg-muted">{cnrLoading ? t("tasks.readingOriginalCnrSignalfdd2de") : rows.length === 0 ? t("tasks.noPlottableRegionOrCnrSignalInca0ea8") : t("tasks.noValidRegionLogValuesOrOriginal61b42f")}</div> : <canvas ref={setCanvas} aria-label={t("tasks.regionIntervalsHaveLogValuesOriginalReadingsd126a3", {p0: String(valid.length)})} onMouseMove={event => {
        const rect=event.currentTarget.getBoundingClientRect(); const coordinate=start+(event.clientX-rect.left-54)/(width-74)*(end-start);
        setHover(valid.find(row=>coordinate>=row.startPosition&&coordinate<=row.endPosition)??null);
      }} onMouseLeave={()=>setHover(null)} className="max-w-full" />}</div>
      {!loading && !error && (valid.length > 0 || bins.length > 0) && <p className="mt-2 min-h-5 text-xs text-fg-muted">{hover ? `${hover.chromosome}:${hover.startPosition}–${hover.endPosition} · log2 ${hover.log2Ratio} · CN ${hover.copyNumber??t("history.notProvided071fb2")}` : t("tasks.mergedIntervalsHaveLogBlueDeletionsRedf4e403", {p0: String(valid.length), p1: String(rows.length)})}</p>}
  </CNVPlotWindow>;
}
