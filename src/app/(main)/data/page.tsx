'use client';

import * as React from 'react';
import { Button, Checkbox, Input } from '@schema/ui-kit';
import {
  AlertTriangle, CheckCircle2, Cloud, Database, Download, HardDrive,
  Loader2, Pencil, RefreshCw, Search, Trash2, Upload, XCircle,
} from 'lucide-react';
import {
  deleteDataAsset, downloadDataAsset, getDataCenterConfig, getUploadStorageStats, listDataAssets,
  retryDataAsset, updateDataAsset, uploadDataFiles, type DataAsset, type DataCenterConfig,
  type UploadFileProgress, type UploadStorageStats,
} from '@/lib/data-assets';
import { AppModal, HoverText, IdCell, MetricTile, ModalSectionHeading } from '@/components/shared';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
}

const statusMeta = {
  pending: { label: '待上传', className: 'bg-warning-subtle text-warning-fg', icon: Loader2 },
  uploading: { label: '上传中', className: 'bg-accent-subtle text-accent-fg', icon: Loader2 },
  completed: { label: '可用', className: 'bg-success-subtle text-success-fg', icon: CheckCircle2 },
  failed: { label: '失败', className: 'bg-danger-subtle text-danger-fg', icon: XCircle },
  missing: { label: '文件缺失', className: 'bg-danger-subtle text-danger-fg', icon: AlertTriangle },
  deleted: { label: '已删除', className: 'bg-canvas-subtle text-fg-muted', icon: Trash2 },
} as const;

function assetStatus(asset: DataAsset, progress?: number) {
  const meta = statusMeta[asset.status] ?? statusMeta.failed;
  const Icon = meta.icon;
  const isActiveUpload = progress !== undefined && progress < 100;
  return (
    <div className="min-w-[112px]">
      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${isActiveUpload ? statusMeta.uploading.className : meta.className}`}>
        <Icon className={`h-3.5 w-3.5 ${isActiveUpload || asset.status === 'uploading' ? 'animate-spin' : ''}`} />
        {isActiveUpload ? `上传中 ${progress}%` : meta.label}
      </span>
      {isActiveUpload && <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-canvas-subtle"><div className="h-full bg-accent-emphasis transition-[width]" style={{ width: `${progress}%` }} /></div>}
    </div>
  );
}

export default function DataCenterPage() {
  const { currentOrg } = useAuth();
  const [assets, setAssets] = React.useState<DataAsset[]>([]);
  const [config, setConfig] = React.useState<DataCenterConfig | null>(null);
  const [storageStats, setStorageStats] = React.useState<UploadStorageStats | null>(null);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [read1, setRead1] = React.useState<File | null>(null);
  const [read2, setRead2] = React.useState<File | null>(null);
  const [internalId, setInternalId] = React.useState('');
  const [uploading, setUploading] = React.useState(false);
  const [uploadPolicyAcknowledged, setUploadPolicyAcknowledged] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [fileProgress, setFileProgress] = React.useState<Record<string, number>>({});
  const [deleting, setDeleting] = React.useState<DataAsset | null>(null);
  const [editing, setEditing] = React.useState<DataAsset | null>(null);
  const [editingInternalId, setEditingInternalId] = React.useState('');
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const retryInputRef = React.useRef<HTMLInputElement | null>(null);
  const retryAssetIdRef = React.useRef<string | null>(null);
  const loadRequestRef = React.useRef(0);

  const load = React.useCallback(async (query = '') => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError('');
    try {
      const [assetResult, configResult, statsResult] = await Promise.all([
        listDataAssets(query),
        getDataCenterConfig(),
        getUploadStorageStats(),
      ]);
      if (requestId !== loadRequestRef.current) return;
      setAssets(assetResult.items ?? []);
      setConfig(configResult);
      setStorageStats(statsResult);
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setError(err instanceof Error ? err.message : '加载数据资产失败');
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(''); }, [load]);

  React.useEffect(() => {
    if (!uploading) return;
    const warnAboutActiveUpload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnAboutActiveUpload);
    return () => window.removeEventListener('beforeunload', warnAboutActiveUpload);
  }, [uploading]);

  const totalBytes = storageStats?.total_bytes ?? 0;
  const readyCount = React.useMemo(() => assets.filter((asset) => asset.status === 'completed').length, [assets]);
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const storageQuotaBytes = isSaaS && (currentOrg?.storageQuotaBytes ?? 0) > 0
    ? currentOrg?.storageQuotaBytes ?? null
    : null;
  const storageQuotaLabel = storageQuotaBytes ? formatBytes(storageQuotaBytes) : '无限制';
  const storageQuotaReached = storageQuotaBytes !== null && totalBytes >= storageQuotaBytes;
  const storageUsagePercent = storageQuotaBytes === null ? null : (totalBytes / storageQuotaBytes) * 100;
  const storageUsageTone = storageUsagePercent === null
    ? null
    : storageUsagePercent >= 90
      ? 'danger' as const
      : storageUsagePercent >= 60
        ? 'warning' as const
        : 'safe' as const;

  const handleDownload = async (asset: DataAsset) => {
    if (!config?.download_allowed) return;
    setError('');
    try {
      const result = await downloadDataAsset(asset.id, asset.file_name);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载失败');
    }
  };

  const handleUpload = async () => {
    if (!read1 && !read2) { setError('请至少选择一个 Read1 或 Read2 文件'); return; }
    if (config?.temporary && !uploadPolicyAcknowledged) { setError('请先勾选“我已确认”'); return; }
    const oversizedFile = [read1, read2].find((file) => file && config?.temporary && config.max_file_size_bytes > 0 && file.size > config.max_file_size_bytes);
    if (oversizedFile) { setError(`${oversizedFile.name} 超过 SaaS 单文件 20 GB 限制`); return; }
    const selectedBytes = (read1?.size ?? 0) + (read2?.size ?? 0);
    if (storageQuotaBytes !== null && totalBytes + selectedBytes > storageQuotaBytes) {
      setError(`所选文件将超过存储总容量（已用 ${formatBytes(totalBytes)}，总容量 ${formatBytes(storageQuotaBytes)}）`);
      return;
    }
    setUploading(true);
    setProgress(0);
    setError('');
    try {
      await uploadDataFiles(read1, read2, uploadPolicyAcknowledged, internalId, setProgress, {
        onStarted: (files: UploadFileProgress[]) => {
          setFileProgress(Object.fromEntries(files.map((file) => [file.fileId, 0])));
          void load(search);
        },
        onFileProgress: (file: UploadFileProgress) => {
          setFileProgress((current) => ({ ...current, [file.fileId]: file.progress }));
        },
      });
      setProgress(100);
      setUploadOpen(false);
      setRead1(null);
      setRead2(null);
      setInternalId('');
      setUploadPolicyAcknowledged(false);
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      setFileProgress({});
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setError('');
    try {
      await deleteDataAsset(deleting.id);
      setDeleting(null);
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setError('');
    try {
      await updateDataAsset(editing.id, editingInternalId);
      setEditing(null);
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新内部编号失败');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRetryFile = async (file: File | undefined) => {
    const asset = assets.find((item) => item.id === retryAssetIdRef.current);
    if (!asset || !file) return;
    if (file.name !== asset.file_name) {
      setError(`请选择原文件：${asset.file_name}`);
      retryAssetIdRef.current = null;
      if (retryInputRef.current) retryInputRef.current.value = '';
      return;
    }
    setRetryingId(asset.id);
    setError('');
    try {
      await retryDataAsset(asset.id, file, (value) => setFileProgress((current) => ({ ...current, [asset.id]: value })));
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试上传失败');
    } finally {
      setRetryingId(null);
      retryAssetIdRef.current = null;
      if (retryInputRef.current) retryInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full overflow-auto p-6 xl:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="yj-page-title">数据中心</h2>
          <p className="mt-2 text-sm text-fg-muted">管理组织内可用于样本匹配和分析的测序数据</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile label="数据资产" value={assets.length} icon={<Database className="h-4 w-4" />} />
          <MetricTile label="可用文件" value={readyCount} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
          <MetricTile
            label="占用空间 / 总容量"
            value={`${formatBytes(totalBytes)} / ${storageQuotaLabel}`}
            icon={<HardDrive className="h-4 w-4" />}
            tone="info"
            capacityFill={storageUsagePercent !== null && storageUsageTone
              ? { percent: storageUsagePercent, tone: storageUsageTone }
              : undefined}
          />
        </div>
      </div>

      {config?.temporary && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" />
          <div>
            <p className="text-sm font-medium text-fg-default">数据仅保留 {config.retention_days} 天</p>
            <p className="mt-0.5 text-xs leading-5 text-fg-muted">
              仅支持上传和删除，文件不可下载；到期后将从对象存储自动删除。单个文件不得超过 20 GB。
            </p>
          </div>
        </div>
      )}

      {error && <div className="mb-4 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>}

      {storageQuotaReached && (
        <div className="mb-4 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          存储总容量已用尽，请删除不再需要的数据，或联系 SaaS 管理员调整容量。
        </div>
      )}

      <div className="yj-panel overflow-hidden">
        <div className="yj-panel-header flex-wrap gap-3 px-5 py-4">
          <div className="flex min-w-[280px] flex-1 items-center gap-2">
            <div className="w-full max-w-[420px]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索文件名、内部编号或 UUID" leftElement={<Search className="h-4 w-4" />} onKeyDown={(event) => { if (event.key === 'Enter') void load(search); }} />
            </div>
            <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-canvas-subtle hover:text-fg-default" title="刷新" aria-label="刷新" onClick={() => void load(search)}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <Button variant="primary" leftIcon={<Upload className="h-4 w-4" />} onClick={() => { if (!uploading) setUploadPolicyAcknowledged(false); setUploadOpen(true); }}>{uploading ? `查看上传 ${progress}%` : '上传数据'}</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1470px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[260px]" /><col className="w-[160px]" /><col className="w-[150px]" />
              <col className="w-[80px]" /><col className="w-[100px]" /><col className="w-[120px]" />
              <col className="w-[140px]" /><col className="w-[170px]" /><col className="w-[170px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="border-y border-border-default bg-canvas-subtle text-xs text-fg-muted">
              <tr>
                <th className="px-5 py-3 text-left align-middle font-medium">文件</th><th className="px-4 py-3 text-left align-middle font-medium">内部编号</th><th className="px-4 py-3 text-left align-middle font-medium">UUID</th>
                <th className="px-4 py-3 text-center align-middle font-medium">Read</th><th className="px-4 py-3 text-right align-middle font-medium">大小</th>
                <th className="px-4 py-3 text-left align-middle font-medium">存储</th><th className="px-4 py-3 text-left align-middle font-medium">状态</th>
                <th className="px-4 py-3 text-left align-middle font-medium">上传时间</th><th className="px-4 py-3 text-left align-middle font-medium">到期时间</th>
                <th className="whitespace-nowrap px-5 py-3 text-center align-middle font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {!loading && assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-canvas-subtle">
                  <td className="max-w-0 px-5 py-3 align-middle font-medium text-fg-default"><HoverText value={asset.file_name} className="font-medium text-fg-default" /></td>
                  <td className="max-w-0 px-4 py-3 align-middle">{asset.internal_id ? <HoverText value={asset.internal_id} className="font-medium text-fg-default" /> : <span className="text-fg-muted">-</span>}</td>
                  <td className="px-4 py-3 align-middle"><IdCell id={asset.id} truncateLength={8} /></td>
                  <td className="px-4 py-3 text-center align-middle uppercase text-fg-default">{asset.read_type}</td>
                  <td className="px-4 py-3 text-right align-middle tabular-nums text-fg-muted">{formatBytes(asset.file_size)}</td>
                  <td className="px-4 py-3 align-middle"><span className="inline-flex items-center gap-1.5 text-fg-muted">{asset.provider === 's3' ? <Cloud className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}{asset.provider === 's3' ? '对象存储' : '本地'}</span></td>
                  <td className="px-4 py-3 align-middle">{assetStatus(asset, fileProgress[asset.id])}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-fg-muted">{formatTime(asset.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-fg-muted">{asset.expires_at ? formatTime(asset.expires_at) : '永久'}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-center align-middle"><div className="inline-flex items-center justify-center gap-1">
                    {config?.download_allowed && <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-accent-subtle hover:text-accent-fg disabled:opacity-40" title="下载" aria-label="下载" disabled={asset.status !== 'completed'} onClick={() => void handleDownload(asset)}><Download className="h-4 w-4" /></button>}
                    {(asset.status === 'pending' || asset.status === 'failed') && <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-accent-subtle hover:text-accent-fg disabled:opacity-40" title="重新上传" aria-label="重新上传" disabled={retryingId !== null} onClick={() => { retryAssetIdRef.current = asset.id; if (retryInputRef.current) { retryInputRef.current.value = ''; retryInputRef.current.click(); } }}><Upload className="h-4 w-4" /></button>}
                    <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-accent-subtle hover:text-accent-fg" title="编辑内部编号" aria-label="编辑内部编号" onClick={() => { setEditing(asset); setEditingInternalId(asset.internal_id ?? ''); }}><Pencil className="h-4 w-4" /></button>
                    <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-danger-subtle hover:text-danger-fg" title="删除" aria-label="删除" onClick={() => setDeleting(asset)}><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="flex h-48 items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" />正在加载数据资产</div>}
          {!loading && assets.length === 0 && <div className="flex h-48 flex-col items-center justify-center text-fg-muted"><Database className="mb-2 h-6 w-6" /><p className="text-sm">暂无数据资产</p></div>}
        </div>
      </div>
      <input ref={retryInputRef} type="file" className="hidden" onChange={(event) => void handleRetryFile(event.target.files?.[0])} />

      <AppModal
        open={uploadOpen}
        size="large"
        title="上传测序数据"
        onOpenChange={(open) => { setUploadOpen(open); if (!open && !uploading) setUploadPolicyAcknowledged(false); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setUploadOpen(false); if (!uploading) { setUploadPolicyAcknowledged(false); setInternalId(''); } }}>{uploading ? '隐藏到数据中心' : '取消'}</Button>
            <Button variant="primary" disabled={uploading || storageQuotaReached || (!read1 && !read2) || Boolean(config?.temporary && !uploadPolicyAcknowledged)} leftIcon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} onClick={() => void handleUpload()}>{uploading ? '上传中...' : '开始上传'}</Button>
          </>
        }
      >
        <div className="space-y-6">
          {config?.temporary && <div className="space-y-3 rounded-md border border-warning-muted bg-warning-subtle p-3 text-sm text-warning-fg"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>上传文件将在 {config.retention_days} 天后自动删除，SaaS 模式不提供下载，单个文件不得超过 20 GB。</span></div><Checkbox checked={uploadPolicyAcknowledged} disabled={uploading} onCheckedChange={(checked) => setUploadPolicyAcknowledged(checked === true)} label="我已确认" /></div>}
          {isSaaS && <p className="text-xs text-fg-muted">当前已用 {formatBytes(totalBytes)}，总容量 {storageQuotaLabel}。</p>}
          <section>
            <ModalSectionHeading icon={<Upload className="h-4 w-4" />} title="测序文件" description="分别选择 Read1 和 Read2；允许暂时只上传其中一个文件。" />
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">内部编号（推荐）</label>
              <Input value={internalId} disabled={uploading} maxLength={100} onChange={(event) => setInternalId(event.target.value)} placeholder="填写样本中心的内部编号，如 SAMPLE-001" />
              <p className="mt-1.5 text-xs text-fg-muted">自动匹配将优先使用此编号；未填写时才根据 FASTQ 文件名匹配。</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-fg-muted">Read1（R1 FASTQ）</span><input type="file" accept=".fastq,.fq,.fastq.gz,.fq.gz" disabled={uploading} onChange={(event) => setRead1(event.target.files?.[0] ?? null)} className="block w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm text-fg-default file:mr-3 file:rounded file:border-0 file:bg-canvas-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-fg-muted">Read2（R2 FASTQ）</span><input type="file" accept=".fastq,.fq,.fastq.gz,.fq.gz" disabled={uploading} onChange={(event) => setRead2(event.target.files?.[0] ?? null)} className="block w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm text-fg-default file:mr-3 file:rounded file:border-0 file:bg-canvas-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium" /></label>
            </div>
          </section>
          {uploading && <section className="border-t border-[var(--yj-border-subtle)] pt-5"><ModalSectionHeading icon={<Cloud className="h-4 w-4" />} title="上传进度" description="请保持页面打开，文件完成后会自动登记到数据中心。" /><div className="mb-1.5 flex justify-between text-xs text-fg-muted"><span>正在上传</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded bg-canvas-subtle"><div className="h-full bg-accent-emphasis transition-[width]" style={{ width: `${progress}%` }} /></div></section>}
        </div>
      </AppModal>

      <AppModal
        open={editing !== null}
        size="small"
        title="编辑内部编号"
        onOpenChange={(open) => { if (!open && !savingEdit) setEditing(null); }}
        footer={<><Button variant="secondary" disabled={savingEdit} onClick={() => setEditing(null)}>取消</Button><Button variant="primary" disabled={savingEdit} onClick={() => void handleEdit()}>{savingEdit ? '保存中...' : '保存'}</Button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">{editing?.file_name}</p>
          <label className="block text-xs font-medium text-fg-muted">样本中心内部编号</label>
          <Input value={editingInternalId} maxLength={100} disabled={savingEdit} onChange={(event) => setEditingInternalId(event.target.value)} placeholder="如 SAMPLE-001" />
          <p className="text-xs leading-5 text-fg-muted">保存后自动匹配会优先使用该编号；清空后恢复文件名匹配。</p>
        </div>
      </AppModal>

      <AppModal
        open={deleting !== null}
        size="small"
        title="删除数据资产"
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>取消</Button><Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => void handleDelete()}>确认删除</Button></>}
      >
        <p className="text-sm leading-6 text-fg-muted">将永久删除 <span className="font-medium text-fg-default">{deleting?.file_name}</span> 及其存储对象。此操作无法撤销。</p>
      </AppModal>
    </div>
  );
}
