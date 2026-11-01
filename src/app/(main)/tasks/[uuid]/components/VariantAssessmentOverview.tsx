'use client';
import * as React from 'react';
import { useText } from '@/i18n/useText';
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
  onInterpretation: () => void;
  onAdoptSource?: (source: AdoptedSource, classification?: string | null) => Promise<void> | void;
}) {
  const t = useText();
  const label = (value?: string | null) => (!value || ['.', '-'].includes(value.trim())) ? '缺失' : value === 'insufficient_data' ? t('variantAssessment.insufficient') : value.replaceAll('_', ' ');

  // 人工评估是否已经正式保存确认
  const isHumanConfirmed = Boolean(
    (variant.acmgAssessmentSource === 'manual_evidence' || variant.acmgAssessmentSource === 'manual_override') ||
    (variant.acmgEvidence && variant.acmgEvidence.length > 0)
  );

  // 1. 数据库参考 (ClinVar)
  const rawClinvar = variant.clinvarSignificance?.trim();
  const clinvarValue = !rawClinvar || ['.', '-'].includes(rawClinvar) ? '缺失' : rawClinvar;
  const clinvarStars = clinvarReviewStars(variant.clinvarReviewStatus);
  const clinvarDisease = variant.clinvarDisease && !['.', '-'].includes(variant.clinvarDisease.trim()) ? variant.clinvarDisease : '相关疾病: 缺失';
  const clinvarId = variant.clinvarId && !['.', '-'].includes(variant.clinvarId.trim()) ? `ClinVar ID: ${variant.clinvarId}` : '';
  const dbDetail = [
    variant.clinvarReviewStatus && !['.', '-'].includes(variant.clinvarReviewStatus.trim()) ? variant.clinvarReviewStatus : '',
    clinvarStars && clinvarStars !== '-' ? `${clinvarStars} ★` : '',
    clinvarDisease,
    clinvarId,
  ].filter(Boolean).join(' · ');

  // 2. 本地快速初评
  const rawQuick = variant.automaticAcmg?.classification?.trim();
  const quickValue = !rawQuick || ['.', '-'].includes(rawQuick) ? '缺失' : rawQuick;
  const autoScore = variant.automaticAcmg?.score !== undefined ? `${variant.automaticAcmg.score > 0 ? `+${variant.automaticAcmg.score}` : variant.automaticAcmg.score} 分` : '';
  const autoCriteria = variant.automaticAcmg?.criteria?.map(c => c.code).join(', ');
  const quickDetail = [
    autoScore,
    autoCriteria ? `依据: ${autoCriteria}` : '',
    variant.automaticAcmg?.screeningNotes?.filter(n => n && !['.', '-'].includes(n.trim())).join(' ') || variant.automaticAcmg?.profile,
  ].filter(Boolean).join(' · ');

  // 3. AI 证据建议
  const effectiveAI = ai ?? variant.acmgAIResult;
  const rawAI = (effectiveAI?.suggestedClassification || effectiveAI?.classification)?.trim();
  const aiValue = !rawAI || ['.', '-'].includes(rawAI)
    ? (effectiveAI ? '缺失' : '尚未进行 AI 评估')
    : rawAI === 'insufficient_data'
      ? t('variantAssessment.insufficient')
      : rawAI;
  const aiMetCriteria = effectiveAI?.evidence?.filter(e => e.status === 'met').map(e => e.code).join(', ');
  const aiDetail = isHumanConfirmed
    ? '已完成人工复核并转入正式评估'
    : effectiveAI
      ? [
          effectiveAI.model,
          aiMetCriteria ? `候选条目: ${aiMetCriteria}` : '',
          effectiveAI.generatedAt ? new Date(effectiveAI.generatedAt).toLocaleTimeString() : '',
        ].filter(Boolean).join(' · ')
      : '';

  // 4. 人工评估
  const rawManual = (variant.acmgOverride || variant.legacyAcmgClassification || (isHumanConfirmed ? variant.acmgClassification : null))?.trim();
  const manualValue = !rawManual || ['.', '-'].includes(rawManual) ? '尚未评定' : rawManual;
  const manualCriteria = (variant.acmgEvidence ?? []).map(e => `${e.code}(${e.strength})`).join(', ');
  const manualDetail = isHumanConfirmed
    ? [
        manualCriteria ? `核定条目: ${manualCriteria}` : '',
        variant.acmgOverrideReason ? `覆写: ${variant.acmgOverrideReason}` : '',
        variant.acmgSavedAt ? new Date(variant.acmgSavedAt).toLocaleString() : '',
      ].filter(Boolean).join(' · ')
    : '尚未进行人工评定（进入下方计算器完成核定）';

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
    database: '数据库参考',
    quick: '本地快速初评',
    ai: 'AI证据建议',
    manual: '人工评估',
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
    if (source === 'database' && clinvarValue !== '缺失') targetClass = clinvarValue;
    else if (source === 'quick' && quickValue !== '缺失') targetClass = quickValue;
    else if (source === 'ai' && aiValue !== '缺失' && aiValue !== '尚未进行 AI 评估') targetClass = aiValue;
    else if (source === 'manual' && manualValue !== '尚未评定') targetClass = manualValue;
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
            采用自: <strong className="text-fg-default">{sourceLabelMap[activeSource]}</strong>
            <span className="ml-1 text-[11px] text-fg-subtle">（点击下方卡片可直接切换采用）</span>
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ClinicalSignificanceBadge value={adoptedClassification !== '缺失' && adoptedClassification !== '尚未评定' && adoptedClassification !== '尚未进行 AI 评估' ? adoptedClassification : undefined} className="text-sm px-2.5 py-1 font-semibold">
              {label(adoptedClassification)}
            </ClinicalSignificanceBadge>
            {activeSource === 'manual' && isHumanConfirmed ? (
              <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                <UserCheck className="h-3.5 w-3.5" /> 人工已核定
              </span>
            ) : activeSource === 'quick' ? (
              <span className="inline-flex items-center gap-1 text-xs text-accent-fg">
                <Cpu className="h-3.5 w-3.5" /> 规则初评基线
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-accent-fg font-medium hover:underline"
            onClick={onCalculator}
          >
            <Calculator className="h-3.5 w-3.5" />
            进入ACMG计算器 →
          </button>
        </div>
      </section>

      {/* 四轨评估对比卡片（支持点击单选四选一） */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-fg-muted uppercase tracking-wider">证据与评定对照（点击卡片选择最终采用）</h4>
          <span className="text-[11px] text-fg-subtle">单选四选一</span>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
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
                    ✓ 当前采用
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">点击采用</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg-default">
                {label(clinvarValue)}
              </p>
            </div>
            <p className="mt-2 break-words text-xs text-fg-muted leading-relaxed">
              {dbDetail || '缺失'}
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
                    ✓ 当前采用
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">点击采用</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg-default">
                {label(quickValue)}
              </p>
            </div>
            <p className="mt-2 break-words text-xs text-fg-muted leading-relaxed">
              {quickDetail || '缺失'}
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
                    ✓ 当前采用
                  </span>
                ) : showAiPendingReview ? (
                  <span className="rounded bg-accent-emphasis/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-fg">
                    待复核提案
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">点击采用</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg-default">
                {label(aiValue)}
              </p>
            </div>
            <p className="mt-2 break-words text-xs text-fg-muted leading-relaxed">
              {aiDetail || (effectiveAI ? '—' : '尚未进行 AI 评估')}
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
                  人工评估
                </span>
                {activeSource === 'manual' ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-emphasis px-2 py-0.5 text-[10px] font-semibold text-fg-on-emphasis">
                    ✓ 当前采用
                  </span>
                ) : isHumanConfirmed ? (
                  <span className="rounded bg-success-emphasis/15 px-1.5 py-0.5 text-[10px] font-medium text-success-fg">
                    已核定
                  </span>
                ) : (
                  <span className="text-[10px] text-fg-subtle">点击采用</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-fg-default">
                {label(manualValue)}
              </p>
              <p className="mt-1 break-words text-xs text-fg-muted leading-relaxed">
                {manualDetail}
              </p>
            </div>
            {/* 卡片内部增加 ACMG 计算器按钮 */}
            <div className="mt-3 pt-2 border-t border-border-subtle flex items-center justify-between">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-canvas-subtle px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-subtle hover:border-accent-emphasis/50 transition-colors shadow-2xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onCalculator();
                }}
              >
                <Calculator className="h-3.5 w-3.5" />
                {t('variantAssessment.openCalculator')}
              </button>
              <span className="text-[10px] text-fg-subtle">调证据与分级</span>
            </div>
          </section>
        </div>
      </div>

      {svcAI && (
        <section className="rounded-lg border border-border-subtle bg-canvas-default p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-fg-muted">{t('variantAssessment.ai')} · SVC v4</span>
            <span className="text-xs text-warning-fg">{t('variantAssessment.svcDraft')}</span>
          </div>
          <p className="mt-1 text-sm font-semibold">{label(svcAI.suggestedClassification || svcAI.classification)}</p>
        </section>
      )}

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
            <span>AI 提议待人工复核项</span>
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
                {effectiveAI.warnings?.map((warning, i) => (
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
              立即进入计算器复核 AI 条目 →
            </button>
          </div>
        </div>
      )}

      {/* 底部工作流动作 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-subtle">
        <p className="text-xs text-fg-muted">{t('variantAssessment.referenceNotice')}</p>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-default hover:bg-canvas-subtle transition-colors"
          onClick={onInterpretation}
        >
          {t('variantAssessment.next')} →
        </button>
      </div>
    </div>
  );
}
