'use client';

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
  const tooltip = checked ? `${source === 'automatic' ? `系统自动置顶：${reasons?.join('；')||'证据支持的重要候选'}` : '重要位点已置顶'}；点击取消置顶` : `点击置顶重要位点${reasons?.length?'；初评：'+reasons.join('；'):''}`;

  return (
    <Tooltip content={tooltip} placement="top" variant="nav">
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
        aria-label={checked ? '取消置顶' : '置顶重要位点'}
        aria-pressed={checked}
      >
        <Pin className={`w-5 h-5 ${checked ? 'fill-success-subtle' : ''}`} />
      </button>
    </Tooltip>
  );
}

/**
 * 回报标记。
 */
export function ReportCheckbox({ checked, onChange, disabled }: ReviewCheckboxProps) {
  const tooltip = checked
    ? '已标记回报；点击可撤回，此标记不代表正式报告已签发'
    : '点击选入回报';

  return (
    <Tooltip content={tooltip} placement="top" variant="nav">
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
        data-result-mark="report"
        aria-label={checked ? '撤回回报' : '选入回报'}
        aria-pressed={checked}
      >
        <FileCheck2 className={`w-5 h-5 ${checked ? 'fill-accent-subtle' : ''}`} />
      </button>
    </Tooltip>
  );
}

/**
 * 置顶和回报状态的列头。
 */
export function PinColumnHeader() {
  return '置顶';
}

export function ReportColumnHeader() {
  return '回报';
}
