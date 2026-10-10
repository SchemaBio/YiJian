'use client';
import * as React from 'react';
import { evaluateSVCv4, getSVCv4Schema, type EvidenceSchema, type SVCv4Assessment, type SVCv4Schema } from '@/lib/svcv4';
import type { SNVIndel } from '../types';
import { AIAssistanceAction, AIResultCard } from '@/components/shared/AIAssistanceAction';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import { aiVariantContext } from '../utils/ai-context';
import { ACMG_CONFIG } from '../result-api';

const LABELS:Record<string,string>={
  predictive:'预测证据',functional:'功能实验',informative:'已知变异比较',mechanism_exon_relevance:'疾病机制与外显子相关性',
  prediction_outcome:'预测分支',parent_code:'证据父项',amino_acid:'氨基酸影响',splice:'剪接影响',
  faf:'筛选等位基因频率（FAF）',faf_source:'FAF来源／版本',daft:'疾病等位基因频率阈值（DAFT）',daft_method:'DAFT来源方法',
  homozygote_count:'纯合出现次数',hemizygote_count:'半合子出现次数',hmz_eligible:'纯合／半合子证据适用性',
  id:'病例／证据编号',family_id:'家系编号',sex:'性别',age:'年龄',phenotypes:'表型',relatives:'家系成员',
  pheno_specificity_for_mde:'表型与疾病一致性',testing:'检测范围',vbc_exists:'携带待评变异',vbc_zygosity:'待评变异合子状态',
  confirmed_parental_relationship:'亲缘关系已确认',age_matched_penetrance:'年龄相关外显率',compound_het_variant:'反式第二变异',
  additional_variants:'其他变异',diagnostic_yield_for_phenotypes:'表型诊断率',affected_w_mde:'具有对应疾病表型',
  initial_points:'初始证据积分',adjusted_points:'已编码调整积分',prd_points:'预测积分',fxn_points:'功能积分',inf_points:'比较积分',
  source:'证据来源',basis:'证据依据',note:'说明',description:'描述',name:'名称',gene:'基因',label:'名称',
  protein_fraction_reduced:'蛋白减少比例',alternative_met_rescue:'替代起始位点救援',molecular_mechanism:'分子机制',
  exon_relevance:'外显子相关性',transcript_relevance:'转录本相关性',classification:'变异分类',
};
const inputClass='w-full rounded-md border border-border-default bg-canvas-default px-2 py-1.5 text-sm';

// Optional inputs are absent until the curator explicitly supplies them. A blank is never zero.
export function EvidenceFields({schema,root=schema,value,onChange,label,disabled=false,depth=0}: {
  schema:EvidenceSchema;root?:EvidenceSchema;value:unknown;onChange:(v:unknown)=>void;label:string;disabled?:boolean;depth?:number;
}) {
  let resolved=schema;
  if(resolved.anyOf) resolved=resolved.anyOf.find(s=>s.type!=='null')??resolved;
  if(resolved.$ref) resolved=root.$defs?.[resolved.$ref.split('/').at(-1)??'']??resolved;
  if(depth>12) return <p>此证据嵌套过深，请简化输入。</p>;
  const title=LABELS[label]??label;
  if(resolved.properties) {
    const object=value && typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
    return <details className="rounded border border-border-subtle p-2" open={depth===0}>
      <summary className="cursor-pointer text-sm font-medium">{title}{!object?' · 未提供':''}</summary>
      <div className="mt-2 space-y-2">
        {resolved.description&&<p className="text-xs text-fg-muted">{resolved.description}</p>}
        {!object?<button type="button" disabled={disabled} onClick={()=>onChange({})} className="text-sm text-accent-fg">录入{title}</button>:<>
          {Object.entries(resolved.properties).filter(([key])=>key!=='type').map(([key,child])=><EvidenceFields key={key} schema={child} root={root} value={object[key]} label={key} disabled={disabled} depth={depth+1} onChange={v=>{const next={...object};if(v===undefined)delete next[key];else next[key]=v;onChange(next);}} />)}
          <button type="button" disabled={disabled} onClick={()=>onChange(undefined)} className="text-xs text-fg-muted">清除{title}证据</button>
        </>}
      </div>
    </details>;
  }
  if(resolved.type==='array') {
    const list=Array.isArray(value)?value:[];
    return <div className="space-y-2 rounded border border-border-subtle p-2"><div className="text-sm font-medium">{title}</div>
      {list.map((item,index)=><div key={index} className="space-y-1"><EvidenceFields schema={resolved.items??{type:'string'}} root={root} value={item} label={`${title} ${index+1}`} disabled={disabled} depth={depth+1} onChange={v=>onChange(list.map((old,i)=>i===index?v:old))} /><button type="button" disabled={disabled} onClick={()=>onChange(list.filter((_,i)=>i!==index))} className="text-xs text-fg-muted">移除此项</button></div>)}
      <button type="button" disabled={disabled||list.length>=100} onClick={()=>onChange([...list,resolved.items?.type==='string'?'':{}])} className="text-sm text-accent-fg">添加{title}</button>
    </div>;
  }
  const choices=resolved.enum??(resolved.type==='boolean'?['true','false']:undefined);
  return <label className="block space-y-1 text-sm"><span title={resolved.description}>{title}</span>
    {choices?<select disabled={disabled} aria-label={title} className={inputClass} value={value===undefined||value===null?'':String(value)} onChange={e=>onChange(e.target.value===''?undefined:resolved.type==='boolean'?e.target.value==='true':e.target.value)}><option value="">未提供／待确认</option>{choices.map(v=><option key={v} value={v}>{v==='true'?'是':v==='false'?'否':v}</option>)}</select>:
      <input disabled={disabled} aria-label={title} className={inputClass} type={resolved.type==='number'||resolved.type==='integer'?'number':'text'} step={resolved.type==='integer'?'1':'any'} value={value===undefined||value===null?'':String(value)} onChange={e=>onChange(e.target.value===''?undefined:resolved.type==='number'||resolved.type==='integer'?Number(e.target.value):e.target.value)} />}
    {resolved.description&&<span className="block text-xs text-fg-muted">{resolved.description}</span>}
  </label>;
}

export function SVCv4AssessmentPanel({taskId,variant,readOnly,onSave,onUseAIInterpretation}: {taskId:string;variant:SNVIndel;readOnly:boolean;onUseAIInterpretation?:(result:AIAssistanceResult)=>void;onSave?:(assessment:SVCv4Assessment,reason:string)=>Promise<void>}) {
  const [aiResult,setAIResult]=React.useState<AIAssistanceResult>();
  const [schema,setSchema]=React.useState<SVCv4Schema>();
  const [draft,setDraft]=React.useState<SVCv4Assessment>(()=>variant.svcv4Assessment??{disease:'',moi:'',inputs:{},confirmed:false});
  const [dirty,setDirty]=React.useState(false),[reason,setReason]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  React.useEffect(()=>{const controller=new AbortController();void getSVCv4Schema(taskId,controller.signal).then(setSchema).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'新版规则加载失败');});return()=>controller.abort();},[taskId]);
  const update=(change:Partial<SVCv4Assessment>)=>{setDraft(old=>({...old,...change,confirmed:false,result:undefined}));setDirty(true);};
  const evidence=(key:string,value:unknown)=>update({inputs:{...draft.inputs,[key]:value}});
  const calculate=async()=>{setBusy(true);setError('');try{setDraft(await evaluateSVCv4(taskId,{...draft,confirmed:false}));setDirty(false);}catch(e){setError(e instanceof Error?e.message:'计算失败');}finally{setBusy(false);}};
  const save=async()=>{if(!onSave)return;if(!reason.trim()){setError('请填写本次证据调整理由');return;}setBusy(true);setError('');try{await onSave(draft,reason.trim());setReason('');}catch(e){setError(e instanceof Error?e.message:'保存失败');}finally{setBusy(false);}};
  const result=draft.result;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">SVC v4.0版</span><AIAssistanceAction disabled={readOnly||busy} input={{feature:'svcv4',taskId,variant:aiVariantContext(variant),calculator:{draft,schema}}} onResult={setAIResult} /></div>
    {aiResult&&<AIResultCard result={aiResult} onUseInterpretation={!readOnly&&onUseAIInterpretation?()=>onUseAIInterpretation(aiResult):undefined} />}
    <div className="rounded border border-warning-emphasis/40 bg-warning-subtle p-3 text-sm"><strong>SVC v4.0 试行 · 草案／非权威参考实现</strong><p>以具体疾病为单位评定。缺失信息保持待确认，ClinGen CSpec 为权威计分来源。</p>{schema&&<a href={schema.source} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-fg">规则版本 {schema.revision.slice(0,12)}</a>}</div>
    <p className="break-words text-sm">{variant.gene} · {variant.chromosome}:{variant.position} {variant.ref} → {variant.alt} · {variant.transcript}<br />{variant.consequence}</p>
    <p className="text-xs text-fg-muted">已有注释参考：gnomAD AF {variant.gnomadAF??'未提供'}；东亚 AF {variant.gnomadEasAF??'未提供'}；AlphaMissense {variant.alphaMissenseScore??'未提供'}。AF 不直接作为 FAF 计分，请核验。</p>
    {!schema&&!error&&<p>加载新版证据表单…</p>}
    {schema&&<fieldset disabled={readOnly||busy} className="space-y-3">
      <label className="block text-sm">疾病（名称或 CURIE，人工确认）<input className={inputClass} value={draft.disease} onChange={e=>update({disease:e.target.value})} /></label>
      {variant.diseaseAssociation&&<p className="text-xs text-fg-muted">注释疾病参考：{variant.diseaseAssociation}</p>}
      <label className="block text-sm">遗传模式<select className={inputClass} value={draft.moi} onChange={e=>update({moi:e.target.value})}><option value="">待确认</option>{schema.moi.map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="block text-sm">基因与疾病关联有效性<select className={inputClass} value={draft.geneDiseaseValidity??''} onChange={e=>update({geneDiseaseValidity:e.target.value||null})}><option value="">未提供</option>{schema.geneDiseaseValidity.map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="block text-sm">变异影响工作流<select className={inputClass} value={draft.inputs.workflow??''} onChange={e=>update({inputs:{...draft.inputs,workflow:e.target.value||undefined,impact:undefined}})}><option value="">未提供／待确认</option>{schema.workflows.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}<option disabled>框内 InDel／非编码工作流暂不支持</option></select></label>
      {schema.workflows.filter(w=>w.id===draft.inputs.workflow).map(w=><EvidenceFields key={w.id} schema={w.schema} value={draft.inputs.impact} label="变异影响证据" disabled={readOnly||busy} onChange={v=>evidence('impact',v)} />)}
      <EvidenceFields schema={schema.population} value={draft.inputs.population} label="人群证据" disabled={readOnly||busy} onChange={v=>evidence('population',v)} />
      <p className="text-xs text-fg-muted">每个无关家系仅录入一个先证者；同一家系成员放在家系证据中。</p>
      <EvidenceFields schema={{type:'array',items:schema.case}} root={schema.case} value={draft.inputs.cases} label="临床病例" disabled={readOnly||busy} onChange={v=>evidence('cases',v)} />
      <EvidenceFields schema={schema.caseControl} value={draft.inputs.caseControl} label="病例对照研究" disabled={readOnly||busy} onChange={v=>evidence('caseControl',v)} />
      <EvidenceFields schema={schema.case} value={draft.inputs.family} label="家系与位点特异性证据" disabled={readOnly||busy} onChange={v=>evidence('family',v)} />
      <button type="button" onClick={()=>void calculate()} className="rounded border border-border-default px-3 py-2 text-sm">{busy?'处理中…':'计算新版评定'}</button>
    </fieldset>}
    {result&&!dirty&&<div className="space-y-2 rounded border border-border-subtle p-3 text-sm">
      <strong>{result.classification?ACMG_CONFIG[result.classification].label:'未评定'}{result.vusSubclass?` · ${result.vusSubclass}`:''} · {result.score??'—'} 分</strong>
      <dl>{Object.entries(result.breakdown).map(([key,value])=><div key={key} className="flex justify-between"><dt>{key}</dt><dd>{value} 分</dd></div>)}</dl>
      <details><summary>子项分数与计算记录</summary><pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(result.details,null,2)}</pre></details>
      <details open><summary>适用性、假设与计算依据</summary><ul className="list-disc space-y-1 pl-4 text-xs">{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>
      <label className="flex items-start gap-2"><input type="checkbox" disabled={readOnly||busy} checked={draft.confirmed} onChange={e=>setDraft(old=>({...old,confirmed:e.target.checked}))} /><span>我已核验疾病、证据适用性及上述草案假设，确认此参考评定。</span></label>
    </div>}
    {!readOnly&&onSave&&<div className="space-y-2"><textarea aria-label="新版证据调整理由" placeholder="本次新版证据调整理由（必填）" className={inputClass} value={reason} onChange={e=>setReason(e.target.value)} /><button type="button" disabled={busy||dirty||!result} onClick={()=>void save()} className="rounded bg-accent-emphasis px-3 py-2 text-sm text-fg-on-emphasis disabled:opacity-50">保存新版评定</button></div>}
    {error&&<p role="alert" className="text-sm text-danger-fg">{error}</p>}
  </div>;
}
