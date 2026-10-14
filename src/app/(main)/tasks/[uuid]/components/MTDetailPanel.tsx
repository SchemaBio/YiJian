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
  variant: MitochondrialVariant | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenIGV?: (chromosome: string, position: number) => void;
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

export function MTDetailPanel({ variant, isOpen, onClose, onOpenIGV }: MTDetailPanelProps) {
  const t = useText();
  const [section, setSection] = React.useState<InspectorSection>('annotation');
  React.useEffect(() => { setSection('annotation'); }, [variant?.id, isOpen]);
  if (!isOpen || !variant) return null;

  const pathogenicityConfig = PATHOGENICITY_CONFIG[variant.pathogenicity];

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

        <InspectorTabs value={section} onChange={setSection} id="mt-inspector" />
        <div id="mt-inspector-content" role="tabpanel" aria-labelledby={`mt-inspector-${section}`} className="yj-inspector-content">
          {section === 'annotation' && <>
          {/* 基本信息 */}
          <SectionTitle icon={Dna} title={t("samples.basicInformationb122f8")} />
          <div className="border border-border-subtle rounded-lg px-3 py-1">
            <InfoItem label={t("history.gene9ef2ed")} value={variant.gene} />
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

          </>}
          {section === 'evidence' && <>
          {/* 异质性 */}
          <SectionTitle icon={FileText} title={t("tasks.heteroplasmyAnalysisb874d7")} />
          <div className="border border-border-subtle rounded-lg px-3 py-1">
            <InfoItem label={t("tasks.heteroplasmyFractionba19ec")} value={`${formatNumericString((variant.heteroplasmy * 100).toFixed(1), t.locale)}%`} />
            <InfoItem
              label={t("tasks.heteroplasmyLevel613cf4")}
              value={
                variant.heteroplasmy >= 0.8 ? t("tasks.highHeteroplasmya2ae59") :
                variant.heteroplasmy >= 0.4 ? t("tasks.moderateHeteroplasmydfccc0") :
                t("tasks.lowHeteroplasmyd36825")
              }
            />
          </div>

          </>}
          {section === 'assessment' && <>
          <PhenotypeSummary assessment={variant.automaticAssessment} />
          {/* 致病性评估 */}
          <SectionTitle icon={Database} title={t("tasks.pathogenicityAssessment0df423")} />
          <div className="border border-border-subtle rounded-lg px-3 py-1">
            <InfoItem
              label={t("history.pathogenicityfa6024")}
              value={<Tag variant={pathogenicityConfig.variant}>{translateUI(pathogenicityConfig.label, t)}</Tag>}
            />
            <InfoItem label={t("history.associatedDiseasea79330")} value={variant.associatedDisease} />
          </div>

          </>}
          {section === 'annotation' && <>
          {/* 外部资源 */}
          <SectionTitle icon={ExternalLink} title={t("tasks.externalResources227d9d")} />
          <div className="border border-border-subtle rounded-lg px-3 py-1">
            <InfoItem
              label="MITOMAP"
              value="查看"
              link={mitomapAlleleURL(variant.position)}
            />
            <InfoItem
              label="HmtVar"
              value="查看"
              link={hmtVarURL(variant.position, variant.ref, variant.alt)}
            />
            <InfoItem
              label="MitoTIP"
              value="查看"
              link={mitoTipURL(variant.position)}
            />
          </div>

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
        </div>
    </WorkspaceInspector>
  );
}
