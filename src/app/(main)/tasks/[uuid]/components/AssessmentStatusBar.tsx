'use client';
import * as React from 'react';
import {assessmentStatus,cancelAssessment,type AssessmentStatus} from '@/lib/assessment/client';
import {reevaluateBrowserResults,retryBrowserAssessment} from '@/lib/parquet-browser';
export function AssessmentStatusBar({taskId,table}:{taskId:string;table?:string}){
 const [status,setStatus]=React.useState<AssessmentStatus|undefined>(()=>assessmentStatus(taskId));
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 React.useEffect(()=>{setStatus(assessmentStatus(taskId));const update=(event:Event)=>{const value=(event as CustomEvent<AssessmentStatus>).detail;if(value.taskId===taskId)setStatus(value);};window.addEventListener('yijian:assessment-status',update);return()=>window.removeEventListener('yijian:assessment-status',update);},[taskId]);
 if(!status)return null;
 return <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-border-subtle bg-canvas-subtle px-3 py-1.5 text-xs" role="status">
 <span>{status.state==='loading'?`浏览器全量初评中 · 已处理 ${status.processed.toLocaleString()} 条`:status.state==='ready'?`初评完成 · 自动置顶 ${status.pinned??0} 条`:'初评失败'}</span>
 {status.state==='loading'&&<button type="button" className="whitespace-nowrap text-blue-600 underline" onClick={()=>cancelAssessment(taskId)}>取消本地初评</button>}
 {status.state==='ready'&&table&&<span>当前类型自动建议 {status.pinnedByTable?.[table]??0} 条</span>}
 {status.state==='ready'&&<span className="text-text-muted" title={status.version}>germline-browser-assessment-v1</span>}
 {!!status.pending?.length&&<details><summary className="cursor-pointer text-text-muted">证据可用性</summary><ul className="max-w-lg space-y-1 py-2">{status.pending.map(x=><li key={x}>{x}</li>)}</ul></details>}
 {status.packVersion&&status.packVersion!=='unavailable'&&<details><summary className="cursor-pointer text-text-muted">资源版本</summary><p>本服务使用 Human Phenotype Ontology、ClinGen 和 Mondo。{status.packVersion}</p></details>}
 {status.state==='error'&&<button type="button" className="text-blue-600 underline" onClick={()=>void retryBrowserAssessment(taskId)}>重试本地初评</button>}
 {status.reassessmentAvailable&&<button type="button" disabled={busy||status.state==='loading'} className="whitespace-nowrap text-blue-600 underline" onClick={async()=>{setBusy(true);setError('');try{await reevaluateBrowserResults(taskId);}catch(e){setError(e instanceof Error?e.message:'重新评估失败');}finally{setBusy(false);}}}>{busy?'准备中…':'证据版本已更新，重新评估'}</button>}
 {(status.error||error)&&<span className="text-red-600">{error||status.error}</span>}
 </div>;
}
