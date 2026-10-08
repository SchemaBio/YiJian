'use client';
import { HoverHint } from '@/components/shared/HoverHint';


import { ExternalLink } from 'lucide-react';
import type { SNVIndel } from '../types';
import { variantResourceGroups } from '../utils/variant-resource-links';

/** Only explicit, user-initiated outbound navigation. No provider data is fetched. */
export function VariantResourceLinks({ variant, referenceGenome }: { variant: SNVIndel; referenceGenome?: string }) {
  const groups = variantResourceGroups(variant, referenceGenome);
  return <div className="yj-resource-groups">
    {groups.map(group => {
      const available = group.links.filter(link => link.href);
      const missing = group.links.filter(link => !link.href);
      return <div key={group.label}>
        <p className="mb-2 text-xs font-medium text-fg-muted">{group.label}</p>
        <div className="yj-resource-link-grid">{available.map(link => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="yj-resource-link"><span>{link.label}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>)}</div>
        {missing.length > 0 && <p className="mt-2 text-xs leading-relaxed text-fg-muted">未提供标识：{missing.map((link, index) => <HoverHint content={link.reason} key={link.label}><span key={link.label} >{index > 0 ? '、' : ''}{link.label}</span></HoverHint>)}</p>}
      </div>;
    })}
    <p className="text-xs leading-relaxed text-fg-muted">外部数据库仅供参考，注释不等同于本站判读结论。</p>
  </div>;
}
