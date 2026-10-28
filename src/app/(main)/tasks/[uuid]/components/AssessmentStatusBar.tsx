'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton } from '@/components/shared/ActionButton';

import { useInterpretationReadOnly } from './InterpretationLock';
import * as React from 'react';
import {assessmentStatus,cancelAssessment,type AssessmentStatus} from '@/lib/assessment/client';
import {reevaluateBrowserResults,retryBrowserAssessment} from '@/lib/parquet-browser';
import { ToolbarPopover } from '@/components/shared/ToolbarPopover';
import { Info, Dna } from 'lucide-react';
import { TaskNavigationCollapsed } from './TaskNavigation';
export function AssessmentStatusBar({taskId,table}:{taskId:string;table?:string}){
  const t = useText();
 const readOnly = useInterpretationReadOnly();
 const compact = React.useContext(TaskNavigationCollapsed);
 const [status,setStatus]=React.useState<AssessmentStatus|undefined>(()=>assessmentStatus(taskId));
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState('');
 React.useEffect(()=>{setStatus(assessmentStatus(taskId));const update=(event:Event)=>{const value=(event as CustomEvent<AssessmentStatus>).detail;if(value.taskId===taskId)setStatus(value);};window.addEventListener('yijian:assessment-status',update);return()=>window.removeEventListener('yijian:assessment-status',update);},[taskId]);
 if(!status)return null;
 return <div className="yj-assessment-status shrink-0" data-state={status.state}>
 <ToolbarPopover iconOnly={compact} label={status.state==='loading'?t("tasks.initialAssessmentRecords6a8820", {p0: String(status.processed.toLocaleString(t.locale))}):status.state==='error'?t("tasks.initialAssessmentFailed447463"):t("tasks.assessmentInformationc3f3b7")} icon={<Info size={14} />}>
   <div className="space-y-4 text-xs leading-relaxed">
     {(status.error||error)&&<p role="alert" className="text-danger-fg">{error||(status.errorKey ? t(status.errorKey) : status.error)}</p>}
     {status.state==='loading'&&<p role="status">{t("tasks.localInitialAssessmentProcessedc2a938")}{status.processed.toLocaleString(t.locale)} {t("history.recordseb8c2d")}</p>}
     {status.state==='ready'&&<p>{t("tasks.automaticallyPinned272d97")}{status.pinned??0} {t("history.recordseb8c2d")}{table ? t("tasks.currentTypeRecordse8ce8f", {p0: String(status.pinnedByTable?.[table]??0)}) : ''}</p>}
     <section><h4 className="mb-1 font-semibold">{t("tasks.assessmentVersion0a63d1")}</h4><p className="break-words text-fg-muted">{status.version || t("history.notProvided071fb2")}</p></section>
     <section><h4 className="mb-1 font-semibold">{t("tasks.evidenceAvailabilityc554c6")}</h4>{status.pending?.length ? <ul className="space-y-2 text-fg-muted">{status.pending.map(x=><li key={x}>{t(x)}</li>)}</ul> : <p className="text-fg-muted">{t("tasks.noAdditionalAvailabilityNoticesProfessionalReviewIs6fffa8")}</p>}</section>
     <section><h4 className="mb-1 font-semibold">{t("tasks.resourceVersion0c7595")}</h4><p className="break-words text-fg-muted">{status.packVersion && status.packVersion !== 'unavailable' ? `Human Phenotype Ontology、ClinGen、Mondo · ${status.packVersion}` : t("tasks.assessmentResourcesUnavailableOrNotLoaded700183")}</p></section>
   </div>
 </ToolbarPopover>
 {status.state==='loading'&&!!status.preview?.length&&<ToolbarPopover wide iconOnly={compact} label={t('assessmentPreview.title')} icon={<Info size={14}/>}>
   <p className="mb-3 text-xs text-fg-muted" role="status">{t('assessmentPreview.pending')}</p>
   <ol className="max-h-80 space-y-3 overflow-auto text-xs">{status.preview.filter(row=>!table||row.table===table).map(row=><li key={`${row.table}/${row.rowId}`} className="rounded border border-border-default p-2">
     <p className="font-semibold">{row.gene??row.rowId.slice(0,12)}</p>
     <p>{t('assessmentPreview.rowResult')}: {row.classification??t('assistance.verifiedEvidenceInsufficient')} · {row.score}</p>
     {!!row.criteria.length&&<p>{row.criteria.map(item=>`${item.code} (${item.strength})`).join(', ')}</p>}
     {!!row.pending.length&&<p className="text-fg-muted">{row.pending.map(item=>t(item)).join(' · ')}</p>}
   </li>)}</ol>
 </ToolbarPopover>}
 {status.geneRanking&&<ToolbarPopover wide iconOnly={compact} label={t('phenotype.geneList')} icon={<Dna size={14}/>}>
   <p className="mb-3 text-xs text-fg-muted">{t('phenotype.geneListHelp')}</p>
   <div className="max-h-80 overflow-auto">
     <table className="w-full text-left text-xs"><thead><tr><th className="p-2">#</th><th className="p-2">{t('phenotype.gene')}</th><th className="p-2">{t('phenotype.similarity')}</th><th className="p-2">{t('phenotype.disease')}</th></tr></thead>
       <tbody>{status.geneRanking.map((gene,index)=><tr key={gene.gene} className="border-t border-border-default" title={`${gene.source}\n${gene.matched.map(term=>term.name??term.id).join('；')}`}><td className="p-2 tabular-nums">{index+1}</td><td className="p-2 font-semibold">{gene.gene}</td><td className="p-2 tabular-nums">{(gene.score*100).toFixed(1)}%</td><td className="p-2">{gene.diseaseName??gene.diseaseId}<span className="block text-fg-muted">{gene.diseaseId}</span></td></tr>)}</tbody>
     </table>
     {!status.geneRanking.length&&<p className="p-2 text-xs text-fg-muted">{t('phenotype.noCandidates')}</p>}
   </div>
 </ToolbarPopover>}
 {status.state==='loading'&&<ActionButton iconOnly={compact} aria-label={t("tasks.cancelInitialAssessment38256e")} action="stop" variant="ghost" type="button" className="yj-tool-button" onClick={()=>cancelAssessment(taskId)}>{!compact && t("tasks.cancelInitialAssessment38256e")}</ActionButton>}
 {(status.state==='error'||status.state==='cancelled')&&<ActionButton iconOnly={compact} aria-label={t("tasks.retryLocalAssessment3192ee")} loading={busy} loadingLabel={compact ? undefined : t("tasks.preparinge25f6e")} action="retry" variant="ghost" type="button" disabled={busy} className="yj-tool-button" onClick={async()=>{setBusy(true);setError('');try{await retryBrowserAssessment(taskId);}catch(e){setError(e instanceof Error ? errorText(e, t):t("tasks.retryFailed8af761"));}finally{setBusy(false);}}}>{!compact && t("tasks.retryLocalAssessment3192ee")}</ActionButton>}
 {!readOnly&&status.state==='ready'&&<ActionButton iconOnly={compact} aria-label={t(status.reassessmentAvailable?"tasks.evidenceUpdatedReassessc59c30":"tasks.reassessInitialAssessment")} action="refresh" loading={busy} loadingLabel={compact ? undefined : t("tasks.preparinge25f6e")} variant="ghost" type="button" disabled={busy} className="yj-tool-button" onClick={async()=>{setBusy(true);setError('');try{await reevaluateBrowserResults(taskId);}catch(e){setError(e instanceof Error ? errorText(e, t):t("tasks.reassessmentFailed1f0dc8"));}finally{setBusy(false);}}}>{!compact && t(status.reassessmentAvailable?"tasks.evidenceUpdatedReassessc59c30":"tasks.reassessInitialAssessment")}</ActionButton>}
 {(status.error||error)&&<span className={compact ? "sr-only" : "text-danger-fg"}>{error||status.error}</span>}
 </div>;
}
