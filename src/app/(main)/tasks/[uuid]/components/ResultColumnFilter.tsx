'use client';

import * as React from 'react';
import type { Column } from '@schema/ui-kit';
import type { PaginatedResult, TableFilterState } from '../types';

const operators = [['contains', '包含'], ['equals', '等于'], ['in', '任一值'], ['gte', '≥'], ['lte', '≤'], ['between', '范围'], ['is_missing', '缺失'], ['is_not_missing', '非缺失']] as const;
type Operator = typeof operators[number][0];

function ColumnFilter({fields, types, state, onChange}: {
  fields: string[]; types?: PaginatedResult<unknown>['columnTypes']; state: TableFilterState; onChange: (state: TableFilterState) => void;
}) {
  const [field, setField] = React.useState(fields[0] ?? '');
  const current = state.columnFilters?.find(filter => filter.column === field);
  const [operator, setOperator] = React.useState<Operator>((current?.operator as Operator) ?? 'contains');
  const [draft, setDraft] = React.useState(Array.isArray(current?.value) ? current.value.join(',') : current?.value ?? '');
  const change = React.useRef(onChange); change.current = onChange;
  const latest = React.useRef(state); latest.current = state;
  React.useEffect(() => {setOperator((current?.operator as Operator) ?? 'contains'); setDraft(Array.isArray(current?.value) ? current.value.join(',') : current?.value ?? '');}, [current?.operator, JSON.stringify(current?.value), field]);
  const apply = React.useCallback((text: string, op: Operator) => {
    if (!field) return;
    const presence = op === 'is_missing' || op === 'is_not_missing';
    if (op === 'between' && (text.split(',').length !== 2 || text.split(',').some(v => !v.trim()))) return;
    const filters = (latest.current.columnFilters ?? []).filter(f => f.column !== field);
    if (presence || text.trim()) filters.push({column:field, operator:op, ...(presence ? {} : {value: op === 'in' || op === 'between' ? text.split(',').map(v=>v.trim()).filter(Boolean) : text.trim()})});
    if (JSON.stringify(filters) !== JSON.stringify(latest.current.columnFilters ?? [])) change.current({...latest.current, columnFilters:filters, page:1});
  }, [field]);
  React.useEffect(() => {const timer = setTimeout(()=>apply(draft, operator),300); return ()=>clearTimeout(timer);}, [draft, operator, apply]);
  if (!fields.length) return <span className="text-[10px] font-normal text-fg-muted">无原始字段</span>;
  const presence = operator === 'is_missing' || operator === 'is_not_missing';
  return <div className="mt-2 flex min-w-[84px] flex-col gap-1 font-normal" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    {fields.length > 1 && <select aria-label="筛选字段" value={field} onChange={e=>setField(e.target.value)} className="w-full rounded border border-border-default bg-canvas-default text-[11px]">{fields.map(f=><option key={f}>{f}</option>)}</select>}
    <select aria-label={`${field}筛选方式`} value={operator} onChange={e=>setOperator(e.target.value as Operator)} className="h-6 w-full rounded border border-border-default bg-canvas-default text-[11px]">
      {operators.filter(([op]) => !['gte','lte','between'].includes(op) || types?.[field] === 'number').map(([op,label])=><option key={op} value={op}>{label}</option>)}
    </select>
    {!presence && (types?.[field] === 'boolean' ? <select aria-label={`${field}筛选值`} value={draft} onChange={e=>{setOperator('equals');setDraft(e.target.value);}} className="h-6 w-full rounded border border-border-default bg-canvas-default text-center text-xs"><option value="">全部</option><option value="true">是</option><option value="false">否</option></select> : <input aria-label={`${field}筛选值`} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={operator === 'between' ? '最小,最大' : '筛选…'} className="h-6 w-full min-w-0 rounded border border-border-default bg-canvas-default px-1 text-center text-xs" />)}
    {current && <button type="button" className="text-[10px] text-accent-fg" onClick={()=>{setDraft('');setOperator('contains');apply('', 'contains');}}>清除</button>}
  </div>;
}

export function filterableColumns<T>(columns: Column<T>[], result: Pick<PaginatedResult<T>, 'columns' | 'columnAliases' | 'columnTypes'> | null | undefined, state: TableFilterState, onChange: (state:TableFilterState)=>void, table: string): Column<T>[] {
  const raw = result?.columns ?? [];
  const hints: Record<string,string[]> = {alleleFrequency:['VAF'], change:['Ref','Alt'], position:['Chromosome','Position'], locus:['Chromosome','Position','Locus'], genes:['Dosage_Genes','GenCC_AD_Genes','Gene'], exon:['Col8'], ratio:['Copy_Ratio','Col10'], confidence:[table==='cnv-segment'?'Col7':'Col11','Quality'], repeatCount:['Repeat_Count','Allele1_Repeats','Allele2_Repeats','Repeat_Display'], normalRange:['Normal_Min','Normal_Max'], pathogenicity:table.startsWith('cnv-')?['cnvClassification']:['ClinVar_Sig'], transcript:['Transcript'], hgvsc:['HGVS_c'], hgvsp:['HGVS_p']};
  return columns.map(column => {
    const alternate: Record<string,string[]> = {variantType:['variantType','type'], meiType:['teType','teFamily'], insertionType:['insertionType','eventType'], strand:['direction','strand'], length:table==='mei'?['avgSoftClipLength']:['length'], frequency:['gnomadAF'], homozygosity:['percentageHomozygosity'], variantCount:['nbVariants'], genes:table==='roh'?['recessiveGenes']:['dosageGenes','genccADGenes','genes'], repeatCount:['repeatCount','allele1Repeats','allele2Repeats','repeatDisplay'], normalRange:['normalRangeMin','normalRangeMax'], exon:['exon','exonCount'], ratio:['copyRatio','depthRatio','ratio2'], confidence:['weight','quality','confidence']};
    const targets = alternate[column.id] ?? [column.id];
    const fields = [...new Set([...raw.filter(f=>f === column.id || result?.columnAliases?.[f]?.some(alias=>targets.includes(alias))), ...(hints[column.id] ?? []).filter(f=>raw.includes(f))])];
    return {...column, align:'center', minWidth:Math.max(column.minWidth ?? 0,110), header:<div className="w-full text-center"><div>{column.header}</div><ColumnFilter fields={fields} types={result?.columnTypes} state={state} onChange={onChange}/></div>};
  });
}
