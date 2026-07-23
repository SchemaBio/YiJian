'use client';

import * as React from 'react';
import { Button } from '@schema/ui-kit';
import { Database, File, Link2, Link2Off, Loader2 } from 'lucide-react';
import { AppModal } from '@/components/shared';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import { bindSampleDataAssets, clearSampleMatchedPair } from '@/lib/samples';
import type { Sample } from '../types';

interface DataLinkModalProps {
  open: boolean;
  sample: Sample | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '大小未知';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function AssetSelect({
  label,
  value,
  assets,
  onChange,
}: {
  label: 'Read1' | 'Read2';
  value: string;
  assets: DataAsset[];
  onChange: (value: string) => void;
}) {
  const selected = assets.find((asset) => asset.id === value);

  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-sm font-semibold text-[var(--yj-text-strong)]" htmlFor={`sample-${label.toLowerCase()}-asset`}>
        {label}
      </label>
      <select
        id={`sample-${label.toLowerCase()}-asset`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-bg)] px-3 text-sm text-fg-default outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">请选择 {label} 文件</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.file_name} · {formatBytes(asset.file_size)} · {asset.id.slice(0, 8)}
          </option>
        ))}
      </select>
      <div className="h-14 rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] px-3 py-2">
        {selected ? (
          <div className="flex min-w-0 items-center gap-2">
            <File className="h-4 w-4 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-fg-default" title={selected.file_name}>{selected.file_name}</p>
              <p className="mt-0.5 text-[11px] text-fg-muted">{formatBytes(selected.file_size)} · UUID {selected.id.slice(0, 8)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs leading-9 text-fg-muted">尚未选择文件</p>
        )}
      </div>
    </div>
  );
}

export function DataLinkModal({ open, sample, onOpenChange, onSaved }: DataLinkModalProps) {
  const [assets, setAssets] = React.useState<DataAsset[]>([]);
  const [read1Id, setRead1Id] = React.useState('');
  const [read2Id, setRead2Id] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const read1Assets = assets.filter((asset) => asset.status === 'completed' && asset.read_type === 'read1');
  const read2Assets = assets.filter((asset) => asset.status === 'completed' && asset.read_type === 'read2');

  React.useEffect(() => {
    if (!open || !sample) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setRead1Id('');
    setRead2Id('');
    listDataAssets()
      .then((result) => {
        if (!cancelled) setAssets(result.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载数据资产失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, sample]);

  const handleSave = async () => {
    if (!sample || !read1Id || !read2Id || saving) return;
    setSaving(true);
    setError('');
    try {
      await bindSampleDataAssets(sample.id, read1Id, read2Id);
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存数据关联失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!sample || saving) return;
    setSaving(true);
    setError('');
    try {
      await clearSampleMatchedPair(sample.id);
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '解除数据关联失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving) onOpenChange(nextOpen);
      }}
      title="关联测序数据"
      size="large"
      footer={
        <>
          {sample?.matchedPair ? (
            <Button variant="secondary" disabled={saving} leftIcon={<Link2Off className="h-4 w-4" />} onClick={() => void handleClear()}>
              解除关联
            </Button>
          ) : <span className="flex-1" />}
          <Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>取消</Button>
          <Button
            variant="primary"
            disabled={saving || loading || !read1Id || !read2Id}
            leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            onClick={() => void handleSave()}
          >
            {saving ? '保存中' : '保存手动关联'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-900">样本 {sample?.internalId || '-'}</p>
            <p className="mt-1 text-xs leading-5 text-blue-700">
              从当前组织的数据中心分别选择 Read1 和 Read2。保存后记为手动关联，后台自动匹配不会覆盖此选择。
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-36 items-center justify-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载数据中心文件
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AssetSelect label="Read1" value={read1Id} assets={read1Assets} onChange={setRead1Id} />
            <AssetSelect label="Read2" value={read2Id} assets={read2Assets} onChange={setRead2Id} />
          </div>
        )}

        {!loading && (read1Assets.length === 0 || read2Assets.length === 0) && (
          <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
            当前组织没有完整的可用 Read1/Read2 文件，请先在数据中心上传并等待文件就绪。
          </div>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
      </div>
    </AppModal>
  );
}
