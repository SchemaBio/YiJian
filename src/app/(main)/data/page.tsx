'use client';

import * as React from 'react';
import { Button, Checkbox, DataTable, Input, type Column } from '@schema/ui-kit';
import {
  AlertTriangle, CheckCircle2, Cloud, Database, Download, HardDrive,
  Loader2, Pencil, RefreshCw, Search, Trash2, Upload, XCircle,
} from 'lucide-react';
import {
  deleteDataAsset, downloadDataAsset, getDataCenterConfig, getDataAssetUploadStatus, getUploadStorageStats, listDataAssets,
  retryDataAsset, updateDataAsset, type DataAsset, type DataCenterConfig,
  type UploadStorageStats,
} from '@/lib/data-assets';
import { AppModal, HoverText, IdCell, MetricTile, ModalSectionHeading } from '@/components/shared';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { useUpload } from '@/components/providers/UploadProvider';
import { ApiError } from '@/lib/api';

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
  deleting: { label: '删除中', className: 'bg-canvas-subtle text-fg-muted', icon: Loader2 },
  deleted: { label: '已删除', className: 'bg-canvas-subtle text-fg-muted', icon: Trash2 },
} as const;

function assetStatus(asset: DataAsset, progress?: number, liveStatus?: 'uploading' | 'canceling' | 'cancelled' | 'completed' | 'failed' | 'deleted') {
  const meta = statusMeta[asset.status] ?? statusMeta.failed;
  const Icon = meta.icon;
  const isCanceling = liveStatus === 'canceling';
  const isCancelled = liveStatus === 'cancelled';
  const isActiveUpload = liveStatus === 'uploading' || (progress !== undefined && progress < 100);
  const isFailed = liveStatus === 'failed';
  const isSpinning = isCanceling || liveStatus === 'uploading' || (liveStatus === undefined && (isActiveUpload || asset.status === 'uploading' || asset.status === 'deleting'));
  return (
    <div className="min-w-[112px]">
      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${isCanceling || isCancelled ? statusMeta.deleting.className : isFailed ? statusMeta.failed.className : isActiveUpload ? statusMeta.uploading.className : meta.className}`}>
        <Icon className={`h-3.5 w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
        {isCanceling ? '取消中' : isCancelled ? '已取消' : isFailed ? '失败' : isActiveUpload ? `上传中 ${progress ?? 0}%` : meta.label}
      </span>
      {isActiveUpload && <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-canvas-subtle"><div className="h-full bg-accent-emphasis transition-[width]" style={{ width: `${progress ?? 0}%` }} /></div>}
    </div>
  );
}

export default function DataCenterPage() {
  const { currentOrg } = useAuth();
  const { activeUpload, startUpload: runUpload, cancelFile, forgetFile, pruneFiles, markFileFailed, cancelUpload, clearUpload } = useUpload();
  const [assets, setAssets] = React.useState<DataAsset[]>([]);
  const [config, setConfig] = React.useState<DataCenterConfig | null>(null);
  const [storageStats, setStorageStats] = React.useState<UploadStorageStats | null>(null);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [cancelUploadConfirmOpen, setCancelUploadConfirmOpen] = React.useState(false);
  const [recoveryChecking, setRecoveryChecking] = React.useState(false);
  const [recoveryLookupFailed, setRecoveryLookupFailed] = React.useState(false);
  const [read1, setRead1] = React.useState<File | null>(null);
  const [read2, setRead2] = React.useState<File | null>(null);
  const [internalId, setInternalId] = React.useState('');
  const [uploadPolicyAcknowledged, setUploadPolicyAcknowledged] = React.useState(false);
  const [deleting, setDeleting] = React.useState<DataAsset | null>(null);
  const [editing, setEditing] = React.useState<DataAsset | null>(null);
  const [editingInternalId, setEditingInternalId] = React.useState('');
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [retryProgress, setRetryProgress] = React.useState<Record<string, number>>({});
  const retryInputRef = React.useRef<HTMLInputElement | null>(null);
  const retryAssetIdRef = React.useRef<string | null>(null);
  const loadRequestRef = React.useRef(0);
  const uploading = activeUpload?.status === 'uploading';
  const canceling = activeUpload?.status === 'canceling';
  const uploadBusy = uploading || canceling;
  const activeUploadJobId = activeUpload?.files.find((file) => file.jobId)?.jobId;
  const progress = activeUpload?.progress ?? 0;
  const fileProgress = React.useMemo(
    () => activeUpload?.status === 'uploading'
      ? Object.fromEntries((activeUpload.files ?? []).filter((file) => file.status === 'uploading').map((file) => [file.fileId, file.progress]))
      : {},
    [activeUpload?.files, activeUpload?.status],
  );
  const fileLiveStatus = React.useMemo(
    () => Object.fromEntries((activeUpload?.files ?? []).map((file) => [file.fileId, file.status])),
    [activeUpload?.files],
  );

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
      // BED files are managed only in Workflow Center. Storage stats remain
      // the unfiltered organization aggregate so BED still consumes quota.
      setAssets((assetResult.items ?? []).filter((asset) => asset.read_type !== 'bed'));
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

  const activeFileKey = (activeUpload?.files ?? []).map((file) => file.fileId).join(',');
  React.useEffect(() => {
    if (activeFileKey) void load(search);
  }, [activeFileKey, load, search]);

  // A browser refresh can leave only durable upload metadata in localStorage.
  // Ask the backend for every remembered file before showing a resume prompt:
  // completed/deleted/missing records are not resumable, while transient
  // lookup failures are retained so a later retry cannot lose the record.
  React.useEffect(() => {
    if (activeUpload?.status !== 'needs_file' || activeUpload.files.length === 0) {
      setRecoveryChecking(false);
      setRecoveryLookupFailed(false);
      return;
    }
    let cancelled = false;
    setRecoveryChecking(true);
    setRecoveryLookupFailed(false);
    const reconcile = async () => {
      const terminal: string[] = [];
      let lookupFailed = false;
      await Promise.all(activeUpload.files.map(async (file) => {
        try {
          const remote = await getDataAssetUploadStatus(file.fileId);
          if (remote.status === 'completed' || remote.status === 'deleted' || remote.status === 'deleting') {
            terminal.push(file.fileId);
          }
        } catch (error) {
          const status = error instanceof ApiError
            ? error.status
            : (typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: unknown }).status : undefined);
          if (status === 404) terminal.push(file.fileId);
          else lookupFailed = true;
        }
      }));
      if (!cancelled) {
        setRecoveryLookupFailed(lookupFailed);
        setRecoveryChecking(false);
        pruneFiles(terminal);
      }
    };
    void reconcile();
    return () => { cancelled = true; };
  }, [activeUpload, getDataAssetUploadStatus, pruneFiles]);

  React.useEffect(() => {
    if (!uploadBusy) return;
    const warnAboutActiveUpload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnAboutActiveUpload);
    return () => window.removeEventListener('beforeunload', warnAboutActiveUpload);
  }, [uploadBusy]);

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
    setError('');
    try {
      await runUpload({ read1, read2, uploadPolicyAcknowledged, internalId });
      setUploadOpen(false);
      setRead1(null);
      setRead2(null);
      setInternalId('');
      setUploadPolicyAcknowledged(false);
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const liveFile = activeUpload?.files.find((file) => file.fileId === deleting.id);
    if (liveFile && liveFile.status !== 'completed' && liveFile.status !== 'cancelled' && liveFile.status !== 'deleted') {
      // Abort the browser request before asking the backend to delete the
      // asset. The paired file keeps its own controller and continues.
      cancelFile(deleting.id);
    }
    setError('');
    try {
      await deleteDataAsset(deleting.id);
      forgetFile(deleting.id);
      setDeleting(null);
      await load(search);
    } catch (err) {
      if (liveFile) markFileFailed(deleting.id, err instanceof Error ? err.message : '删除失败');
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleCancelUpload = async () => {
    setError('');
    try {
      await cancelUpload();
      setCancelUploadConfirmOpen(false);
      setUploadOpen(false);
      setRead1(null);
      setRead2(null);
      setInternalId('');
      setUploadPolicyAcknowledged(false);
      await load(search);
    } catch (err) {
      setCancelUploadConfirmOpen(false);
      setError(err instanceof Error ? err.message : '取消上传失败');
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
    if (asset.file_size > 0 && file.size !== asset.file_size) {
      setError(`文件大小不匹配：应为 ${formatBytes(asset.file_size)}`);
      retryAssetIdRef.current = null;
      if (retryInputRef.current) retryInputRef.current.value = '';
      return;
    }
    setRetryingId(asset.id);
    setError('');
    try {
      await retryDataAsset(asset.id, file, (value) => setRetryProgress((current) => ({ ...current, [asset.id]: value })));
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重试上传失败');
    } finally {
      setRetryingId(null);
      setRetryProgress((current) => { const next = { ...current }; delete next[asset.id]; return next; });
      retryAssetIdRef.current = null;
      if (retryInputRef.current) retryInputRef.current.value = '';
    }
  };

  const columns: Column<DataAsset>[] = [
    {
      id: 'file',
      header: '文件',
      accessor: (asset) => <HoverText value={asset.file_name} className="font-medium text-fg-default" />,
      width: 260,
      minWidth: 260,
    },
    {
      id: 'internalId',
      header: '内部编号',
      accessor: (asset) => asset.internal_id
        ? <HoverText value={asset.internal_id} className="font-medium text-fg-default" />
        : <span className="text-fg-muted">-</span>,
      width: 160,
      minWidth: 160,
    },
    {
      id: 'uuid',
      header: 'UUID',
      accessor: (asset) => <IdCell id={asset.id} truncateLength={8} />,
      width: 150,
      minWidth: 150,
    },
    {
      id: 'readType',
      header: 'Read',
      accessor: (asset) => <span className="uppercase">{asset.read_type}</span>,
      width: 80,
      minWidth: 80,
      align: 'center',
    },
    {
      id: 'size',
      header: '大小',
      accessor: (asset) => <span className="tabular-nums text-fg-muted">{formatBytes(asset.file_size)}</span>,
      width: 100,
      minWidth: 100,
      align: 'right',
    },
    {
      id: 'provider',
      header: '存储',
      accessor: (asset) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
          {asset.provider === 's3' ? <Cloud className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}
          {asset.provider === 's3' ? '对象存储' : '本地'}
        </span>
      ),
      width: 120,
      minWidth: 120,
    },
    {
      id: 'status',
      header: '状态',
      accessor: (asset) => assetStatus(asset, fileProgress[asset.id] ?? retryProgress[asset.id], fileLiveStatus[asset.id]),
      width: 140,
      minWidth: 140,
    },
    {
      id: 'createdAt',
      header: '上传时间',
      accessor: (asset) => <span className="whitespace-nowrap text-fg-muted">{formatTime(asset.created_at)}</span>,
      width: 170,
      minWidth: 170,
    },
    {
      id: 'expiresAt',
      header: '到期时间',
      accessor: (asset) => <span className="whitespace-nowrap text-fg-muted">{asset.expires_at ? formatTime(asset.expires_at) : '永久'}</span>,
      width: 170,
      minWidth: 170,
    },
    {
      id: 'actions',
      header: '操作',
      accessor: (asset) => (
        <div className="inline-flex items-center justify-center gap-1">
          {config?.download_allowed && (
            <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-accent-subtle hover:text-accent-fg disabled:opacity-40" title="下载" aria-label="下载" disabled={asset.status !== 'completed'} onClick={() => void handleDownload(asset)}>
              <Download className="h-4 w-4" />
            </button>
          )}
          {(asset.status === 'pending' || asset.status === 'uploading' || asset.status === 'failed') && (
            <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-accent-subtle hover:text-accent-fg disabled:opacity-40" title="重新上传" aria-label="重新上传" disabled={retryingId !== null} onClick={() => { retryAssetIdRef.current = asset.id; if (retryInputRef.current) { retryInputRef.current.value = ''; retryInputRef.current.click(); } }}>
              <Upload className="h-4 w-4" />
            </button>
          )}
          <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-accent-subtle hover:text-accent-fg" title="编辑内部编号" aria-label="编辑内部编号" onClick={() => { setEditing(asset); setEditingInternalId(asset.internal_id ?? ''); }}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-danger-subtle hover:text-danger-fg" title="删除" aria-label="删除" onClick={() => setDeleting(asset)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
      width: 120,
      minWidth: 120,
      align: 'center',
      pinned: 'right',
    },
  ];

  return (
    <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden p-6 xl:p-8">
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

      {activeUpload?.status === 'needs_file' && !recoveryChecking && (
        <div className="mb-4 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3 text-sm text-warning-fg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{recoveryLookupFailed ? '暂时无法确认部分上传记录的状态，请稍后刷新重试。其余未完成记录仍可选择原文件继续，系统会优先恢复对象存储中已完成的分片。' : '上次上传在浏览器刷新后仍有未完成记录。请选择相同文件后继续，系统会优先恢复对象存储中已完成的分片。'}</span>
            <button type="button" className="shrink-0 rounded-md border border-warning-muted px-2.5 py-1 text-xs font-medium text-warning-fg hover:bg-warning-muted/40" onClick={() => clearUpload()}>
              放弃恢复记录
            </button>
          </div>
        </div>
      )}

      {storageQuotaReached && (
        <div className="mb-4 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          存储总容量已用尽，请删除不再需要的数据，或联系 SaaS 管理员调整容量。
        </div>
      )}

      <div className="yj-panel min-w-0 overflow-hidden">
        <div className="yj-panel-header flex-wrap gap-3 px-5 py-4">
          <div className="flex min-w-[280px] flex-1 items-center gap-2">
            <div className="w-full max-w-[420px]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索文件名、内部编号或 UUID" leftElement={<Search className="h-4 w-4" />} onKeyDown={(event) => { if (event.key === 'Enter') void load(search); }} />
            </div>
            <button type="button" className="rounded-md p-2 text-fg-muted hover:bg-canvas-subtle hover:text-fg-default" title="刷新" aria-label="刷新" onClick={() => void load(search)}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <Button variant="primary" leftIcon={<Upload className="h-4 w-4" />} disabled={canceling} onClick={() => { if (!uploadBusy) setUploadPolicyAcknowledged(false); setUploadOpen(true); }}>{canceling ? '正在取消…' : uploading ? `查看上传 ${progress}%` : '上传数据'}</Button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" />正在加载数据资产</div>
        ) : assets.length > 0 ? (
          <DataTable
            data={assets}
            columns={columns}
            rowKey="id"
            density="compact"
            className="yj-data-table right-pinned-actions-table data-center-table"
          />
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-fg-muted"><Database className="mb-2 h-6 w-6" /><p className="text-sm">暂无数据资产</p></div>
        )}
      </div>
      <input ref={retryInputRef} type="file" className="hidden" onChange={(event) => void handleRetryFile(event.target.files?.[0])} />

      <AppModal
        open={uploadOpen}
        size="large"
        title="上传测序数据"
        onOpenChange={(open) => { if (canceling && !open) return; setUploadOpen(open); if (!open && !uploadBusy) setUploadPolicyAcknowledged(false); }}
        footer={
          <>
            {uploading && <Button variant="danger" disabled={canceling || !activeUploadJobId} onClick={() => setCancelUploadConfirmOpen(true)}>取消上传</Button>}
            <Button variant="secondary" disabled={canceling} onClick={() => { setUploadOpen(false); if (!uploadBusy) { setUploadPolicyAcknowledged(false); setInternalId(''); } }}>{uploadBusy ? '隐藏到数据中心' : '取消'}</Button>
            <Button variant="primary" disabled={uploadBusy || storageQuotaReached || (!read1 && !read2) || Boolean(config?.temporary && !uploadPolicyAcknowledged)} leftIcon={uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} onClick={() => void handleUpload()}>{canceling ? '取消中...' : uploading ? '上传中...' : '开始上传'}</Button>
          </>
        }
      >
        <div className="space-y-6">
          {config?.temporary && <div className="space-y-3 rounded-md border border-warning-muted bg-warning-subtle p-3 text-sm text-warning-fg"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>上传文件将在 {config.retention_days} 天后自动删除，SaaS 模式不提供下载，单个文件不得超过 20 GB。</span></div><Checkbox checked={uploadPolicyAcknowledged} disabled={uploadBusy} onCheckedChange={(checked) => setUploadPolicyAcknowledged(checked === true)} label="我已确认" /></div>}
          {isSaaS && <p className="text-xs text-fg-muted">当前已用 {formatBytes(totalBytes)}，总容量 {storageQuotaLabel}。</p>}
          <section>
            <ModalSectionHeading icon={<Upload className="h-4 w-4" />} title="测序文件" description="分别选择 Read1 和 Read2；允许暂时只上传其中一个文件。" />
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">内部编号（推荐）</label>
              <Input value={internalId} disabled={uploadBusy} maxLength={100} onChange={(event) => setInternalId(event.target.value)} placeholder="填写样本中心的内部编号，如 SAMPLE-001" />
              <p className="mt-1.5 text-xs text-fg-muted">自动匹配将优先使用此编号；未填写时才根据 FASTQ 文件名匹配。</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-fg-muted">Read1（R1 FASTQ）</span><input type="file" accept=".fastq,.fq,.fastq.gz,.fq.gz" disabled={uploadBusy} onChange={(event) => setRead1(event.target.files?.[0] ?? null)} className="block w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm text-fg-default file:mr-3 file:rounded file:border-0 file:bg-canvas-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium" /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-medium text-fg-muted">Read2（R2 FASTQ）</span><input type="file" accept=".fastq,.fq,.fastq.gz,.fq.gz" disabled={uploadBusy} onChange={(event) => setRead2(event.target.files?.[0] ?? null)} className="block w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm text-fg-default file:mr-3 file:rounded file:border-0 file:bg-canvas-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium" /></label>
            </div>
          </section>
          {uploadBusy && <section className="border-t border-[var(--yj-border-subtle)] pt-5"><ModalSectionHeading icon={<Cloud className="h-4 w-4" />} title={canceling ? '正在取消上传' : '上传进度'} description={canceling ? '正在终止传输并清理对象存储，请稍候。' : '请保持页面打开，文件完成后会自动登记到数据中心。'} /><div className="mb-1.5 flex justify-between text-xs text-fg-muted"><span>{canceling ? '取消中' : '正在上传'}</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded bg-canvas-subtle"><div className="h-full bg-accent-emphasis transition-[width]" style={{ width: `${progress}%` }} /></div></section>}
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
        open={cancelUploadConfirmOpen}
        size="small"
        title="取消整个上传任务"
        onOpenChange={(open) => { if (!canceling) setCancelUploadConfirmOpen(open); }}
        footer={<><Button variant="secondary" disabled={canceling} onClick={() => setCancelUploadConfirmOpen(false)}>继续上传</Button><Button variant="danger" disabled={canceling} onClick={() => void handleCancelUpload()}>{canceling ? '取消中...' : '确认取消并删除'}</Button></>}
      >
        <p className="text-sm leading-6 text-fg-muted">将取消整个上传任务并删除该任务中的所有文件（包括已经完成的 Read1/Read2）。此操作无法撤销。</p>
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
