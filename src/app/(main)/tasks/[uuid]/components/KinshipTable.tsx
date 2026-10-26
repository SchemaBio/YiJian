'use client';
import { useText } from '@/i18n/useText';
import type { TrioMember } from '@/lib/sample-parents';
import type { ResultContext } from '../types';
import { verificationMember, type VerificationSample } from './QCResultTab';
import { CopyTableButton } from './CopyTableButton';

export function KinshipTable({context,sample,snapshot=[]}:{context:ResultContext;sample?:VerificationSample|null;snapshot?:TrioMember[]}) {
 const t=useText(); const data=context.kinship;
 if (!data) return null;
 const label=(id:string)=>{
  // Match the source identifier first. Role aliases are explicit workflow IDs,
  // never positional SNP-report columns.
  const member=context.members.find(item=>item.id===id||item.sampleId===id) ?? (['proband','father','mother'].includes(id)?{id,role:id}:undefined);
  return member?verificationMember(member,sample,snapshot).label:id;
 };
 const flag=(value:boolean)=>t(value?'kinship.yes':'kinship.no');
 const headers=['sampleA','sampleB','relatedness','expected','sites','ibs0','predictedParents','parentError','duplicate'].map(key=>t(`kinship.${key}`));
 const rows=[headers,...data.pairs.map(pair=>[label(pair.sampleA),label(pair.sampleB),String(pair.relatedness),String(pair.pedigreeRelatedness),pair.sites.toLocaleString(t.locale),pair.ibs0.toLocaleString(t.locale),flag(pair.predictedParents),flag(pair.parentError),flag(pair.sampleDuplicationError)])];
 return <section aria-labelledby="kinship-heading" className="overflow-hidden rounded-lg border border-border-default bg-canvas-default">
  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default px-3 py-2"><h3 id="kinship-heading" className="text-sm font-semibold text-fg-default">{t('kinship.title')}</h3>{data.status==='ready'&&<CopyTableButton rows={rows} label={t('tasks.copy4edd1d')}/>}</header>
  {data.status==='ready'?<div className="overflow-x-auto"><table className="w-full select-text border-collapse text-left text-sm">
   <thead className="bg-canvas-subtle text-xs text-fg-muted"><tr>{headers.map(header=><th key={header} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{header}</th>)}</tr></thead>
   <tbody>{data.pairs.map((pair,i)=><tr key={`${pair.sampleA}:${pair.sampleB}`} className="border-t border-border-default">{rows[i+1].map((value,j)=><td key={j} className={`whitespace-nowrap px-3 py-2 tabular-nums ${j>=7&&(pair.parentError||pair.sampleDuplicationError)?'text-warning-fg':'text-fg-default'}`}>{value}</td>)}</tr>)}</tbody>
  </table></div>:<p className="px-3 py-3 text-sm text-fg-muted">{t(`kinship.${data.status}`)}</p>}
  <p className="border-t border-border-default px-3 py-2 text-xs text-fg-muted">{t('kinship.note')}</p>
 </section>;
}
