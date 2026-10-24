'use client';
import * as React from 'react';
import {useText} from '@/i18n/useText';
import {errorText} from '@/i18n/errors';
import {getTrioContext,type TrioContext,type TrioMember} from '@/lib/sample-parents';
export function TrioSnapshot({members}:{members:TrioMember[]}) {
 const t=useText();return <details className="mb-3 rounded-md border border-border-default p-3 text-sm"><summary>{t('sampleParents.trioSummary')}</summary>{members.map(member=><p key={member.role}>{t(`sampleParents.${member.role}`)}: {member.internal_id} · {t(`sampleParents.${member.gender||'unknown'}`)} · {t(`sampleParents.${member.affected_status==='unknown'?'unknown':member.affected_status||'unknown'}`)}</p>)}</details>;
}
export function useTrioContext(id:string|undefined,enabled:boolean) {
 const [state,setState]=React.useState<{context:TrioContext|null;error:unknown;loading:boolean}>({context:null,error:null,loading:false});
 React.useEffect(()=>{
  setState({context:null,error:null,loading:enabled&&!!id});if(!enabled||!id)return;
  const controller=new AbortController();let active=true;
  getTrioContext(id,controller.signal).then(context=>{if(active)setState({context,error:null,loading:false});}).catch(error=>{if(active)setState({context:null,error,loading:false});});
  return()=>{active=false;controller.abort();};
 },[id,enabled]);return state;
}
export function TrioSummary({state}:{state:ReturnType<typeof useTrioContext>}) {
 const t=useText();const {context,error,loading}=state;
 return <section className="space-y-2 rounded-md border border-border-default p-4">
  <h3 className="text-sm font-medium">{t('sampleParents.trioSummary')}</h3>
  <p className="text-xs text-fg-muted">{t('sampleParents.probandAffected')}</p>
  {loading&&<p role="status">{t('sampleParents.checking')}</p>}
  {error!=null&&<p role="alert" className="text-sm text-danger-fg">{errorText(error,t)}</p>}
  {context?.members.map(member=><div key={member.role} className="text-sm">{t(`sampleParents.${member.role}`)}: {member.internal_id} · {t(`sampleParents.${member.gender||'unknown'}`)} · {t(`sampleParents.${member.affected_status||'unknown'}`)} · {t('sampleParents.dataReady')}</div>)}
  {context?.errors.map(message=><p role="alert" key={message} className="text-sm text-danger-fg">{errorText(new Error(message),t)}</p>)}
  {!!context?.warnings.length&&<p className="text-sm text-warning-fg">{t('sampleParents.genderWarning')}</p>}
 </section>;
}
