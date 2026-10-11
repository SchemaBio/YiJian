'use client';

import * as React from 'react';
import Link from 'next/link';
import { ActionButton, ACTION_ICONS, type ButtonAction, type ActionButtonProps } from './ActionButton';
import { HoverHint } from './HoverHint';

export function TableActions({ children }: { children: React.ReactNode }) {
  return <div role="group" aria-label="行操作" className="yj-table-actions" onClick={event => event.stopPropagation()}>{children}</div>;
}

interface TableActionProps extends Omit<ActionButtonProps, 'children' | 'size' | 'variant' | 'iconOnly'> {
  label: string;
  hint?: string;
  tone?: 'default' | 'primary' | 'danger';
}

export function TableAction({ label, hint, tone = 'default', className = '', ...props }: TableActionProps) {
  const descriptionId = React.useId();
  return <HoverHint content={hint ?? label}><span className="yj-table-action-hint">
    <ActionButton {...props} size="small" variant="ghost" aria-label={props['aria-label'] ?? label}
      aria-describedby={[props['aria-describedby'], hint ? descriptionId : undefined].filter(Boolean).join(' ') || undefined}
      className={`yj-table-action yj-table-action-${tone} ${className}`}>{label}</ActionButton>
    {hint && <span id={descriptionId} className="sr-only">{hint}</span>}
  </span></HoverHint>;
}

export function TableActionLink({ label, action = 'view', className = '', ...props }: Omit<React.ComponentProps<typeof Link>, 'children'> & { label: string; action?: ButtonAction }) {
  const Icon = ACTION_ICONS[action];
  return <Link {...props} className={`yj-action-button yj-action-button-compact yj-table-action yj-table-action-default inline-flex items-center justify-center ${className}`}>
    <span><Icon aria-hidden="true" />{label}</span>
  </Link>;
}
