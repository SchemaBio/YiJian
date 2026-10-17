'use client';
﻿
import { useBusinessPermissions } from '@/components/providers/BusinessPermissionProvider';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';

import { useInterpretationReadOnly } from './InterpretationLock';

import * as React from 'react';
import { Pin, FileCheck2 } from 'lucide-react';
import { Tooltip } from '@schema/ui-kit';

interface ReviewCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  source?: 'automatic' | 'manual';
  reasons?: string[];
}

/**
 * 置顶标记。置顶和取消都会写入 Octopus 的不可变审计事件。
 */
export function PinCheckbox({ checked, onChange, disabled, source, reasons }: ReviewCheckboxProps) {
  const t = useText();
  reasons = reasons?.map(reason => translateUI(reason, t));
  const { hasPermission } = useBusinessPermissions();
  const noPermission = !hasPermission('interpretation_reports.manage');
  const readOnly = useInterpretationReadOnly();
  disabled = disabled || readOnly;
  const tooltip = noPermission ? t('permissions.denied') : readOnly ? t("tasks.interpretationIsCompleteReopenItFirsta9331f") : checked ? t("tasks.clickToUnpinbda191", {p0: String(source === 'automatic' ? t('系统自动置顶：{p0}{p1}', {p0:reasons?.join('；')||t("display.evidenceSupportedKeyCandidate43d43a"), p1:''}) : t("display.keyLocusPinneda50ba8"))}) : t("tasks.clickToPinImportantLocus56c657", {p0: String(reasons?.length?t("display.initialAssessment325903")+reasons.join('；'):'')});

  return (
    <Tooltip content={translateUI(tooltip, t)} placement="top" variant="nav">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        disabled={disabled}
        className={`
          p-1 rounded transition-colors
          ${checked
            ? 'text-success-fg'
            : 'text-fg-muted hover:text-fg-default hover:bg-canvas-subtle'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        data-result-mark="pin"
        aria-label={checked ? t("tasks.unpincfb5cd") : t("tasks.pinImportantLocus904270")}
        aria-pressed={checked}
      >
        <Pin className={`w-5 h-5 ${checked ? 'fill-success-subtle' : ''}`} />
      </button>
    </Tooltip>
  );
}

/**
 * 关注标记。
 */
export function FocusCheckbox({ checked, onChange, disabled }: ReviewCheckboxProps) {
  const t = useText();
  const { hasPermission } = useBusinessPermissions();
  const noPermission = !hasPermission('interpretation_reports.manage');
  const readOnly = useInterpretationReadOnly();
  disabled = disabled || readOnly;
  const tooltip = noPermission ? t('permissions.denied') : readOnly ? t("tasks.interpretationIsCompleteReopenItFirsta9331f") : checked
    ? t("tasks.selectedForFocusClickToWithdrawThis7e81d6")
    : t("tasks.clickToIncludeInFocusd66934");

  return (
    <Tooltip content={translateUI(tooltip, t)} placement="top" variant="nav">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        disabled={disabled}
        className={`
          p-1 rounded transition-colors
          ${checked
            ? 'text-accent-fg'
            : 'text-fg-muted hover:text-fg-default hover:bg-canvas-subtle'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        data-result-mark="focus"
        aria-label={checked ? t("history.withdrawFromFocus41c14c") : t("history.includeInFocus233738")}
        aria-pressed={checked}
      >
        <FileCheck2 className={`w-5 h-5 ${checked ? 'fill-accent-subtle' : ''}`} />
      </button>
    </Tooltip>
  );
}

/**
 * 置顶和关注状态的列头。
 */
export function PinColumnHeader() {
  const t = useText();
  return t("tasks.pin7bcf18");
}

export function FocusColumnHeader() {
  const t = useText();
  return t("tasks.focus6c4cc0");
}
