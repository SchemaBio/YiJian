'use client';

import { ExternalLink } from 'lucide-react';
import type { SNVIndel } from '../types';
import { variantResourceGroups } from '../utils/variant-resource-links';

/** Only explicit, user-initiated outbound navigation. No provider data is fetched. */
export function VariantResourceLinks({ variant, referenceGenome }: { variant: SNVIndel; referenceGenome?: string }) {
  const groups = variantResourceGroups(variant, referenceGenome);
  return <div className="space-y-3 rounded-lg bg-canvas-subtle p-3">
    {groups.map(group => <div key={group.label}>
      <p className="mb-1.5 text-xs font-medium text-fg-muted">{group.label}</p>
      <div className="flex flex-wrap gap-2">{group.links.map(link => link.href
        ? <a key={link.label} href={link.href} title={link.label} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex max-w-full items-center gap-1 rounded-md border border-border-default bg-canvas-default px-2 py-1 text-xs text-accent-fg hover:bg-accent-subtle"><span className="break-all">{link.label}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>
        : <span key={link.label} title={link.reason} className="rounded-md border border-border-default px-2 py-1 text-xs text-fg-muted">{link.label} · 未提供</span>)}
      </div>
    </div>)}
    <p className="text-xs text-fg-muted">点击将把变异坐标、基因或公开标识传给外部网站；不会传递样本信息。外部注释不等同于本站判读结论。</p>
  </div>;
}
