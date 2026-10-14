'use client';
import { useText } from '@/i18n/useText';


import { ActionButton, IconActionButton } from '@/components/shared/ActionButton';

import { useInterpretationReadOnly } from './InterpretationLock';

import * as React from 'react';
import { AIAssistanceAction, AIResultCard } from '@/components/shared/AIAssistanceAction';
import type { AIAssistanceResult } from '@/lib/ai-assistance';
import { aiVariantContext } from '../utils/ai-context';
import { WorkspaceInspector } from '@/components/shared/WorkspaceInspector';
import { Calculator } from 'lucide-react';
import { Tag } from '@/components/shared/Tag';
import type {
  CNVSegment,
  CNVExon,
  CNVAssessment,
  ClinGenClassification,
  SectionScores,
  LossAssessmentCriteria,
  GainAssessmentCriteria,
  Section2LossCriteria,
  Section2GainCriteria,
} from '../types';
import {
  getClassificationLabel,
  getClassificationVariant,
  formatScore,
} from '../utils/pathogenicity-classifier';
import { Section1Panel } from './assessment/Section1Panel';
import { Section2Panel } from './assessment/Section2Panel';
import { Section3Panel } from './assessment/Section3Panel';
import { Section4Panel } from './assessment/Section4Panel';
import { Section5Panel } from './assessment/Section5Panel';

interface CNVAssessmentPanelProps {
  taskId?: string;
  referenceId?: string;
  saving?: boolean;
  error?: string | null;
  /** CNV变异数据 */
  cnv: CNVSegment | CNVExon | null;
  /** 当前评估数据 */
  assessment: CNVAssessment | null;
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave?: (assessment: CNVAssessment) => void;
  /** 重置回调 */
  onReset?: () => void;
  /** 标准变更回调 */
  onCriteriaChange?: (criteria: LossAssessmentCriteria | GainAssessmentCriteria) => void;
}

/**
 * 分数汇总卡片
 */
function ScoreSummaryCard({
  classification,
  totalScore,
  sectionScores,
  isUserModified,
  insufficient,
}: {
  classification: ClinGenClassification;
  totalScore: number;
  sectionScores: SectionScores;
  isUserModified: boolean;
  insufficient?: boolean;
}) {
  const t = useText();
  const variant = insufficient ? 'neutral' : getClassificationVariant(classification);
  const label = insufficient ? t("tasks.insufficientEvidence70568c") : getClassificationLabel(classification);

  return (
    <div className="bg-canvas-subtle rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-fg-muted" />
          <span className="text-sm font-medium text-fg-default">{t("tasks.assessmentResult9dccae")}</span>
        </div>
        {isUserModified && (
          <span className="text-xs text-warning-fg">{t("tasks.manuallyModifiedd03878")}</span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Tag variant={variant} className="text-base px-3 py-1">
          {label}
        </Tag>
        <span className="text-2xl font-bold text-fg-default">
          {formatScore(totalScore)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-fg-muted mb-2">{t("tasks.sectionScorescbc75f")}</div>
        <ScoreBar label="Section 1" score={sectionScores.section1} />
        <ScoreBar label="Section 2" score={sectionScores.section2} />
        <ScoreBar label="Section 3" score={sectionScores.section3} />
        <ScoreBar label="Section 4" score={sectionScores.section4} />
        <ScoreBar label="Section 5" score={sectionScores.section5} />
      </div>
    </div>
  );
}

/**
 * 单个分数条
 */
function ScoreBar({ label, score }: { label: string; score: number }) {
  const isNegative = score < 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-fg-muted">{label}</span>
      <div className="flex-1 h-2 bg-canvas-inset rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            'bg-fg-muted'
          }`}
          style={{
            width: `${Math.min(Math.abs(score) * 50, 100)}%`,
            marginLeft: isNegative ? 'auto' : 0,
          }}
        />
      </div>
      <span className={`w-12 text-right font-mono ${
        'text-fg-muted'
      }`}>
        {score >= 0 ? '+' : ''}{formatScore(score)}
      </span>
    </div>
  );
}

/**
 * 可折叠的Section面板
 */
function AssessmentSection({ title, score, children }: { title: string; score: number; children: React.ReactNode }) {
  const number = title.match(/Section ([1-5])/)?.[1];
  return <section id={`cnv-section-${number}`} className="scroll-mt-4 border-b border-border-subtle pb-4 pt-3">
    <div className="mb-3 flex items-start justify-between gap-3"><h4 className="text-sm font-semibold">{title}</h4>
      <span className="font-mono text-sm text-fg-muted">{score >= 0 ? '+' : ''}{formatScore(score)}</span></div>
    {children}
  </section>;
}

/**
 * CNV评估侧边栏主组件
 */
export function CNVAssessmentPanel({
  taskId, referenceId,
  cnv,
  saving = false,
  error,
  assessment,
  isOpen,
  onClose,
  onSave,
  onReset,
  onCriteriaChange,
}: CNVAssessmentPanelProps) {
  const t = useText();
  const readOnly = useInterpretationReadOnly();
  const [aiResult, setAIResult] = React.useState<AIAssistanceResult>();
  React.useEffect(() => { setAIResult(undefined); }, [taskId, cnv?.id]);
  if (!isOpen || !cnv || !assessment) return null;
  if (cnv.type === 'Normal' || cnv.type === 'Unknown') return null;

  const isLoss = cnv.type === 'Deletion';
  const frameworkType = isLoss ? 'Loss' : 'Gain';
  const criteria = assessment.criteria;

  // 处理Section 1变更
  const handleSection1Change = (newSection1: LossAssessmentCriteria['section1'] | GainAssessmentCriteria['section1']) => {
    if (onCriteriaChange) {
      onCriteriaChange({
        ...criteria,
        section1: newSection1,
      } as LossAssessmentCriteria | GainAssessmentCriteria);
    }
  };

  // 处理Section 2变更
  const handleSection2Change = (newSection2: Section2LossCriteria | Section2GainCriteria) => {
    if (onCriteriaChange) {
      onCriteriaChange({
        ...criteria,
        section2: newSection2,
      } as LossAssessmentCriteria | GainAssessmentCriteria);
    }
  };

  // 处理Section 3变更
  const handleSection3Change = (newSection3: LossAssessmentCriteria['section3']) => {
    if (onCriteriaChange) {
      onCriteriaChange({
        ...criteria,
        section3: newSection3,
      } as LossAssessmentCriteria | GainAssessmentCriteria);
    }
  };

  // 处理Section 4变更
  const handleSection4Change = (newSection4: LossAssessmentCriteria['section4']) => {
    if (onCriteriaChange) {
      onCriteriaChange({
        ...criteria,
        section4: newSection4,
      } as LossAssessmentCriteria | GainAssessmentCriteria);
    }
  };

  // 处理Section 5变更
  const handleSection5Change = (newSection5: LossAssessmentCriteria['section5']) => {
    if (onCriteriaChange) {
      onCriteriaChange({
        ...criteria,
        section5: newSection5,
      } as LossAssessmentCriteria | GainAssessmentCriteria);
    }
  };

  return (
    <>
      <WorkspaceInspector label={t("tasks.clingenCnvAssessment0157de")} onClose={onClose}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-canvas-subtle">
          <div className="flex items-center gap-3">
            <Calculator className="w-5 h-5 text-fg-muted" />
            <div>
              <h3 className="text-base font-medium text-fg-default">
                ClinGen CNV {frameworkType} {t("tasks.assessment6c63b7")}</h3>
              <p className="text-xs text-fg-muted">
                {cnv.chromosome}:{cnv.startPosition}-{cnv.endPosition}
              </p>
            </div>
          </div>
          <IconActionButton label={t("tasks.close6c14bd")} action="close" variant="ghost"
            onClick={onClose}
            className="p-1.5 text-fg-muted hover:text-fg-default hover:bg-canvas-inset rounded transition-colors"

           />
        </div>

        {/* 内容区域 */}
        <fieldset disabled={readOnly} className="yj-inspector-content min-w-0">
          <p className="mb-3 text-xs text-fg-muted">{t("tasks.basedOnAcmgClingenPreselectionUsesProvided16a1ce")}</p>
          {assessment.autoEvidenceNotes?.map(note => <p key={note} className="mb-2 rounded bg-canvas-subtle p-2 text-xs text-fg-muted">{note}</p>)}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{t("tasks.aiAssistedAssessment6b72ee")}</span><AIAssistanceAction key={`${taskId}/${cnv.id}`} disabled={readOnly||saving||!taskId} input={{feature:isLoss?'cnv_loss':'cnv_gain',taskId,reference:referenceId,variant:aiVariantContext(cnv),calculator:assessment}} onResult={setAIResult} /></div>
          {aiResult && <div className="mb-4"><AIResultCard result={aiResult} /></div>}
          {/* 分数汇总 */}
          <ScoreSummaryCard
            classification={assessment.classification}
            totalScore={assessment.totalScore}
            sectionScores={assessment.sectionScores}
            isUserModified={assessment.isUserModified}
            insufficient={assessment.assessmentState === 'insufficient_evidence'}
          />

          <nav aria-label={t("tasks.assessmentSections8c836d")} className="mb-3 flex flex-wrap gap-2">
            {[t("tasks.genomicContentd5200b"), t("tasks.regionOverlap5aab91"), t("tasks.geneCount236d07"), t("tasks.literatureEvidence2f2a4c"), t("samples.familyHistory35fef1")].map((label, index) => <a key={label} href={`#cnv-section-${index + 1}`} className="yj-tool-button">{index + 1}. {label}</a>)}
          </nav>
          {/* Section 面板 */}
          <div className="space-y-2">
            <AssessmentSection
              title={t("tasks.sectionInitialGenomicContentAssessment875250")}
              score={assessment.sectionScores.section1}
            >
              <Section1Panel
                cnvType={cnv.type}
                criteria={criteria.section1}
                onChange={handleSection1Change}
              />
            </AssessmentSection>

            <AssessmentSection
              title={t("tasks.sectionGeneRegionOverlapa4193a", {p0: String(isLoss ? 'HI' : 'TS/HI')})}
              score={assessment.sectionScores.section2}
            >
              <Section2Panel
                cnvType={cnv.type}
                criteria={criteria.section2}
                onChange={handleSection2Change}
              />
            </AssessmentSection>

            <AssessmentSection
              title={t("tasks.sectionGeneCountAssessment441573")}
              score={assessment.sectionScores.section3}
            >
              <Section3Panel
                cnvType={cnv.type}
                criteria={criteria.section3}
                onChange={handleSection3Change}
              />
            </AssessmentSection>

            <AssessmentSection
              title={t("tasks.sectionLiteratureAndDatabaseEvidencecbeccf")}
              score={assessment.sectionScores.section4}
            >
              <Section4Panel
                cnvType={cnv.type}
                criteria={criteria.section4}
                onChange={handleSection4Change}
              />
            </AssessmentSection>

            <AssessmentSection
              title={t("tasks.sectionInheritanceFamilyHistoryd426e7")}
              score={assessment.sectionScores.section5}
            >
              <Section5Panel
                cnvType={cnv.type}
                criteria={criteria.section5}
                onChange={handleSection5Change}
              />
            </AssessmentSection>
          </div>
        </fieldset>

        {/* 底部操作栏 */}
        <div className="border-t border-border p-4 bg-canvas-subtle">
          {error && <p role="alert" className="mb-2 text-sm text-danger-fg">{error}</p>}
          <div className="flex gap-3">
            {onReset && (
              <ActionButton action="retry" variant="ghost"
                disabled={readOnly || saving}
                onClick={onReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-canvas-inset transition-colors"
              >

                {t("tasks.reset3d8134")}</ActionButton>
            )}
            {onSave && (
              <ActionButton loading={saving} loadingLabel={t("tasks.saving6644f0")} action="save" variant="ghost"
                disabled={readOnly || saving}
                onClick={() => onSave(assessment)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-accent-emphasis text-white rounded-md hover:bg-accent-fg transition-colors"
              >

                {t("data.savefadf24")}</ActionButton>
            )}
          </div>
        </div>
      </WorkspaceInspector>
    </>
  );
}
