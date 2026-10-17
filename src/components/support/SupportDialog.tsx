'use client';
import { SaaSSupportDialog } from './SaaSSupportDialog';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { Github } from 'lucide-react';
import { HoverHint } from '@/components/shared/HoverHint';

// Retain the component API for older entry points while replacing support UI.
export function SupportDialog({ trigger = 'icon', context = 'general' }: {
  trigger?: 'icon' | 'button';
  context?: 'general' | 'billing' | 'account';
}) {
  if (getRuntimeBackendFlavor() === 'squid') return <SaaSSupportDialog trigger={trigger} context={context} />;
  return <HoverHint content="GitHub"><a
    href="https://github.com/SchemaBio/YiJian"
    target="_blank" rel="noopener noreferrer" aria-label="GitHub"
    className="inline-flex items-center gap-2 rounded-md p-2 text-sm text-fg-muted hover:text-fg-default hover:bg-[var(--yj-panel-muted)] transition-colors"
  ><Github className="h-5 w-5" aria-hidden="true" />{trigger === 'button' && 'GitHub'}</a></HoverHint>;
}
