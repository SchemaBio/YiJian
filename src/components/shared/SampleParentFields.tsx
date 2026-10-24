'use client';
import * as React from 'react';
import {Input,Select} from '@schema/ui-kit';
import {api} from '@/lib/api';
import {useText} from '@/i18n/useText';
import {errorText} from '@/i18n/errors';
import type {SampleParentValues,ParentSampleInfo,ParentAffectedStatus} from '@/lib/sample-parents';

export function ParentSampleStatus({info}:{info?:ParentSampleInfo}) {
 const t=useText();if(!info||info.state==='empty')return null;
 return <span className={`block text-xs ${info.state==='found'?'text-fg-muted':'text-danger-fg'}`}>
  {t(`sampleParents.${info.state}`)}{info.state==='found'&&<> · {info.internal_id} · {t(`sampleParents.${info.gender||'unknown'}`)} · {t(info.data_ready?'sampleParents.dataReady':'sampleParents.dataMissing')}</>}
  {info.warning&&<span className="block text-warning-fg">{t('sampleParents.genderWarning')}</span>}
 </span>;
}

export function SampleParentFields({value,onChange,sampleId,internalId,disabled=false}:{value:SampleParentValues;onChange:(next:SampleParentValues)=>void;sampleId?:string;internalId?:string;disabled?:boolean}) {
 const t=useText();const [resolved,setResolved]=React.useState<{father?:ParentSampleInfo;mother?:ParentSampleInfo}>({});const [failure,setFailure]=React.useState<unknown>(null);const [loading,setLoading]=React.useState(false);
 React.useEffect(()=>{
  let active=true;setResolved({});setFailure(null);setLoading(true);
  if(!value.fatherSampleInternalId?.trim()&&!value.motherSampleInternalId?.trim()){setLoading(false);return;}
  const timer=setTimeout(()=>{
   api.post<{father?:ParentSampleInfo;mother?:ParentSampleInfo}>('/v1/samples/resolve-parents',{sample_id:sampleId,internal_id:internalId,father_sample_internal_id:value.fatherSampleInternalId?.trim()||'',mother_sample_internal_id:value.motherSampleInternalId?.trim()||''})
   .then(result=>{if(active)setResolved(result);}).catch(err=>{if(active)setFailure(err);}).finally(()=>{if(active)setLoading(false);});
  },300);
  return()=>{active=false;clearTimeout(timer);};
 },[sampleId,internalId,value.fatherSampleInternalId,value.motherSampleInternalId]);
 return <section className="space-y-3 rounded-md border border-border-default p-4">
  <h3 className="text-sm font-medium">{t('sampleParents.title')}</h3>
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{(['father','mother'] as const).map(role=>{
   const idKey=role==='father'?'fatherSampleInternalId':'motherSampleInternalId';const statusKey=role==='father'?'fatherAffectedStatus':'motherAffectedStatus';
   return <React.Fragment key={role}><div><label className="mb-1 block text-xs">{t(`sampleParents.${role}Sample`)}</label>
    <Input aria-label={t(`sampleParents.${role}Sample`)} value={value[idKey]||''} disabled={disabled} onChange={e=>onChange({...value,[idKey]:e.target.value})} placeholder={t('sampleParents.internalIdPlaceholder')}/>
    {loading&&value[idKey]?<span role="status" className="text-xs text-fg-muted">{t('sampleParents.checking')}</span>:<ParentSampleStatus info={resolved[role]}/>}
   </div><div><label className="mb-1 block text-xs">{t(`sampleParents.${role}Status`)}</label>
    <Select aria-label={t(`sampleParents.${role}Status`)} value={value[statusKey]||'__empty'} disabled={disabled} options={(['','affected','unaffected','carrier'] as ParentAffectedStatus[]).map(status=>({value:status||'__empty',label:t(`sampleParents.${status||'empty'}`)}))} onChange={v=>{const selected=Array.isArray(v)?v[0]:v;onChange({...value,[statusKey]:selected==='__empty'?'':selected});}}/>
   </div></React.Fragment>;
  })}</div>
  {failure!=null&&<p role="alert" className="text-xs text-danger-fg">{errorText(failure,t)}</p>}
  <p className="text-xs text-fg-muted">{t('sampleParents.saveHint')}</p>
 </section>;
}
