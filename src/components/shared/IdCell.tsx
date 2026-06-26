'use client';

import * as React from 'react';
import { Tooltip } from '@schema/ui-kit';

interface IdCellProps {
  /** The full ID to display (truncated) and copy */
  id: string;
  /** Number of characters to show (default: 8) */
  truncateLength?: number;
}

/**
 * UUID display component with click-to-copy functionality.
 * Shows truncated ID with tooltip showing full value.
 *
 * @example
 * <IdCell id="a1b2c3d4-e5f6-7890-abcd-ef1234567890" />
 */
export function IdCell({ id, truncateLength = 8 }: IdCellProps) {
  const [copied, setCopied] = React.useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip content={id} placement="top" variant="default">
      <span
        className={`font-mono text-xs cursor-pointer ${copied ? 'text-green-500' : 'text-accent-fg hover:underline'}`}
        onClick={handleClick}
      >
        {id.substring(0, truncateLength)}
      </span>
    </Tooltip>
  );
}
