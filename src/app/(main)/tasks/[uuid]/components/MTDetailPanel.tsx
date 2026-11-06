'use client';
import { formatNumericString } from '@/i18n/format';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { IconActionButton } from '@/components/shared/ActionButton';
import { PhenotypeSummary } from './PhenotypeSummary';


import * as React from 'react';
import { WorkspaceInspector, InspectorTabs, type InspectorSection } from '@/components/shared/WorkspaceInspector';
import { ExternalLink, FileText, Database, Dna } from 'lucide-react';
import { Tag } from '@/components/shared/Tag';
import type { MitochondrialVariant, MitochondrialPathogenicity } from '../types';
import { MTACMGEditor, type MTEvidence } from './MTACMGEditor';

// 致病性配置
const PATHOGENICITY_CONFIG: Record<MitochondrialPathogenicity, { label: string; variant: 'danger' | 'warning' | 'neutral' | 'info' | 'success' }> = {
  Pathogenic: { label: '致病', variant: 'danger' },
  Likely_Pathogenic: { label: '可能致病', variant: 'warning' },
  VUS: { label: '意义未明', variant: 'neutral' },
  Likely_Benign: { label: '可能良性', variant: 'info' },
  Benign: { label: '良性', variant: 'success' },
  Unknown: { label: '未提供', variant: 'neutral' },
};

interface MTDetailPanelProps {
  taskId: string;
  variant: MitochondrialVariant | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenIGV?: (chromosome: string, position: number) => void;
  initialSection?: InspectorSection;
  onSaveAssessment: (variant: MitochondrialVariant, evidence: MTEvidence) => Promise<void>;
}

const mtSections: InspectorSection[] = ['annotation', 'evidence', 'assessment', 'acmg'];
const molecularFields = ['MT_Gene_Type', 'Type', 'Feature', 'Consequence', 'Impact', 'HGVS_c', 'HGVS_p', 'Amino_Acids', 'Protein_Position'];
const referenceFields = ['Mitophen_Variant', 'Mitophen_Phenotypes', 'ClinVar_Sig', 'ClinVar_DN', 'ClinVar_Star', 'dbSNP', 'GnomAD_AF', 'GnomAD_AF_EAS', 'MAX_AF'];
const callFields = ['Filter', 'Genotype', 'Heteroplasmy_Class', 'AD', 'AF', 'TLOD', 'POPAF', 'GERMQ', 'STRANDQ', 'CONTQ', 'SEQQ', 'MBQ', 'MMQ', 'MFRL'];

function ReportFields({ fields, values }: { fields: string[]; values?: Record<string, unknown> }) {
  return <div className="rounded-lg border border-border-subtle px-3 py-1">
    {fields.map(field => {
      const value = values?.[field];
      const display = value == null || value === '.' ? undefined : String(value);
      return <InfoItem key={field} label={field.replaceAll('_', ' ')} value={display} />;
    })}
  </div>;
}
function mitomapAlleleURL(position: number): string {
  return `https://www.mitomap.org/MITOMAP/SearchAllele?position=${encodeURIComponent(String(position))}`;
}

function hmtVarURL(position: number, ref: string, alt: string): string {
  const variant = `m.${position}${ref}>${alt}`;
  return `https://www.hmtvar.uniba.it/varCard/${encodeURIComponent(variant)}`;
}

function mitoTipURL(position: number): string {
  return `https://www.mitomap.org/cgi-bin/search_tRNA?pos=${encodeURIComponent(String(position))}`;
}

// 信息项组件
function InfoItem({ label, value, link }: { label: string; value?: React.ReactNode; link?: string }) {
  if (value === undefined || value === null || value === '' || value === '-') {
    return (
      <div className="flex justify-between gap-4 py-2 border-b border-border-subtle last:border-0">
        <span className="text-fg-muted text-sm shrink-0">{label}</span>
        <span className="text-fg-subtle text-sm">-</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border-subtle last:border-0">
      <span className="text-fg-muted text-sm shrink-0">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-fg text-sm hover:underline flex items-center gap-1"
        >
          {value}
          <ExternalLink className="w-3 h-3" />
        </a>
      ) : (
        <span className="text-fg-default text-sm font-medium min-w-0 break-words text-right">{value}</span>
      )}
    </div>
  );
}

// 分组标题组件
function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <Icon className="w-4 h-4 text-fg-muted" />
      <h4 className="text-sm font-medium text-fg-default">{title}</h4>
    </div>
  );
}

export function MTDetailPanel({ taskId, variant, isOpen, onClose, onOpenIGV, initialSection = 'annotation', onSaveAssessment }: MTDetailPanelProps) {
  const t = useText();
  const [section, setSection] = React.useState<InspectorSection>('annotation');
  React.useEffect(() => { setSection(initialSection); }, [variant?.id, isOpen, initialSection]);
  if (!isOpen || !variant) return null;

  const pathogenicityConfig = PATHOGENICITY_CONFIG[variant.mtAssessment?.classification ?? variant.pathogenicity];

  return (
    <WorkspaceInspector label={t("tasks.mitochondrialVariantDetails7315db")} onClose={onClose}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-canvas-subtle">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-base font-medium text-fg-default">{t("tasks.mitochondrialVariantDetails7315db")}</h3>
            <Tag variant={pathogenicityConfig.variant}>{translateUI(pathogenicityConfig.label, t)}</Tag>
          </div>
          <IconActionButton label={t("tasks.close6c14bd")} action="close" variant="ghost"
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"

           />
        </div>

        <InspectorTabs value={section} onChange={setSection} id="mt-inspector" sections={mtSections} />
        <div id="mt-inspector-content" role="tabpanel" aria-labelledby={`mt-inspector-${section}`} className="yj-inspector-content">
          {section === 'annotation' && <>
          {/* 基本信息 */}
          <SectionTitle icon={Dna} title={t("samples.basicInformationb122f8")} />
          <div className="border border-border-subtle rounded-lg px-3 py-1">
            <InfoItem label={t("history.gene9ef2ed")} value={variant.gene} />
            <InfoItem label="HGVS" value={variant.hgvs} />
            <InfoItem
              label={t("history.position88c344")}
              value={
                <button
                  onClick={() => onOpenIGV?.('chrM', variant.position)}
                  className="text-accent-fg hover:underline"
                >
                  m.{variant.position}
                </button>
              }
            />
            <InfoItem label={t("tasks.referenceAlternateabcf6a")} value={`${variant.ref} > ${variant.alt}`} />
            {variant.haplogroup && (
              <InfoItem label={t("history.haplogroupd4fd42")} value={variant.haplogroup} />
            )}
          </div>
          <SectionTitle icon={Dna} title={t('mtDetail.molecularAnnotation')} />
          <ReportFields fields={molecularFields} values={variant.annotationValues} />
          <SectionTitle icon={Database} title={t('mtDetail.referenceAnnotation')} />
          <ReportFields fields={referenceFields} values={variant.annotationValues} />

          </>}
          {section === 'evidence' && <>
          {/* 异质性 */}
          <SectionTitle icon={FileText} title={t("tasks.heteroplasmyAnalysisb874d7")} />
          <div className="border border-border-subtle rounded-lg px-3 py-1">
            <InfoItem label={t("tasks.heteroplasmyFractionba19ec")} value={`${formatNumericString((variant.heteroplasmy * 100).toFixed(1), t.locale)}%`} />
            <InfoItem label={t("tasks.dpReadDepth438651")} value={variant.depth?.toLocaleString(t.locale)} />
            <InfoItem label={t("tasks.mtAltReadCount")} value={variant.altReadCounts.map(count => count?.toLocaleString(t.locale) ?? '-').join(' / ')} />
          </div>
          <SectionTitle icon={FileText} title={t('mtDetail.callEvidence')} />
          <ReportFields fields={callFields} values={variant.annotationValues} />

          </>}
          {section === 'assessment' && <>
          <PhenotypeSummary assessment={variant.automaticAssessment} />
          {/* 致病性评估 */}
          <SectionTitle icon={Database} title={t("tasks.pathogenicityAssessment0df423")} />
          <div className="border border-border-subtle rounded-lg px-3 py-1">
            <InfoItem
              label={t('mtDetail.reportClassification')}
              value={translateUI(PATHOGENICITY_CONFIG[variant.pathogenicity].label, t)}
            />
            <InfoItem label={t('mtDetail.manualClassification')} value={variant.mtAssessment ? translateUI(pathogenicityConfig.label, t) : undefined} />
            <InfoItem label={t("history.associatedDiseasea79330")} value={variant.associatedDisease} />
          </div>
          <button type="button" className="mt-3 text-sm text-accent-fg underline" onClick={() => setSection('acmg')}>{t('mtDetail.calculator')}</button>

          </>}
          {section === 'annotation' && <>
          <section aria-labelledby="mt-links-heading">
            <h4 id="mt-links-heading" className="yj-annotation-heading">{t("tasks.externalResources227d9d")}</h4>
            <div className="yj-resource-groups">
              <div className="yj-resource-link-grid">
                {[
                  { label: 'MITOMAP', href: mitomapAlleleURL(variant.position) },
                  { label: 'HmtVar', href: hmtVarURL(variant.position, variant.ref, variant.alt) },
                  { label: 'MitoTIP', href: mitoTipURL(variant.position) },
                ].map(link => (
                  <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="yj-resource-link">
                    <span>{link.label}</span><ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-fg-muted">{t("tasks.externalDatabasesAreReferenceResourcesAnnotationsAree1f593")}</p>
            </div>
          </section>

          </>}
          {section === 'assessment' && <>
          {/* 置顶状态 */}
          <SectionTitle icon={FileText} title={t("tasks.pinStatus129a6b")} />
          <div className="border border-border-subtle rounded-lg px-3 py-1">
            <InfoItem
              label={t("tasks.pinStatus129a6b")}
              value={variant.pinned ? (
                <Tag variant="success">{t("tasks.pinnedd7d970")}</Tag>
              ) : (
                <Tag variant="neutral">{t("tasks.notPinned9065cc")}</Tag>
              )}
            />

            <InfoItem
              label={t("tasks.focusStatus86bba4")}
              value={variant.focused ? (
                <Tag variant="info">{t("tasks.focused6fb7a5")}</Tag>
              ) : (
                <Tag variant="neutral">{t("tasks.notFocuseda438d1")}</Tag>
              )}
            />
            {variant.focused && variant.focusedBy && (
              <>
                <InfoItem label={t("tasks.focusedBycc3bc9")} value={variant.focusedBy} />
                <InfoItem label={t("tasks.focusedAt741a21")} value={variant.focusedAt} />
              </>
            )}
          </div>
          </>}
          {section === 'acmg' && <MTACMGEditor key={variant.id} taskId={taskId} variant={variant} onSave={evidence => onSaveAssessment(variant, evidence)} />}
        </div>
    </WorkspaceInspector>
  );
}
