import type { DataAsset } from './data-assets';

export interface CNVSamplePair {
  id: string;
  label: string;
  read1: DataAsset;
  read2: DataAsset;
}

function filenameKey(asset: DataAsset): string | null {
  const stem = asset.file_name.replace(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}_/i, '').replace(/\.(fastq|fq)(\.gz)?$/i, '');
  // Preserve lane/chunk identifiers so files from different lanes cannot pair.
  const match = stem.match(/^(.+)[._-]R([12])((?:_[\d]{3})?)$/i) ?? stem.match(/^(.+)[._-]([12])$/);
  if (!match || match[2] !== (asset.read_type === 'read1' ? '1' : '2')) return null;
  return `${match[1]}${match[3] || ''}`;
}

/** Only unique, complete pairs are selectable; never guess between duplicates. */
export function buildCNVSamplePairs(assets: DataAsset[], now = Date.now()): CNVSamplePair[] {
  const groups = new Map<string, { label: string; read1: DataAsset[]; read2: DataAsset[] }>();
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    if (asset.status !== 'completed' || (asset.read_type !== 'read1' && asset.read_type !== 'read2')) continue;
    if (asset.expires_at && !(Date.parse(asset.expires_at) > now)) continue;
    const internalID = asset.internal_id?.trim();
    const label = internalID || filenameKey(asset);
    if (!label) continue;
    const key = `${internalID ? 'id' : 'file'}:${label.toLowerCase()}`;
    const group = groups.get(key) ?? { label, read1: [], read2: [] };
    group[asset.read_type].push(asset);
    groups.set(key, group);
  }
  return Array.from(groups.values()).flatMap(group => {
    if (group.read1.length !== 1 || group.read2.length !== 1) return [];
    const read1 = group.read1[0], read2 = group.read2[0];
    return [{ id: `${read1.id}:${read2.id}`, label: group.label, read1, read2 }];
  }).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
}

export function selectedCNVSamplePairs(assets: DataAsset[], ids: string[]): CNVSamplePair[] {
  const pairs = new Map(buildCNVSamplePairs(assets).map(pair => [pair.id, pair]));
  return ids.map(id => {
    const pair = pairs.get(id);
    if (!pair) throw new Error('所选样本数据已不可用，请重新选择完整的样本组。');
    return pair;
  });
}
