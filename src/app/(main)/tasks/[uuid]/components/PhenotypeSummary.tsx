'use client';
import { useText } from '@/i18n/useText';
import { ChevronRight } from 'lucide-react';
import type { PhenotypeMatch } from '@/lib/assessment/types';
export function PhenotypeSummary({assessment}:{assessment?:{phenotypeMatch?:PhenotypeMatch;phenotypePriority?:boolean;phenotypeResource?:string;pending?:string[]}}){
  const t=useText(),match=assessment?.phenotypeMatch;
  if(!match)return null;
  return <details key={`${match.gene}:${match.diseaseId}`} aria-label={t('phenotype.title')} className="group/phenotype my-3 rounded-md border border-border-default bg-canvas-subtle text-xs">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emphasis [&::-webkit-details-marker]:hidden">
      <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-fg-muted transition-transform group-open/phenotype:rotate-90" />
      <strong className="min-w-0 flex-1">{t('phenotype.title')}</strong>
      <span title={t('phenotype.similarity')} className="shrink-0 font-mono tabular-nums text-fg-muted">{(match.score*100).toFixed(1)}%</span>
    </summary>
    <div className="space-y-2 border-t border-border-default p-3">
    <p className="text-fg-muted">{t(assessment?.phenotypePriority?'phenotype.priority':'phenotype.relevanceOnly')}</p>
    <p>{match.gene} · {match.diseaseName||match.diseaseId} ({match.diseaseId})</p>
    <p>{t('phenotype.similarity')}: {(match.score*100).toFixed(1)}% · {t(match.eligible?'phenotype.matches':'phenotype.belowThreshold')}</p>
    <p>{t('phenotype.matchedTerms')}: {match.matched.map(term=>`${term.id}${term.name?' '+term.name:''}`).join('；')||t('phenotype.none')}</p>
    <p className="break-words text-fg-muted">{t('phenotype.resource')}: {assessment?.phenotypeResource}<br/>{t('phenotype.source')}: {match.source}</p>
    <p className="text-fg-muted">{t('phenotype.noPoints')}</p>
    <p className="text-fg-muted">{t('phenotype.acknowledgement')}</p>
    {match.geneBackground&&<p className="break-words text-fg-muted">{t('phenotype.geneBackground')}: {match.geneBackground.id} · {match.geneBackground.validity} · {match.geneBackground.inheritance}</p>}
    {assessment?.pending?.filter(note=>note.startsWith('phenotype.')).map(note=><p key={note} className="text-fg-muted">{t(note)}</p>)}
    </div>
  </details>;
}
export function AnnotationScreeningNotes({details}:{details?:{field:string;value:string}[]}){
  const t=useText();if(!details?.length)return null;
  return <details aria-label={t('phenotype.annotations')} className="group/annotations my-3 rounded-md border border-border-default bg-canvas-subtle text-xs text-fg-muted">
    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emphasis [&::-webkit-details-marker]:hidden">
      <ChevronRight size={14} aria-hidden="true" className="shrink-0 transition-transform group-open/annotations:rotate-90" />
      <strong className="min-w-0 flex-1">{t('phenotype.annotations')}</strong>
      <span className="shrink-0 font-mono tabular-nums">{details.length}</span>
    </summary>
    <div className="space-y-1 border-t border-border-default p-3">
    {details.map(({field,value})=><p key={field} className="break-words">{field}: {value}</p>)}
    <p>{t('phenotype.annotationLimits')}</p>
    </div>
  </details>;
}
