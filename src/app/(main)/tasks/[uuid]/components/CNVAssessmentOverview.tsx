'use client';
import * as React from 'react';
import { useText } from '@/i18n/useText';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import type { CNVSegment, CNVExon, CNVAssessment, CNVAdoptedSource, ClinGenClassification } from '../types';
import { ClinicalSignificanceBadge } from './ClinicalSignificanceBadge';
import { getClassificationLabel, formatScore } from '../utils/pathogenicity-classifier';
import { cnvAIClauses } from '../utils/cnv-ai';
import { Sparkles, Database, Cpu, UserCheck, CheckCircle2, Calculator } from 'lucide-react';

export function CNVAssessmentOverview({
  variant,
  assessment,
  ai,
  aiError,
  onClingen,
  onAdoptSource,
}: {
  variant: CNVSegment | CNVExon;
  assessment?: CNVAssessment | null;
  ai?: AIAssistanceResult;
  aiError?: string;
  onClingen: () => void;
  onAdoptSource?: (source: CNVAdoptedSource, classification?: string | null) => Promise<void> | void;
}) {
  const t = useText();

  const label = (value?: string | null) => {
    if (!value || ['.', '-'].includes(value.trim())) return '缺失';
    if (value === 'insufficient_data') return t('tasks.insufficientEvidence70568c');
    try {
      const clingenLabel = getClassificationLabel(value as ClinGenClassification);
      if (clingenLabel) return clingenLabel;
    } catch {
      // fallback
    }
    return value.replaceAll('_', ' ');
  };

  // 人工 ClinGen 评估是否已经正式修改/确认
  const isHumanConfirmed = Boolean(assessment && assessment.isUserModified);

  // 1. 数据库参考
  const clinvar = variant.annotationValues?.ClinVar?.trim();
  const clingenDb = variant.annotationValues?.ClinGen?.trim() || variant.annotationValues?.['ClinGen Dosage']?.trim();
  const rawDb = clinvar || clingenDb;
  const dbValue = !rawDb || ['.', '-'].includes(rawDb) ? '缺失' : rawDb;
  const dbDetails: string[] = [];
  if (variant.annotationValues) {
    for (const [k, v] of Object.entries(variant.annotationValues)) {
      if (['ClinVar', 'ClinGen', 'ClinGen Dosage', 'DECIPHER', 'DGV'].includes(k) && v && !['.', '-'].includes(v.trim())) {
        dbDetails.push(`${k}: ${v}`);
      }
    }
  }
  const dbDetail = dbDetails.length > 0 ? dbDetails.join(' · ') : '暂无可引用的数据库直接致病性结论';

  // 2. 本地快速初评
  const autoCnv = variant.automaticAssessment;
  const rawQuick = (autoCnv?.cnvClassification || autoCnv?.classification)?.trim();
  const quickValue = !rawQuick || ['.', '-'].includes(rawQuick) ? '缺失' : rawQuick;
  const autoScore = (autoCnv?.cnvScore !== undefined || autoCnv?.score !== undefined)
    ? `${formatScore(autoCnv.cnvScore ?? autoCnv.score ?? 0)} 分`
    : '';
  const autoCriteria = autoCnv?.criteria?.map(c => c.code).join(', ');
  const quickDetail = [
    autoScore,
    autoCriteria ? `依据: ${autoCriteria}` : '',
    autoCnv?.screeningNotes?.filter(n => n && !['.', '-'].includes(n.trim())).join(' ') || autoCnv?.profile,
  ].filter(Boolean).join(' · ');

  // 3. AI 证据建议
  const effectiveAI: AIAssistanceResult | undefined = (ai && typeof ai === 'object')
    ? ai
    : (variant.cnvAIResult && typeof variant.cnvAIResult === 'object')
      ? variant.cnvAIResult
      : undefined;

  const rawAI = (effectiveAI?.suggestedClassification || effectiveAI?.classification)?.trim();
  const aiValue = !rawAI || ['.', '-'].includes(rawAI)
    ? (effectiveAI ? '缺失' : '尚未进行 AI 评估')
    : rawAI === 'insufficient_data'
      ? '证据不足，待补充'
      : rawAI;

  const proposalClauses = effectiveAI ? cnvAIClauses(effectiveAI) : [];
  const validClauses = proposalClauses.filter(c => c.status !== 'insufficient_data' && c.status !== 'not_applicable');
  const validEvidence = (effectiveAI?.evidence ?? []).filter(e => e.status !== 'insufficient_data' && e.status !== 'not_applicable');
  const aiCodeList = Array.from(new Set([
    ...validClauses.map(c => c.code),
    ...validEvidence.map(e => e.code),
  ])).filter(Boolean);
  const aiCriteria = aiCodeList.join(', ');
  const aiDetail = aiCriteria ? `依据: ${aiCriteria}` : (effectiveAI ? '无生效条目' : '尚未进行 AI 评估');

  // 4. ClinGen 评估
  const rawClingen = assessment?.classification?.trim();
  const clingenValue = !rawClingen || ['.', '-'].includes(rawClingen)
    ? (assessment ? assessment.classification : '尚未评定')
    : rawClingen;

  const clingenDetail = isHumanConfirmed && assessment
    ? [
        `核定总分: ${formatScore(assessment.totalScore)} 分`,
        assessment.updatedAt ? new Date(assessment.updatedAt).toLocaleString() : '',
      ].filter(Boolean).join(' · ')
    : '尚未进行人工评定（进入下方计算器完成核定）';

  // 确定当前采用（四选一），初次评估默认指向“本地快速初评”
  const activeSource: CNVAdoptedSource = React.useMemo(() => {
    if (variant.adoptedCNV?.source === 'database') return 'database';
    if (variant.adoptedCNV?.source === 'ai') return 'ai';
    if (variant.adoptedCNV?.source === 'clingen') return 'clingen';
    if (variant.adoptedCNV?.source === 'quick') return 'quick';
    // 若有人工正式评估记录且未显式指定其他，使用 clingen
    if (assessment && assessment.isUserModified) {
      return 'clingen';
    }
    // 默认指向本地快速初评
    return 'quick';
  }, [variant.adoptedCNV?.source, assessment]);

  const sourceLabelMap: Record<CNVAdoptedSource, string> = {
    database: '数据库参考',
    quick: '本地快速初评',
    ai: 'AI证据建议',
    clingen: 'ClinGen评估',
  };

  const adoptedClassification = React.useMemo(() => {
    if (activeSource === 'database') return dbValue;
    if (activeSource === 'quick') return quickValue;
    if (activeSource === 'ai') return aiValue;
    return clingenValue;
  }, [activeSource, dbValue, quickValue, aiValue, clingenValue]);

  const handleCardClick = (source: CNVAdoptedSource) => {
    if (!onAdoptSource) return;
    let targetClass: string | undefined;
    if (source === 'database' && dbValue !== '缺失') targetClass = dbValue;
    else if (source === 'quick' && quickValue !== '缺失') targetClass = quickValue;
    else if (source === 'ai' && aiValue !== '缺失' && aiValue !== '尚未进行 AI 评估' && aiValue !== '证据不足，待补充') targetClass = aiValue;
    else if (source === 'clingen' && clingenValue !== '尚未评定') targetClass = clingenValue;
    onAdoptSource(source, targetClass);
  };

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
            {activeSource === 'clingen' && isHumanConfirmed ? (
              <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                <UserCheck className="h-3.5 w-3.5" /> ClinGen 人工已核定
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
            onClick={onClingen}
          >
            <Calculator className="h-3.5 w-3.5" />
            进入ClinGen评估 →
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
            aria-label="选择数据库参考采用"
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
                {label(dbValue)}
              </p>
            </div>
            <p className="mt-2 break-words text-xs text-fg-muted leading-relaxed">
              {dbDetail}
            </p>
          </section>

          {/* 卡片 2: 本地快速初评 */}
          <section
            role="button"
            tabIndex={0}
            aria-label="选择本地快速初评采用"
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
            aria-label="选择AI证据建议采用"
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
                ) : isHumanConfirmed && effectiveAI ? (
                  <span className="rounded bg-success-emphasis/15 px-1.5 py-0.5 text-[10px] font-medium text-success-fg">
                    已核定
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
              {aiDetail}
            </p>
          </section>

          {/* 卡片 4: ClinGen 评估 */}
          <section
            role="button"
            tabIndex={0}
            aria-label="选择ClinGen评估采用"
            onClick={() => handleCardClick('clingen')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick('clingen'); } }}
            className={`cursor-pointer rounded-lg border p-3 flex flex-col justify-between transition-all select-none ${
              activeSource === 'clingen'
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
                  ClinGen评估
                </span>
                {activeSource === 'clingen' ? (
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
                {label(clingenValue)}
              </p>
              <p className="mt-1 break-words text-xs text-fg-muted leading-relaxed">
                {clingenDetail}
              </p>
            </div>
            {/* 卡片内部增加 ClinGen 评估按钮 */}
            <div className="mt-3 pt-2 border-t border-border-subtle flex items-center">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-canvas-subtle px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent-subtle hover:border-accent-emphasis/50 transition-colors shadow-2xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onClingen();
                }}
              >
                <Calculator className="h-3.5 w-3.5" />
                ClinGen评估
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
    </div>
  );
}
