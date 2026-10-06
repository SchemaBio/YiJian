'use client';

import { ExternalLink } from 'lucide-react';
import type { SNVIndel } from '../types';

/** Only explicit, user-initiated outbound navigation. No provider data is fetched. */
export function VariantResourceLinks({ variant, referenceGenome }: { variant: SNVIndel; referenceGenome?: string }) {
  const reference = referenceGenome === 'hg19' || referenceGenome === 'hg38' ? referenceGenome : undefined;
  const chromosome = variant.chromosome.replace(/^chr/i, '');
  const compatible = /^(?:[1-9]|1[0-9]|2[0-2]|X|Y|M|MT)$/i.test(chromosome)
    && Number.isSafeInteger(variant.position) && variant.position > 0
    && /^[ACGTN]+$/i.test(variant.ref) && /^[ACGTN]+$/i.test(variant.alt);
  const varsome = reference && compatible
    ? `https://varsome.com/variant/${reference}/${encodeURIComponent(`${variant.chromosome}:${variant.position}:${variant.ref}:${variant.alt}`)}` : undefined;
  const rs = /^rs[0-9]+$/i.test(variant.rsId ?? '') ? variant.rsId : undefined;
  const links = [
    { label: 'VarSome', href: varsome },
    { label: 'ClinVar', href: rs ? `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(rs)}` : undefined },
    { label: 'dbSNP', href: rs ? `https://www.ncbi.nlm.nih.gov/snp/${rs}` : undefined },
  ];
  return <div className="rounded-lg bg-canvas-subtle p-3">
    <div className="flex flex-wrap gap-2">{links.map(link => link.href
      ? <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-flex items-center gap-1 rounded-md border border-border-default bg-canvas-default px-2 py-1 text-xs text-accent-fg hover:bg-accent-subtle">{link.label}<ExternalLink className="h-3 w-3" /></a>
      : <span key={link.label} title={link.label === 'VarSome' ? '需要明确的 hg19/hg38 参考和兼容变异坐标' : '未提供可检索的 dbSNP 标识'} className="rounded-md border border-border-default px-2 py-1 text-xs text-fg-muted">{link.label} · 暂不可用</span>)}

    </div>
    <p className="mt-2 text-xs text-fg-muted">点击将把变异坐标或公开标识传给外部网站；不会传递样本信息。外部注释不等同于本站判读结论。</p>
  </div>;
}
