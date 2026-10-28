'use client';
import {useText} from '@/i18n/useText';

type ObjectValue=Record<string,unknown>;
const object=(value:unknown):ObjectValue|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as ObjectValue:undefined;
const list=(value:unknown):ObjectValue[]=>Array.isArray(value)?value.slice(0,200).flatMap(item=>object(item)?[object(item)!]:[]):[];
const text=(value:unknown)=>typeof value==='string'?value:'';
const reasonCodes=new Set(['duplicate_binding','claim_not_asserted','unknown_fact_id','ambiguous_binding','fact_scope_mismatch','structured_support_unavailable','request_fact_cannot_claim_source','referenced_fact_unavailable','unknown_source','source_not_cited','source_conflicting_or_rejected','excerpt_not_located','excerpt_requires_review','imported_context_only','independent_structured_fact','missing_independent_or_excerpt_binding']);
function sourceURL(value:unknown){try{const url=new URL(text(value));return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined;}catch{return undefined;}}

/** A read-only audit surface shared by all assessment engines and old records. */
export function EvidenceQualityPanel({proposal,defaultedFields=[]}:{proposal:unknown;defaultedFields?:string[]}){
 const t=useText();const root=object(proposal);const quality=object(root?.evidence_quality);
 const known=quality?.version==='evidence-quality-v1';const criteria=known?list(quality.criteria):[];
 const reports=known?list(quality.evidence_bindings):[];
 const defaulted=defaultedFields.length>0||Array.isArray(root?.calculator_defaults)&&root.calculator_defaults.length>0||reports.some(report=>Array.isArray(report.issues)&&report.issues.length>0);
 return <section className="space-y-2 text-xs text-fg-muted" aria-label={t('assessmentQuality.title')}>
  <p>{t('assessmentQuality.title')}</p>
  {!known&&<p>{t('evidenceBindings.missing')}</p>}
  {known&&<ul>{criteria.map((item,index)=><li key={`${text(item.code)}-${index}`}>{text(item.code)}: {t(`assessmentQuality.${['supported','pending_review','insufficient_data','conflicting'].includes(text(item.status))?text(item.status):'pending_review'}`)}</li>)}</ul>}
  {defaulted&&<p className="font-medium">{t('evidenceBindings.defaulted')}</p>}
  {known&&!Array.isArray(quality.evidence_bindings)&&<p>{t('evidenceBindings.missing')}</p>}
  {!!reports.length&&<details><summary className="cursor-pointer">{t('evidenceBindings.details')}</summary>
   <p className="my-2">{t('evidenceBindings.traceability')}</p>
   <ul className="space-y-3">{reports.map((report,index)=><li key={`${text(report.code)}-${index}`} className="rounded border border-border-subtle p-2">
    <p className="font-medium">{text(report.code)}</p>
    {!list(report.bindings).length&&<p>{t('evidenceBindings.noBinding')}</p>}
    <ul className="space-y-2">{list(report.bindings).map((binding,ordinal)=>{
     const href=sourceURL(binding.source_url);const label=text(binding.source_title)||text(binding.source_id);
     const status=['supported','context_only','pending_review','invalid'].includes(text(binding.status))?text(binding.status):'pending_review';
     const reason=reasonCodes.has(text(binding.reason))?text(binding.reason):'unknown';
     return <li key={ordinal}>
      <p>{text(binding.fact)||t('evidenceBindings.criterion')}: {t(`evidenceBindings.status.${status}`)}</p>
      <p>{t(`evidenceBindings.reason.${reason}`)}</p>
      <p>{t(binding.origin==='rule_engine'?'evidenceBindings.ruleOrigin':'evidenceBindings.modelOrigin')}</p>
      {label&&<p>{href?<a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-fg underline">{label}</a>:label}</p>}
      {!!text(binding.source_id)&&<p>{t('evidenceBindings.version')}: {text(binding.source_version)&&binding.source_version!=='unversioned'?text(binding.source_version):t('evidenceBindings.notRecorded')}</p>}
      {!!text(binding.fact_id)&&<p>{t('evidenceBindings.fact')}: {text(binding.fact_id)}</p>}
      {!!text(binding.excerpt)&&<blockquote className="whitespace-pre-wrap break-words border-l-2 pl-2">{text(binding.excerpt)}</blockquote>}
     </li>;
    })}</ul>
   </li>)}</ul>
  </details>}
 </section>;
}
