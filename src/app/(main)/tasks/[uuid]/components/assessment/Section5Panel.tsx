'use client';
import { formatNumericString } from '@/i18n/format';

import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';


import * as React from 'react';
import { Tooltip } from '@schema/ui-kit';
import { HelpCircle } from 'lucide-react';
import type { Section5Criteria } from '../../types';

interface Section5PanelProps {
  cnvType: 'Amplification' | 'Deletion';
  criteria: Section5Criteria;
  onChange: (criteria: Section5Criteria) => void;
}

/**
 * 单选按钮组件
 */
function RadioOption({
  id,
  name,
  label,
  description,
  score,
  checked,
  onChange,
  hasRange,
  onScoreChange,
  range,
}: {
  id: string;
  name: string;
  label: string;
  description: string;
  score: number;
  checked: boolean;
  onChange: () => void;
  hasRange?: boolean;
  onScoreChange?: (score: number) => void;
  range?: { min: number; max: number };
}) {
  const t = useText();
  return (
    <div
      className={`
        p-3 rounded-lg border transition-colors
        ${checked 
          ? 'border-accent-emphasis bg-accent-subtle' 
          : 'border-border hover:border-border-default'
        }
      `}
    >
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
        <input
          type="radio"
          id={id}
          name={name}
          checked={checked}
          onChange={onChange}
          className="mt-1 w-4 h-4 text-accent-fg focus:ring-accent-emphasis"
        />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-fg-default">{label}</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono ${
                score > 0 ? 'text-success-fg' : score < 0 ? 'text-danger-fg' : 'text-fg-muted'
              }`}>
                {score >= 0 ? '+' : ''}{formatNumericString(score.toFixed(2), t.locale)}
              </span>
              <Tooltip content={translateUI(description, t)} placement="left" variant="nav">
                <HelpCircle className="w-4 h-4 text-fg-muted" />
              </Tooltip>
            </div>
          </div>
        </div>
      </label>
      
      {checked && hasRange && range && onScoreChange && (
        <div className="mt-3 ml-7">
          <input
            type="range"
            min={range.min}
            max={range.max}
            step={0.05}
            value={score}
            onChange={(e) => onScoreChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-canvas-inset rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-fg-muted mt-1">
            <span>{formatNumericString(range.min.toFixed(2), t.locale)}</span>
            <span>{formatNumericString(range.max.toFixed(2), t.locale)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Section 5: 遗传模式/家族史评估面板
 */
export function Section5Panel({ cnvType, criteria, onChange }: Section5PanelProps) {
  const t = useText();
  return (
    <div className="space-y-6">
      {/* De Novo */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("tasks.observedCnvIsDeNovof77383")}</h4>
        <RadioOption
          id="section5-5A"
          name="section5-denovo"
          label={t("tasks.aUseSectionDeNovoScore82fe25")}
          description={t("tasks.useSectionADDeNovoCategories6af70f")}
          score={criteria.deNovo.score}
          checked={criteria.deNovo.selected === '5A'}
          onChange={() => onChange({
            ...criteria,
            deNovo: { selected: '5A', score: criteria.deNovo.score },
            inherited: { selected: null, score: 0 },
            other: { selected: null, score: 0 },
          })}
          hasRange
          range={{ min: 0, max: 0.45 }}
          onScoreChange={(score) => onChange({
            ...criteria,
            deNovo: { selected: '5A', score },
          })}
        />
      </div>

      {/* Inherited */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("tasks.observedCnvIsInheritedc56d72")}</h4>
        <div className="space-y-2">
          <RadioOption
            id="section5-5B"
            name="section5-inherited"
            label={t("tasks.bSpecificPhenotypeNoFamilyHistoryInherited0da759")}
            description={t("tasks.specificWellDefinedPhenotypeWithoutFamilyHistoryb560fd")}
            score={criteria.inherited.selected === '5B' ? criteria.inherited.score : -0.30}
            checked={criteria.inherited.selected === '5B'}
            onChange={() => onChange({
              ...criteria,
              deNovo: { selected: null, score: 0 },
              inherited: { selected: '5B', score: -0.30 },
              other: { selected: null, score: 0 },
            })}
            hasRange
            range={{ min: -0.45, max: 0 }}
            onScoreChange={(score) => onChange({
              ...criteria,
              inherited: { selected: '5B', score },
            })}
          />
          <RadioOption
            id="section5-5C"
            name="section5-inherited"
            label={t("tasks.cNonspecificPhenotypeNoFamilyHistoryInherited691994")}
            description={t("tasks.nonspecificPhenotypeWithoutFamilyHistoryCnvInherited556ec6")}
            score={criteria.inherited.selected === '5C' ? criteria.inherited.score : -0.15}
            checked={criteria.inherited.selected === '5C'}
            onChange={() => onChange({
              ...criteria,
              deNovo: { selected: null, score: 0 },
              inherited: { selected: '5C', score: -0.15 },
              other: { selected: null, score: 0 },
            })}
            hasRange
            range={{ min: -0.30, max: 0 }}
            onScoreChange={(score) => onChange({
              ...criteria,
              inherited: { selected: '5C', score },
            })}
          />
          <RadioOption
            id="section5-5D"
            name="section5-inherited"
            label={t("tasks.dCnvSegregatesWithConsistentFamilyPhenotype6cfc81")}
            description={t("tasks.useSectionFHSegregationCategoriesTo61cb38")}
            score={criteria.inherited.selected === '5D' ? criteria.inherited.score : 0}
            checked={criteria.inherited.selected === '5D'}
            onChange={() => onChange({
              ...criteria,
              deNovo: { selected: null, score: 0 },
              inherited: { selected: '5D', score: 0 },
              other: { selected: null, score: 0 },
            })}
            hasRange
            range={{ min: 0, max: 0.45 }}
            onScoreChange={(score) => onChange({
              ...criteria,
              inherited: { selected: '5D', score },
            })}
          />
        </div>
      </div>

      {/* Non-segregation */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("tasks.observedCnvNonsegregationb551de")}</h4>
        <RadioOption
          id="section5-5E"
          name="section5-nonseg"
          label={t("tasks.eUseSectionNonsegregationScore28baf5")}
          description={t("tasks.useSectionIKNonsegregationCategoriesTo375a7f")}
          score={criteria.nonSegregation.score}
          checked={criteria.nonSegregation.selected === '5E'}
          onChange={() => onChange({
            ...criteria,
            nonSegregation: { selected: '5E', score: criteria.nonSegregation.score },
          })}
          hasRange
          range={{ min: -0.45, max: 0 }}
          onScoreChange={(score) => onChange({
            ...criteria,
            nonSegregation: { selected: '5E', score },
          })}
        />
      </div>

      {/* Other */}
      <div>
        <h4 className="text-sm font-medium text-fg-default mb-3">{t("samples.other1a26ed")}</h4>
        <div className="space-y-2">
          <RadioOption
            id="section5-5F"
            name="section5-other"
            label={t("tasks.fInheritanceInformationUnavailableOrUninformative86e37c")}
            description={t("tasks.inheritanceInformationIsUnavailableOrUninformative11e2e3")}
            score={0}
            checked={criteria.other.selected === '5F'}
            onChange={() => onChange({
              ...criteria,
              deNovo: { selected: null, score: 0 },
              inherited: { selected: null, score: 0 },
              other: { selected: '5F', score: 0 },
            })}
          />
          <RadioOption
            id="section5-5G"
            name="section5-other"
            label={t("tasks.gInheritanceUnknownNonspecificPhenotypeConsistentWith7e4882")}
            description={t("tasks.inheritanceUnavailableOrUninformativeNonspecificPhenotypeConsistent225a56")}
            score={criteria.other.selected === '5G' ? criteria.other.score : 0.10}
            checked={criteria.other.selected === '5G'}
            onChange={() => onChange({
              ...criteria,
              deNovo: { selected: null, score: 0 },
              inherited: { selected: null, score: 0 },
              other: { selected: '5G', score: 0.10 },
            })}
            hasRange
            range={{ min: 0, max: 0.15 }}
            onScoreChange={(score) => onChange({
              ...criteria,
              other: { selected: '5G', score },
            })}
          />
          <RadioOption
            id="section5-5H"
            name="section5-other"
            label={t("tasks.hInheritanceUnknownHighlySpecificPhenotypeConsistentab0819")}
            description={t("tasks.inheritanceUnavailableOrUninformativeHighlySpecificPhenotype80def7")}
            score={criteria.other.selected === '5H' ? criteria.other.score : 0.15}
            checked={criteria.other.selected === '5H'}
            onChange={() => onChange({
              ...criteria,
              deNovo: { selected: null, score: 0 },
              inherited: { selected: null, score: 0 },
              other: { selected: '5H', score: 0.15 },
            })}
            hasRange
            range={{ min: 0, max: 0.30 }}
            onScoreChange={(score) => onChange({
              ...criteria,
              other: { selected: '5H', score },
            })}
          />
        </div>
      </div>
    </div>
  );
}
