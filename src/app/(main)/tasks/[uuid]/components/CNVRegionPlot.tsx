'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { getCNVSegments, getIGVSession, getIGVTrackURLs } from '../result-api';
import { DEFAULT_FILTER_STATE } from '../types';
import type { CNVSegment } from '../types';

interface CNRBin { chromosome: string; start: number; end: number; log2: number; }
const contig = (value: string) => value.replace(/^chr/i, '').toUpperCase().replace(/^M$/, 'MT');
async function readCNR(url: string, signal: AbortSignal): Promise<CNRBin[]> {
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
  if (!response.ok || !response.body) throw new Error('CNR 对象不可读取，请检查授权或 COS 浏览器访问配置');
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  let text = '', bytes = 0;
  try { for (;;) { const chunk = await reader.read(); if(chunk.done)break;
    bytes += chunk.value.byteLength;
    if(bytes > 32*1024*1024)throw new Error('CNR 超过浏览器图形读取上限（32 MiB）');
    text += decoder.decode(chunk.value,{stream:true});
  } text += decoder.decode(); } finally { await reader.cancel(); }
  const lines = text.split(/\r?\n/).filter(line=>line.trim() && !line.startsWith('#'));
  const fields = lines.shift()?.split('\t').map(field=>field.toLowerCase()) ?? [];
  const indexes = ['chromosome','start','end','log2'].map(field=>fields.indexOf(field));
  if(indexes.some(index=>index<0))throw new Error('CNR 缺少 chromosome/start/end/log2 列');
  const result: CNRBin[] = [];
  for(const line of lines){const parts=line.split('\t');
    if(indexes.some(index=>parts[index]===undefined || parts[index]==='' || parts[index]==='.'))continue;
    const [chromosome,start,end,log2]=indexes.map(index=>parts[index]);
    const bin={chromosome,start:Number(start),end:Number(end),log2:Number(log2)};
    if(Number.isSafeInteger(bin.start)&&Number.isSafeInteger(bin.end)&&bin.start>=0&&bin.end>bin.start&&Number.isFinite(bin.log2))result.push(bin);
  }
  return result;
}

// Region rows are merged genomic bins, not the original CNR target probes.
export function CNVRegionPlot({ taskId, variant, isOpen, onClose }: {
  taskId: string; variant: CNVSegment; isOpen: boolean; onClose: () => void;
}) {
  const [cnr, setCNR] = React.useState<CNRBin[]>([]);
  const [cnrStatus, setCNRStatus] = React.useState('');
  const cnrCache = React.useRef<{task: string; version: string; bins: CNRBin[]} | null>(null);
  const [flankKB, setFlankKB] = React.useState(100);
  const [rows, setRows] = React.useState<CNVSegment[]>([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  const [width, setWidth] = React.useState(800);
  const [hover, setHover] = React.useState<CNVSegment | null>(null);
  const holder = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const start = Math.max(0, variant.startPosition - flankKB * 1000);
  const end = variant.endPosition + flankKB * 1000;
  React.useEffect(() => {
    if(!isOpen)return;
    const controller=new AbortController(); setCNR([]);setCNRStatus('原始 CNR 读取中…');
    void (async()=>{
      const session=await getIGVSession(taskId,controller.signal);
      if(variant.attemptId && session.executionAttemptId !== variant.attemptId)throw new Error('执行版本已改变');
      const track=session.tracks?.find(track=>track.format==='cnr');
      if(!track?.available){setCNRStatus('当前归档接口未提供可读取的原始 CNR，仅显示 Region 合并信号');return;}
      let bins=cnrCache.current?.task===taskId&&cnrCache.current.version===session.version?cnrCache.current.bins:undefined;
      if(!bins){
        const signed=await getIGVTrackURLs(taskId,session.version,[track.id],controller.signal);
        const target=signed.tracks.find(value=>value.id===track.id);if(!target)throw new Error('CNR 读取授权缺失');
        bins=await readCNR(target.url,controller.signal);
        if(controller.signal.aborted)return;
        cnrCache.current={task:taskId,version:session.version,bins};
      }
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
    if (!isOpen || !holder.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, Math.floor(entries[0].contentRect.width))));
    observer.observe(holder.current); return () => observer.disconnect();
  }, [isOpen]);
  const valid = React.useMemo(() => rows.filter(row => row.log2Ratio !== null && Number.isFinite(row.log2Ratio)), [rows]);
  const bins = React.useMemo(()=>cnr.filter(bin=>contig(bin.chromosome)===contig(variant.chromosome)&&bin.start<end&&bin.end>start),[cnr,variant.chromosome,start,end]);
  const minimum = bins.reduce((value,bin)=>Math.min(value,bin.log2),Math.min(-1.5, ...valid.map(row => row.log2Ratio!)));
  const maximum = bins.reduce((value,bin)=>Math.max(value,bin.log2),Math.max(1, ...valid.map(row => row.log2Ratio!)));
  const x = (position: number) => 54 + (position - start) / Math.max(1, end-start) * (width - 74);
  const y = (ratio: number) => 20 + (maximum-ratio) / (maximum-minimum) * 210;
  React.useEffect(() => {
    if (!isOpen || !canvas.current) return;
    const dpr = window.devicePixelRatio || 1;
    const node = canvas.current; node.width = width*dpr; node.height = 270*dpr;
    node.style.width = `${width}px`; node.style.height = '270px';
    const ctx = node.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr,dpr); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,width,270);
    ctx.fillStyle = '#fff5cc'; ctx.fillRect(x(variant.startPosition),20, Math.max(1,x(variant.endPosition)-x(variant.startPosition)),210);
    ctx.font = '11px sans-serif';
    for (let i=0;i<=4;i++) {
      const value = minimum+(maximum-minimum)*i/4;
      ctx.strokeStyle = '#e5e7eb'; ctx.beginPath(); ctx.moveTo(54,y(value)); ctx.lineTo(width-20,y(value)); ctx.stroke();
      ctx.fillStyle='#57606a'; ctx.textAlign='right'; ctx.fillText(value.toFixed(2),48,y(value)+4);
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
    ctx.restore(); ctx.fillStyle='#374151'; ctx.textAlign='left'; ctx.fillText('log2 ratio',4,12);
  }, [isOpen,width,valid,bins,start,end,minimum,maximum,variant]);
  if (!isOpen) return null;
  return <div role="dialog" aria-modal="true" aria-label="CNV Region 区域信号图" onKeyDown={e => {if(e.key==='Escape'){e.stopPropagation();onClose();}}} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 p-3">
    <section className="w-[900px] max-w-full rounded-lg border border-border-default bg-canvas-default p-4 shadow-xl">
      <header className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{variant.chromosome} · CNV Region 信号图</h3><button type="button" autoFocus onClick={onClose} aria-label="关闭区域信号图"><X className="h-5 w-5" /></button></header>
      <div className="my-3 flex flex-wrap items-center gap-3 text-xs"><label className="flex items-center gap-2">选中区间两侧扩展<input aria-label="窗口两侧扩展 kb" type="number" min="0" max="100000" value={flankKB} onChange={e => {const v=Number(e.target.value);if(Number.isFinite(v)&&v>=0&&v<=100000)setFlankKB(v);}} className="w-24 rounded border border-border-default bg-canvas-default px-2 py-1" />kb</label><span>{start.toLocaleString()}–{end.toLocaleString()}（窗口 {(end-start).toLocaleString()} bp）</span></div>
      <p className="mb-2 text-xs text-fg-muted">来源：完整 Region Parquet 中与窗口相交的合并区间，横线表示区间 log2，圆点表示其中点。缺测处留空；虚线为 log2=0。显示窗口不改变检出时的 bin 大小。灰色散点为归档原始 CNR bin，不插值或填补缺测。</p>
      <p className="mb-2 text-xs text-fg-muted">{cnrStatus}；当前窗口 {bins.length.toLocaleString()} 个原始 bin。</p>
      <div ref={holder}>{loading ? <p role="status" className="py-20 text-center text-sm">正在浏览器中查询区域数据…</p> : error ? <div role="alert" className="py-8 text-sm text-danger-fg">{error}<button className="ml-3 underline" onClick={()=>setRetry(v=>v+1)}>重试</button></div> : <canvas ref={canvas} aria-label={`${valid.length} 个有 log2 数值的 Region 区间；可在检出表中读取原始数值`} onMouseMove={event => {
        const rect=event.currentTarget.getBoundingClientRect(); const coordinate=start+(event.clientX-rect.left-54)/(width-74)*(end-start);
        setHover(valid.find(row=>coordinate>=row.startPosition&&coordinate<=row.endPosition)??null);
      }} onMouseLeave={()=>setHover(null)} className="max-w-full" />}</div>
      <p className="mt-2 min-h-5 text-xs text-fg-muted">{hover ? `${hover.chromosome}:${hover.startPosition}–${hover.endPosition} · log2 ${hover.log2Ratio} · CN ${hover.copyNumber??'未提供'}` : `${valid.length}/${rows.length} 个合并区间提供 log2；蓝色缺失，红色扩增，灰色其他，浅黄色为选中区间。`}</p>
    </section>
  </div>;
}
