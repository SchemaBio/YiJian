'use client';
import { useText } from '@/i18n/useText';
import { chineseText, translateUI, type TextTranslator } from '@/i18n/text';

import { HoverHint } from '@/components/shared/HoverHint';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import {Filter, X} from 'lucide-react';
import type {Column} from '@schema/ui-kit';
import type {PaginatedResult, TableFilterState} from '../types';
const operators = [['contains','包含'],['not_contains','不包含'],['equals','等于'],['in','任一值'],['gte','≥'],['lte','≤'],['between','范围'],['is_missing','缺失'],['is_not_missing','非缺失']] as const;
type Operator = typeof operators[number][0];
const labels:Record<string,string>={Chromosome:'染色体',Position:'位置',Start:'起始位置',End:'终止位置',Ref:'参考碱基',Alt:'变异碱基',Gene:'基因',Type:'类型',Transcript:'转录本',HGVS_c:'cDNA变化',HGVS_p:'蛋白质变化',Dosage_Genes:'剂量敏感基因',GenCC_AD_Genes:'GenCC AD 基因',pinned:'置顶',focused:'关注',acmgClassification:'ACMG 分类',cnvClassification:'CNV 评定',Interval_Length:'区间长度',Repeat_Count:'重复次数',Allele1_Repeats:'等位基因1重复次数',Allele2_Repeats:'等位基因2重复次数',Normal_Min:'正常范围下限',Normal_Max:'正常范围上限'};
function ColumnFilter({fields,fieldLabels,types,state,onChange,cnvType=false,compactLabel}: {fieldLabels:Record<string,string>;compactLabel?:string;cnvType?:boolean;fields:string[];types?:PaginatedResult<unknown>['columnTypes'];state:TableFilterState;onChange:(state:TableFilterState)=>void}) {
  const t = useText();
 const [open,setOpen]=React.useState(false);
 const [selectedField,setField]=React.useState(fields[0]??'');
 const field=fields.includes(selectedField)?selectedField:fields[0]??'';
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
  <Popover.Root open={open} onOpenChange={v=>{if(v)reset(field);setOpen(v);}}><HoverHint content={t("tasks.filterThisColumn6eb7db")}><Popover.Trigger asChild><button type="button" aria-label={t("history.filter8d2485", {p0: String(fieldLabels[field]??field)})}  className={`inline-flex h-6 ${compactLabel?"gap-0.5 text-xs":"w-6"} shrink-0 items-center justify-center rounded hover:bg-canvas-inset ${active?'bg-accent-subtle text-accent-fg':'text-fg-muted'}`}>{compactLabel}<Filter className={compactLabel?"h-2.5 w-2.5":"h-3 w-3"} fill={active?'currentColor':'none'}/></button></Popover.Trigger></HoverHint>
   <Popover.Portal><Popover.Content side="bottom" align="center" sideOffset={6} collisionPadding={12} aria-label={t("tasks.filterCriteria7a875d", {p0: String(fieldLabels[field]??field)})} className="z-[80] w-64 rounded-lg border border-border-default bg-canvas-default p-3 text-left text-sm shadow-xl" onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    <div className="mb-3 flex items-center justify-between font-medium text-fg-default"><span>{translateUI(fieldLabels[field]??field, t)}</span><Popover.Close aria-label={t("tasks.closeFilter00bab1")} className="rounded p-1 text-fg-muted"><X className="h-3.5 w-3.5"/></Popover.Close></div>
    {fields.length>1&&<select aria-label={t("tasks.filterField5f7508")} value={field} onChange={e=>{setField(e.target.value);reset(e.target.value);}} className="mb-2 h-8 w-full rounded border border-border-default bg-canvas-default px-2 text-xs">{fields.map(f=><option key={f} value={f}>{translateUI(fieldLabels[f]??f, t)}</option>)}</select>}
    {!presence&&(cnvType&&field==='Col4'?<select aria-label={t("tasks.cnvTypef96475")} value={draft} onChange={e=>setDraft(e.target.value)} className="h-8 w-full rounded border border-border-default bg-canvas-default px-2"><option value="">{t("tasks.all778fc8")}</option><option value="DUP">{t("history.duplication1aeb54")}</option><option value="DEL">{t("history.deletion2fe9b7")}</option><option value="Normal">{t("history.normalf78d03")}</option></select>:types?.[field]==='boolean'?<select aria-label={t("tasks.filterValue809cd5")} value={draft} onChange={e=>setDraft(e.target.value)} className="h-8 w-full rounded border border-border-default bg-canvas-default px-2"><option value="">{t("tasks.all778fc8")}</option><option value="true">{t("tasks.yes30160a")}</option><option value="false">{t("tasks.no8bf5c1")}</option></select>:range?<div className="flex items-center gap-2"><input aria-label={t("tasks.minimumc3d641")} type="number" value={rangeParts[0]??''} onChange={e=>setDraft(e.target.value+','+(rangeParts[1]??''))} placeholder={t("tasks.minimumc3d641")} className="h-8 w-0 flex-1 rounded border border-border-default bg-canvas-default px-2"/><span className="text-fg-muted">–</span><input aria-label={t("tasks.maximum018219")} type="number" value={rangeParts[1]??''} onChange={e=>setDraft((rangeParts[0]??'')+','+e.target.value)} placeholder={t("tasks.maximum018219")} className="h-8 w-0 flex-1 rounded border border-border-default bg-canvas-default px-2"/></div>:<input aria-label={t("tasks.filterValue809cd5")} autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')apply();}} placeholder={numeric?t("tasks.enterNumber23d28b"):t("tasks.enterKeyword532b4f")} className="h-8 w-full rounded border border-border-default bg-canvas-default px-2"/>)}
    <label className="mt-3 block text-xs text-fg-muted">{t("tasks.matchMethod6a05db")}<select aria-label={t("tasks.filterMethod3f94ac")} value={operator} onChange={e=>setOperator(e.target.value as Operator)} className="mt-2 h-8 w-full rounded border border-border-default bg-canvas-default px-2">{operators.filter(([op])=>!['gte','lte','between'].includes(op)||numeric).map(([op,label])=><option key={op} value={op}>{t(label)}</option>)}</select></label>
    <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={()=>apply(true)} className="rounded border border-border-default px-3 py-1.5 text-xs">{t("tasks.clear7b15e5")}</button><button type="button" disabled={invalid&&!presence} onClick={()=>apply()} className="rounded bg-accent-emphasis px-3 py-1.5 text-xs text-fg-on-emphasis disabled:opacity-40">{t("tasks.apply456202")}</button></div>
   </Popover.Content></Popover.Portal>
  </Popover.Root>
 </div>;
}

type FilterMetadata = Pick<PaginatedResult<unknown>, 'columns' | 'columnAliases' | 'columnTypes'>;

function fieldsForColumn(id: string, result: FilterMetadata | null | undefined, table: string): string[] {
  const raw = result?.columns ?? [];
  const hints: Record<string,string[]> = {alleleFrequency:['VAF'], change:['Ref','Alt'], position:['Chromosome','Position'], locus:['Chromosome','Position','Locus'], genes:['Dosage_Genes','GenCC_AD_Genes','Gene'], exon:['Col8'], ratio:['Copy_Ratio'], confidence:[table==='cnv-segment'?'Col7':'Col18','Quality'], repeatCount:['Repeat_Count','Allele1_Repeats','Allele2_Repeats','Repeat_Display'], normalRange:['Normal_Min','Normal_Max'], pathogenicity:table.startsWith('cnv-')?['cnvClassification']:['ClinVar_Sig'], transcript:['Transcript'], hgvsc:['HGVS_c'], hgvsp:['HGVS_p']};
    const alternate: Record<string,string[]> = {variantType:['variantType','type'], meiType:['teType','teFamily'], insertionType:['insertionType','eventType'], strand:['direction','strand'], length:table==='mei'?['avgSoftClipLength']:['length'], frequency:['gnomadAF'], homozygosity:['percentageHomozygosity'], variantCount:['nbVariants'], genes:table==='roh'?['recessiveGenes']:['dosageGenes','genccADGenes','genes'], repeatCount:['repeatCount','allele1Repeats','allele2Repeats','repeatDisplay'], normalRange:['normalRangeMin','normalRangeMax'], exon:['exon','exonCount'], ratio:['copyRatio','depthRatio','ratio2'], confidence:table==='cnv-exon'?['confidenceLabel']:['weight','quality','confidence']};
    const targets = alternate[id] ?? [id];
    const cnvFields: Record<string,string> = table === 'cnv-exon'
      ? {type:'Col4',gene:'Col5',transcript:'Col6',exon:'Col8',log2Ratio:'Col9',copyNumber:'Col12',confidence:'Col18'}
      : table === 'cnv-segment' ? {type:'Col4',log2Ratio:'Col5',confidence:'Col7',copyNumber:'Col8'} : {};
    return [...new Set([...raw.filter(f=>f === id || result?.columnAliases?.[f]?.some(alias=>targets.includes(alias))), ...(hints[id] ?? []).filter(f=>raw.includes(f)), ...[cnvFields[id]].filter(f=>f && raw.includes(f))])];
}

/** Display names follow the table, while saved filters keep their original data keys. */
export function resultColumnLabels<T>(columns: Column<T>[], result: FilterMetadata | null | undefined, table: string, t: TextTranslator = chineseText): Record<string,string> {
  const cnvLabels: Record<string,string> = table === 'cnv-exon'
    ? {Col4:t("history.typee4e46c"),Col5:t("history.gene9ef2ed"),Col6:t("history.transcript96b6d7"),Col7:t("tasks.ensemblTranscript7441ae"),Col8:t("tasks.exonCount17ce3c"),Col9:'log2 ratio',Col10:t("tasks.medianLog3f39fc"),Col11:t("tasks.logStandardDeviation57463b"),Col12:t("history.copyNumber04d1ca"),Col13:t("tasks.deptha1128a"),Col14:t("tasks.signalWeight9907ea"),Col15:t("tasks.binCount4a348a"),Col16:t("tasks.segmentCountbe25f0"),Col17:t("tasks.coverageFractionb12427"),Col18:t("history.confidenceb78c2d"),Col19:t("tasks.pValuebda434")}
    : table === 'cnv-segment' ? {Col4:t("history.typee4e46c"),Col5:'log2 ratio',Col6:t("tasks.deptha1128a"),Col7:t("tasks.signalWeight9907ea"),Col8:t("history.copyNumber04d1ca")} : {};
  const resultLabels: Record<string,string> = {...Object.fromEntries(Object.entries(labels).map(([field, label]) => [field, t(label)])),...cnvLabels,HGVS_c:'HGVSc',HGVS_p:'HGVSp'};
  for (const column of columns) {
    const fields = fieldsForColumn(column.id, result, table);
    if (fields.length === 1 && typeof column.header === 'string') resultLabels[fields[0]] = t(column.header);
  }
  return resultLabels;
}

export function filterableColumns<T>(columns: Column<T>[], result: FilterMetadata | null | undefined, state: TableFilterState, onChange: (state:TableFilterState)=>void, table: string, t: TextTranslator = chineseText): Column<T>[] {
  const fieldLabels = resultColumnLabels(columns, result, table, t);
  return columns.map(column => {
    const fields = fieldsForColumn(column.id, result, table);
    const marking = column.id === 'pinned' || column.id === 'focused';
    return {...column, align:'center', ...(marking ? {width:60,minWidth:60,maxWidth:60} : {minWidth:Math.max(column.minWidth ?? 0,80)}), header:<div className="flex w-full items-center justify-center gap-1 whitespace-nowrap text-center">{(!marking||!fields.length)&&<div>{translateUI(column.header, t)}</div>}<ColumnFilter fields={fields} fieldLabels={fieldLabels} types={result?.columnTypes} state={state} onChange={onChange} cnvType={table.startsWith('cnv-')} compactLabel={marking?column.id==='pinned'?t("tasks.pin7bcf18"):t("tasks.focus6c4cc0"):undefined}/></div>};
  });
}
