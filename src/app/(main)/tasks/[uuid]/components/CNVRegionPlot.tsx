'use client';

import * as React from 'react';
import { AppModal } from '@/components/shared';
import { useTheme } from '@schema/ui-kit';
import { getCNVSegments } from '../result-api';
import {loadCNR, normalizeContig as contig, type CNRBin} from '../utils/cnv-signal';
import { DEFAULT_FILTER_STATE } from '../types';
import type { CNVSegment } from '../types';

// Region rows are merged genomic bins, not the original CNR target probes.
export function CNVRegionPlot({ taskId, variant, isOpen, onClose }: {
  taskId: string; variant: CNVSegment; isOpen: boolean; onClose: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const [cnr, setCNR] = React.useState<CNRBin[]>([]);
  const [cnrStatus, setCNRStatus] = React.useState('');
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
    const controller=new AbortController(); setCNR([]);setCNRStatus('原始 CNR 读取中…');
    void (async()=>{
      const bins=await loadCNR(taskId,variant.attemptId,controller.signal);
      if(!controller.signal.aborted){setCNR(bins);setCNRStatus(`原始 CNR 已读取，${bins.length.toLocaleString()} 个有效 bin`);}
    })().catch(()=>{if(!controller.signal.aborted)setCNRStatus('原始 CNR 读取失败：请检查短时授权、对象可用性或 COS CORS；Region 信号仍可查看');});
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
        if (page > 1 && version !== result.version) throw new Error('数据版本已改变，请重新打开区域图');
        version = result.version;
        if (result.total > 50000) throw new Error('窗口超过 50,000 个合并区间，请缩小窗口');
        if(variant.attemptId && result.data.some(row=>row.attemptId && row.attemptId!==variant.attemptId))throw new Error('执行版本已改变，请重新打开区域图');
        collected.push(...result.data);
        if (collected.length >= result.total) break;
        if (!result.data.length) throw new Error('区域数据读取不完整，请重试');
      }
      if (!controller.signal.aborted) setRows(collected.sort((a,b) => a.startPosition - b.startPosition));
    })().catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '区域数据读取失败'); })
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
      ctx.fillStyle=color('--color-fg-muted','#57606a'); ctx.textAlign='right'; ctx.fillText(value.toFixed(2),48,y(value)+4);
      const position=start+(end-start)*i/4; ctx.textAlign='center'; ctx.fillText(`${(position/1e6).toFixed(3)} Mb`,x(position),251);
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
  }, [isOpen,width,valid,bins,start,end,minimum,maximum,variant,resolvedTheme,canvas]);
  if (!isOpen) return null;
  return <AppModal open={isOpen} onOpenChange={open=>!open&&onClose()} title={`${variant.chromosome} · CNV Region 信号图`} size="large" className="!z-[80] !w-[min(900px,94vw)] !max-w-none">
      <div className="my-3 flex flex-wrap items-center gap-3 text-xs"><label className="flex items-center gap-2">选中区间两侧扩展<input aria-label="窗口两侧扩展 kb" type="number" min="0" max="100000" value={flankKB} onChange={e => {const v=Number(e.target.value);if(Number.isFinite(v)&&v>=0&&v<=100000)setFlankKB(v);}} className="w-24 rounded border border-border-default bg-canvas-default px-2 py-1" />kb</label><span>{start.toLocaleString()}–{end.toLocaleString()}（窗口 {(end-start).toLocaleString()} bp）</span></div>
      <p className="mb-2 text-xs text-fg-muted">来源：完整 Region Parquet 中与窗口相交的合并区间，横线表示区间 log2，圆点表示其中点。缺测处留空；虚线为 log2=0。显示窗口不改变检出时的 bin 大小。灰色散点为归档原始 CNR bin，不插值或填补缺测。</p>
      <p className="mb-2 text-xs text-fg-muted">{cnrStatus}；当前窗口 {bins.length.toLocaleString()} 个原始 bin。</p>
      <div ref={setHolder}>{loading ? <p role="status" className="py-20 text-center text-sm">正在浏览器中查询区域数据…</p> : error ? <div role="alert" className="py-8 text-sm text-danger-fg">{error}<button className="yj-tool-button ml-3" onClick={()=>setRetry(v=>v+1)}>重试</button></div> : <canvas ref={setCanvas} aria-label={`${valid.length} 个有 log2 数值的 Region 区间；可在检出表中读取原始数值`} onMouseMove={event => {
        const rect=event.currentTarget.getBoundingClientRect(); const coordinate=start+(event.clientX-rect.left-54)/(width-74)*(end-start);
        setHover(valid.find(row=>coordinate>=row.startPosition&&coordinate<=row.endPosition)??null);
      }} onMouseLeave={()=>setHover(null)} className="max-w-full" />}</div>
      <p className="mt-2 min-h-5 text-xs text-fg-muted">{hover ? `${hover.chromosome}:${hover.startPosition}–${hover.endPosition} · log2 ${hover.log2Ratio} · CN ${hover.copyNumber??'未提供'}` : `${valid.length}/${rows.length} 个合并区间提供 log2；蓝色缺失，红色扩增，灰色其他，浅黄色为选中区间。`}</p>
  </AppModal>;
}
