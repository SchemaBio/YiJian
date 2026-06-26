'use client';

import * as React from 'react';
import { Tag } from '@schema/ui-kit';
import type { TagVariant } from '@schema/ui-kit';

interface StatusConfig {
  label: string;
  variant: TagVariant;
}

interface StatusTagProps {
  /** Status value to display */
  status: string;
  /** Configuration mapping status values to display config */
  config: Record<string, StatusConfig>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Configurable status badge component.
 * Maps status values to display labels and visual variants.
 *
 * @example
 * const statusConfig = {
 *   running: { label: '运行中', variant: 'info' },
 *   completed: { label: '已完成', variant: 'success' },
 *   failed: { label: '失败', variant: 'danger' },
 * };
 *
 * <StatusTag status="running" config={statusConfig} />
 */
export function StatusTag({ status, config, className }: StatusTagProps) {
  const statusConfig = config[status];
  if (!statusConfig) {
    return null;
  }

  return (
    <Tag variant={statusConfig.variant} className={className}>
      {statusConfig.label}
    </Tag>
  );
}

interface StatusDotProps {
  /** Status value to display */
  status: string;
  /** Configuration mapping status values to color classes */
  config: Record<string, string>;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status dot indicator component.
 * Shows a colored dot based on status value.
 *
 * @example
 * const dotColors = {
 *   running: 'bg-accent-emphasis',
 *   completed: 'bg-success-emphasis',
 *   failed: 'bg-danger-emphasis',
 * };
 *
 * <StatusDot status="running" config={dotColors} />
 */
export function StatusDot({ status, config, className }: StatusDotProps) {
  const colorClass = config[status];
  if (!colorClass) {
    return null;
  }

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colorClass} ${className || ''}`} />
  );
}
