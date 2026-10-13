'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';


import * as React from 'react';
import { Button as KitButton, type ButtonProps } from '@schema/ui-kit';
import { Plus, Pencil, Save, RefreshCw, RotateCcw, Play, Square, Clock, Trash2, X, Copy, Check, Upload, Download, BookOpen, CheckCircle2, LockKeyhole, UnlockKeyhole, Sparkles, ExternalLink, MoreHorizontal, Loader2, Eye, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { HoverHint } from './HoverHint';

export const ACTION_ICONS = {
  add: Plus, edit: Pencil, save: Save, refresh: RefreshCw, retry: RotateCcw,
  start: Play, stop: Square, wait: Clock, delete: Trash2, close: X,
  copy: Copy, copied: Check, upload: Upload, download: Download, export: Download,
  interpret: BookOpen, completed: CheckCircle2, lock: LockKeyhole, unlock: UnlockKeyhole,
  ai: Sparkles, external: ExternalLink, more: MoreHorizontal, view: Eye,
  previous: ChevronLeft, next: ChevronRight,
} satisfies Record<string, LucideIcon>;
export type ButtonAction = keyof typeof ACTION_ICONS;

export interface ActionButtonProps extends ButtonProps {
  action?: ButtonAction;
  loadingLabel?: string;
}

/** Thin UI Kit adapter: no business state or operation dispatch lives here. */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton({
  action, size = 'medium', loading = false, loadingLabel, disabled, children,
  leftIcon, rightIcon, iconOnly = false, className = '', type = 'button', variant = 'secondary', ...props
}, ref) {
  const Icon = action ? ACTION_ICONS[action] : undefined;
  const icon = loading ? <Loader2 aria-hidden="true" className="yj-button-spinner" /> : Icon ? <Icon aria-hidden="true" /> : leftIcon;
  return <KitButton {...props} ref={ref} type={type} variant={variant} size={size} iconOnly={iconOnly} data-action={action} data-icon-only={iconOnly || undefined}
    disabled={disabled || loading} aria-busy={loading || undefined}
    className={`yj-action-button ${size === 'small' ? 'yj-action-button-compact' : ''} ${className}`}
    leftIcon={icon} rightIcon={loading ? undefined : rightIcon}>
    {loadingLabel ? <span className="yj-loading-label"><span aria-hidden={loading || undefined} className={loading ? 'invisible' : undefined}>{children}</span><span aria-hidden={!loading || undefined} className={`yj-loading-label-active ${loading ? '' : 'invisible'}`}>{loadingLabel}</span></span> : children}
  </KitButton>;
});

export interface IconActionButtonProps extends Omit<ActionButtonProps, 'iconOnly' | 'children'> {
  label: string;
  hint?: React.ReactNode;
}
export const IconActionButton = React.forwardRef<HTMLButtonElement, IconActionButtonProps>(function IconActionButton({ label, hint, ...props }, ref) {
  const t = useText();
  const descriptionID = React.useId();
  // Keep the structure stable when loading: focus, refs and popover anchors survive.
  // The wrapper exposes disabled reasons on hover; the description is also readable
  // without requiring a screen-reader user to open the visual tooltip.
  return <HoverHint content={translateUI(hint ?? label, t)}><span className="yj-icon-button-hint">
    <ActionButton {...props} ref={ref} iconOnly aria-label={translateUI(label, t)} aria-describedby={[props['aria-describedby'], descriptionID].filter(Boolean).join(' ')} />
    <span id={descriptionID} className="sr-only">{hint ?? label}</span>
  </span></HoverHint>;
});
