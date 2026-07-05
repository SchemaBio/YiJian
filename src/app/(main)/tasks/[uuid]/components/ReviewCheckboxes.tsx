'use client';

import * as React from 'react';
import { CheckCircle2, FileCheck2 } from 'lucide-react';
import { Tooltip } from '@schema/ui-kit';

interface ReviewCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * 审核标记。
 *
 * Octopus 当前的 review/report 接口只支持把状态置为 true，
 * 不支持取消。因此组件在已标记状态下不再触发 onChange(false)，
 * 避免前端乐观展示一个后端无法持久化的 false 状态。
 */
export function ReviewCheckbox({ checked, onChange, disabled }: ReviewCheckboxProps) {
  const tooltip = checked ? '已审核；当前后端不支持在此取消审核' : '点击标记为已审核';

  return (
    <Tooltip content={tooltip} placement="top" variant="nav">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!checked) {
            onChange(true);
          }
        }}
        disabled={disabled}
        className={`
          p-1 rounded transition-colors
          ${checked
            ? 'text-success-fg'
            : 'text-fg-muted hover:text-fg-default hover:bg-canvas-subtle'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : checked ? 'cursor-default' : 'cursor-pointer'}
        `}
        aria-label={checked ? '已审核' : '标记为已审核'}
        aria-pressed={checked}
      >
        <CheckCircle2 className={`w-5 h-5 ${checked ? 'fill-success-subtle' : ''}`} />
      </button>
    </Tooltip>
  );
}

/**
 * 回报标记。
 */
export function ReportCheckbox({ checked, onChange, disabled }: ReviewCheckboxProps) {
  const tooltip = checked ? '已回报；当前后端不支持在此取消回报' : '点击标记为已回报';

  return (
    <Tooltip content={tooltip} placement="top" variant="nav">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!checked) {
            onChange(true);
          }
        }}
        disabled={disabled}
        className={`
          p-1 rounded transition-colors
          ${checked
            ? 'text-accent-fg'
            : 'text-fg-muted hover:text-fg-default hover:bg-canvas-subtle'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : checked ? 'cursor-default' : 'cursor-pointer'}
        `}
        aria-label={checked ? '已回报' : '标记为已回报'}
        aria-pressed={checked}
      >
        <FileCheck2 className={`w-5 h-5 ${checked ? 'fill-accent-subtle' : ''}`} />
      </button>
    </Tooltip>
  );
}

/**
 * 审核和回报状态的列头。
 */
export function ReviewColumnHeader() {
  return '审核';
}

export function ReportColumnHeader() {
  return '回报';
}
