'use client';
import * as React from 'react';
import {assessmentStatus,cancelAssessment,type AssessmentStatus} from '@/lib/assessment/client';
import {reevaluateBrowserResults,retryBrowserAssessment} from '@/lib/parquet-browser';
import { ToolbarPopover } from '@/components/shared/ToolbarPopover';
import { Info } from 'lucide-react';
export function AssessmentStatusBar({taskId,table}:{taskId:string;table?:string}){
 const [status,setStatus]=React.useState<AssessmentStatus|undefined>(()=>assessmentStatus(taskId));
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 React.useEffect(()=>{setStatus(assessmentStatus(taskId));const update=(event:Event)=>{const value=(event as CustomEvent<AssessmentStatus>).detail;if(value.taskId===taskId)setStatus(value);};window.addEventListener('yijian:assessment-status',update);return()=>window.removeEventListener('yijian:assessment-status',update);},[taskId]);
 if(!status)return null;
 return <div className="yj-assessment-status shrink-0" data-state={status.state}>
 <span className="yj-status-dot" aria-hidden="true" />
 <span role="status">
 <span>{status.state==='loading'?`${status.phase==='context'?'正在加载初评证据':status.phase==='finalize'?'正在汇总全量候选':status.phase==='transfer'?'正在整理初评结果':'浏览器全量初评中'} · 已处理 ${status.processed.toLocaleString()} 条`:status.state==='ready'?`初评完成 · 自动置顶 ${status.pinned??0} 条`:'初评失败'}</span>
 </span>
 {status.state==='loading'&&<button type="button" className="yj-tool-button" onClick={()=>cancelAssessment(taskId)}>取消本地初评</button>}
 {status.state==='ready'&&table&&<span>当前类型自动建议 {status.pinnedByTable?.[table]??0} 条</span>}
 {!!status.pending?.length&&<span className="text-warning-fg">{status.pending.length} 项证据限制 · {status.pending[0]}</span>}
 <ToolbarPopover label="评估信息" icon={<Info size={14} />}>
   <div className="space-y-4 text-xs leading-relaxed">
     <section><h4 className="mb-1 font-semibold">评估版本</h4><p className="break-words text-fg-muted">{status.version || '未提供'}</p></section>
     <section><h4 className="mb-1 font-semibold">证据可用性</h4>{status.pending?.length ? <ul className="space-y-2 text-fg-muted">{status.pending.map(x=><li key={x}>{x}</li>)}</ul> : <p className="text-fg-muted">当前无额外可用性提示；自动初评仍需专业复核。</p>}</section>
     <section><h4 className="mb-1 font-semibold">资源版本</h4><p className="break-words text-fg-muted">{status.packVersion && status.packVersion !== 'unavailable' ? `Human Phenotype Ontology、ClinGen、Mondo · ${status.packVersion}` : '评估资源不可用或尚未加载'}</p></section>
   </div>
 </ToolbarPopover>
 {status.state==='error'&&<button type="button" className="text-blue-600 underline" onClick={()=>void retryBrowserAssessment(taskId)}>重试本地初评</button>}
 {status.reassessmentAvailable&&<button type="button" disabled={busy||status.state==='loading'} className="whitespace-nowrap text-blue-600 underline" onClick={async()=>{setBusy(true);setError('');try{await reevaluateBrowserResults(taskId);}catch(e){setError(e instanceof Error?e.message:'重新评估失败');}finally{setBusy(false);}}}>{busy?'准备中…':'证据版本已更新，重新评估'}</button>}
 {(status.error||error)&&<span className="text-red-600">{error||status.error}</span>}
 </div>;
}
