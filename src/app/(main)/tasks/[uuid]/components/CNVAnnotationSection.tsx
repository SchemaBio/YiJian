'use client';
import * as React from 'react';
import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';
import { usePublicResult } from '@/components/shared/PublicResultContext';
import { formatNumericString } from '@/i18n/format';
import { ExternalLink, FileText, Database, MapPin } from 'lucide-react';
import { Tag } from '@/components/shared/Tag';
import { ClinicalSignificanceBadge } from './ClinicalSignificanceBadge';
import type { CNVSegment, CNVExon } from '../types';
import type { InspectorSection } from '@/components/shared/WorkspaceInspector';
function InfoItem({ label, value, link }: { label: string; value?: React.ReactNode; link?: string }) {
  const publicResult=usePublicResult();
  if (value === undefined || value === null || value === '' || value === '-') {
    return (
      <div className="flex justify-between py-1.5 border-b border-border-subtle last:border-0">
        <span className="text-fg-muted text-sm">{label}</span>
        <span className="text-fg-subtle text-sm">-</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between py-1.5 border-b border-border-subtle last:border-0">
      <span className="text-fg-muted text-sm">{label}</span>
      {link && !publicResult ? (
        <CNVEvidenceLink
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-fg text-sm hover:underline flex items-center gap-1"
        >
          {value}
          <ExternalLink className="w-3 h-3" />
        </CNVEvidenceLink>
      ) : (
        <span className="text-fg-default text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <Icon className="w-4 h-4 text-fg-muted" />
      <h4 className="text-sm font-medium text-fg-default">{title}</h4>
    </div>
  );
}

function formatLength(length: number, t: TextTranslator = chineseText): string {
  if (length >= 1000000) return `${formatNumericString((length / 1000000).toFixed(2), t.locale)} Mb`;
  if (length >= 1000) return `${formatNumericString((length / 1000).toFixed(1), t.locale)} kb`;
  return `${length} bp`;
}

function isCNVExon(variant: CNVSegment | CNVExon): variant is CNVExon {
  return 'gene' in variant;
}


export function CNVAnnotationSection({variant,variantType,section,referenceId}:{variant:CNVSegment|CNVExon;referenceId?:string;variantType:'segment'|'exon';section:InspectorSection}) {
 const t=useText();
 const externalReference=ucscDatabase(referenceId);
 const isExon=variantType==='exon';
 const exonRatio='ratio' in variant ? variant.ratio : null;
 return <>
            {/* 2. 注释 */}
            <section hidden={section !== 'annotation'} className="space-y-4">
              {(variant.type === 'Amplification' || variant.type === 'Deletion') && (
                <div className="mt-4 rounded-lg border border-border-default p-3">
                  <h4 className="mb-2 text-sm font-medium">{t("tasks.candidateIscnAnnotation38e32d")}</h4>
                  <p className="select-text break-words font-mono text-sm">{variant.iscnCandidate || t("tasks.cannotGenerateConfirmCopyStateReferenceVersionb03eb9")}</p>
                  <p className="mt-2 text-xs leading-relaxed text-fg-muted">{t("tasks.roundedSequencingCnEstimateXDenotesCandidate64f8d8")}</p>
                  {variant.annotationValues?.ISCN && (
                    <details className="mt-2 text-xs text-fg-muted">
                      <summary className="cursor-pointer">{t("tasks.originalWorkflowAnnotationUnchangedca650c")}</summary>
                      <p className="mt-1 select-text break-words font-mono">{variant.annotationValues.ISCN}</p>
                    </details>
                  )}
                </div>
              )}

              {/* 涉及基因 (仅 Segment) */}
              {!isExon && (variant as CNVSegment).genes?.length > 0 && (
                <>
                  <SectionTitle icon={Database} title={t("history.affectedGenes9fbbad")} />
                  <div className="space-y-0">
                    <div className="flex flex-wrap gap-2">
                      {(variant as CNVSegment).genes.map((gene) => (
                        <CNVEvidenceLink
                          key={gene}
                          href={geneCardsURL(gene)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-canvas-inset text-accent-fg rounded hover:bg-accent-subtle transition-colors"
                        >
                          {gene}
                          <ExternalLink className="w-3 h-3" />
                        </CNVEvidenceLink>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 基因组位置链接 */}
              <SectionTitle icon={MapPin} title={t("tasks.externalResources227d9d")} />
              <div className="space-y-0">
                {externalReference ? (
                  <>
                    <InfoItem
                      label="UCSC Genome Browser"
                      value={t("tasks.view7ea73e", { p0: String(externalReference) })}
                      link={ucscRegionURL(externalReference, variant.chromosome, variant.startPosition, variant.endPosition)}
                    />
                    <InfoItem
                      label="Ensembl"
                      value="查看"
                      link={ensemblRegionURL(variant.chromosome, variant.startPosition, variant.endPosition)}
                    />
                  </>
                ) : (
                  <InfoItem label={t("tasks.externalResources227d9d")} value={t("display.taskReferenceVersionNotProvided8f850e")} />
                )}
                {isExon && (
                  <InfoItem
                    label="GeneCards"
                    value={(variant as CNVExon).gene}
                    link={geneCardsURL((variant as CNVExon).gene)}
                  />
                )}
              </div>
            </section>

</>;
}
function CNVEvidenceLink(props:React.AnchorHTMLAttributes<HTMLAnchorElement>){const publicResult=usePublicResult();return publicResult?<span className={props.className}>{props.children}</span>:<a {...props}/>;}
function geneCardsURL(gene: string): string {
  return `https://www.genecards.org/cgi-bin/carddisp.pl?gene=${encodeURIComponent(String(gene).trim())}`;
}

function ucscDatabase(referenceId?: string): 'hg19' | 'hg38' | null {
  const normalized = referenceId?.trim().toLowerCase();
  if (normalized === 'hg19' || normalized === 'grch37') return 'hg19';
  if (normalized === 'hg38' || normalized === 'grch38') return 'hg38';
  return null;
}

function ucscRegionURL(database: 'hg19' | 'hg38', chromosome: string, startPosition: number, endPosition: number): string {
  const position = `${chromosome}:${startPosition}-${endPosition}`;
  return `https://genome.ucsc.edu/cgi-bin/hgTracks?db=${database}&position=${encodeURIComponent(position)}`;
}

function ensemblRegionURL(chromosome: string, startPosition: number, endPosition: number): string {
  const region = `${chromosome.replace(/^chr/i, '')}:${startPosition}-${endPosition}`;
  return `https://www.ensembl.org/Homo_sapiens/Location/View?r=${encodeURIComponent(region)}`;
}

function cnvTypeLabel(type: CNVSegment['type'], t: TextTranslator = chineseText): string {
  if (type === 'Amplification') return t("history.duplication1aeb54");
  if (type === 'Deletion') return t("history.deletion2fe9b7");
  if (type === 'Normal') return t("history.normalf78d03");
  return t("history.notProvided071fb2");
}
