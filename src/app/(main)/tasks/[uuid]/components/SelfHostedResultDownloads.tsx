'use client';

import * as React from 'react';
import {api,apiResourceURL} from '@/lib/api';
import {useText} from '@/i18n/useText';
import {errorText} from '@/i18n/errors';
import {ActionButton} from '@/components/shared/ActionButton';

interface File {id:string;filename:string;size_bytes:number}
interface Catalog {attempt_id:string;version?:string;zip_status:string;zip_error?:string;zip?:File;files?:File[];bams:File[];missing:string[]}

export function SelfHostedResultDownloads({taskId}:{taskId:string}) {
 const t=useText();
 const [catalog,setCatalog]=React.useState<Catalog|null>(null);
 const [error,setError]=React.useState('');
 const [busy,setBusy]=React.useState(false);
 const [reload,setReload]=React.useState(0);
 const base=`/v1/tasks/${encodeURIComponent(taskId)}/downloads`;
 const generation=React.useRef(0);
 React.useEffect(()=>{
  const current=++generation.current;
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  setCatalog(null);setError('');setBusy(false);
  const load=async()=>{
   try {
    const next=await api.get<Catalog>(base,{signal:controller.signal});
    if(controller.signal.aborted||current!==generation.current)return;
    setCatalog(next);setError('');
    if(next.zip_status==='building')timer=setTimeout(()=>void load(),3000);
   }catch(cause){if(!controller.signal.aborted&&current===generation.current)setError(errorText(cause,t));}
  };
  void load();
  return ()=>{controller.abort();clearTimeout(timer);++generation.current;};
 },[base,reload,t]);
 const prepare=async()=>{
  if(busy)return;
  const current=generation.current;
  setBusy(true);setError('');
  try {
   await api.post<Catalog>(`${base}/prepare`,{});
   if(current===generation.current)setReload(value=>value+1);
  }catch(cause){if(current===generation.current)setError(errorText(cause,t));}
  finally{if(current===generation.current)setBusy(false);}
 };
 const link=(file:File)=>apiResourceURL(`${base}/files/${encodeURIComponent(file.id)}`,{attempt:catalog!.attempt_id,...(catalog!.version?{version:catalog!.version}:{})});
 const size=(bytes:number)=>bytes>=1e9?`${(bytes/1e9).toLocaleString(t.locale,{maximumFractionDigits:2})} GB`:`${(bytes/1e6).toLocaleString(t.locale,{maximumFractionDigits:2})} MB`;
 const fileLink=(file:File,label:string)=><a href={link(file)} download={file.filename} className="inline-flex shrink-0 items-center rounded-md bg-accent-emphasis px-3 py-2 text-sm text-fg-on-emphasis">{label}</a>;
 return <section className="space-y-4" aria-label={t('tasks.archivedFileDownloadse08d1b')}>
  <div><h3 className="text-base font-semibold">{t('tasks.downloadArchivedFiles21d22a')}</h3><p className="mt-1 text-xs text-fg-muted">{t('selfHostedDownloads.description')}</p></div>
  {error&&<div role="alert" className="rounded-lg border border-danger-muted bg-danger-subtle p-3 text-sm text-danger-fg">{error}<ActionButton permission={null} action="retry" variant="ghost" onClick={()=>setReload(value=>value+1)}>{t('pipeline.retrye2d53a')}</ActionButton></div>}
  {!catalog&&!error&&<p role="status" className="text-sm text-fg-muted">{t('tasks.readingDownloadInformationb590b7')}</p>}
  {catalog&&<>
   <article className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-default bg-canvas-default p-5">
    <div><h4 className="font-semibold">{t('selfHostedDownloads.resultZIP')}</h4><p className="mt-1 text-xs text-fg-muted">{catalog.zip?`${catalog.zip.filename} · ${size(catalog.zip.size_bytes)}`:t('selfHostedDownloads.zipDescription')}</p></div>
    {catalog.zip_status==='ready'&&catalog.zip?fileLink(catalog.zip,t('selfHostedDownloads.downloadZIP')):<ActionButton permission={null} action="download" variant="primary" disabled={busy||catalog.zip_status==='building'} onClick={()=>void prepare()}>{busy||catalog.zip_status==='building'?t('tasks.preparingZipeca113'):t('selfHostedDownloads.prepareZIP')}</ActionButton>}
    {catalog.zip_error&&<p role="alert" className="w-full text-sm text-danger-fg">{catalog.zip_error}</p>}
   </article>
   <article className="rounded-xl border border-border-default bg-canvas-default p-5"><h4 className="mb-3 font-semibold">{t('selfHostedDownloads.individualFiles')}</h4><div className="space-y-3">{(catalog.files??catalog.bams).map(file=><div key={file.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3"><div className="min-w-0"><p className="break-all text-sm">{file.filename}</p><p className="mt-1 text-xs text-fg-muted">{size(file.size_bytes)}</p></div>{fileLink(file,t('data.download2b9d01'))}</div>)}</div></article>
   {!!catalog.missing.length&&<details className="rounded-lg bg-canvas-subtle p-3 text-xs text-fg-muted"><summary>{t('tasks.viewOmittedOutputs8b837d')}{catalog.missing.length}</summary><ul className="mt-2 space-y-1">{catalog.missing.map((message,index)=><li key={index}>{message}</li>)}</ul></details>}
  </>}
 </section>;
}
