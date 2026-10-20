'use client';

import * as React from 'react';
import { Input } from '@schema/ui-kit';
import { Loader2, Search } from 'lucide-react';
import { useText } from '@/i18n/useText';
import { errorText } from '@/i18n/errors';
import type { ResourcePage } from '@/lib/resource-pages';
import { ActionButton } from './ActionButton';

export interface ResourcePageRequest {search:string;page:number;pageSize:number;signal:AbortSignal}

interface Props<T extends {id:string}> {
  label:string;
  searchPlaceholder:string;
  value:string;
  selectedItem:T|null;
  onSelect:(item:T|null)=>void;
  loadPage:(request:ResourcePageRequest)=>Promise<ResourcePage<T>>;
  title:(item:T)=>React.ReactNode;
  details?:(item:T)=>React.ReactNode;
  disabled?:boolean;
}

export function TaskResourcePicker<T extends {id:string}>({label,searchPlaceholder,value,selectedItem,onSelect,loadPage,title,details,disabled=false}:Props<T>) {
  const t=useText();
  const radioName=React.useId();
  const searchId=React.useId();
  const [query,setQuery]=React.useState('');
  const [request,setRequest]=React.useState({search:'',page:1});
  const [result,setResult]=React.useState<ResourcePage<T>>({items:[],total:0});
  const [loading,setLoading]=React.useState(true);
  const [failure,setFailure]=React.useState<unknown>(null);
  const [retry,setRetry]=React.useState(0);
  const pageSize=20;
  const searching=query.trim()!==request.search;

  React.useEffect(()=>{
    const timer=setTimeout(()=>setRequest(current=>current.search===query.trim()?current:{search:query.trim(),page:1}),250);
    return()=>clearTimeout(timer);
  },[query]);

  React.useEffect(()=>{
    const controller=new AbortController();let active=true;
    setLoading(true);setFailure(null);setResult({items:[],total:0});
    loadPage({...request,pageSize,signal:controller.signal}).then(page=>{
      if(active)setResult(page);
    }).catch(error=>{if(active)setFailure(error);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[request,retry,loadPage]);

  const busy=loading||searching;
  const pages=Math.max(1,Math.ceil(result.total/pageSize));
  return <section className="min-w-0 space-y-3 rounded-md border border-border-default bg-canvas-default p-4">
    <h3 className="text-sm font-medium text-fg-default">{label}</h3>
    <label className="sr-only" htmlFor={searchId}>{searchPlaceholder}</label>
    <Input id={searchId} type="search" placeholder={searchPlaceholder} value={query} disabled={disabled}
      onChange={event=>setQuery(event.target.value)} leftElement={<Search className="h-4 w-4"/>}/>
    <p className="text-xs text-fg-muted">{t('resourcePicker.searchAll')}</p>
    {value&&<div className="flex items-start justify-between gap-2 rounded-md border border-accent-muted bg-accent-subtle p-3">
      <div className="min-w-0"><p className="text-xs text-fg-muted">{t('resourcePicker.selected')}</p>
        <div className="break-words text-sm font-medium">{selectedItem?title(selectedItem):value}</div>
        <p className="break-all font-mono text-xs text-fg-muted">{value}</p>
      </div>
      <ActionButton permission={null} action="close" iconOnly size="small" variant="ghost" disabled={disabled}
        aria-label={`${t('resourcePicker.clearSelection')} · ${label}`} onClick={()=>onSelect(null)}/>
    </div>}
    <div role="group" aria-label={label} aria-busy={busy} className="h-[320px] overflow-y-auto rounded-md border border-border-default md:h-[380px]">
      {busy?<div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin"/>{t('resourcePicker.loading')}</div>
        :failure?<div role="alert" className="space-y-3 p-4 text-sm text-danger-fg"><p>{errorText(failure,t)}</p><ActionButton permission={null} action="retry" size="small" disabled={disabled} onClick={()=>setRetry(n=>n+1)}>{t('resourcePicker.retry')}</ActionButton></div>
        :result.items.length===0?<p className="p-6 text-center text-sm text-fg-muted">{t('resourcePicker.noResults')}</p>
        :result.items.map(item=><label key={item.id} className={`flex min-h-20 cursor-pointer items-start gap-3 border-b border-border-default px-3 py-3 last:border-b-0 ${value===item.id?'bg-accent-subtle':'hover:bg-canvas-subtle'} ${disabled?'cursor-not-allowed opacity-50':''}`}>
          <input type="radio" name={radioName} value={item.id} checked={value===item.id} disabled={disabled} onChange={()=>onSelect(item)} className="mt-1 shrink-0 accent-[var(--color-accent-emphasis)]"/>
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium text-fg-default">{title(item)}</span>
            <span className="block break-all font-mono text-xs leading-5 text-fg-muted">{item.id}</span>
            {details&&<span className="block break-words text-xs leading-5 text-fg-muted">{details(item)}</span>}
          </span>
        </label>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span aria-live="polite" className="text-xs text-fg-muted">{!busy&&!failure?t('resourcePicker.pageSummary',{p0:String(request.page),p1:String(pages),p2:String(result.total)}):''}</span>
      <div className="flex gap-1"><ActionButton permission={null} action="previous" size="small" disabled={disabled||busy||request.page<=1} onClick={()=>setRequest(current=>({...current,page:current.page-1}))}>{t('resourcePicker.previous')}</ActionButton>
        <ActionButton permission={null} action="next" size="small" disabled={disabled||busy||request.page>=pages} onClick={()=>setRequest(current=>({...current,page:current.page+1}))}>{t('resourcePicker.next')}</ActionButton></div>
    </div>
  </section>;
}
