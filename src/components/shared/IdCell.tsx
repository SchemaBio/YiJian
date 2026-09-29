'use client';

import * as React from 'react';
import { Tooltip } from '@schema/ui-kit';

interface IdCellProps {
  /** The full ID to display (truncated) and copy */
  id: string;
  /** Number of characters to show (default: 8) */
  truncateLength?: number;
}

interface HoverTextProps {
  value: string;
  className?: string;
}

/** Truncated text with the same styled hover card used for UUIDs. */
export function HoverText({ value, className = '' }: HoverTextProps) {
  return (
    <Tooltip content={value} placement="top" variant="default">
      <span className={`block truncate ${className}`}>{value}</span>
    </Tooltip>
  );
}

/**
 * UUID display component with click-to-copy functionality.
 * Shows truncated ID with tooltip showing full value.
 *
 * @example
 * <IdCell id="a1b2c3d4-e5f6-7890-abcd-ef1234567890" />
 */
export function IdCell({ id, truncateLength = 8 }: IdCellProps) {
  const [copyStatus, setCopyStatus] = React.useState<'idle' | 'copied' | 'failed'>('idle');

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
    window.setTimeout(() => setCopyStatus('idle'), 1800);
  };

  return (
    <Tooltip content={copyStatus === 'copied' ? '已复制任务编号' : copyStatus === 'failed' ? '复制失败，请检查剪贴板权限' : id} placement="top" variant="default">
      <button
        type="button"
        aria-label={copyStatus === 'copied' ? '已复制编号' : copyStatus === 'failed' ? '复制失败' : '复制编号'}
        className={`font-mono text-xs cursor-pointer ${copyStatus === 'copied' ? 'text-green-600' : copyStatus === 'failed' ? 'text-danger-fg' : 'text-accent-fg hover:underline'}`}
        onClick={handleClick}
      >
        {id.substring(0, truncateLength)}
      </button>
    </Tooltip>
  );
}
