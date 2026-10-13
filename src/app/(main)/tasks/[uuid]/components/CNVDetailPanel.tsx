'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';

import { IconActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { WorkspaceInspector, InspectorTabs, type InspectorSection } from '@/components/shared/WorkspaceInspector';
import { useInterpretationReadOnly } from './InterpretationLock';
import { ResultChangeHistory } from './ResultChangeHistory';
import { AIAssistanceAction, AIResultCard } from '@/components/shared/AIAssistanceAction';
import { formatAIInterpretation, type AIAssistanceResult } from '@/lib/ai-assistance';
import { aiVariantContext } from '../utils/ai-context';
import { CNVRegionPlot } from './CNVRegionPlot';
import { CNVExonPlot } from './CNVExonPlot';
import type { CNVPlotAnchor } from './CNVPlotWindow';
import { ExternalLink, FileText, Database, MapPin } from 'lucide-react';
import { getClassificationLabel, formatScore } from '../utils/pathogenicity-classifier';
import { Tag } from '@schema/ui-kit';
import type { CNVSegment, CNVExon } from '../types';

interface CNVDetailPanelProps {
  variant: CNVSegment | CNVExon | null;
  variantType: 'segment' | 'exon';
  isOpen: boolean;
  onClose: () => void;
  allSegments?: CNVSegment[];  // 保留旧调用方兼容；区域图从完整本地数据集查询
  referenceId?: string;
  taskId?: string;
  plotAnchor?: CNVPlotAnchor;
  onSaveInterpretation?: (variant: CNVSegment | CNVExon, interpretation: string) => Promise<void>;
  onOpenAssessment?: (variant: CNVSegment | CNVExon) => void;
}

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

function cnvTypeVariant(type: CNVSegment['type']): 'danger' | 'info' | 'neutral' {
  if (type === 'Amplification') return 'danger';
  if (type === 'Deletion') return 'info';
  return 'neutral';
}

// 信息项组件
function InfoItem({ label, value, link }: { label: string; value?: React.ReactNode; link?: string }) {
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
        <span className="text-fg-default text-sm font-medium">{value}</span>
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

// 格式化长度显示
function formatLength(length: number, t: TextTranslator = chineseText): string {
  if (length >= 1000000) return `${formatNumericString((length / 1000000).toFixed(2), t.locale)} Mb`;
  if (length >= 1000) return `${formatNumericString((length / 1000).toFixed(1), t.locale)} kb`;
  return `${length} bp`;
}

// 拖动 Hook
function isCNVExon(variant: CNVSegment | CNVExon): variant is CNVExon {
  return 'gene' in variant;
}

export function CNVDetailPanel({ variant, variantType, isOpen, onClose, referenceId, taskId, plotAnchor, onOpenAssessment, onSaveInterpretation }: CNVDetailPanelProps) {
  const t = useText();
  const [section, setSection] = React.useState<InspectorSection>('annotation');
  const readOnly = useInterpretationReadOnly();
  const [aiResult, setAIResult] = React.useState<AIAssistanceResult>();
  const [interpretation, setInterpretation] = React.useState('');
  const [savedInterpretation, setSavedInterpretation] = React.useState('');
  const [saving, setSaving] = React.useState(false), [saveError, setSaveError] = React.useState('');
  const scope = `${taskId}/${variantType}/${variant?.id}`;
  const scopeRef = React.useRef(scope); scopeRef.current = scope;
  const [plotOpen, setPlotOpen] = React.useState(false);
  React.useEffect(() => { if (isOpen && taskId && variant) setPlotOpen(true); setSection('annotation'); setAIResult(undefined); setInterpretation(variant?.interpretation ?? ''); setSavedInterpretation(variant?.interpretation ?? ''); setSaving(false); setSaveError(''); }, [scope, isOpen]);
  if (!variant) return null;

  const isExon = isCNVExon(variant);
  const exonRatio = isExon ? variant.ratio : null;
  const showPlot = variantType === 'segment' && Boolean(taskId);
  const typeVariant = cnvTypeVariant(variant.type);
  const typeLabel = cnvTypeLabel(variant.type, t);
  const externalReference = ucscDatabase(referenceId);

  return (
    <>
      {isOpen && <WorkspaceInspector label={t("tasks.variantDetails7ca440")} onClose={onClose} nonModal>
        {/* 头部 */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-canvas-subtle">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-medium text-fg-default">
              {variantType === 'exon' ? t("tasks.exonCnvDetails317773") : t("tasks.regionCnvDetails47f31b")}
            </h3>
            <Tag variant={typeVariant}>
              {typeLabel}
            </Tag>
          </div>
          <div className="ml-auto flex items-center gap-2">
          {taskId && <ActionButton action="view" size="small" variant="secondary" className="shrink-0" onClick={() => setPlotOpen(true)}>{isExon ? t("tasks.exonCnDistribution991e77") : t("tasks.regionSignalPlot630d9d")}</ActionButton>}
          <IconActionButton label={t("tasks.close6c14bd")} action="close" variant="ghost"
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"

           />
          </div>
        </div>

        <div className="yj-inspector-summary">
          <strong className="text-fg-default">{variant.chromosome}:{variant.startPosition}–{variant.endPosition}</strong>
          <p className="mt-1">{variant.assessment?.assessmentState === 'insufficient_evidence' ? t("tasks.insufficientEvidence70568c") : variant.assessment ? getClassificationLabel(variant.assessment.classification) : t("tasks.notAssessed88f079")} · {variant.assessment ? t("tasks.pointsc91542", {p0: String(formatScore(variant.assessment.totalScore))}) : '—'}</p>
        </div>
        {/* 内容区域 */}
        <InspectorTabs id="variant-inspector" value={section} onChange={setSection} sections={['annotation', 'evidence', 'assessment', 'interpretation', 'history']} />
        <div id="variant-inspector-content" role="tabpanel" aria-labelledby={`variant-inspector-${section}`} className="yj-inspector-content">
          <section hidden={section !== 'interpretation'} className="space-y-3">
            <h4 className="text-sm font-semibold">{t("tasks.manualInterpretation1fcaef")}</h4>
            <textarea aria-label={t("tasks.manualCnvInterpretation348a96")} readOnly={readOnly} value={interpretation} onChange={event => setInterpretation(event.target.value)} placeholder={t("tasks.enterYourInterpretationOfThisCnv6b6b17")} className="min-h-32 w-full resize-y rounded-md border border-border-default bg-canvas-default p-3 text-sm" />
            <div className="flex items-center justify-between gap-2"><span className="text-xs text-fg-muted">{interpretation.length} {t("tasks.characters9f8ba6")}</span><ActionButton loading={saving} loadingLabel={t("tasks.saving6644f0")} action="save" variant="ghost" type="button" disabled={readOnly || saving || !onSaveInterpretation || interpretation === savedInterpretation} className="inline-flex items-center justify-center rounded-md bg-accent-emphasis px-3 py-2 text-sm font-medium text-fg-on-emphasis disabled:opacity-40 disabled:opacity-40" onClick={async () => {
              if (!onSaveInterpretation) return;
              setSaving(true); setSaveError(''); const originalScope = scope; const draft = interpretation;
              try { await onSaveInterpretation(variant, draft); if (scopeRef.current === originalScope) setSavedInterpretation(draft); }
              catch (cause) { if (scopeRef.current === originalScope) setSaveError(cause instanceof Error ? errorText(cause, t) : t("tasks.saveFailed40525a")); }
              finally { if (scopeRef.current === originalScope) setSaving(false); }
            }}>{t("tasks.saveInterpretationac1ec3")}</ActionButton></div>
            {saveError && <p role="alert" className="text-sm text-danger-fg">{saveError}</p>}
          </section>
          <section hidden={section !== 'history'}>
            <ResultChangeHistory taskId={taskId} table={variantType === 'exon' ? 'cnv-exon' : 'cnv-segment'} rowId={variant.id} active={section === 'history'} revision={variant.adjustmentVersion} />
          </section>
          <section hidden={section !== 'assessment'} >
          {(variant.type === 'Deletion' || variant.type === 'Amplification') && <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">ClinGen {variant.type === 'Deletion' ? 'Loss' : 'Gain'} {t("tasks.assessment6c63b7")}</span><AIAssistanceAction key={scope} disabled={readOnly || !taskId} input={{feature:variant.type === 'Deletion'?'cnv_loss':'cnv_gain',taskId,reference:referenceId,variant:aiVariantContext(variant),calculator:variant.assessment}} onResult={setAIResult} /></div>}
          {aiResult && <div className="mb-4"><AIResultCard result={aiResult} onUseInterpretation={!readOnly && onSaveInterpretation ? () => { setInterpretation(previous => [previous, formatAIInterpretation(aiResult)].filter(Boolean).join('\n\n')); setSection('interpretation'); } : undefined} /></div>}
          <div className="mb-3 flex flex-wrap gap-2">
            {onOpenAssessment && (variant.type === 'Deletion' || variant.type === 'Amplification') && <button type="button" onClick={() => onOpenAssessment(variant)} className="rounded-md bg-accent-emphasis px-3 py-2 text-sm text-fg-on-emphasis">ClinGen {variant.type === 'Deletion' ? 'Loss' : 'Gain'} {t("tasks.calculatoraf747d")}</button>}

          </div>
          </section>
          <section hidden={section !== 'annotation'} >
          {(variant.type === 'Amplification' || variant.type === 'Deletion') && <div className="mt-4 rounded-lg border border-border-default p-3">
            <h4 className="mb-2 text-sm font-medium">{t("tasks.candidateIscnAnnotation38e32d")}</h4>
            <p className="select-text break-words font-mono text-sm">{variant.iscnCandidate || t("tasks.cannotGenerateConfirmCopyStateReferenceVersionb03eb9")}</p>
            <p className="mt-2 text-xs leading-relaxed text-fg-muted">{t("tasks.roundedSequencingCnEstimateXDenotesCandidate64f8d8")}</p>
            {variant.annotationValues?.ISCN && <details className="mt-2 text-xs text-fg-muted"><summary className="cursor-pointer">{t("tasks.originalWorkflowAnnotationUnchangedca650c")}</summary><p className="mt-1 select-text break-words font-mono">{variant.annotationValues.ISCN}</p></details>}
          </div>}
          </section>
          <section hidden={section !== 'evidence'} >
          {/* CNV 特征 */}
          <SectionTitle icon={FileText} title={t("tasks.cnvFeaturesc60b58")} />
          <div className="space-y-0">
            <InfoItem
              label={t("history.typee4e46c")}
              value={
                <Tag variant={typeVariant}>
                  {typeLabel}
                </Tag>
              }
            />
            <InfoItem label={t("history.copyNumber04d1ca")} value={variant.copyNumber} />
            <InfoItem label={t("interface.copyRatio111a27")} value={variant.copyRatio === null ? undefined : formatNumericString(variant.copyRatio.toFixed(3), t.locale)} />
            <InfoItem label={t("tasks.segmentLogRatio9322a9")} value={variant.log2Ratio === null ? undefined : formatNumericString(variant.log2Ratio.toFixed(3), t.locale)} />
            {isExon && (
              <InfoItem label={t("tasks.exonRatiof1ba01")} value={exonRatio === null ? undefined : formatNumericString(exonRatio.toFixed(2), t.locale)} />
            )}
            <InfoItem label={isExon ? t("history.confidenceb78c2d") : t("tasks.signalWeight9907ea")} value={isExon ? ({HIGH:t("tasks.highb096b3"),MEDIUM:t("tasks.medium086907"),LOW:t("tasks.lowb9ee25")}[variant.confidenceLabel ?? ""] ?? variant.confidenceLabel) : variant.confidence ?? undefined} />
          </div>

          </section>
          <section hidden={section !== 'annotation'} >
          {/* 涉及基因 (仅 Segment) */}
          {!isExon && (variant as CNVSegment).genes.length > 0 && (
            <>
              <SectionTitle icon={Database} title={t("history.affectedGenes9fbbad")} />
              <div className="space-y-0">
                <div className="flex flex-wrap gap-2">
                  {(variant as CNVSegment).genes.map((gene) => (
                    <a
                      key={gene}
                      href={geneCardsURL(gene)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-canvas-inset text-accent-fg rounded hover:bg-accent-subtle transition-colors"
                    >
                      {gene}
                      <ExternalLink className="w-3 h-3" />
                    </a>
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
                  value={t("tasks.view7ea73e", {p0: String(externalReference)})}
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
          <section hidden={section !== 'assessment'} >
          {/* 置顶状态 */}
          <SectionTitle icon={FileText} title={t("tasks.pinStatus129a6b")} />
          <div className="space-y-0">
            <InfoItem
              label={t("tasks.pinStatus129a6b")}
              value={variant.pinned ? (
                <Tag variant="success">{t("tasks.pinnedd7d970")}</Tag>
              ) : (
                <Tag variant="neutral">{t("tasks.notPinned9065cc")}</Tag>
              )}
            />

            <InfoItem
              label={t("tasks.reportStatus86bba4")}
              value={variant.reported ? (
                <Tag variant="info">{t("tasks.reported6fb7a5")}</Tag>
              ) : (
                <Tag variant="neutral">{t("tasks.notReporteda438d1")}</Tag>
              )}
            />
            {variant.reported && variant.reportedBy && (
              <>
                <InfoItem label={t("tasks.reportedBycc3bc9")} value={variant.reportedBy} />
                <InfoItem label={t("tasks.reportedAt741a21")} value={variant.reportedAt} />
              </>
            )}
          </div>
          </section>
        </div>

      </WorkspaceInspector>}

      {isExon && taskId && <CNVExonPlot anchor={plotAnchor} variant={variant} taskId={taskId} isOpen={plotOpen} onClose={() => setPlotOpen(false)} />}
      {/* CNV 图弹窗 */}
      {showPlot && !isExon && (
        <CNVRegionPlot
          anchor={plotAnchor}
          variant={variant as CNVSegment}
          taskId={taskId!}
          isOpen={plotOpen}
          onClose={() => setPlotOpen(false)}
        />
      )}
    </>
  );
}
