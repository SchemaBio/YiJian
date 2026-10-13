'use client';
import { useText } from '@/i18n/useText';
import type { PhenotypeMatch } from '@/lib/assessment/types';
export function PhenotypeSummary({assessment}:{assessment?:{phenotypeMatch?:PhenotypeMatch;phenotypePriority?:boolean;phenotypeResource?:string;pending?:string[]}}){
  const t=useText(),match=assessment?.phenotypeMatch;
  if(!match)return null;
  return <section aria-label={t('phenotype.title')} className="my-3 space-y-2 rounded-md border border-border-default bg-canvas-subtle p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{t('phenotype.title')}</strong><span>{t(assessment?.phenotypePriority?'phenotype.priority':'phenotype.relevanceOnly')}</span></div>
    <p>{match.gene} · {match.diseaseName||match.diseaseId} ({match.diseaseId})</p>
    <p>{t('phenotype.similarity')}: {(match.score*100).toFixed(1)}% · {t(match.eligible?'phenotype.matches':'phenotype.belowThreshold')}</p>
    <p>{t('phenotype.matchedTerms')}: {match.matched.map(term=>`${term.id}${term.name?' '+term.name:''}`).join('；')||t('phenotype.none')}</p>
    <p className="break-words text-fg-muted">{t('phenotype.resource')}: {assessment?.phenotypeResource}<br/>{t('phenotype.source')}: {match.source}</p>
    <p className="text-fg-muted">{t('phenotype.noPoints')}</p>
    <p className="text-fg-muted">{t('phenotype.acknowledgement')}</p>
    {match.geneBackground&&<p className="break-words text-fg-muted">{t('phenotype.geneBackground')}: {match.geneBackground.id} · {match.geneBackground.validity} · {match.geneBackground.inheritance}</p>}
    {assessment?.pending?.filter(note=>note.startsWith('phenotype.')).map(note=><p key={note} className="text-fg-muted">{t(note)}</p>)}
  </section>;
}
export function AnnotationScreeningNotes({details}:{details?:{field:string;value:string}[]}){
  const t=useText();if(!details?.length)return null;
  return <section aria-label={t('phenotype.annotations')} className="my-3 space-y-1 rounded-md bg-canvas-subtle p-3 text-xs text-fg-muted">
    <strong>{t('phenotype.annotations')}</strong>
    {details.map(({field,value})=><p key={field} className="break-words">{field}: {value}</p>)}
    <p>{t('phenotype.annotationLimits')}</p>
  </section>;
}
