'use client';

import { useState, useCallback, useMemo } from 'react';
import type {
  CNVSegment,
  CNVExon,
  CNVAssessment,
  LossAssessmentCriteria,
  GainAssessmentCriteria,
  ScoreResult,
} from '../types';
import {
  createDefaultLossAssessmentCriteria,
  createDefaultGainAssessmentCriteria,
  createDefaultSectionScores,
} from '../types';
import { calculateLossTotal } from '../utils/loss-calculator';
import { calculateGainTotal } from '../utils/gain-calculator';
import { classify } from '../utils/pathogenicity-classifier';

/**
 * 生成唯一ID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `assessment-${crypto.randomUUID()}`;
  }
  return `assessment-${Date.now()}`;
}

/**
 * 根据CNV类型创建默认评估
 */
function createDefaultAssessment(cnv: CNVSegment | CNVExon): CNVAssessment {
  const isLoss = cnv.type === 'Deletion';
  const criteria = isLoss 
    ? createDefaultLossAssessmentCriteria() 
    : createDefaultGainAssessmentCriteria();
  
  const annotation = cnv.annotationValues ?? {};
  const number = (field: string): number | undefined => {
    const raw = annotation[field];
    if (raw === undefined || raw === null || String(raw).trim() === '' || raw === '.') return undefined;
    const value = Number(raw); return Number.isFinite(value) ? value : undefined;
  };
  const selected = (field: string) => number(field) === 1;
  const autoEvidenceNotes: string[] = [];
  // Only explicit source flags with compatible score semantics are selected.
  if (selected('Evidence_1A') && !selected('Evidence_1B') && number('Section1') === 0) {
    criteria.section1.selected = '1A';
    autoEvidenceNotes.push('1A：流程 Evidence_1A=1 且 Section1=0；预选后请核对功能元素注释。');
  } else if (selected('Evidence_1B') && !selected('Evidence_1A') && number('Section1') === -0.6) {
    criteria.section1.selected = '1B';
    autoEvidenceNotes.push('1B：流程 Evidence_1B=1 且 Section1=-0.60；预选后请确认不含功能元素。');
  } else autoEvidenceNotes.push('1A/1B：没有可一致映射的流程证据，保持未选。');
  if (isLoss && selected('Evidence_2F') && number('Section2') === -1 && annotation.Benign_Regions_Overlap && annotation.Benign_Regions_Overlap !== '.') {
    (criteria as LossAssessmentCriteria).section2.benignOverlap = { selected: '2F', score: -1 };
    autoEvidenceNotes.push('Loss 2F：流程已标记良性区域重叠并给出 -1.00 分；请核对完整包含关系。');
  }
  const populationScore = number('Section4');
  if (selected('Evidence_4O') && populationScore !== undefined && populationScore < 0 && populationScore >= -1
      && ['Evidence_4A', 'Evidence_4L'].every(field => !selected(field))) {
    criteria.section4.caseControl['4O'] = { score: populationScore };
    autoEvidenceNotes.push(`4O：流程人群证据预选，保留 Section4=${populationScore} 分；请核对人群来源与适用性。`);
  }
  criteria.section3.confirmed = false;
  criteria.section5.other = { selected: '5F', score: 0 };
  autoEvidenceNotes.push(`流程 Gene_Count=${annotation.Gene_Count ?? '未提供'}；尚未证明是完整蛋白编码 RefSeq 基因计数，不自动计分。`);
  autoEvidenceNotes.push('5F：当前检出表未提供可靠遗传信息（0 分）；请按家系证据调整。');
  autoEvidenceNotes.push('其他 HI/TS、断点、病例或表型证据若无法对应明确条款，保持未选，不推断计分。');

  // 计算初始评分
  const scoreResult: ScoreResult = isLoss
    ? calculateLossTotal(criteria as LossAssessmentCriteria)
    : calculateGainTotal(criteria as GainAssessmentCriteria);

  return {
    id: generateId(),
    cnvId: cnv.id,
    cnvType: cnv.type,
    criteria,
    sectionScores: scoreResult.sectionScores,
    totalScore: scoreResult.totalScore,
    classification: scoreResult.classification,
    autoEvidenceNotes,
    isAutoCalculated: true,
    isUserModified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * CNV评估状态管理Hook
 */
export function useCNVAssessment(cnv: CNVSegment | CNVExon | null) {
  // 评估状态
  const [assessment, setAssessment] = useState<CNVAssessment | null>(() => {
    if (!cnv) return null;
    return createDefaultAssessment(cnv);
  });

  // 原始评估（用于重置）
  const [originalAssessment, setOriginalAssessment] = useState<CNVAssessment | null>(() => {
    if (!cnv) return null;
    return createDefaultAssessment(cnv);
  });

  // 是否为Loss类型
  const isLoss = cnv?.type === 'Deletion';

  /**
   * 更新评估标准并重新计算评分
   */
  const updateCriteria = useCallback((
    newCriteria: LossAssessmentCriteria | GainAssessmentCriteria
  ) => {
    if (!assessment) return;

    // 重新计算评分
    const scoreResult: ScoreResult = isLoss
      ? calculateLossTotal(newCriteria as LossAssessmentCriteria)
      : calculateGainTotal(newCriteria as GainAssessmentCriteria);

    setAssessment({
      ...assessment,
      criteria: newCriteria,
      sectionScores: scoreResult.sectionScores,
      totalScore: scoreResult.totalScore,
      classification: scoreResult.classification,
      isUserModified: true,
      updatedAt: new Date().toISOString(),
    });
  }, [assessment, isLoss]);

  /**
   * 重置评估到默认值
   */
  const resetAssessment = useCallback(() => {
    if (!cnv) return;
    const defaultAssessment = createDefaultAssessment(cnv);
    setAssessment(defaultAssessment);
    setOriginalAssessment(defaultAssessment);
  }, [cnv]);

  /**
   * 保存评估
   */
  const saveAssessment = useCallback((userId?: string): CNVAssessment | null => {
    if (!assessment) return null;

    const savedAssessment: CNVAssessment = {
      ...assessment,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    setAssessment(savedAssessment);
    setOriginalAssessment(savedAssessment);

    // 返回已规范化的评估对象；调用方负责写入 Octopus
    // `/results/cnv-assessments/:type/:vid`，避免 Hook 内部耦合任务 ID。

    return savedAssessment;
  }, [assessment]);

  /**
   * 加载已保存的评估
   */
  const loadAssessment = useCallback((savedAssessment: CNVAssessment) => {
    setAssessment(savedAssessment);
    setOriginalAssessment(savedAssessment);
  }, []);

  /**
   * 检查是否有未保存的更改
   */
  const hasUnsavedChanges = useMemo(() => {
    if (!assessment || !originalAssessment) return false;
    return assessment.updatedAt !== originalAssessment.updatedAt;
  }, [assessment, originalAssessment]);

  /**
   * 初始化评估（当CNV变化时）
   */
  const initializeAssessment = useCallback((newCnv: CNVSegment | CNVExon) => {
    const defaultAssessment = createDefaultAssessment(newCnv);
    setAssessment(defaultAssessment);
    setOriginalAssessment(defaultAssessment);
  }, []);

  return {
    assessment,
    isLoss,
    updateCriteria,
    resetAssessment,
    saveAssessment,
    loadAssessment,
    hasUnsavedChanges,
    initializeAssessment,
  };
}

/**
 * 序列化评估数据为JSON
 */
export function serializeAssessment(assessment: CNVAssessment): string {
  return JSON.stringify(assessment);
}

/**
 * 从JSON反序列化评估数据
 */
export function deserializeAssessment(json: string): CNVAssessment | null {
  try {
    const parsed = JSON.parse(json);
    // 基本验证
    if (!parsed.id || !parsed.cnvId || !parsed.cnvType || !parsed.criteria) {
      return null;
    }
    return parsed as CNVAssessment;
  } catch {
    return null;
  }
}
