'use client';
import { PhenotypeSummary } from './PhenotypeSummary';
import { formatNumericString } from '@/i18n/format';
import { errorText } from '@/i18n/errors';
import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';
import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';

import * as React from 'react';
import { WorkspaceInspector, InspectorTabs, type InspectorSection } from '@/components/shared/WorkspaceInspector';
import { useInterpretationReadOnly } from './InterpretationLock';
import { ResultChangeHistory } from './ResultChangeHistory';
import { VariantTypeBadge } from './VariantTypeBadge';
import { AIAssistanceAction, AIResultCard } from '@/components/shared/AIAssistanceAction';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import { aiVariantContext } from '../utils/ai-context';
import { CNVRegionPlot } from './CNVRegionPlot';
import { CNVExonPlot } from './CNVExonPlot';
import type { CNVPlotAnchor } from './CNVPlotWindow';
import { ExternalLink, FileText, Database, MapPin, Sparkles } from 'lucide-react';
import { getClassificationLabel, formatScore } from '../utils/pathogenicity-classifier';
import { Tag } from '@/components/shared/Tag';
import { ClinicalSignificanceBadge } from './ClinicalSignificanceBadge';
import { CNVAssessmentOverview } from './CNVAssessmentOverview';
import { CNVCalculator } from './CNVCalculator';
import { useCNVAssessment } from '../hooks/useCNVAssessment';
import { cnvAIClauses } from '../utils/cnv-ai';
import type { CNVSegment, CNVExon, CNVAssessment, CNVAdoptedAssessment, CNVAdoptedSource, ClinGenClassification } from '../types';

interface CNVDetailPanelProps {
  variant: CNVSegment | CNVExon | null;
  variantType: 'segment' | 'exon';
  isOpen: boolean;
  onClose: () => void;
  allSegments?: CNVSegment[];
  referenceId?: string;
  taskId?: string;
  plotAnchor?: CNVPlotAnchor;
  initialSection?: InspectorSection;
  assessment?: CNVAssessment | null;
  onSaveAssessment?: (variant: CNVSegment | CNVExon, assessment: CNVAssessment) => Promise<void> | void;
  onSaveVersionedAssessment?: (variant: CNVSegment | CNVExon, adjustments: Record<string, unknown>, reason: string) => Promise<void>;
  onSaveInterpretation?: (variant: CNVSegment | CNVExon, interpretation: string) => Promise<void>;
  onOpenAssessment?: (variant: CNVSegment | CNVExon, result?: AIAssistanceResult) => void;
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

export function CNVDetailPanel({
  variant,
  variantType,
  isOpen,
  onClose,
  referenceId,
  taskId,
  plotAnchor,
  initialSection,
  assessment: externalAssessment,
  onSaveAssessment,
  onSaveVersionedAssessment,
  onSaveInterpretation,
  onOpenAssessment,
}: CNVDetailPanelProps) {
  const t = useText();
  const [section, setSection] = React.useState<InspectorSection>(initialSection ?? 'overview');
  const readOnly = useInterpretationReadOnly();

  // AI 评估状态
  const [aiResult, setAIResult] = React.useState<AIAssistanceResult | undefined>(
    typeof variant?.cnvAIResult === 'object' && variant.cnvAIResult !== null ? variant.cnvAIResult : undefined
  );
  const [aiError, setAIError] = React.useState('');
  const [versionBusy, setVersionBusy] = React.useState(false);

  // 采用结果
  const [localAdoptedCNV, setLocalAdoptedCNV] = React.useState<CNVAdoptedAssessment | null>(null);

  // 人工解读
  const [interpretation, setInterpretation] = React.useState('');
  const [savedInterpretation, setSavedInterpretation] = React.useState('');
  const [savingInterpretation, setSavingInterpretation] = React.useState(false);
  const [saveInterpretationError, setSaveInterpretationError] = React.useState('');

  // ClinGen 计算器状态
  const {
    assessment: localAssessment,
    updateCriteria,
    resetAssessment,
    saveAssessment: commitAssessment,
    loadAssessment,
    initializeAssessment,
    switchCalculatorMode,
  } = useCNVAssessment(variant);
  const [assessmentSaving, setAssessmentSaving] = React.useState(false);
  const [assessmentError, setAssessmentError] = React.useState<string | null>(null);

  const scope = `${taskId}/${variantType}/${variant?.id}`;
  const scopeRef = React.useRef(scope);
  scopeRef.current = scope;
  const [plotOpen, setPlotOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && taskId && variant) setPlotOpen(true);
    setSection(initialSection ?? 'overview');
    setAIResult(typeof variant?.cnvAIResult === 'object' && variant?.cnvAIResult !== null ? variant.cnvAIResult : undefined);
    setLocalAdoptedCNV(variant?.adoptedCNV ?? null);
    setInterpretation(variant?.interpretation ?? '');
    setSavedInterpretation(variant?.interpretation ?? '');
    setSavingInterpretation(false);
    setSaveInterpretationError('');
    setAIError('');
    setVersionBusy(false);
    setAssessmentSaving(false);
    setAssessmentError(null);

    if (variant) {
      const targetAssessment = externalAssessment ?? variant.assessment;
      if (targetAssessment) {
        loadAssessment(targetAssessment);
      } else {
        initializeAssessment(variant);
      }
    }
  }, [scope, isOpen, initialSection, externalAssessment]);

  if (!variant) return null;

  const isExon = isCNVExon(variant);
  const exonRatio = isExon ? variant.ratio : null;
  const showPlot = variantType === 'segment' && Boolean(taskId);
  const typeLabel = cnvTypeLabel(variant.type, t);
  const externalReference = ucscDatabase(referenceId);

  const effectiveAssessment = localAssessment ?? externalAssessment ?? variant.assessment;
  const effectiveAdopted = localAdoptedCNV ?? variant.adoptedCNV;

  // 保存版本调整通用逻辑
  const saveVersioned = async (adjustments: Record<string, unknown>, reason: string) => {
    if (!onSaveVersionedAssessment) return;
    await onSaveVersionedAssessment(variant, adjustments, reason);
  };

  // AI 评估完成回调（自动保存）
  const handleAIResult = async (result: AIAssistanceResult) => {
    setAIResult(result);
    setAIError('');
    if (onSaveVersionedAssessment) {
      setVersionBusy(true);
      try {
        await saveVersioned({ cnvAIResult: result }, 'AI评估自动保存');
      } catch (e) {
        setAIError(e instanceof Error ? errorText(e, t) : '保存AI评估失败');
      } finally {
        setVersionBusy(false);
      }
    }
  };

  // 四选一切换采用
  const handleAdoptSource = async (source: CNVAdoptedSource, classification?: string | null) => {
    if (readOnly) return;
    const targetClass = (classification && !['缺失', '尚未评定', '尚未进行 AI 评估', '证据不足，待补充'].includes(classification))
      ? classification as ClinGenClassification
      : undefined;

    let score: number | undefined;
    if (source === 'quick') score = variant.automaticAssessment?.cnvScore ?? variant.automaticAssessment?.score;
    else if (source === 'clingen') score = effectiveAssessment?.totalScore;

    const sourceLabelMap: Record<CNVAdoptedSource, string> = {
      database: '数据库参考',
      quick: '本地快速初评',
      ai: 'AI证据建议',
      clingen: 'ClinGen评估',
    };

    const adoptedData: CNVAdoptedAssessment = {
      source,
      classification: targetClass,
      score,
      savedAt: new Date().toISOString(),
    };
    setLocalAdoptedCNV(adoptedData);

    if (onSaveVersionedAssessment) {
      try {
        await saveVersioned({ adoptedCNV: adoptedData }, `采用${sourceLabelMap[source]}结果`);
      } catch (e) {
        console.error('Failed to save adopted CNV source:', e);
      }
    }
  };

  // 保存 ClinGen 评估
  const handleSaveAssessment = async (finalizedAssessment: CNVAssessment) => {
    const finalized = commitAssessment();
    if (!finalized) return;
    setAssessmentSaving(true);
    setAssessmentError(null);
    try {
      if (onSaveAssessment) {
        await onSaveAssessment(variant, finalized);
      } else if (onSaveVersionedAssessment) {
        const adoptedData: CNVAdoptedAssessment = {
          source: 'clingen',
          classification: finalized.classification,
          score: finalized.totalScore,
          savedAt: new Date().toISOString(),
        };
        setLocalAdoptedCNV(adoptedData);
        await saveVersioned({
          cnvAssessment: finalized,
          adoptedCNV: adoptedData,
        }, 'ClinGen 评估保存');
      }
    } catch (e) {
      setAssessmentError(e instanceof Error ? errorText(e, t) : '保存评估失败');
    } finally {
      setAssessmentSaving(false);
    }
  };

  return (
    <>
      {isOpen && (
        <WorkspaceInspector label={t("tasks.variantDetails7ca440")} onClose={onClose} nonModal>
          {/* 头部 */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-canvas-subtle">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-medium text-fg-default">
                {variantType === 'exon' ? t("tasks.exonCnvDetails317773") : t("tasks.regionCnvDetails47f31b")}
              </h3>
              <VariantTypeBadge value={variant.type}>
                {typeLabel}
              </VariantTypeBadge>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {taskId && (
                <ActionButton action="view" size="small" variant="secondary" className="shrink-0" onClick={() => setPlotOpen(true)}>
                  {isExon ? t("tasks.exonCnDistribution991e77") : t("tasks.regionSignalPlot630d9d")}
                </ActionButton>
              )}
              <IconActionButton
                label={t("tasks.close6c14bd")}
                action="close"
                variant="ghost"
                onClick={onClose}
                className="p-1.5 text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"
              />
            </div>
          </div>

          <div className="yj-inspector-summary">
            <strong className="text-fg-default">{variant.chromosome}:{variant.startPosition}–{variant.endPosition}</strong>
            <p className="mt-1">
              {effectiveAdopted?.classification
                ? (getClassificationLabel(effectiveAdopted.classification as ClinGenClassification) ?? effectiveAdopted.classification)
                : (effectiveAssessment?.assessmentState === 'insufficient_evidence'
                    ? t("tasks.insufficientEvidence70568c")
                    : effectiveAssessment
                      ? getClassificationLabel(effectiveAssessment.classification)
                      : t("tasks.notAssessed88f079"))} · {effectiveAdopted?.score !== undefined ? t('assessmentDisplay.score', {p0: formatScore(effectiveAdopted.score)}) : effectiveAssessment ? t("tasks.pointsc91542", { p0: String(formatScore(effectiveAssessment.totalScore)) }) : '—'}
            </p>
          </div>

          {/* 7 个标签系统 */}
          <InspectorTabs
            id="variant-inspector"
            value={section}
            onChange={setSection}
            sections={['overview', 'annotation', 'evidence', 'ai', 'clingen', 'interpretation', 'history']}
          />

          <div id="variant-inspector-content" role="tabpanel" aria-labelledby={`variant-inspector-${section}`} className="yj-inspector-content">
            {/* 1. 评估总览 */}
            <section hidden={section !== 'overview'}>
              <CNVAssessmentOverview
                variant={{ ...variant, adoptedCNV: effectiveAdopted }}
                assessment={effectiveAssessment}
                ai={aiResult}
                aiError={aiError}
                onClingen={() => setSection('clingen')}
                onAdoptSource={handleAdoptSource}
              />
            </section>

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

            {/* 3. 证据 */}
            <section hidden={section !== 'evidence'} className="space-y-4">
              <PhenotypeSummary assessment={variant.automaticAssessment} />

              <SectionTitle icon={FileText} title={t("tasks.cnvFeaturesc60b58")} />
              <div className="space-y-0">
                <InfoItem
                  label={t("history.typee4e46c")}
                  value={
                    <VariantTypeBadge value={variant.type}>
                      {typeLabel}
                    </VariantTypeBadge>
                  }
                />
                <InfoItem label={t("history.copyNumber04d1ca")} value={variant.copyNumber} />
                <InfoItem label={t("interface.copyRatio111a27")} value={variant.copyRatio === null ? undefined : formatNumericString(variant.copyRatio.toFixed(3), t.locale)} />
                <InfoItem label={t("tasks.segmentLogRatio9322a9")} value={variant.log2Ratio === null ? undefined : formatNumericString(variant.log2Ratio.toFixed(3), t.locale)} />
                {isExon && (
                  <InfoItem label={t("tasks.exonRatiof1ba01")} value={exonRatio === null ? undefined : formatNumericString(exonRatio.toFixed(2), t.locale)} />
                )}
                <InfoItem
                  label={isExon ? t("history.confidenceb78c2d") : t("tasks.signalWeight9907ea")}
                  value={isExon ? ({ HIGH: t("tasks.highb096b3"), MEDIUM: t("tasks.medium086907"), LOW: t("tasks.lowb9ee25") }[variant.confidenceLabel ?? ""] ?? variant.confidenceLabel) : variant.confidence ?? undefined}
                />
              </div>

              {/* 置顶与关注状态 */}
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
            </section>

            {/* 4. AI 评估 */}
            <section hidden={section !== 'ai'} className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-accent-fg shrink-0" />
                  <h4 className="text-sm font-semibold text-fg-default truncate">{t('assessmentDisplay.clingenAI')}</h4>
                </div>
                <div className="shrink-0 flex items-center justify-end ml-auto">
                  {(variant.type === 'Deletion' || variant.type === 'Amplification') && (
                    <AIAssistanceAction
                      onError={setAIError}
                      key={`${taskId}/${variant.id}/cnv-ai`}
                      disabled={readOnly || versionBusy || !taskId}
                      input={{
                        feature: variant.type === 'Deletion' ? 'cnv_loss' : 'cnv_gain',
                        taskId,
                        reference: referenceId,
                        variant: aiVariantContext(variant),
                        calculator: effectiveAssessment,
                      }}
                      onResult={handleAIResult}
                    />
                  )}
                </div>
              </div>

              {versionBusy && (
                <div className="flex items-center gap-2 rounded-md bg-canvas-subtle p-3 text-xs text-fg-muted border border-border-subtle">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-emphasis border-t-transparent" />
                  <span>{t('assessmentDisplay.autoSaving')}</span>
                </div>
              )}

              {aiError && (
                <p role="alert" className="text-sm text-danger-fg bg-danger-subtle/30 border border-danger-emphasis/30 rounded p-2.5">
                  {aiError}
                </p>
              )}

              {aiResult ? (
                <div className="space-y-4">
                  {/* 1. AI 评定证据与结论（置顶放置） */}
                  <div className="rounded-lg border border-border-subtle bg-canvas-subtle p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-fg-default">{t('assessmentDisplay.aiEvidence')}</span>
                        {((aiResult.suggestedClassification || aiResult.classification) as string | undefined) && (
                          <ClinicalSignificanceBadge value={aiResult.suggestedClassification || aiResult.classification}>
                            {getClassificationLabel((aiResult.suggestedClassification || aiResult.classification) as ClinGenClassification) ?? (aiResult.suggestedClassification || aiResult.classification)}
                          </ClinicalSignificanceBadge>
                        )}
                      </div>
                      {aiResult.requestId && (
                        <span className="text-xs text-fg-muted font-mono">
                          {t('assessmentDisplay.archive')} {aiResult.requestId}
                        </span>
                      )}
                    </div>

                    {(() => {
                      const proposalClauses = cnvAIClauses(aiResult);
                      const validClauses = proposalClauses.filter(c => c.status !== 'insufficient_data' && c.status !== 'not_applicable');
                      const validEvidence = (aiResult.evidence ?? []).filter(item => item.status !== 'insufficient_data' && item.status !== 'not_applicable');

                      if (validClauses.length > 0) {
                        return (
                          <div className="space-y-2">
                            {validClauses.map((item, idx) => (
                              <div
                                key={item.code || idx}
                                className="rounded border border-border-default/60 bg-canvas-default p-2.5 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded font-bold text-xs bg-accent-subtle text-accent-fg">
                                      {item.code}
                                    </span>
                                    {item.status && <span className="text-fg-muted">· {item.status}</span>}
                                    {item.score_hundredths !== undefined && (
                                      <span className="font-mono text-fg-default">
                                        {item.score_hundredths >= 0 ? '+' : ''}{(item.score_hundredths / 100).toFixed(2)} 分
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {item.override_reason && (
                                  <p className="text-fg-muted leading-relaxed pl-0.5">{item.override_reason}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      }

                      if (validEvidence.length > 0) {
                        return (
                          <div className="space-y-2">
                            {validEvidence.map((item, idx) => (
                              <div
                                key={item.code || idx}
                                className="rounded border border-border-default/60 bg-canvas-default p-2.5 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 rounded font-bold text-xs bg-accent-subtle text-accent-fg">
                                      {item.code}
                                    </span>
                                    <span className="font-semibold text-fg-default">{item.strength}</span>
                                    {item.status && <span className="text-fg-muted">· {item.status}</span>}
                                  </div>
                                </div>
                                {item.reason && (
                                  <p className="text-fg-muted leading-relaxed pl-0.5">{item.reason}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <p className="text-xs text-fg-muted py-1">{t('assessmentDisplay.noEligible')}</p>
                      );
                    })()}
                  </div>

                  {/* 2. AI 研究内容（放在评定证据与结论下方） */}
                  <AIResultCard
                    result={aiResult}
                    humanReviewSaved={Boolean(aiResult.requestId && variant.cnvAIResult?.requestId === aiResult.requestId)}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border-subtle p-8 text-center text-fg-muted space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto text-accent-fg/60" />
                  <p className="text-sm font-medium text-fg-default">{t('assessmentDisplay.noAIRecords')}</p>
                  <p className="text-xs">{t('assessmentDisplay.cnvAIHelp')}</p>
                </div>
              )}
            </section>

            {/* 5. ClinGen 评估（计算器内嵌） */}
            <section hidden={section !== 'clingen'}>
              {effectiveAssessment ? (
                <CNVCalculator
                  cnv={variant}
                  assessment={effectiveAssessment}
                  onCriteriaChange={updateCriteria}
                  onSwitchMode={switchCalculatorMode}
                  onReset={resetAssessment}
                  onSave={handleSaveAssessment}
                  saving={assessmentSaving}
                  error={assessmentError}
                />
              ) : (
                <div className="p-6 text-center text-sm text-fg-muted">
                  {t('assessmentDisplay.loadingClinGen')}
                </div>
              )}
            </section>

            {/* 6. 人工解读 */}
            <section hidden={section !== 'interpretation'} className="space-y-3">
              <h4 className="text-sm font-semibold">{t("tasks.manualInterpretation1fcaef")}</h4>
              <textarea
                aria-label={t("tasks.manualCnvInterpretation348a96")}
                readOnly={readOnly}
                value={interpretation}
                onChange={event => setInterpretation(event.target.value)}
                placeholder={t("tasks.enterYourInterpretationOfThisCnv6b6b17")}
                className="min-h-48 w-full resize-y rounded-md border border-border-default bg-canvas-default p-3 text-sm leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg-muted">
                  {interpretation.length} {t("tasks.characters9f8ba6")}
                </span>
                <ActionButton
                  loading={savingInterpretation}
                  loadingLabel={t("tasks.saving6644f0")}
                  action="save"
                  variant="ghost"
                  type="button"
                  disabled={readOnly || savingInterpretation || !onSaveInterpretation || interpretation === savedInterpretation}
                  className="inline-flex items-center justify-center rounded-md bg-accent-emphasis px-3 py-2 text-sm font-medium text-fg-on-emphasis disabled:opacity-40"
                  onClick={async () => {
                    if (!onSaveInterpretation) return;
                    setSavingInterpretation(true);
                    setSaveInterpretationError('');
                    const originalScope = scope;
                    const draft = interpretation;
                    try {
                      await onSaveInterpretation(variant, draft);
                      if (scopeRef.current === originalScope) setSavedInterpretation(draft);
                    } catch (cause) {
                      if (scopeRef.current === originalScope) {
                        setSaveInterpretationError(cause instanceof Error ? errorText(cause, t) : t("tasks.saveFailed40525a"));
                      }
                    } finally {
                      if (scopeRef.current === originalScope) setSavingInterpretation(false);
                    }
                  }}
                >
                  {t("tasks.saveInterpretationac1ec3")}
                </ActionButton>
              </div>
              {saveInterpretationError && (
                <p role="alert" className="text-sm text-danger-fg">{saveInterpretationError}</p>
              )}
            </section>

            {/* 7. 变更记录 */}
            <section hidden={section !== 'history'}>
              <ResultChangeHistory
                taskId={taskId}
                table={variantType === 'exon' ? 'cnv-exon' : 'cnv-segment'}
                rowId={variant.id}
                active={section === 'history'}
                revision={variant.adjustmentVersion}
              />
            </section>
          </div>
        </WorkspaceInspector>
      )}

      {isExon && taskId && (
        <CNVExonPlot
          anchor={plotAnchor}
          variant={variant}
          taskId={taskId}
          isOpen={plotOpen}
          onClose={() => setPlotOpen(false)}
        />
      )}
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
