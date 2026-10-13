'use client';
import { useText } from '@/i18n/useText';
import { translateUI } from '@/i18n/text';



import { ExternalLink } from 'lucide-react';
import type { SNVIndel } from '../types';
import { variantResourceGroups } from '../utils/variant-resource-links';

/** Only explicit, user-initiated outbound navigation. No provider data is fetched. */
export function VariantResourceLinks({ variant, referenceGenome }: { variant: SNVIndel; referenceGenome?: string }) {
  const t = useText();
  const groups = variantResourceGroups(variant, referenceGenome);
  return <div className="yj-resource-groups">
    {groups.map(group => {
      const available = group.links.filter(link => link.href);
      if (available.length === 0) return null;
      return <div key={group.label}>
        <p className="mb-2 text-xs font-medium text-fg-muted">{translateUI(group.label, t)}</p>
        <div className="yj-resource-link-grid">{available.map(link => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="yj-resource-link"><span>{translateUI(link.label, t)}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>)}</div>
      </div>;
    })}
    <p className="text-xs leading-relaxed text-fg-muted">{t("tasks.externalDatabasesAreReferenceResourcesAnnotationsAree1f593")}</p>
  </div>;
}
