import type { DataAsset } from './data-assets';

// Keep a pair adjacent, newest pair first, with R1 before R2. Do not depend on
// completion order, which changes when the two transfers finish independently.
export function sortPairedAssets(assets: DataAsset[]): DataAsset[] {
  const key = (asset: DataAsset) => asset.file_name.replace(/([._-])R?[12](?=([._-]|\.(?:fastq|fq)))/i, '$1read');
  const groups = new Map<string, DataAsset[]>();
  for (const asset of assets) {
    const group = ['read1', 'read2'].includes(asset.read_type) ? `${asset.internal_id ?? ''}/${key(asset)}` : asset.id;
    groups.set(group, [...(groups.get(group) ?? []), asset]);
  }
  return [...groups.values()]
    .sort((a, b) => Math.max(...b.map(x => Date.parse(x.created_at) || 0)) - Math.max(...a.map(x => Date.parse(x.created_at) || 0)))
    .flatMap(group => group.sort((a, b) => Number(a.read_type === 'read2') - Number(b.read_type === 'read2') || a.id.localeCompare(b.id)));
}
