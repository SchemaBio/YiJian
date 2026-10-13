'use client';
import { formatNumericString } from '@/i18n/format';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import { Tooltip } from '@schema/ui-kit';
import { HelpCircle, Minus } from 'lucide-react';
import type { Section4Criteria } from '../../types';

interface Section4PanelProps {
  cnvType: 'Amplification' | 'Deletion';
  criteria: Section4Criteria;
  onChange: (criteria: Section4Criteria) => void;
}

/**
 * 计数器组件
 */
function Counter({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  tooltip?: string;
}) {
  const t = useText();
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-fg-default">{label}</span>
        {tooltip && (
          <Tooltip content={translateUI(tooltip, t)} placement="right" variant="nav">
            <HelpCircle className="w-3 h-3 text-fg-muted" />
          </Tooltip>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="p-1 rounded border border-border hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center font-mono text-sm">{value}</span>
        <ActionButton size="small" iconOnly action="add" variant="ghost"
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="p-1 rounded border border-border hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed"
         />
      </div>
    </div>
  );
}

/**
 * 分数滑块组件
 */
function ScoreSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.05,
  tooltip,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  tooltip?: string;
}) {
  const t = useText();
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-fg-default">{label}</span>
          {tooltip && (
            <Tooltip content={translateUI(tooltip, t)} placement="right" variant="nav">
              <HelpCircle className="w-3 h-3 text-fg-muted" />
            </Tooltip>
          )}
        </div>
        <span className={`text-sm font-mono ${
          value > 0 ? 'text-success-fg' : value < 0 ? 'text-danger-fg' : 'text-fg-muted'
        }`}>
          {value >= 0 ? '+' : ''}{formatNumericString(value.toFixed(2), t.locale)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-canvas-inset rounded-lg appearance-none cursor-pointer"
      />
      <div className="flex justify-between text-xs text-fg-muted mt-1">
        <span>{formatNumericString(min.toFixed(2), t.locale)}</span>
        <span>{formatNumericString(max.toFixed(2), t.locale)}</span>
      </div>
    </div>
  );
}

/**
 * Section 4: 文献和数据库证据评估面板
 */
export function Section4Panel({ cnvType, criteria, onChange }: Section4PanelProps) {
  const t = useText();
  const updateDeNovo = (key: '4A' | '4B' | '4C', field: 'confirmedCount' | 'assumedCount', value: number) => {
    onChange({
      ...criteria,
      deNovo: {
        ...criteria.deNovo,
        [key]: {
          ...criteria.deNovo[key],
          [field]: value,
        },
      },
    });
  };

  const updateDeNovo4D = (count: number, score: number) => {
    onChange({
      ...criteria,
      deNovo: {
        ...criteria.deNovo,
        '4D': { count, score },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* De Novo 证据 */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("tasks.caseEvidenceDeNovoa769bc")}</h4>
        <div className="space-y-4 pl-2 border-l-2 border-border">
          {/* 4A */}
          <div className="bg-canvas-subtle rounded-lg p-3">
            <div className="text-sm text-fg-default mb-2">
              {t("tasks.aHighlySpecificUniquePhenotype5daba7")}<span className="text-xs text-fg-muted ml-2">{t("tasks.confirmedAssumed142898")}</span>
            </div>
            <Counter
              label={t("tasks.confirmedDeNovo437ef2")}
              value={criteria.deNovo['4A'].confirmedCount}
              onChange={(v) => updateDeNovo('4A', 'confirmedCount', v)}
              tooltip={t("tasks.deNovoVariantConfirmedByParentalTesting0faf76")}
            />
            <Counter
              label={t("tasks.assumedDeNovo6d5bcf")}
              value={criteria.deNovo['4A'].assumedCount}
              onChange={(v) => updateDeNovo('4A', 'assumedCount', v)}
              tooltip={t("tasks.assumedDeNovoWithoutParentalConfirmationf03a1a")}
            />
          </div>

          {/* 4B */}
          <div className="bg-canvas-subtle rounded-lg p-3">
            <div className="text-sm text-fg-default mb-2">
              {t("tasks.bHighlySpecificButNotUniquePhenotype8f9093")}<span className="text-xs text-fg-muted ml-2">{t("tasks.confirmedAssumed86fc57")}</span>
            </div>
            <Counter
              label={t("tasks.confirmedDeNovo437ef2")}
              value={criteria.deNovo['4B'].confirmedCount}
              onChange={(v) => updateDeNovo('4B', 'confirmedCount', v)}
            />
            <Counter
              label={t("tasks.assumedDeNovo6d5bcf")}
              value={criteria.deNovo['4B'].assumedCount}
              onChange={(v) => updateDeNovo('4B', 'assumedCount', v)}
            />
          </div>

          {/* 4C */}
          <div className="bg-canvas-subtle rounded-lg p-3">
            <div className="text-sm text-fg-default mb-2">
              {t("tasks.cConsistentButNotHighlySpecificPhenotype73977a")}<span className="text-xs text-fg-muted ml-2">{t("tasks.confirmedAssumed867612")}</span>
            </div>
            <Counter
              label={t("tasks.confirmedDeNovo437ef2")}
              value={criteria.deNovo['4C'].confirmedCount}
              onChange={(v) => updateDeNovo('4C', 'confirmedCount', v)}
            />
            <Counter
              label={t("tasks.assumedDeNovo6d5bcf")}
              value={criteria.deNovo['4C'].assumedCount}
              onChange={(v) => updateDeNovo('4C', 'assumedCount', v)}
            />
          </div>

          {/* 4D */}
          <div className="bg-canvas-subtle rounded-lg p-3">
            <div className="text-sm text-fg-default mb-2">
              {t("tasks.dInconsistentPhenotypeae5234")}<span className="text-xs text-fg-muted ml-2">{t("tasks.rangeTo3cdf86")}</span>
            </div>
            <Counter
              label={t("tasks.caseCountb3165f")}
              value={criteria.deNovo['4D'].count}
              onChange={(v) => updateDeNovo4D(v, criteria.deNovo['4D'].score)}
            />
            <ScoreSlider
              label={t("tasks.score2f5856")}
              value={criteria.deNovo['4D'].score}
              onChange={(v) => updateDeNovo4D(criteria.deNovo['4D'].count, v)}
              min={-0.30}
              max={0}
            />
          </div>
        </div>
      </div>

      {/* 未知遗传证据 */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("tasks.caseEvidenceInheritanceUnknownf4a398")}</h4>
        <div className="bg-canvas-subtle rounded-lg p-3">
          <div className="text-sm text-fg-default mb-2">
            {t("tasks.eHighlySpecificPhenotypeInheritanceUnknown7f842e")}<span className="text-xs text-fg-muted ml-2">{t("tasks.perCaseMaximum53d67a")}</span>
          </div>
          <Counter
            label={t("tasks.caseCountb3165f")}
            value={criteria.unknownInheritance['4E'].count}
            onChange={(v) => onChange({
              ...criteria,
              unknownInheritance: { '4E': { count: v } },
            })}
          />
        </div>
      </div>

      {/* 分离证据 */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("tasks.caseEvidenceSegregation140ce0")}</h4>
        <div className="space-y-2">
          <div className="bg-canvas-subtle rounded-lg p-3">
            <Counter
              label={t("tasks.fIndependentFamiliesWithSegregations3ff206")}
              value={criteria.segregation['4F']}
              onChange={(v) => onChange({
                ...criteria,
                segregation: { ...criteria.segregation, '4F': v },
              })}
              tooltip={t("tasks.perIndependentFamilyMaximumSegregationScoreDo72e2a9")}
            />
          </div>
          <div className="bg-canvas-subtle rounded-lg p-3">
            <Counter
              label={t("tasks.gIndependentFamiliesWithSegregationsfb3c1b")}
              value={criteria.segregation['4G']}
              onChange={(v) => onChange({
                ...criteria,
                segregation: { ...criteria.segregation, '4G': v },
              })}
              tooltip={t("tasks.each5685b7")}
            />
          </div>
          <div className="bg-canvas-subtle rounded-lg p-3">
            <Counter
              label={t("tasks.hIndependentFamiliesWithAtLeastSegregationsfc2a5d")}
              value={criteria.segregation['4H']}
              onChange={(v) => onChange({
                ...criteria,
                segregation: { ...criteria.segregation, '4H': v },
              })}
              tooltip={t("tasks.perIndependentFamilyMaximumSegregationScore552c62")}
            />
          </div>
        </div>
      </div>

      {/* 非分离证据 */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("tasks.caseEvidenceNonsegregation266807")}</h4>
        <div className="space-y-2">
          <div className="bg-canvas-subtle rounded-lg p-3">
            <div className="text-sm text-fg-default mb-2">{t("tasks.iNotFoundInAffectedRelatives430922")}</div>
            <Counter
              label={t("tasks.familyCount95d922")}
              value={criteria.nonSegregation['4I'].familyCount}
              onChange={(v) => onChange({
                ...criteria,
                nonSegregation: {
                  ...criteria.nonSegregation,
                  '4I': { familyCount: v, score: Math.max(-0.45 * v, -0.90) },
                },
              })}
            />
          </div>
          <div className="bg-canvas-subtle rounded-lg p-3">
            <div className="text-sm text-fg-default mb-2">{t("tasks.jFoundInUnaffectedRelativesSpecificPhenotypeba0a30")}</div>
            <Counter
              label={t("tasks.familyCount95d922")}
              value={criteria.nonSegregation['4J'].familyCount}
              onChange={(v) => onChange({
                ...criteria,
                nonSegregation: {
                  ...criteria.nonSegregation,
                  '4J': { familyCount: v, score: Math.max(-0.30 * v, -0.90) },
                },
              })}
            />
          </div>
          <div className="bg-canvas-subtle rounded-lg p-3">
            <div className="text-sm text-fg-default mb-2">{t("tasks.kFoundInUnaffectedRelativesNonspecificPhenotype360b6a")}</div>
            <Counter
              label={t("tasks.familyCount95d922")}
              value={criteria.nonSegregation['4K'].familyCount}
              onChange={(v) => onChange({
                ...criteria,
                nonSegregation: {
                  ...criteria.nonSegregation,
                  '4K': { familyCount: v, score: Math.max(-0.15 * v, -0.30) },
                },
              })}
            />
          </div>
        </div>
      </div>

      {/* 病例对照证据 */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("tasks.caseControlAndPopulationEvidence6967a1")}</h4>
        <div className="space-y-2">
          <div className="bg-canvas-subtle rounded-lg p-3">
            <ScoreSlider
              label={t("tasks.lSignificantlyEnrichedInCasesSpecificPhenotypef900a9")}
              value={criteria.caseControl['4L'].score}
              onChange={(v) => onChange({
                ...criteria,
                caseControl: { ...criteria.caseControl, '4L': { studyCount: 1, score: v } },
              })}
              min={0}
              max={0.45}
              tooltip={t("tasks.toPerStudy118c29")}
            />
          </div>
          <div className="bg-canvas-subtle rounded-lg p-3">
            <ScoreSlider
              label={t("tasks.mSignificantlyEnrichedInCasesNonspecificPhenotypefdcd46")}
              value={criteria.caseControl['4M'].score}
              onChange={(v) => onChange({
                ...criteria,
                caseControl: { ...criteria.caseControl, '4M': { studyCount: 1, score: v } },
              })}
              min={0}
              max={0.45}
            />
          </div>
          <div className="bg-canvas-subtle rounded-lg p-3">
            <ScoreSlider
              label={t("tasks.nNoSignificantCaseControlDifferencec3e4de")}
              value={criteria.caseControl['4N'].score}
              onChange={(v) => onChange({
                ...criteria,
                caseControl: { ...criteria.caseControl, '4N': { studyCount: 1, score: v } },
              })}
              min={-0.90}
              max={0}
            />
          </div>
          <div className="bg-canvas-subtle rounded-lg p-3">
            <ScoreSlider
              label={t("tasks.oOverlapsCommonPopulationVariationf606f1")}
              value={criteria.caseControl['4O'].score}
              onChange={(v) => onChange({
                ...criteria,
                caseControl: { ...criteria.caseControl, '4O': { score: v } },
              })}
              min={-1.00}
              max={0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
