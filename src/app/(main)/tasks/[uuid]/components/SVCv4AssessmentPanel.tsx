'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';

import * as React from 'react';
import { evaluateSVCv4, getSVCv4Schema, type EvidenceSchema, type SVCv4Assessment, type SVCv4Schema } from '@/lib/svcv4';
import type { SNVIndel } from '../types';
import { AIAssistanceAction, AIResultCard } from '@/components/shared/AIAssistanceAction';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import { aiVariantContext } from '../utils/ai-context';
import { svcExperimentalInput } from '@/lib/svc-experimental';
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
  const t = useText();
  let resolved=schema;
  if(resolved.anyOf) resolved=resolved.anyOf.find(s=>s.type!=='null')??resolved;
  if(resolved.$ref) resolved=root.$defs?.[resolved.$ref.split('/').at(-1)??'']??resolved;
  if(depth>12) return <p>{t("tasks.evidenceNestingIsTooDeepSimplifyThef2bfec")}</p>;
  const title=LABELS[label] ? t(LABELS[label]) : label;
  if(resolved.properties) {
    const object=value && typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
    return <details className="rounded border border-border-subtle p-2" open={depth===0}>
      <summary className="cursor-pointer text-sm font-medium">{title}{!object?t("tasks.notProvided86bef9"):''}</summary>
      <div className="mt-2 space-y-2">
        {resolved.description&&<p className="text-xs text-fg-muted">{translateUI(resolved.description, t)}</p>}
        {!object?<button type="button" disabled={disabled} onClick={()=>onChange({})} className="text-sm text-accent-fg">{t("tasks.enter83f84c")}{title}</button>:<>
          {Object.entries(resolved.properties).filter(([key])=>key!=='type').map(([key,child])=><EvidenceFields key={key} schema={child} root={root} value={object[key]} label={translateUI(key, t)} disabled={disabled} depth={depth+1} onChange={v=>{const next={...object};if(v===undefined)delete next[key];else next[key]=v;onChange(next);}} />)}
          <button type="button" disabled={disabled} onClick={()=>onChange(undefined)} className="text-xs text-fg-muted">{t("tasks.clear7b15e5")}{title}{t("tasks.evidence68d4cd")}</button>
        </>}
      </div>
    </details>;
  }
  if(resolved.type==='array') {
    const list=Array.isArray(value)?value:[];
    return <div className="space-y-2 rounded border border-border-subtle p-2"><div className="text-sm font-medium">{title}</div>
      {list.map((item,index)=><div key={index} className="space-y-1"><EvidenceFields schema={resolved.items??{type:'string'}} root={root} value={item} label={translateUI(`${title} ${index+1}`, t)} disabled={disabled} depth={depth+1} onChange={v=>onChange(list.map((old,i)=>i===index?v:old))} /><ActionButton action="delete" variant="ghost" type="button" disabled={disabled} onClick={()=>onChange(list.filter((_,i)=>i!==index))} className="text-xs text-fg-muted">{t("tasks.removeItem456b1c")}</ActionButton></div>)}
      <ActionButton action="add" variant="ghost" type="button" disabled={disabled||list.length>=100} onClick={()=>onChange([...list,resolved.items?.type==='string'?'':{}])} className="text-sm text-accent-fg">{t("pipeline.add94191c")}{title}</ActionButton>
    </div>;
  }
  const choices=resolved.enum??(resolved.type==='boolean'?['true','false']:undefined);
  return <label className="block space-y-1 text-sm"><span title={translateUI(resolved.description, t)}>{title}</span>
    {choices?<select disabled={disabled} aria-label={translateUI(title, t)} className={inputClass} value={value===undefined||value===null?'':String(value)} onChange={e=>onChange(e.target.value===''?undefined:resolved.type==='boolean'?e.target.value==='true':e.target.value)}><option value="">{t("tasks.notProvidedUnconfirmed8126ad")}</option>{choices.map(v=><option key={v} value={v}>{v==='true'?t("tasks.yes30160a"):v==='false'?t("tasks.no8bf5c1"):v}</option>)}</select>:
      <input disabled={disabled} aria-label={translateUI(title, t)} className={inputClass} type={resolved.type==='number'||resolved.type==='integer'?'number':'text'} step={resolved.type==='integer'?'1':'any'} value={value===undefined||value===null?'':String(value)} onChange={e=>onChange(e.target.value===''?undefined:resolved.type==='number'||resolved.type==='integer'?Number(e.target.value):e.target.value)} />}
    {resolved.description&&<span className="block text-xs text-fg-muted">{translateUI(resolved.description, t)}</span>}
  </label>;
}

export function SVCv4AssessmentPanel({taskId,reference,variant,readOnly,onSave,onUseAIInterpretation}: {reference?:string;taskId:string;variant:SNVIndel;readOnly:boolean;onUseAIInterpretation?:(result:AIAssistanceResult)=>void;onSave?:(assessment:SVCv4Assessment,reason:string)=>Promise<void>}) {
  const t = useText();
  const [aiResult,setAIResult]=React.useState<AIAssistanceResult>();
  const [schema,setSchema]=React.useState<SVCv4Schema>();
  const [draft,setDraft]=React.useState<SVCv4Assessment>(()=>variant.svcv4Assessment??{disease:'',moi:'',inputs:{},confirmed:false});
  const [dirty,setDirty]=React.useState(false),[reason,setReason]=React.useState(''),[busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
  React.useEffect(()=>{const controller=new AbortController();void getSVCv4Schema(taskId,controller.signal).then(setSchema).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error ? errorText(e, t):t("tasks.unableToLoadNewRules9e8115"));});return()=>controller.abort();},[taskId]);
  const update=(change:Partial<SVCv4Assessment>)=>{setDraft(old=>({...old,...change,confirmed:false,result:undefined}));setDirty(true);};
  const evidence=(key:string,value:unknown)=>update({inputs:{...draft.inputs,[key]:value}});
  const calculate=async()=>{setBusy(true);setError('');try{setDraft(await evaluateSVCv4(taskId,{...draft,confirmed:false}));setDirty(false);}catch(e){setError(e instanceof Error ? errorText(e, t):t("tasks.calculationFailed95b6cf"));}finally{setBusy(false);}};
  const save=async()=>{if(!onSave)return;setBusy(true);setError('');try{await onSave(draft,reason.trim());setReason('');}catch(e){setError(e instanceof Error ? errorText(e, t):t("tasks.saveFailed40525a"));}finally{setBusy(false);}};
  const result=draft.result;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{t("tasks.svcV6cd501")}</span><AIAssistanceAction disabled={readOnly||busy} input={{feature:'svcv4',mode:'experimental',draftAssessment:svcExperimentalInput(draft),taskId,reference,variant:aiVariantContext(variant),calculator:{draft,schema}}} onResult={setAIResult} /></div>
    {aiResult&&<AIResultCard result={aiResult} onUseInterpretation={!readOnly&&onUseAIInterpretation?()=>onUseAIInterpretation(aiResult):undefined} />}
    <div className="rounded border border-warning-emphasis/40 bg-warning-subtle p-3 text-sm"><strong>{t("tasks.svcVExperimentalDraftNonauthoritativeReferenceImplementationf34d3e")}</strong><p>{t("tasks.assessPerDiseaseMissingInformationStaysUnconfirmed035985")}</p>{schema&&<a href={schema.source} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-fg">{t("tasks.ruleVersion5cc2ef")}{schema.revision.slice(0,12)}</a>}</div>
    <p className="break-words text-sm">{variant.gene} · {variant.chromosome}:{variant.position} {variant.ref} → {variant.alt} · {variant.transcript}<br />{variant.consequence}</p>
    <p className="text-xs text-fg-muted">{t("tasks.existingAnnotationGnomadAf3702da")}{variant.gnomadAF??t("history.notProvided071fb2")}{t("tasks.eastAsianAf54203b")}{variant.gnomadEasAF??t("history.notProvided071fb2")}；AlphaMissense {variant.alphaMissenseScore??t("history.notProvided071fb2")}{t("tasks.afIsNotScoredDirectlyAsFaf309fe1")}</p>
    {!schema&&!error&&<p>{t("tasks.loadingNewEvidenceFormc89313")}</p>}
    {schema&&<fieldset disabled={readOnly||busy} className="space-y-3">
      <label className="block text-sm">{t("tasks.diseaseNameOrCurieManualConfirmation1c578d")}<input className={inputClass} value={draft.disease} onChange={e=>update({disease:e.target.value})} /></label>
      {variant.diseaseAssociation&&<p className="text-xs text-fg-muted">{t("tasks.annotatedDiseaseReference7dfca4")}{variant.diseaseAssociation}</p>}
      <label className="block text-sm">{t("tasks.inheritancePattern5de3fe")}<select className={inputClass} value={draft.moi} onChange={e=>update({moi:e.target.value})}><option value="">{t("tasks.awaitingConfirmation27b584")}</option>{schema.moi.map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="block text-sm">{t("tasks.geneDiseaseValidity2a432a")}<select className={inputClass} value={draft.geneDiseaseValidity??''} onChange={e=>update({geneDiseaseValidity:e.target.value||null})}><option value="">{t("history.notProvided071fb2")}</option>{schema.geneDiseaseValidity.map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="block text-sm">{t("tasks.variantImpactWorkflow3b5e4e")}<select className={inputClass} value={draft.inputs.workflow??''} onChange={e=>update({inputs:{...draft.inputs,workflow:e.target.value||undefined,impact:undefined}})}><option value="">{t("tasks.notProvidedUnconfirmed8126ad")}</option>{schema.workflows.map(v=><option key={v.id} value={v.id}>{translateUI(v.label, t)}</option>)}<option disabled>{t("tasks.inFrameIndelNoncodingWorkflowsNotSupportede4b680")}</option></select></label>
      {schema.workflows.filter(w=>w.id===draft.inputs.workflow).map(w=><EvidenceFields key={w.id} schema={w.schema} value={draft.inputs.impact} label={t("tasks.variantImpactEvidence877753")} disabled={readOnly||busy} onChange={v=>evidence('impact',v)} />)}
      <EvidenceFields schema={schema.population} value={draft.inputs.population} label={t("tasks.populationEvidence778a9e")} disabled={readOnly||busy} onChange={v=>evidence('population',v)} />
      <p className="text-xs text-fg-muted">{t("tasks.enterOneProbandPerUnrelatedFamilyUse1cb00e")}</p>
      <EvidenceFields schema={{type:'array',items:schema.case}} root={schema.case} value={draft.inputs.cases} label={t("tasks.clinicalCases880773")} disabled={readOnly||busy} onChange={v=>evidence('cases',v)} />
      <EvidenceFields schema={schema.caseControl} value={draft.inputs.caseControl} label={t("tasks.caseControlStudiesca91cb")} disabled={readOnly||busy} onChange={v=>evidence('caseControl',v)} />
      <EvidenceFields schema={schema.case} value={draft.inputs.family} label={t("tasks.familyAndLocusSpecificEvidence2704b8")} disabled={readOnly||busy} onChange={v=>evidence('family',v)} />
      <ActionButton loading={busy} loadingLabel={t("tasks.processing1cac8a")} action="start" variant="ghost" type="button" onClick={()=>void calculate()} className="rounded border border-border-default px-3 py-2 text-sm">{t("tasks.calculateNewAssessmenteaab6f")}</ActionButton>
    </fieldset>}
    {result&&!dirty&&<div className="space-y-2 rounded border border-border-subtle p-3 text-sm">
      <strong>{result.classification?ACMG_CONFIG[result.classification].label:t("tasks.notAssessedd94e42")}{result.vusSubclass?` · ${result.vusSubclass}`:''} · {result.score??'—'} {t("tasks.pointsdecb3b")}</strong>
      <dl>{Object.entries(result.breakdown).map(([key,value])=><div key={key} className="flex justify-between"><dt>{key}</dt><dd>{value} {t("tasks.pointsdecb3b")}</dd></div>)}</dl>
      <details><summary>{t("tasks.subscoresAndCalculationHistoryea93e0")}</summary><pre className="overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(result.details,null,2)}</pre></details>
      <details open><summary>{t("tasks.applicabilityAssumptionsAndCalculationBasis8b88a4")}</summary><ul className="list-disc space-y-1 pl-4 text-xs">{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>
      <label className="flex items-start gap-2"><input type="checkbox" disabled={readOnly||busy} checked={draft.confirmed} onChange={e=>setDraft(old=>({...old,confirmed:e.target.checked}))} /><span>{t("tasks.iVerifiedDiseaseEvidenceApplicabilityAndDraft24409b")}</span></label>
    </div>}
    {!readOnly&&onSave&&<div className="space-y-2"><textarea aria-label={t("tasks.reasonForNewEvidenceChange2775ba")} placeholder={t("tasks.reasonForNewEvidenceChangeOptional")} className={inputClass} value={reason} onChange={e=>setReason(e.target.value)} /><ActionButton action="save" variant="primary" type="button" disabled={busy||dirty||!result} onClick={()=>void save()}>{t("tasks.saveNewAssessment62fa07")}</ActionButton></div>}
    {error&&<p role="alert" className="text-sm text-danger-fg">{error}</p>}
  </div>;
}
