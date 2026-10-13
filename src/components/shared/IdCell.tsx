'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';


import * as React from 'react';
import { Tooltip } from '@schema/ui-kit';

interface IdCellProps {
  /** The full ID to display (truncated) and copy */
  id: string;
  /** Number of characters to show (default: 8) */
  truncateLength?: number;
  /** Display the complete UUID without truncation. */
  full?: boolean;
}

interface HoverTextProps {
  value: string;
  className?: string;
}

/** Truncated text with the same styled hover card used for UUIDs. */
export function HoverText({ value, className = '' }: HoverTextProps) {
  const t = useText();
  return (
    <Tooltip content={translateUI(value, t)} placement="top" variant="nav">
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
export function IdCell({ id, truncateLength = 8, full = false }: IdCellProps) {
  const t = useText();
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
    <Tooltip content={copyStatus === 'copied' ? t("common.taskIdCopiedd2e79a") : copyStatus === 'failed' ? t("common.copyFailedCheckClipboardPermissionsa47e63") : id} placement="top" variant="nav">
      <button
        type="button"
        aria-label={copyStatus === 'copied' ? t("common.idCopied7aaff6") : copyStatus === 'failed' ? t("common.copyFailedf2c6b5") : t("common.copyIdc6c5ce")}
        className={`whitespace-nowrap font-mono text-xs cursor-pointer ${copyStatus === 'copied' ? 'text-green-600' : copyStatus === 'failed' ? 'text-danger-fg' : 'text-accent-fg hover:underline'}`}
        onClick={handleClick}
      >
        {full ? id : id.substring(0, truncateLength)}
      </button>
    </Tooltip>
  );
}
