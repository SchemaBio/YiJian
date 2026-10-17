'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { ListFilter, Bookmark } from 'lucide-react';
import { ToolbarPopover } from '@/components/shared/ToolbarPopover';
import type { TableFilterState } from '../types';
import type { ResultTable } from '@/lib/assessment/types';
import { api } from '@/lib/api';
import { retainBrowserTable, refreshBrowserTable } from '@/lib/parquet-browser';

const OPS = [
  ['contains', '包含'], ['not_contains', '不包含'], ['equals', '精确匹配'], ['in', '任一匹配'],
  ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['between', '范围'],
  ['is_missing', '缺失'], ['is_not_missing', '非缺失'],
] as const;
const NUMERIC_OPS = new Set(['gt', 'gte', 'lt', 'lte', 'between']);

type FilterOperator = typeof OPS[number][0];

function label(field: string, t: TextTranslator = chineseText): string {
  const common: Record<string, string> = {
    Chromosome: t("history.chromosome326659"), Position: t("history.position88c344"), Gene: t("history.gene9ef2ed"), Type: t("history.typee4e46c"), VAF: 'VAF',
    GnomAD_AF: 'gnomAD AF', GnomAD_AF_EAS: t("tasks.gnomadEastAsianAfe9255d"), ClinVar_Sig: t("tasks.clinvarSignificanceeb01c2"),
    acmgClassification: t("tasks.acmgAssessment6a7cd5"), pinned: t("tasks.pin7bcf18"), focused: t("tasks.focus6c4cc0"),
  };
  return common[field] ?? field.replaceAll('_', ' ');
}

export function ParquetColumnFilterBar({
  taskId, table,
  columns,
  columnTypes,
  columnLabels,
  state,
  onChange,
  viewControls,
}: {
  viewControls?: React.ReactNode;
  taskId?: string;
  table?: ResultTable;
  columns: string[];
  columnTypes?: Record<string, 'text' | 'number' | 'enum' | 'boolean'>;
  columnLabels?: Record<string, string>;
  state: TableFilterState;
  onChange: (state: TableFilterState) => void;
}) {
  const t = useText();
  const [views,setViews]=React.useState<Array<{name:string;stateJson:string;version:number}>>([]);
  const fieldLabel = (field: string) => columnLabels?.[field] ?? label(field, t);
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
    void api.get<typeof views>(viewsURL,{signal:controller.signal}).then(setViews).catch(cause=>{if(!controller.signal.aborted)setViewMessage(cause instanceof Error ? errorText(cause, t):t("tasks.unableToLoadPreset699c0b"));});
    return()=>controller.abort();
  },[viewsURL]);
  React.useEffect(()=>{
    const changed=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      if(detail?.taskId===taskId&&detail?.table===table){setViewMessage(t("tasks.interpretationChangesSynchronized582ca8"));changeRef.current({...stateRef.current});}
    };
    const failed=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table===table)setViewMessage(t("tasks.synchronizationFailedTemporarilyShowingLastSynchronizedData6f5786"));};
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
      const next=await api.get<typeof views>(viewsURL);if(scopeRef.current===scope){setViews(next);setViewMessage(t("tasks.personalFilterPresetSavedAvailableAcrossDevicese9df2f"));}
    }catch(cause){if(scopeRef.current===scope){setViewMessage(cause instanceof Error ? errorText(cause, t):t("tasks.unableToSavePreset53b908"));try{const next=await api.get<typeof views>(viewsURL);if(scopeRef.current===scope)setViews(next);}catch{/* keep current choices */}}}
    finally{if(scopeRef.current===scope)setViewSaving(false);}
  };
  const applyView=()=>{const v=views.find(v=>v.name===selectedView);if(v){try{onChange({...JSON.parse(v.stateJson),page:1});setViewName(v.name);setViewMessage(t("tasks.personalFilterPresetRestored3fe5d8"));}catch{setViewMessage(t("tasks.invalidFilterPresetdd7436"));}}};
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
    <div className="yj-filter-tools mb-2 flex flex-wrap items-center gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarPopover label={t("tasks.addFilter20e774")} icon={<ListFilter size={14} />}><div className="grid gap-3">
        <select aria-label={t("tasks.selectFilterColumn63f3ff")} value={column} onChange={event => { const next = event.target.value; setColumn(next); if (columnTypes?.[next] === 'boolean' || columnTypes?.[next] === 'enum') setOperator('equals'); else if (NUMERIC_OPS.has(operator) && columnTypes?.[next] !== 'number') setOperator('contains'); }} className="h-8 max-w-[220px] rounded-md border border-border-default bg-canvas-default px-2 text-sm">
          {columns.map(item => <option key={item} value={item}>{fieldLabel(item)}</option>)}
        </select>
        <select aria-label={t("tasks.filterMethod3f94ac")} value={operator} onChange={event => setOperator(event.target.value as FilterOperator)} className="h-8 rounded-md border border-border-default bg-canvas-default px-2 text-sm">
          {availableOps.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        {!isPresence && <input aria-label={t("tasks.filterValue809cd5")} value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addFilter(); }} placeholder={operator === 'in' ? t("tasks.separateMultipleValuesWithCommas19a07b") : operator === 'between' ? t("tasks.minimumMaximumf8c16b") : t("tasks.enterMatchingValue88f822")} className="h-8 min-w-[150px] rounded-md border border-border-default bg-canvas-default px-2 text-sm" />}
        <button type="button" onClick={addFilter} disabled={!column || (!isPresence && !value.trim()) || (operator === 'between' && value.split(',').length !== 2)} className="h-8 rounded-md bg-accent-emphasis px-3 text-sm font-medium text-fg-on-emphasis disabled:opacity-50">{t("tasks.apply456202")}</button>
        {filters.length > 0 && <button type="button" onClick={() => onChange({ ...state, columnFilters: [], page: 1 })} className="h-8 rounded-md border border-border-default px-3 text-sm text-fg-muted">{t("tasks.clearColumnFiltersf7f498")}</button>}
        </div></ToolbarPopover>
      </div>
      {viewsURL&&<div className="flex flex-wrap items-center gap-2 text-xs">

        <ToolbarPopover label={t("tasks.filterViewc66e4a")} icon={<Bookmark size={14} />}><div className="yj-filter-view grid gap-4">
        <div className="grid gap-2">
        <span className="text-xs font-medium text-fg-muted">{t("tasks.savedPresetsf2c1f7")}</span>
        <div className="yj-filter-view-row">
        <select aria-label={t("tasks.loadPersonalFilterPresetbf4bea")} value={selectedView} className="yj-filter-view-field" onChange={event=>setSelectedView(event.target.value)}>
          <option value="">{t("tasks.selectSavedPresete82018")}</option>{views.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}
        </select>
        <ActionButton permission={null} action="start" disabled={!selectedView} onClick={applyView} className="yj-filter-view-action">{t("tasks.applyPreset34d975")}</ActionButton>
        </div>
        </div>
        <div className="grid gap-2">
        <span className="text-xs font-medium text-fg-muted">{t("tasks.saveCurrentFiltersb9e931")}</span>
        <div className="yj-filter-view-row">
        <input aria-label={t("tasks.personalFilterPresetName6ffe93")} value={viewName} maxLength={80} onChange={e=>setViewName(e.target.value)} placeholder={t("tasks.enterPresetNamed45aa0")} className="yj-filter-view-field" />
        <ActionButton permission={null} loading={viewSaving} loadingLabel={t("samples.savinga032e8")} action="save" type="button" disabled={!viewName.trim()||viewSaving} onClick={()=>void saveView()} className="yj-filter-view-action">{t("tasks.savePresetede701")}</ActionButton>
        </div>
        </div>
        <div className="flex justify-end border-t border-border-default pt-3">
        <ActionButton action="refresh" variant="ghost" type="button" onClick={()=>{void refreshBrowserTable(taskId!,table!).then(()=>{onChange({...stateRef.current});setViewMessage(t("tasks.interpretationChangesRefreshed4e0e04"));}).catch(cause=>setViewMessage(cause instanceof Error ? errorText(cause, t):t("tasks.refreshFailedbe6ff1")));}} className="yj-filter-view-action">{t("tasks.refreshChanges302987")}</ActionButton>
        </div>
        </div></ToolbarPopover>{viewMessage&&<span role="status" className="text-fg-muted">{viewMessage}</span>}
      </div>}
      {viewControls}
      {filters.length > 0 && (
        <div className="basis-full flex flex-wrap gap-2" aria-live="polite">
          {filters.map(filter => {
            const op = OPS.find(([key]) => key === filter.operator)?.[1] ?? filter.operator;
            const shown = Array.isArray(filter.value) ? filter.value.join(' / ') : filter.value;
            return <span key={filter.column} className="inline-flex items-center gap-1 rounded-md border border-border-default bg-canvas-subtle px-2.5 py-1 text-xs text-fg-default">
              {fieldLabel(filter.column)} {op}{shown ? ` ${shown}` : ''}
              <ActionButton size="small" iconOnly action="close" variant="ghost" type="button" aria-label={t("tasks.removeFiltera4187c", {p0: String(fieldLabel(filter.column))})} onClick={() => removeFilter(filter.column)} className="rounded-full p-0.5 hover:bg-canvas-inset" />
            </span>;
          })}
        </div>
      )}

    </div>
  );
}
