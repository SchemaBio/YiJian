'use client';
import * as React from 'react';
import { useText } from '@/i18n/useText';
import { usePublicResult } from '@/components/shared/PublicResultContext';
import { ExternalLink, FileText, Database, Dna } from 'lucide-react';
import { readSNVSample } from '@/lib/snv-sample-metrics';
import { formatSampleVaf, sampleZygosityLabel } from './SNVSampleColumns';
import { clinvarReviewStars, formatPopulationFrequency, formatPredictionLabel, sourceAnnotation, transcriptLocation } from '../utils/snv-annotations';
import { dbSnpIdentifiers } from '../utils/variant-resource-links';
import { ClinVarBadge } from './ClinVarBadge';
import { VariantResourceLinks } from './VariantResourceLinks';
import type { SNVIndel } from '../types';
import type { InspectorSection } from '@/components/shared/WorkspaceInspector';
export function InfoItem({ label, value, link }: { label: string; value?: React.ReactNode; link?: string }) {
  const publicResult = usePublicResult();
  if (value === undefined || value === null || value === '' || value === '-') {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3 py-2 border-b border-border-subtle last:border-0">
        <span className="text-fg-muted text-sm">{label}</span>
        <span className="text-fg-subtle text-sm">-</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)] gap-3 py-2 border-b border-border-subtle last:border-0">
      <span className="text-fg-muted text-sm">{label}</span>
      {link && !publicResult ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          className="min-w-0 break-words text-right text-accent-fg text-sm hover:underline flex items-start justify-end gap-1"
        >
          {value}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="min-w-0 break-words text-right text-fg-default text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

function AnnotationField({ label, value }: { label: string; value?: string }) {
  const t = useText();
  return <div><dt className="text-xs text-fg-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-default">{value && !['.', '-'].includes(value) ? value : t("history.notProvided071fb2")}</dd></div>;
}

// 分组标题组件
export function SectionTitle({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-5 first:mt-0">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-fg-muted" />
        <h4 className="text-sm font-medium text-fg-default">{title}</h4>
      </div>
      {action}
    </div>
  );
}


export function SNVAnnotationSections({variant, section, referenceGenome}: {variant:SNVIndel;section:InspectorSection;referenceGenome?:string}) {
 const t=useText();
 const publicResult=usePublicResult();
 const annotation=(column:string,fallback?:string|number)=>sourceAnnotation(variant,column,fallback);
 const dbSnpIds=dbSnpIdentifiers(variant);
 const proband=variant.proband??readSNVSample({...variant,...variant.annotationValues});
 const transcriptInfo=transcriptLocation(variant);
 return <>
          {/* 2. 注释 */}
          <section hidden={section !== 'annotation'} className="yj-annotation-layout">
            <section aria-labelledby="transcript-heading">
              <h4 id="transcript-heading" className="yj-annotation-heading">{t("tasks.transcriptAndHgvsee0106")}</h4>
              <dl className="yj-annotation-fields">
                <AnnotationField label={t("tasks.transcriptIdd6daab")} value={annotation('Transcript', variant.transcript)} />
                <AnnotationField label={t("tasks.exonNumber43bc13")} value={transcriptInfo.exonNumber} />
                <AnnotationField label={t("tasks.intronNumber44f9c7")} value={transcriptInfo.intronNumber} />
                <AnnotationField label={t("tasks.totalExons0e3eaf")} value={transcriptInfo.exonTotal ? `${transcriptInfo.exonTotal}${transcriptInfo.exonTotalDerived ? t("tasks.inferredFromIntronCount67556c") : ''}` : undefined} />
                <AnnotationField label={t("tasks.totalIntrons1db3b5")} value={transcriptInfo.intronTotal ? `${transcriptInfo.intronTotal}${transcriptInfo.intronTotalDerived ? t("tasks.inferredFromExonCount252265") : ''}` : undefined} />
                <AnnotationField label={t("tasks.originalPositionAnnotationae0a50")} value={transcriptInfo.location} />
                <AnnotationField label="HGVSc" value={annotation('HGVS_c', variant.hgvsc)} />
                <AnnotationField label="HGVSp" value={annotation('HGVS_p', variant.hgvsp)} />
                <AnnotationField label={t("history.variantConsequence95666e")} value={variant.consequence} />
              </dl>
            </section>
            <section aria-labelledby="gencc-heading">
              <h4 id="gencc-heading" className="yj-annotation-heading">{t("tasks.genccGeneDiseaseAssociation85a5a5")}</h4>
              <dl className="yj-annotation-fields">
                <AnnotationField label={t("tasks.diseaseAssociation8e7820")} value={annotation('GenCC_disease_title', variant.diseaseAssociation)} />
                <AnnotationField label={t("tasks.inheritancePattern5de3fe")} value={annotation('GenCC_moi_title') || ({ AD: t("tasks.autosomalDominant1594de"), AR: t("tasks.autosomalRecessive8973b8"), XL: t("tasks.xLinked48ce00"), XLD: t("tasks.xLinkedDominantbea7f6"), XLR: t("tasks.xLinkedRecessivec385b8") }[variant.inheritanceMode || '']) || annotation('GenCC_moi_curie', variant.inheritanceMode)} />
                <AnnotationField label={t("tasks.inheritanceIdentifiere42271")} value={annotation('GenCC_moi_curie', variant.inheritanceMode)} />
                <AnnotationField label={t("tasks.diseaseIdentifier3697b1")} value={annotation('GenCC_disease_original_curie')} />
              </dl>
            </section>
            {(dbSnpIds.length > 0 || variant.rsId || annotation('HGNC_ID') || annotation('Cytoband')) && (
              <section aria-labelledby="variant-ids-heading">
                <h4 id="variant-ids-heading" className="yj-annotation-heading">{t("tasks.variantIdentifiera3a10c")}</h4>
                {(dbSnpIds.length > 0 || variant.rsId) && <InfoItem label="dbSNP" value={dbSnpIds.length ? <span className="inline-flex flex-wrap gap-x-2 gap-y-1">{dbSnpIds.map(id => <EvidenceLink key={id} href={`https://www.ncbi.nlm.nih.gov/snp/${id}`} target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline">{id}</EvidenceLink>)}</span> : variant.rsId} />}
                {annotation('HGNC_ID') && <InfoItem label="HGNC ID" value={annotation('HGNC_ID')} />}
                {annotation('Cytoband') && <InfoItem label={t("tasks.cytobandc12b02")} value={annotation('Cytoband')} />}
              </section>
            )}
            {!publicResult && <section aria-labelledby="variant-links-heading">
              <h4 id="variant-links-heading" className="yj-annotation-heading">{t("tasks.databasesAndInterpretationResources02d5cc")}</h4>
              <VariantResourceLinks variant={variant} referenceGenome={referenceGenome} />
            </section>}
          </section>

          {/* 3. 证据 */}
          <section hidden={section !== 'evidence'}>
            <SectionTitle icon={FileText} title={t("tasks.sequencingQuality74e3b6")} />
            <div className="space-y-0">
              <InfoItem label="VAF" value={formatSampleVaf(proband.alleleFrequency, t)} />
              {proband.vafSource==='ad' && <p className="text-xs text-fg-muted">{t('tasks.sampleVafFromAd',{p0:proband.alleleDepth ?? '-'})}</p>}
              {(['father','mother'] as const).map(role => variant[role] && (
                <React.Fragment key={role}>
                  <InfoItem label={t('tasks.'+role+'Zygosity')} value={sampleZygosityLabel(variant[role]!.zygosity,t)} />
                  <InfoItem label={t('tasks.'+role+'Vaf')} value={formatSampleVaf(variant[role]!.alleleFrequency,t)} />
                </React.Fragment>
              ))}
              <InfoItem label="QUAL" value={annotation('Quality') ?? t("history.notProvided071fb2")} />
              <InfoItem label="FILTER" value={annotation('Filter') ?? t("history.notProvided071fb2")} />
              <InfoItem label={t("tasks.dpReadDepth438651")} value={annotation('Depth') ?? t("history.notProvided071fb2")} />
              <InfoItem label={t("tasks.adAlleleDepthd2d259")} value={annotation('AD') ?? t("history.notProvided071fb2")} />
              <InfoItem label={t("tasks.gqGenotypeQualitycc49b1")} value={annotation('GQ') ?? t("history.notProvided071fb2")} />
              <p className="mt-2 text-xs text-fg-muted">{t("tasks.valuesComeFromOriginalAnnotationsQualIsb4e964")}</p>
            </div>

            <SectionTitle icon={Database} title={t("tasks.clinvarAnnotations48099f")} />
            <div className="space-y-0">
              <InfoItem label={t("tasks.clinicalSignificancecd0866")} value={<ClinVarBadge value={annotation('ClinVar_Sig', variant.clinvarSignificance)} />} />
              <InfoItem label={t("tasks.reviewStatusa62215")} value={annotation('ClinVar_RevStat', variant.clinvarReviewStatus)} />
              <InfoItem label={t("tasks.reviewStars29d243")} value={clinvarReviewStars(annotation('ClinVar_RevStat', variant.clinvarReviewStatus))} />
              <InfoItem label={t("history.associatedDiseasea79330")} value={annotation('ClinVar_DN', variant.clinvarDisease)} />
            </div>

            <SectionTitle icon={Database} title={t("tasks.populationFrequency1705e3")} />
            <div className="space-y-0">
              <InfoItem label={t("tasks.gnomadOverallAf6abfe1")} value={formatPopulationFrequency(annotation('GnomAD_AF', variant.gnomadAF), t)} />
              <InfoItem label={t("tasks.gnomadEastAsianAfe9255d")} value={formatPopulationFrequency(annotation('GnomAD_AF_EAS', variant.gnomadEasAF), t)} />
              <InfoItem label="VEP MAX_AF" value={formatPopulationFrequency(annotation('MAX_AF', variant.maxAF), t)} />
              <InfoItem label="gnomAD nhomalt XX" value={annotation('GnomAD_nhomalt_XX', variant.gnomadNhomaltXX)} />
              <InfoItem label="gnomAD nhomalt XY" value={annotation('GnomAD_nhomalt_XY', variant.gnomadNhomaltXY)} />
              <p className="mt-2 text-xs text-fg-muted">{t("tasks.afIsTheOriginalRatioFromTo137eda")}</p>
            </div>

            <SectionTitle icon={Dna} title={t("tasks.functionalPredictions9b8bd4")} />
            <div className="space-y-0">
              <InfoItem label={t("interface.pangolinGaindcee65")} value={annotation('Pangolin_Gain', variant.pangolinGain)} />
              <InfoItem label={t("interface.pangolinLoss653f20")} value={annotation('Pangolin_Loss', variant.pangolinLoss)} />
              <InfoItem label={t("tasks.pangolinPredictionLabel4595a9")} value={annotation('Pangolin_AN', variant.pangolinAnnotation)} />
              <InfoItem label="EVOScore2" value={annotation('EVOScore', variant.evoScore)} />
              <InfoItem label={t("tasks.evoscorePredictionLabel9c87e9")} value={annotation('EVOScore_AN', variant.evoAnnotation)} />
              <InfoItem label={t("tasks.alphamissenseScore84aae0")} value={annotation('AlphaMissense_AM', variant.alphaMissenseScore)} />
              <InfoItem label={t("tasks.alphamissensePredictionLabel5a4a6e")} value={formatPredictionLabel(annotation('AlphaMissense_AMC', variant.alphaMissenseClass))} />
              <p className="mt-2 text-xs text-fg-muted">{t("tasks.workflowMultivaluesAndLabelsArePreservedFunctional8c01b5")}</p>
            </div>
          </section>

</>;
}
function EvidenceLink(props:React.AnchorHTMLAttributes<HTMLAnchorElement>) { const publicResult=usePublicResult(); return publicResult ? <span className={props.className}>{props.children}</span> : <a {...props}/>; }
