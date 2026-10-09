'use client';
import { HoverHint } from '@/components/shared/HoverHint';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import {Filter, X} from 'lucide-react';
import type {Column} from '@schema/ui-kit';
import type {PaginatedResult, TableFilterState} from '../types';
const operators = [['contains','包含'],['equals','等于'],['in','任一值'],['gte','≥'],['lte','≤'],['between','范围'],['is_missing','缺失'],['is_not_missing','非缺失']] as const;
type Operator = typeof operators[number][0];
const labels:Record<string,string>={Chromosome:'染色体',Position:'位置',Ref:'参考碱基',Alt:'变异碱基',pinned:'置顶',reported:'回报',acmgClassification:'ACMG 分类',Interval_Length:'区间长度'};
function ColumnFilter({fields,types,state,onChange,cnvType=false,compactLabel}: {compactLabel?:string;cnvType?:boolean;fields:string[];types?:PaginatedResult<unknown>['columnTypes'];state:TableFilterState;onChange:(state:TableFilterState)=>void}) {
 const [open,setOpen]=React.useState(false);
 const [field,setField]=React.useState(fields[0]??'');
 const current=state.columnFilters?.find(f=>f.column===field);
 const active=state.columnFilters?.some(f=>fields.includes(f.column));
 const defaultOp=(f:string):Operator=>cnvType&&f==='Col4'?'equals':types?.[f]==='number'?'between':types?.[f]==='boolean'||types?.[f]==='enum'?'equals':'contains';
 const [operator,setOperator]=React.useState<Operator>(defaultOp(field));
 const [draft,setDraft]=React.useState('');
 const reset=(f:string)=>{const c=state.columnFilters?.find(v=>v.column===f);setOperator((c?.operator as Operator)??defaultOp(f));setDraft(Array.isArray(c?.value)?c.value.join(','):c?.value??'');};
 const apply=(clear=false)=>{
  const filters=(state.columnFilters??[]).filter(f=>f.column!==field);
  const presence=operator==='is_missing'||operator==='is_not_missing';
  if(!clear&&(presence||draft.trim())) filters.push({column:field,operator,...(presence?{}:{value:operator==='in'||operator==='between'?draft.split(',').map(v=>v.trim()).filter(Boolean):draft.trim()})});
  onChange({...state,columnFilters:filters,page:1});setOpen(false);
 };
 if(!fields.length)return null;
 const presence=operator==='is_missing'||operator==='is_not_missing';
 const range=operator==='between';const numeric=types?.[field]==='number';
 const rangeParts=draft.split(',');
 const invalid=range&&(rangeParts.length!==2||rangeParts.some(v=>!v.trim()||!Number.isFinite(Number(v))));
 return <div onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
  <Popover.Root open={open} onOpenChange={v=>{if(v)reset(field);setOpen(v);}}><HoverHint content="筛选此列"><Popover.Trigger asChild><button type="button" aria-label={`${labels[field]??field}筛选`}  className={`inline-flex h-6 ${compactLabel?"gap-0.5 text-xs":"w-6"} shrink-0 items-center justify-center rounded hover:bg-canvas-inset ${active?'bg-accent-subtle text-accent-fg':'text-fg-muted'}`}>{compactLabel}<Filter className={compactLabel?"h-2.5 w-2.5":"h-3 w-3"} fill={active?'currentColor':'none'}/></button></Popover.Trigger></HoverHint>
   <Popover.Portal><Popover.Content side="bottom" align="center" sideOffset={6} collisionPadding={12} aria-label={`${labels[field]??field}筛选条件`} className="z-[80] w-64 rounded-lg border border-border-default bg-canvas-default p-3 text-left text-sm shadow-xl" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    <div className="mb-3 flex items-center justify-between font-medium text-fg-default"><span>{labels[field]??field}</span><Popover.Close aria-label="关闭筛选" className="rounded p-1 text-fg-muted"><X className="h-3.5 w-3.5"/></Popover.Close></div>
    {fields.length>1&&<select aria-label="筛选字段" value={field} onChange={e=>{setField(e.target.value);reset(e.target.value);}} className="mb-2 h-8 w-full rounded border border-border-default bg-canvas-default px-2 text-xs">{fields.map(f=><option key={f} value={f}>{labels[f]??f}</option>)}</select>}
    {!presence&&(cnvType&&field==='Col4'?<select aria-label="CNV 类型" value={draft} onChange={e=>setDraft(e.target.value)} className="h-8 w-full rounded border border-border-default bg-canvas-default px-2"><option value="">全部</option><option value="DUP">扩增</option><option value="DEL">缺失</option><option value="Normal">正常</option></select>:types?.[field]==='boolean'?<select aria-label="筛选值" value={draft} onChange={e=>setDraft(e.target.value)} className="h-8 w-full rounded border border-border-default bg-canvas-default px-2"><option value="">全部</option><option value="true">是</option><option value="false">否</option></select>:range?<div className="flex items-center gap-2"><input aria-label="最小值" type="number" value={rangeParts[0]??''} onChange={e=>setDraft(e.target.value+','+(rangeParts[1]??''))} placeholder="最小值" className="h-8 w-0 flex-1 rounded border border-border-default bg-canvas-default px-2"/><span className="text-fg-muted">–</span><input aria-label="最大值" type="number" value={rangeParts[1]??''} onChange={e=>setDraft((rangeParts[0]??'')+','+e.target.value)} placeholder="最大值" className="h-8 w-0 flex-1 rounded border border-border-default bg-canvas-default px-2"/></div>:<input aria-label="筛选值" autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')apply();}} placeholder={numeric?'输入数值':'输入关键词'} className="h-8 w-full rounded border border-border-default bg-canvas-default px-2"/>)}
    <label className="mt-3 block text-xs text-fg-muted">匹配方式<select aria-label="筛选方式" value={operator} onChange={e=>setOperator(e.target.value as Operator)} className="mt-2 h-8 w-full rounded border border-border-default bg-canvas-default px-2">{operators.filter(([op])=>!['gte','lte','between'].includes(op)||numeric).map(([op,label])=><option key={op} value={op}>{label}</option>)}</select></label>
    <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={()=>apply(true)} className="rounded border border-border-default px-3 py-1.5 text-xs">清除</button><button type="button" disabled={invalid&&!presence} onClick={()=>apply()} className="rounded bg-accent-emphasis px-3 py-1.5 text-xs text-fg-on-emphasis disabled:opacity-40">应用</button></div>
   </Popover.Content></Popover.Portal>
  </Popover.Root>
 </div>;
}

export function filterableColumns<T>(columns: Column<T>[], result: Pick<PaginatedResult<T>, 'columns' | 'columnAliases' | 'columnTypes'> | null | undefined, state: TableFilterState, onChange: (state:TableFilterState)=>void, table: string): Column<T>[] {
  const raw = result?.columns ?? [];
  const hints: Record<string,string[]> = {alleleFrequency:['VAF'], change:['Ref','Alt'], position:['Chromosome','Position'], locus:['Chromosome','Position','Locus'], genes:['Dosage_Genes','GenCC_AD_Genes','Gene'], exon:['Col8'], ratio:['Copy_Ratio'], confidence:[table==='cnv-segment'?'Col7':'Col18','Quality'], repeatCount:['Repeat_Count','Allele1_Repeats','Allele2_Repeats','Repeat_Display'], normalRange:['Normal_Min','Normal_Max'], pathogenicity:table.startsWith('cnv-')?['cnvClassification']:['ClinVar_Sig'], transcript:['Transcript'], hgvsc:['HGVS_c'], hgvsp:['HGVS_p']};
  return columns.map(column => {
    const alternate: Record<string,string[]> = {variantType:['variantType','type'], meiType:['teType','teFamily'], insertionType:['insertionType','eventType'], strand:['direction','strand'], length:table==='mei'?['avgSoftClipLength']:['length'], frequency:['gnomadAF'], homozygosity:['percentageHomozygosity'], variantCount:['nbVariants'], genes:table==='roh'?['recessiveGenes']:['dosageGenes','genccADGenes','genes'], repeatCount:['repeatCount','allele1Repeats','allele2Repeats','repeatDisplay'], normalRange:['normalRangeMin','normalRangeMax'], exon:['exon','exonCount'], ratio:['copyRatio','depthRatio','ratio2'], confidence:table==='cnv-exon'?['confidenceLabel']:['weight','quality','confidence']};
    const targets = alternate[column.id] ?? [column.id];
    const fields = [...new Set([...raw.filter(f=>f === column.id || result?.columnAliases?.[f]?.some(alias=>targets.includes(alias))), ...(hints[column.id] ?? []).filter(f=>raw.includes(f))])];
    const marking = column.id === 'pinned' || column.id === 'reported';
    return {...column, align:'center', ...(marking ? {width:60,minWidth:60,maxWidth:60} : {minWidth:Math.max(column.minWidth ?? 0,80)}), header:<div className="flex w-full items-center justify-center gap-1 whitespace-nowrap text-center">{(!marking||!fields.length)&&<div>{column.header}</div>}<ColumnFilter fields={fields} types={result?.columnTypes} state={state} onChange={onChange} cnvType={table.startsWith('cnv-')} compactLabel={marking?column.id==='pinned'?'置顶':'回报':undefined}/></div>};
  });
}
