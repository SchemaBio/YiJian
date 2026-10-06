'use client';
import * as React from 'react';
import {X,Copy} from 'lucide-react';
import type {CNVExon} from '../types';
import {loadCNR,exonSignals,type ExonSignal} from '../utils/cnv-signal';

export function CNVExonPlot({taskId,variant,isOpen,onClose}:{taskId:string;variant:CNVExon;isOpen:boolean;onClose:()=>void}) {
  const [signals,setSignals]=React.useState<Map<string,ExonSignal[]>>(new Map());
  const [transcript,setTranscript]=React.useState('');
  const [status,setStatus]=React.useState('');
  const [loading,setLoading]=React.useState(false);
  const [retry,setRetry]=React.useState(0);
  const [copied,setCopied]=React.useState('');
  const [hover,setHover]=React.useState<ExonSignal|null>(null);
  React.useEffect(()=>{
    if(!isOpen)return;
    const controller=new AbortController();setSignals(new Map());setLoading(true);setStatus('');setHover(null);setCopied('');
    void loadCNR(taskId,variant.attemptId,controller.signal).then(bins=>{
      if(controller.signal.aborted)return;
      const grouped=exonSignals(bins,variant.gene,variant.chromosome);setSignals(grouped);
      setTranscript(grouped.has(variant.transcript)?variant.transcript:grouped.keys().next().value??'');
      if(!grouped.size)setStatus('CNR 中没有此基因的完整转录本和外显子注释，无法绘制逐外显子 CN；基因汇总记录不能替代外显子信号。');
    }).catch(error=>{if(!controller.signal.aborted)setStatus(error instanceof Error?error.message:'外显子信号读取失败');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[taskId,variant.attemptId,variant.gene,variant.chromosome,variant.transcript,isOpen,retry]);
  React.useEffect(()=>{if(!isOpen)return;const handle=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopImmediatePropagation();onClose();}};document.addEventListener('keydown',handle,true);return()=>document.removeEventListener('keydown',handle,true);},[isOpen,onClose]);
  if(!isOpen)return null;
  const rows=signals.get(transcript)??[];
  const width=Math.max(680,rows.length*34+100),height=265,left=50,top=20,bottom=215;
  const max=Math.max(4,...rows.map(row=>row.cn))*1.1;
  const y=(cn:number)=>bottom-(cn/max)*(bottom-top);
  const x=(i:number)=>left+(i+0.5)*(width-left-20)/Math.max(1,rows.length);
  const copy=async()=>{try{await navigator.clipboard.writeText(['基因\t转录本\t外显子\t染色体\t起点(1-based)\t终点\tCN估计\tlog2\tbin数',...rows.map(row=>`${variant.gene}\t${transcript}\t${row.exon}\t${variant.chromosome}\t${row.start+1}\t${row.end}\t${row.cn.toFixed(3)}\t${row.log2.toFixed(3)}\t${row.bins}`)].join('\n'));setCopied('已复制');}catch{setCopied('复制失败，可选择下方表格复制');}};
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="外显子 CN 分布" onClick={e=>e.stopPropagation()} className="flex max-h-[85dvh] w-[min(960px,95vw)] flex-col rounded-xl border border-border-default bg-canvas-default shadow-xl">
      <header className="flex shrink-0 items-center justify-between border-b border-border-default px-5 py-3"><div><h3 className="font-semibold">{variant.gene} · 外显子 CN 分布</h3><p className="text-xs text-fg-muted">原始 CNR · 按转录本分组 · 浏览器本地计算</p></div><button autoFocus aria-label="关闭外显子图" onClick={onClose} className="rounded p-2 hover:bg-canvas-inset"><X className="h-5 w-5"/></button></header>
      <div className="min-h-0 overflow-auto p-5">
        {loading?<p role="status" className="py-8 text-center text-fg-muted">读取原始 CNR…</p>:status?<div role="status" className="rounded border border-border-default p-4 text-sm">{status}<button onClick={()=>setRetry(v=>v+1)} className="ml-3 text-accent-fg">重新读取</button></div>:<>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm">转录本<select value={transcript} onChange={e=>{setTranscript(e.target.value);setHover(null);}} className="rounded border border-border-default bg-canvas-default px-2 py-1">{[...signals.keys()].map(id=><option key={id}>{id}</option>)}</select></label><button onClick={copy} className="flex items-center gap-1 rounded border border-border-default px-2 py-1 text-xs"><Copy className="h-3 w-3"/>{copied||'复制图表数据'}</button></div>
          {transcript!==variant.transcript&&<p className="mb-2 text-xs text-fg-muted">报告转录本 {variant.transcript} 没有对应信号；当前显示所选转录本 {transcript}，未合并其他转录本。</p>}
          <div className="overflow-x-auto rounded border border-border-default bg-canvas-subtle">
            <svg width={width} height={height} role="img" aria-label={`${variant.gene} ${transcript} 的 ${rows.length} 个外显子 CN 分布，完整读数见下方表格`}>
              {[0,1,2,3,4].filter(n=>n<=max).map(n=><g key={n}><line x1={left} x2={width-15} y1={y(n)} y2={y(n)} stroke={n===2?'#64748b':'#dbe3ed'} strokeDasharray={n===2?'5 4':'2 3'}/><text x={left-8} y={y(n)+4} textAnchor="end" fontSize={11} fill="#64748b">{n}</text></g>)}
              <text x={7} y={15} fontSize={11} fill="#64748b">CN</text>
              {rows.map((row,i)=><g key={row.exon} onMouseEnter={()=>setHover(row)} onMouseLeave={()=>setHover(null)}>
                <rect x={x(i)-Math.min(10,(width-left)/rows.length/3)} y={y(row.cn)} width={Math.min(20,(width-left)/rows.length*0.6)} height={bottom-y(row.cn)} rx={2} fill={row.cn<1.5?'#0284c7':row.cn>2.5?'#d97706':'#64748b'} opacity={hover===row?1:0.8}><title>{`外显子 ${row.exon} · CN ${row.cn.toFixed(3)} · log2 ${row.log2.toFixed(3)} · ${row.bins} bins`}</title></rect>
                <text x={x(i)} y={bottom+17} textAnchor="middle" fontSize={10} fill="#64748b">{row.exon}</text>
              </g>)}
              <text x={width/2} y={height-10} textAnchor="middle" fontSize={12} fill="#64748b">转录本外显子编号</text>
            </svg>
          </div>
          <p className="mt-2 min-h-5 font-mono text-xs">{hover?`外显子 ${hover.exon} · CN ${hover.cn.toFixed(3)} · log2 ${hover.log2.toFixed(3)} · ${hover.bins} bins`:'悬停查看读数；蓝色 CN <1.5，橙色 CN >2.5，灰色为其他读数。'}</p>
          <p className="my-3 text-xs leading-relaxed text-fg-muted">同一外显子按 CNR weight 聚合 log2；缺少有效 weight 时整组改用 bin 长度加权。CN = 2 × 2^log2，为归一化估计值，未取整。虚线 CN=2 是模型归一化参考；性染色体需结合样本性别及分析校正解释。只绘制有信号的外显子，不补造缺测外显子。</p>
          <details><summary className="cursor-pointer text-sm text-accent-fg">外显子读数表（可选中复制）</summary><div className="mt-2 max-h-56 overflow-auto"><table className="w-full text-center text-xs"><thead className="sticky top-0 bg-canvas-subtle"><tr>{['外显子','起点(1-based)','终点','CN 估计','log2','bin 数'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.exon} className="border-b border-border-subtle"><td className="p-1.5">{row.exon}</td><td>{row.start+1}</td><td>{row.end}</td><td>{row.cn.toFixed(3)}</td><td>{row.log2.toFixed(3)}</td><td>{row.bins}</td></tr>)}</tbody></table></div></details>
        </>}
      </div>
    </section>
  </div>;
}
