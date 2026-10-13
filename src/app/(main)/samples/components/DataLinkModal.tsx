'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';

import { Database, File, Link2, Link2Off, Loader2 } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import { bindSampleDataAssets, clearSampleMatchedPair, getSampleDataLink } from '@/lib/samples';
import type { Sample } from '../types';

interface DataLinkModalProps {
  open: boolean;
  sample: Sample | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}

function formatBytes(bytes: number, t: TextTranslator = chineseText): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return t("samples.unknownSize4f6367");
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${formatNumericString((bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0), t.locale)} ${units[index]}`;
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
  const t = useText();
  const selected = assets.find((asset) => asset.id === value);

  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-xs font-medium text-fg-muted" htmlFor={`sample-${label.toLowerCase()}-asset`}>
        {label}
      </label>
      <select
        id={`sample-${label.toLowerCase()}-asset`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-bg)] px-3 text-sm text-fg-default outline-none transition-colors focus:border-accent-emphasis focus:ring-2 focus:ring-accent-muted"
      >
        <option value="">{t("samples.select064c9b")}{label} {t("samples.file58d713")}</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.file_name} · {formatBytes(asset.file_size, t)} · {asset.id.slice(0, 8)}
          </option>
        ))}
      </select>
      <div className="h-14 rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] px-3 py-2">
        {selected ? (
          <div className="flex min-w-0 items-center gap-2">
            <File className="h-4 w-4 shrink-0 text-accent-fg" />
            <div className="min-w-0">
              <HoverHint content={selected.file_name}><p className="truncate text-xs font-medium text-fg-default" >{selected.file_name}</p></HoverHint>
              <p className="mt-0.5 text-[11px] text-fg-muted">{formatBytes(selected.file_size, t)} · UUID {selected.id.slice(0, 8)}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs leading-9 text-fg-muted">{t("samples.noFileSelecteddee789")}</p>
        )}
      </div>
    </div>
  );
}

export function DataLinkModal({ open, sample, onOpenChange, onSaved }: DataLinkModalProps) {
  const t = useText();
  const [assets, setAssets] = React.useState<DataAsset[]>([]);
  const [read1Id, setRead1Id] = React.useState('');
  const [read2Id, setRead2Id] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const [unavailable, setUnavailable] = React.useState(false);
  const usableAssets = assets.filter(asset => asset.status === 'completed' && (!asset.expires_at || new Date(asset.expires_at).getTime() > Date.now()));
  const read1Assets = usableAssets.filter(asset => asset.read_type === 'read1');
  const read2Assets = usableAssets.filter(asset => asset.read_type === 'read2');

  React.useEffect(() => {
    if (!open || !sample) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setAssets([]);
    setUnavailable(false);
    setRead1Id('');
    setRead2Id('');
    const loadAssets = async () => {
      const files: DataAsset[] = [];
      let page = 1, totalPages = 1;
      do {
        const result = await listDataAssets('', { status: 'completed', page, signal: controller.signal });
        files.push(...(result.items ?? []));
        totalPages = result.total_pages || 1;
        page++;
      } while (page <= totalPages && !controller.signal.aborted);
      return files;
    };
    Promise.all([loadAssets(), getSampleDataLink(sample.id, controller.signal)])
      .then(([files, link]) => {
        if (cancelled) return;
        // Current files remain visible even if they are outside the list page.
        const current = [link.read1, link.read2].filter((file): file is DataAsset => !!file);
        setAssets(Array.from(new Map([...files, ...current].map(file => [file.id, file])).values()));
        setRead1Id(link.read1?.id || '');
        setRead2Id(link.read2?.id || '');
        setUnavailable(link.unavailable);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? errorText(err, t) : t("data.unableToLoadDataAssets555043"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
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
      setError(err instanceof Error ? errorText(err, t) : t("samples.unableToSaveDataAssociation29b5ba"));
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
      setError(err instanceof Error ? errorText(err, t) : t("samples.unableToRemoveDataAssociationddb162"));
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
      title={t("samples.linkSequencingData7a6f18")}
      size="large"
      footer={
        <>
          {sample?.matchedPair ? (
            <Button variant="secondary" disabled={saving} leftIcon={<Link2Off className="h-4 w-4" />} onClick={() => void handleClear()}>
              {t("samples.unlink25a139")}</Button>
          ) : <span className="flex-1" />}
          <Button variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>{t("admin.cancel4d0b46")}</Button>
          <Button loading={saving} loadingLabel={t("samples.savinga032e8")} action="save"
            variant="primary"
            disabled={saving || loading || !!error || !read1Assets.some(asset => asset.id === read1Id) || !read2Assets.some(asset => asset.id === read2Id)}
            leftIcon={<Link2 className="h-4 w-4" />}
            onClick={() => void handleSave()}
          >
            {t("samples.saveManualAssociationba6a21")}</Button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <ModalSectionHeading
            icon={<Database className="h-4 w-4" />}
            title={t("samples.selectSequencingData7a7f3a")}
            description={t("samples.selectReadAndReadForSampleAutomatic18217a", {p0: String(sample?.internalId || '-')})}
          />

        {loading ? (
          <div className="flex h-36 items-center justify-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("samples.loadingDataCenterFilesfdd84b")}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AssetSelect label="Read1" value={read1Id} assets={read1Assets} onChange={setRead1Id} />
            <AssetSelect label="Read2" value={read2Id} assets={read2Assets} onChange={setRead2Id} />
          </div>
        )}

        {!loading && (read1Assets.length === 0 || read2Assets.length === 0) && (
          <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
            {t("samples.thisOrganizationHasNoCompleteAvailableRead4640e8")}</div>
        )}
        {!loading && unavailable && <p role="status" className="rounded-md border border-warning-muted bg-warning-subtle px-3 py-2 text-xs text-warning-fg">{t("samples.previouslyLinkedFilesExpiredOrAreInaccessible79991c")}</p>}
        {error && (
          <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{error}</div>
        )}
        </section>
      </div>
    </AppModal>
  );
}
