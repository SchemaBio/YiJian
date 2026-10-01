'use client';

import * as React from 'react';
import { Download, X } from 'lucide-react';
import type { TableFilterState } from '../types';
import { exportEffectiveTable } from '../result-api';
import { api } from '@/lib/api';
import { retainBrowserTable, refreshBrowserTable } from '@/lib/parquet-browser';

const OPS = [
  ['contains', '包含'], ['equals', '精确匹配'], ['in', '任一匹配'],
  ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['between', '范围'],
  ['is_missing', '缺失'], ['is_not_missing', '非缺失'],
] as const;
const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte', 'between']);

type FilterOperator = typeof OPS[number][0];

function label(field: string): string {
  const common: Record<string, string> = {
    Chromosome: '染色体', Position: '位置', Gene: '基因', Type: '类型', VAF: '样本 VAF',
    GnomAD_AF: 'gnomAD AF', GnomAD_AF_EAS: 'gnomAD 东亚 AF', ClinVar_Sig: 'ClinVar 意义',
    acmgClassification: 'ACMG 评定', reviewed: '复核状态', reported: '回报状态',
  };
  return common[field] ?? field.replaceAll('_', ' ');
}

export function ParquetColumnFilterBar({
  taskId, table,
  columns,
  columnTypes,
  state,
  onChange,
}: {
  taskId?: string;
  table?: Parameters<typeof exportEffectiveTable>[1];
  columns: string[];
  columnTypes?: Record<string, 'text' | 'number' | 'enum' | 'boolean'>;
  state: TableFilterState;
  onChange: (state: TableFilterState) => void;
}) {
  const [views,setViews]=React.useState<Array<{name:string;stateJson:string;version:number}>>([]);
  const [viewName,setViewName]=React.useState('');
  const [selectedView,setSelectedView]=React.useState('');
  const [viewMessage,setViewMessage]=React.useState('');
  const [viewSaving,setViewSaving]=React.useState(false);
  const stateRef=React.useRef(state);stateRef.current=state;
  const changeRef=React.useRef(onChange);changeRef.current=onChange;
  const viewsURL=taskId&&table?`/v1/tasks/${encodeURIComponent(taskId)}/results/tables/${table}/views`:'';
  const scopeRef=React.useRef(viewsURL);scopeRef.current=viewsURL;
  React.useEffect(()=>{if(taskId&&table)return retainBrowserTable(taskId,table);},[taskId,table]);
  React.useEffect(()=>{
    if(!viewsURL)return;
    const controller=new AbortController();
    setViews([]);setViewName('');setSelectedView('');setViewMessage('');setViewSaving(false);
    void api.get<typeof views>(viewsURL,{signal:controller.signal}).then(setViews).catch(cause=>{if(!controller.signal.aborted)setViewMessage(cause instanceof Error?cause.message:'方案读取失败');});
    return()=>controller.abort();
  },[viewsURL]);
  React.useEffect(()=>{
    const changed=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(detail?.taskId===taskId&&detail?.table===table){setViewMessage('判读修改已同步');changeRef.current({...stateRef.current});}
    };
    const failed=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table===table)setViewMessage('修改同步暂时失败，页面保留上次已同步的数据');};
    window.addEventListener('yijian:result-overlays-synced',changed);
    window.addEventListener('yijian:result-sync-error',failed);
    return()=>{window.removeEventListener('yijian:result-overlays-synced',changed);window.removeEventListener('yijian:result-sync-error',failed);};
  },[taskId,table]);
  const saveView=async()=>{
    if(!viewsURL||!viewName.trim()||viewSaving)return;
    setViewSaving(true);const scope=viewsURL;
    try {
      const current=views.find(v=>v.name===viewName.trim());
      await api.put(viewsURL,{name:viewName.trim(),state:{...stateRef.current,page:1},expectedVersion:current?.version??0});
      const next=await api.get<typeof views>(viewsURL);if(scopeRef.current===scope){setViews(next);setViewMessage('个人筛选方案已保存，可跨设备恢复');}
    }catch(cause){if(scopeRef.current===scope){setViewMessage(cause instanceof Error?cause.message:'方案保存失败');try{const next=await api.get<typeof views>(viewsURL);if(scopeRef.current===scope)setViews(next);}catch{/* keep current choices */}}}
    finally{if(scopeRef.current===scope)setViewSaving(false);}
  };
  const applyView=()=>{const v=views.find(v=>v.name===selectedView);if(v){try{onChange({...JSON.parse(v.stateJson),page:1});setViewName(v.name);setViewMessage('已恢复个人筛选方案');}catch{setViewMessage('筛选方案无效');}}};
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState('');
  const exportTable = async () => {
    if (!taskId || !table) return;
    setExporting(true); setExportError('');
    try { const result = await exportEffectiveTable(taskId, table, state); const url = URL.createObjectURL(result.blob); const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (cause) { setExportError(cause instanceof Error ? cause.message : '导出失败'); }
    finally { setExporting(false); }
  };
  const [column, setColumn] = React.useState('');
  const [operator, setOperator] = React.useState<FilterOperator>('contains');
  const [value, setValue] = React.useState('');
  const filters = state.columnFilters ?? [];

  React.useEffect(() => {
    if (!column && columns.length) setColumn(columns[0]);
  }, [column, columns]);

  const addFilter = () => {
    if (!column || (!['is_missing', 'is_not_missing'].includes(operator) && !value.trim())) return;
    const filter = {
      column,
      operator,
      ...(['is_missing', 'is_not_missing'].includes(operator)
        ? {}
        : { value: operator === 'in' || operator === 'between' ? value.split(',').map(part => part.trim()).filter(Boolean) : value.trim() }),
    };
    onChange({ ...state, columnFilters: [...filters.filter(item => item.column !== column), filter], page: 1 });
    setValue('');
  };

  const removeFilter = (field: string) => onChange({ ...state, columnFilters: filters.filter(item => item.column !== field), page: 1 });
  const isPresence = operator === 'is_missing' || operator === 'is_not_missing';
  const fieldType = columnTypes?.[column] ?? 'text';
  const availableOps = OPS.filter(([key]) => !NUMERIC_OPS.has(key) || fieldType === 'number');

  return (
    <div className="mb-3 rounded-lg border border-border-subtle bg-canvas-subtle/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {taskId && table && <button type="button" disabled={exporting} onClick={() => void exportTable()} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-border-default px-3 text-sm"><Download className="h-3.5 w-3.5" />{exporting ? '导出中' : '导出筛选结果 CSV'}</button>}
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">列筛选</span>
        <select aria-label="选择筛选列" value={column} onChange={event => { const next = event.target.value; setColumn(next); if (columnTypes?.[next] === 'boolean' || columnTypes?.[next] === 'enum') setOperator('equals'); else if (NUMERIC_OPS.has(operator) && columnTypes?.[next] !== 'number') setOperator('contains'); }} className="h-8 max-w-[220px] rounded-md border border-border-default bg-canvas-default px-2 text-sm">
          {columns.map(item => <option key={item} value={item}>{label(item)}</option>)}
        </select>
        <select aria-label="筛选方式" value={operator} onChange={event => setOperator(event.target.value as FilterOperator)} className="h-8 rounded-md border border-border-default bg-canvas-default px-2 text-sm">
          {availableOps.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        {!isPresence && <input aria-label="筛选值" value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addFilter(); }} placeholder={operator === 'in' ? '逗号分隔多个值' : operator === 'between' ? '最小值,最大值' : '输入匹配值'} className="h-8 min-w-[150px] rounded-md border border-border-default bg-canvas-default px-2 text-sm" />}
        <button type="button" onClick={addFilter} disabled={!column || (!isPresence && !value.trim()) || (operator === 'between' && value.split(',').length !== 2)} className="h-8 rounded-md bg-accent-emphasis px-3 text-sm font-medium text-fg-on-emphasis disabled:opacity-50">应用</button>
        {filters.length > 0 && <button type="button" onClick={() => onChange({ ...state, columnFilters: [], page: 1 })} className="h-8 rounded-md border border-border-default px-3 text-sm text-fg-muted">清空列筛选</button>}
      </div>
      {viewsURL&&<div className="mt-2 flex flex-wrap items-center gap-2 text-xs">

        <span className="text-fg-muted">个人筛选方案</span>
        <button type="button" onClick={()=>{void refreshBrowserTable(taskId!,table!).then(()=>{onChange({...stateRef.current});setViewMessage('已刷新判读修改');}).catch(cause=>setViewMessage(cause instanceof Error?cause.message:'刷新失败'));}} className="h-8 shrink-0 whitespace-nowrap rounded border border-border-default px-2">刷新修改</button>
        <select aria-label="加载个人筛选方案" value={selectedView} className="h-8 max-w-[180px] rounded border border-border-default bg-canvas-default px-2" onChange={event=>setSelectedView(event.target.value)}>
          <option value="">选择已保存方案</option>{views.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}
        </select>
        <button type="button" disabled={!selectedView} onClick={applyView} className="h-8 shrink-0 whitespace-nowrap rounded border border-border-default px-2 disabled:opacity-50">应用方案</button>
        <input aria-label="个人筛选方案名称" value={viewName} maxLength={80} onChange={e=>setViewName(e.target.value)} placeholder="方案名称" className="h-8 w-32 rounded border border-border-default bg-canvas-default px-2" />
        <button type="button" disabled={!viewName.trim()||viewSaving} onClick={()=>void saveView()} className="h-8 shrink-0 whitespace-nowrap rounded border border-border-default px-2 disabled:opacity-50">{viewSaving?'保存中':'保存方案'}</button>
        {viewMessage&&<span role="status" className="text-fg-muted">{viewMessage}</span>}
      </div>}
      {exportError && <p role="alert" className="mt-2 text-sm text-red-600">{exportError}</p>}
      {filters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-live="polite">
          {filters.map(filter => {
            const op = OPS.find(([key]) => key === filter.operator)?.[1] ?? filter.operator;
            const shown = Array.isArray(filter.value) ? filter.value.join(' / ') : filter.value;
            return <span key={filter.column} className="inline-flex items-center gap-1 rounded-full border border-accent-subtle bg-accent-subtle/40 px-2.5 py-1 text-xs text-fg-default">
              {label(filter.column)} {op}{shown ? ` ${shown}` : ''}
              <button type="button" aria-label={`移除${label(filter.column)}筛选`} onClick={() => removeFilter(filter.column)} className="rounded-full p-0.5 hover:bg-canvas-inset"><X className="h-3 w-3" /></button>
            </span>;
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-fg-muted">不同列条件同时生效；“任一匹配”输入逗号分隔的值，数值范围输入最小值和最大值，多值注释按任一值匹配。</p>
    </div>
  );
}
