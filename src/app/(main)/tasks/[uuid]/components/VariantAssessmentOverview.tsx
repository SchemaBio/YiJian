'use client';
import * as React from 'react';
import { screeningNoteText } from '@/lib/assessment-display';
import { useText } from '@/i18n/useText';
import { aiWarningsForDisplay } from '@/i18n/ai-warnings';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import type { SNVIndel } from '../types';
import { ClinicalSignificanceBadge } from './ClinicalSignificanceBadge';
import { clinvarReviewStars } from '../utils/snv-annotations';
import { Sparkles, Database, Cpu, UserCheck, CheckCircle2, AlertCircle, Calculator } from 'lucide-react';

export type AdoptedSource = 'database' | 'quick' | 'ai' | 'manual';

export function VariantAssessmentOverview({
  variant,
  ai,
  svcAI,
  aiError,
  onCalculator,
  onInterpretation,
  onAdoptSource,
}: {
  variant: SNVIndel;
  ai?: AIAssistanceResult;
  svcAI?: AIAssistanceResult;
  aiError?: string;
  onCalculator: () => void;
  onInterpretation?: () => void;
  onAdoptSource?: (source: AdoptedSource, classification?: string | null) => Promise<void> | void;
}) {
  const t = useText();
  const label = (value?: string | null) => (!value || ['.', '-'].includes(value.trim())) ? t('assessmentDisplay.missing') : value === 'insufficient_data' ? t('variantAssessment.insufficient') : value.replaceAll('_', ' ');

  // 人工评估是否已经正式保存确认
  const isHumanConfirmed = Boolean(
    (variant.acmgAssessmentSource === 'manual_evidence' || variant.acmgAssessmentSource === 'manual_override') ||
    (variant.acmgEvidence && variant.acmgEvidence.length > 0)
  );

  // 1. 数据库参考 (ClinVar)
  const rawClinvar = variant.clinvarSignificance?.trim();
  const clinvarValue = !rawClinvar || ['.', '-'].includes(rawClinvar) ? t('assessmentDisplay.missing') : rawClinvar;
  const clinvarStars = clinvarReviewStars(variant.clinvarReviewStatus);
  const clinvarDisease = variant.clinvarDisease && !['.', '-'].includes(variant.clinvarDisease.trim()) ? variant.clinvarDisease : t('assessmentDisplay.diseaseMissing');
  const clinvarId = variant.clinvarId && !['.', '-'].includes(variant.clinvarId.trim()) ? `ClinVar ID: ${variant.clinvarId}` : '';
  const dbDetail = [
    variant.clinvarReviewStatus && !['.', '-'].includes(variant.clinvarReviewStatus.trim()) ? variant.clinvarReviewStatus : '',
    clinvarStars && clinvarStars !== '-' ? `${clinvarStars} ★` : '',
    clinvarDisease,
    clinvarId,
  ].filter(Boolean).join(' · ');

  // 2. 本地快速初评
  const rawQuick = variant.automaticAcmg?.classification?.trim();
  const quickValue = !rawQuick || ['.', '-'].includes(rawQuick) ? t('assessmentDisplay.missing') : rawQuick;
  const autoScore = variant.automaticAcmg?.score !== undefined ? t('assessmentDisplay.score', {p0: variant.automaticAcmg.score > 0 ? `+${variant.automaticAcmg.score}` : variant.automaticAcmg.score}) : '';
  const autoCriteria = variant.automaticAcmg?.criteria?.map(c => c.code).join(', ');
  const quickDetail = [
    autoScore,
    autoCriteria ? t('assessmentDisplay.criteria', {p0: autoCriteria}) : '',
    variant.automaticAcmg?.screeningNotes?.filter(n => n && !['.', '-'].includes(n.trim())).map(n => screeningNoteText(n, t)).join(' ') || variant.automaticAcmg?.profile,
  ].filter(Boolean).join(' · ');

  // 3. AI 证据建议
  const effectiveAI: AIAssistanceResult | undefined = (ai && typeof ai === 'object')
    ? ai
    : (variant.acmgAIResult && typeof variant.acmgAIResult === 'object')
      ? variant.acmgAIResult
      : undefined;

  const rawAI = (effectiveAI?.suggestedClassification || effectiveAI?.classification)?.trim();
  const aiValue = !rawAI || ['.', '-'].includes(rawAI)
    ? (effectiveAI ? t('assessmentDisplay.missing') : t('assessmentDisplay.noAI'))
    : rawAI === 'insufficient_data'
      ? t('variantAssessment.insufficient')
      : rawAI;

  const effectiveAiEvidence = (effectiveAI?.evidence ?? []).filter(
    item => item.status !== 'insufficient_data' && item.status !== 'not_applicable'
  );
  const aiCriteria = effectiveAiEvidence.map(e => e.code).join(', ');
  const aiDetail = aiCriteria ? t('assessmentDisplay.criteria', {p0: aiCriteria}) : (effectiveAI ? t('assessmentDisplay.noEvidence') : '');

  // 4. 人工评估
  const rawManual = (variant.acmgOverride || variant.legacyAcmgClassification || (isHumanConfirmed ? variant.acmgClassification : null))?.trim();
  const manualValue = !rawManual || ['.', '-'].includes(rawManual) ? t('assessmentDisplay.notAssessed') : rawManual;
  const manualCriteria = (variant.acmgEvidence ?? []).map(e => `${e.code}(${e.strength})`).join(', ');
  const manualDetail = isHumanConfirmed
    ? [
        manualCriteria ? t('assessmentDisplay.confirmedCriteria', {p0: manualCriteria}) : '',
        variant.acmgOverrideReason ? t('assessmentDisplay.override', {p0: variant.acmgOverrideReason}) : '',
        variant.acmgSavedAt ? new Date(variant.acmgSavedAt).toLocaleString(t.locale) : '',
      ].filter(Boolean).join(' · ')
    : t('assessmentDisplay.manualPending');

  // 确定当前采用（四选一），初次评估默认指向“本地快速初评”
  const activeSource: AdoptedSource = React.useMemo(() => {
    if (variant.adoptedACMG?.source === 'database') return 'database';
    if (variant.adoptedACMG?.source === 'ai') return 'ai';
    if (variant.adoptedACMG?.source === 'manual') return 'manual';
    if (variant.adoptedACMG?.source === 'quick' || variant.adoptedACMG?.source === 'automatic') return 'quick';
    // 若有人工正式评估记录且未显式指定其他，使用 manual
    if (variant.acmgAssessmentSource === 'manual_evidence' || variant.acmgAssessmentSource === 'manual_override') {
      return 'manual';
    }
    // 默认指向本地快速初评
    return 'quick';
  }, [variant.adoptedACMG?.source, variant.acmgAssessmentSource]);

  // 获取当前生效结论对应的分类与来源说明
  const sourceLabelMap: Record<AdoptedSource, string> = {
    database: t('assessmentDisplay.database'),
    quick: t('assessmentDisplay.quick'),
    ai: t('assessmentDisplay.ai'),
    manual: t('assessmentDisplay.manual'),
  };

  const adoptedClassification = React.useMemo(() => {
    if (activeSource === 'database') return clinvarValue;
    if (activeSource === 'quick') return quickValue;
    if (activeSource === 'ai') return aiValue;
    return manualValue;
  }, [activeSource, clinvarValue, quickValue, aiValue, manualValue]);

  const handleCardClick = (source: AdoptedSource) => {
    if (!onAdoptSource) return;
    let targetClass: string | undefined;
    if (source === 'database' && clinvarValue !== t('assessmentDisplay.missing')) targetClass = clinvarValue;
    else if (source === 'quick' && quickValue !== t('assessmentDisplay.missing')) targetClass = quickValue;
    else if (source === 'ai' && aiValue !== t('assessmentDisplay.missing') && aiValue !== t('assessmentDisplay.noAI')) targetClass = aiValue;
    else if (source === 'manual' && manualValue !== t('assessmentDisplay.notAssessed')) targetClass = manualValue;
    onAdoptSource(source, targetClass);
  };

  // 待复核临时提示状态：仅在 AI 刚生成且未被人工保存确认时展示
  const showAiPendingReview = Boolean(effectiveAI && !isHumanConfirmed);

  return (
    <div className="space-y-4">
      {/* 顶部决策看板条：展示四选一的最终采用结果 */}
      <section className="rounded-lg border border-accent-subtle bg-accent-subtle/15 p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-accent-fg" />
            <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">{t('variantAssessment.current')}</h4>
          </div>
          <span className="text-xs text-fg-muted">
            {t('assessmentDisplay.adoptedFrom')} <strong className="text-fg-default">{sourceLabelMap[activeSource]}</strong>
            <span className="ml-1 text-[11px] text-fg-subtle">{t('assessmentDisplay.switchHint')}</span>
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ClinicalSignificanceBadge value={adoptedClassification !== t('assessmentDisplay.missing') && adoptedClassification !== t('assessmentDisplay.notAssessed') && adoptedClassification !== t('assessmentDisplay.noAI') ? adoptedClassification : undefined} className="text-sm px-2.5 py-1 font-semibold">
              {label(adoptedClassification)}
            </ClinicalSignificanceBadge>
            {activeSource === 'manual' && isHumanConfirmed ? (
              <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                <UserCheck className="h-3.5 w-3.5" /> {t('assessmentDisplay.confirmed')}
              </span>
            ) : activeSource === 'quick' ? (
              <span className="inline-flex items-center gap-1 text-xs text-accent-fg">
                <Cpu className="h-3.5 w-3.5" /> {t('assessmentDisplay.baseline')}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-accent-fg font-medium hover:underline"
            onClick={onCalculator}
          >
            <Calculator className="h-3.5 w-3.5" />
            {t('assessmentDisplay.openACMG')}
          </button>
        </div>
      </section>

      {/* 四轨评估对比卡片（支持点击单选四选一） */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">{t('assessmentDisplay.comparison')}</h4>
          <span className="text-[11px] text-fg-subtle">{t('assessmentDisplay.singleChoice')}</span>
        </div>
        <div className="yj-assessment-cards">
          {/* 卡片 1: 数据库参考 */}
          <section
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('database')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('database'); } }}
            className={`cursor-pointer rounded-lg border p-3 flex flex-col justify-between transition-all select-none ${
              activeSource === 'database'
                ? 'ring-2 ring-accent-emphasis border-accent-emphasis bg-accent-subtle/15 shadow-sm'
                : 'border-border-subtle bg-canvas-default hover:border-accent-emphasis/50 hover:bg-canvas-subtle'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <Database className="h-3.5 w-3.5 text-fg-muted" />
                  {t('variantAssessment.database')}
                </span>
                {activeSource === 'database' ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-emphasis px-2 py-0.5 text-[10px] font-semibold text-fg-on-emphasis">
                    {t('assessmentDisplay.current')}
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">{t('assessmentDisplay.adopt')}</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg-default">
                {label(clinvarValue)}
              </p>
            </div>
            <p className="mt-2 break-words text-xs text-fg-muted leading-relaxed [overflow-wrap:anywhere]">
              {dbDetail || t('assessmentDisplay.missing')}
            </p>
          </section>

          {/* 卡片 2: 本地快速初评 */}
          <section
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('quick')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('quick'); } }}
            className={`cursor-pointer rounded-lg border p-3 flex flex-col justify-between transition-all select-none ${
              activeSource === 'quick'
                ? 'ring-2 ring-accent-emphasis border-accent-emphasis bg-accent-subtle/15 shadow-sm'
                : 'border-border-subtle bg-canvas-default hover:border-accent-emphasis/50 hover:bg-canvas-subtle'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <Cpu className="h-3.5 w-3.5 text-fg-muted" />
                  {t('variantAssessment.quick')}
                </span>
                {activeSource === 'quick' ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-emphasis px-2 py-0.5 text-[10px] font-semibold text-fg-on-emphasis">
                    {t('assessmentDisplay.current')}
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">{t('assessmentDisplay.adopt')}</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg-default">
                {label(quickValue)}
              </p>
            </div>
            <p className="mt-2 break-words text-xs text-fg-muted leading-relaxed [overflow-wrap:anywhere]">
              {quickDetail || t('assessmentDisplay.missing')}
            </p>
          </section>

          {/* 卡片 3: AI 证据建议 */}
          <section
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('ai')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('ai'); } }}
            className={`cursor-pointer rounded-lg border p-3 flex flex-col justify-between transition-all select-none ${
              activeSource === 'ai'
                ? 'ring-2 ring-accent-emphasis border-accent-emphasis bg-accent-subtle/15 shadow-sm'
                : showAiPendingReview
                  ? 'border-accent-emphasis/40 bg-accent-subtle/10'
                  : 'border-border-subtle bg-canvas-default hover:border-accent-emphasis/50 hover:bg-canvas-subtle'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <Sparkles className="h-3.5 w-3.5 text-accent-fg" />
                  {t('variantAssessment.ai')}
                </span>
                {activeSource === 'ai' ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-emphasis px-2 py-0.5 text-[10px] font-semibold text-fg-on-emphasis">
                    {t('assessmentDisplay.current')}
                  </span>
                ) : isHumanConfirmed && effectiveAI ? (
                  <span className="rounded bg-success-emphasis/15 px-1.5 py-0.5 text-[10px] font-medium text-success-fg">
                    {t('assessmentDisplay.reviewed')}
                  </span>
                ) : showAiPendingReview ? (
                  <span className="rounded bg-accent-emphasis/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-fg">
                    {t('assessmentDisplay.proposal')}
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">{t('assessmentDisplay.adopt')}</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg-default">
                {label(aiValue)}
              </p>
            </div>
            <p className="mt-2 break-words text-xs text-fg-muted leading-relaxed [overflow-wrap:anywhere]">
              {aiDetail || (effectiveAI ? t('assessmentDisplay.noEvidence') : t('assessmentDisplay.noAI'))}
            </p>
          </section>

          {/* 卡片 4: 人工评估 */}
          <section
            role="button"
            tabIndex={0}
            onClick={() => handleCardClick('manual')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('manual'); } }}
            className={`cursor-pointer rounded-lg border p-3 flex flex-col justify-between transition-all select-none ${
              activeSource === 'manual'
                ? 'ring-2 ring-accent-emphasis border-accent-emphasis bg-accent-subtle/15 shadow-sm'
                : isHumanConfirmed
                  ? 'border-success-emphasis/30 bg-success-subtle/10'
                  : 'border-border-subtle bg-canvas-default hover:border-accent-emphasis/50 hover:bg-canvas-subtle'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <UserCheck className="h-3.5 w-3.5 text-success-fg" />
                  {t('assessmentDisplay.manual')}
                </span>
                {activeSource === 'manual' ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-emphasis px-2 py-0.5 text-[10px] font-semibold text-fg-on-emphasis">
                    {t('assessmentDisplay.current')}
                  </span>
                ) : isHumanConfirmed ? (
                  <span className="rounded bg-success-emphasis/15 px-1.5 py-0.5 text-[10px] font-medium text-success-fg">
                    {t('assessmentDisplay.validated')}
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">{t('assessmentDisplay.adopt')}</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg-default">
                {label(manualValue)}
              </p>
              <p className="mt-1 break-words text-xs text-fg-muted leading-relaxed [overflow-wrap:anywhere]">
                {manualDetail}
              </p>
            </div>
            {/* 卡片内部增加 ACMG 评估按钮 */}
            <div className="mt-3 pt-2 border-t border-border-subtle flex items-center">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-canvas-subtle px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-subtle hover:border-accent-emphasis/50 transition-colors shadow-2xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onCalculator();
                }}
              >
                <Calculator className="h-3.5 w-3.5" />
                {t('assessmentDisplay.acmg')}
              </button>
            </div>
          </section>
        </div>
      </div>

      {aiError && (
        <p role="alert" className="rounded border border-danger-emphasis/30 p-3 text-sm text-danger-fg">
          {t("variantAssessment.executionFailed")} · {aiError}
        </p>
      )}

      {/* 仅在 AI 刚运行完、未被人工复核前展示待复核差异与缺失提示；一旦人工确认，此处彻底隐藏，不污染总览 */}
      {showAiPendingReview && effectiveAI && (
        <div className="space-y-3 rounded-lg border border-warning-emphasis/30 bg-warning-subtle/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning-fg">
            <AlertCircle className="h-4 w-4" />
            <span>{t('assessmentDisplay.pendingReview')}</span>
          </div>
          {(effectiveAI.suggestedClassification === 'insufficient_data' || effectiveAI.classification === 'insufficient_data' || effectiveAI.suggestedClassification !== variant.automaticAcmg?.classification) && (
            <p role="note" className="text-xs text-fg-default">
              {t('variantAssessment.difference')}
            </p>
          )}
          {effectiveAI.evidence && effectiveAI.evidence.some(e => e.status !== 'met') && (
            <section className="space-y-1.5 pt-1">
              <h5 className="text-xs font-semibold text-fg-muted">{t('variantAssessment.missing')}</h5>
              <ul className="space-y-1 text-xs text-fg-muted">
                {effectiveAI.evidence.filter(e => e.status !== 'met').map(e => (
                  <li key={e.code}>
                    <strong>{e.code}</strong> · <span>{e.reason}</span>
                  </li>
                ))}
                {aiWarningsForDisplay(effectiveAI.warnings, t).map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </section>
          )}
          <div className="pt-1">
            <button
              type="button"
              className="rounded bg-accent-emphasis px-2.5 py-1 text-xs text-fg-on-emphasis font-medium"
              onClick={onCalculator}
            >
              {t('assessmentDisplay.reviewNow')}
            </button>
          </div>
        </div>
      )}

      {/* 底部工作流说明 */}
      <div className="pt-2 border-t border-border-subtle">
        <p className="text-xs text-fg-muted">{t('variantAssessment.referenceNotice')}</p>
      </div>
    </div>
  );
}
