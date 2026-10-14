'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton } from '@/components/shared/ActionButton';

import * as React from 'react';

import { CNVPlotWindow, type CNVPlotAnchor } from './CNVPlotWindow';
import { HoverHint } from '@/components/shared/HoverHint';
import type {CNVExon} from '../types';
import {loadCNR,exonSignals,type ExonSignal} from '../utils/cnv-signal';

export function CNVExonPlot({taskId,variant,isOpen,onClose,anchor}:{taskId:string;variant:CNVExon;isOpen:boolean;onClose:()=>void;anchor?:CNVPlotAnchor}) {
  const t = useText();
  const [signals,setSignals]=React.useState<Map<string,ExonSignal[]>>(new Map());
  const [transcript,setTranscript]=React.useState('');
  const [status,setStatus]=React.useState('');
  const [loadFailed,setLoadFailed]=React.useState(false);
  const [loading,setLoading]=React.useState(false);
  const [retry,setRetry]=React.useState(0);
  const [copied,setCopied]=React.useState('');
  const [hover,setHover]=React.useState<ExonSignal|null>(null);
  React.useEffect(()=>{
    if(!isOpen)return;
    const controller=new AbortController();setSignals(new Map());setLoading(true);setStatus('');setLoadFailed(false);setHover(null);setCopied('');
    void loadCNR(taskId,variant.attemptId,controller.signal).then(bins=>{
      if(controller.signal.aborted)return;
      const grouped=exonSignals(bins,variant.gene,variant.chromosome);setSignals(grouped);
      setTranscript(grouped.has(variant.transcript)?variant.transcript:grouped.keys().next().value??'');
      if(!grouped.size)setStatus(t("tasks.cnrLacksCompleteTranscriptAndExonAnnotationsf510e2"));
    }).catch(error=>{if(!controller.signal.aborted){setLoadFailed(true);setStatus(error instanceof Error ? errorText(error, t):t("tasks.unableToReadExonSignaldae769"));}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[taskId,variant.attemptId,variant.gene,variant.chromosome,variant.transcript,isOpen,retry]);
  if(!isOpen)return null;
  const rows=signals.get(transcript)??[];
  const width=Math.max(680,rows.length*34+100),height=265,left=50,top=20,bottom=215;
  const max=Math.max(4,...rows.map(row=>row.cn))*1.1;
  const y=(cn:number)=>bottom-(cn/max)*(bottom-top);
  const x=(i:number)=>left+(i+0.5)*(width-left-20)/Math.max(1,rows.length);
  const copy=async()=>{try{await navigator.clipboard.writeText([t("tasks.geneTtranscriptTexonTchromosomeTstartBasedTendd4a897"),...rows.map(row=>`${variant.gene}\t${transcript}\t${row.exon}\t${variant.chromosome}\t${row.start+1}\t${row.end}\t${row.cn.toFixed(3)}\t${row.log2.toFixed(3)}\t${row.bins}`)].join('\n'));setCopied(t("billing.copiede381a5"));}catch{setCopied(t("tasks.copyFailedSelectTheTableBelowTo92b323"));}};
  return <CNVPlotWindow anchor={anchor} open={isOpen} onClose={onClose} title={t("tasks.exonCnDistribution2ecb13", {p0: String(variant.gene)})}>
      <div className="min-h-0">

        {loading?<p role="status" className="py-8 text-center text-fg-muted">{t("tasks.readingOriginalCnr550c8e")}</p>:status?<div role={loadFailed?'alert':'status'} className={`rounded-md border p-4 text-sm ${loadFailed?'border-danger-muted bg-danger-subtle text-danger-fg':'border-border-default text-fg-muted'}`}>{status}<ActionButton variant="ghost" onClick={()=>setRetry(v=>v+1)} className="yj-tool-button ml-3">{t("tasks.readAgain778497")}</ActionButton></div>:<>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm">{t("history.transcript96b6d7")}<select value={transcript} onChange={e=>{setTranscript(e.target.value);setHover(null);}} className="rounded border border-border-default bg-canvas-default px-2 py-1">{[...signals.keys()].map(id=><option key={id}>{id}</option>)}</select></label><ActionButton action="copy" variant="ghost" onClick={copy} className="yj-tool-button">{copied||t("tasks.copyChartData8fefdf")}</ActionButton></div>
          {transcript!==variant.transcript&&<p className="mb-2 text-xs text-fg-muted">{t("tasks.focusedTranscript69a42f")}{variant.transcript} {t("tasks.hasNoSignalShowingSelectedTranscript2c8e2f")}{transcript}{t("tasks.withoutMergingOtherTranscriptsed1a88")}</p>}
          <div className="overflow-x-auto rounded border border-border-default bg-canvas-subtle">
            <svg width={width} height={height} role="img" aria-label={t("tasks.cnDistributionForExonsOfCompleteReadings5d89a4", {p0: String(variant.gene), p1: String(transcript), p2: String(rows.length)})}>
              {[0,1,2,3,4].filter(n=>n<=max).map(n=><g key={n}><line x1={left} x2={width-15} y1={y(n)} y2={y(n)} stroke={n===2?'var(--color-fg-muted)':'var(--color-border-default)'} strokeDasharray={n===2?'5 4':'2 3'}/><text x={left-8} y={y(n)+4} textAnchor="end" fontSize={11} fill="var(--color-fg-muted)">{n}</text></g>)}
              <text x={7} y={15} fontSize={11} fill="var(--color-fg-muted)">CN</text>
              {rows.map((row,i)=><g key={row.exon} onMouseEnter={()=>setHover(row)} onMouseLeave={()=>setHover(null)}>
                <HoverHint content={t("tasks.exonCnLogBinsc7fa86", {p0: String(row.exon), p1: String(formatNumericString(row.cn.toFixed(3), t.locale)), p2: String(formatNumericString(row.log2.toFixed(3), t.locale)), p3: String(row.bins)})}><circle tabIndex={0} cx={x(i)} cy={y(row.cn)} r={hover===row?6:4.5} onFocus={()=>setHover(row)} onBlur={()=>setHover(null)} fill={row.cn<1.5?'#0284c7':row.cn>2.5?'#d97706':'var(--color-fg-muted)'} opacity={hover===row?1:0.8} /></HoverHint>
                <text x={x(i)} y={bottom+17} textAnchor="middle" fontSize={10} fill="var(--color-fg-muted)">{row.exon}</text>
              </g>)}
              <text x={width/2} y={height-10} textAnchor="middle" fontSize={12} fill="var(--color-fg-muted)">{t("tasks.transcriptExonNumber7e61a9")}</text>
            </svg>
          </div>
          <p className="mt-2 min-h-5 font-mono text-xs">{hover?t("tasks.exonCnLogBinsc7fa86", {p0: String(hover.exon), p1: String(formatNumericString(hover.cn.toFixed(3), t.locale)), p2: String(formatNumericString(hover.log2.toFixed(3), t.locale)), p3: String(hover.bins)}):t("tasks.hoverForReadingsBlueCnOrangeCn130783")}</p>
          <p className="my-3 text-xs leading-relaxed text-fg-muted">{t("tasks.exonLogIsAggregatedByCnrWeight6e5bff")}</p>
          <details><summary className="cursor-pointer text-sm text-accent-fg">{t("tasks.exonReadingsSelectToCopyfaecf2")}</summary><div className="mt-2 max-h-56 overflow-auto"><table className="w-full text-center text-xs"><thead className="sticky top-0 bg-canvas-subtle"><tr>{[t("history.exonfb0270"),t("tasks.startBased6b4cb3"),t("tasks.enda7fe11"),t("tasks.cnEstimate4d0717"),'log2',t("tasks.binCount4a348a")].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.exon} className="border-b border-border-subtle"><td className="p-1.5">{row.exon}</td><td>{row.start+1}</td><td>{row.end}</td><td>{formatNumericString(row.cn.toFixed(3), t.locale)}</td><td>{formatNumericString(row.log2.toFixed(3), t.locale)}</td><td>{row.bins}</td></tr>)}</tbody></table></div></details>
        </>}
      </div>
  </CNVPlotWindow>;
}
