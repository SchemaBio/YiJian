'use client';
import { LocalDataImportModal } from './LocalDataImportModal';
import { downloadImportWorkbook } from '@/lib/import-workbook';
import {localDataTemplate} from '@/lib/local-data-import';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { TableActions, TableAction } from '@/components/shared/TableActions';
import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { Checkbox, DataTable, Input, type Column } from '@schema/ui-kit';
import { AlertTriangle, CheckCircle2, Cloud, Database, HardDrive, Loader2, Search, Trash2, Upload, X, XCircle } from 'lucide-react';
import {
  deleteDataAsset, downloadDataAsset, getDataCenterConfig, getDataAssetUploadStatus, listDataAssets,
  retryDataAsset, updateDataAsset, type DataAsset, type DataCenterConfig,
  type UploadStorageStats,
} from '@/lib/data-assets';
import { AppModal, FilePicker, HoverText, IdCell, MetricTile, ModalSectionHeading } from '@/components/shared';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { useUpload } from '@/components/providers/UploadProvider';
import { ApiError } from '@/lib/api';
import { sortPairedAssets } from '@/lib/data-asset-order';

function formatBytes(value: number, t: TextTranslator = chineseText): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${formatNumericString((value / 1024 ** index).toFixed(index > 1 ? 1 : 0), t.locale)} ${units[index]}`;
}

function formatTime(value?: string, t: TextTranslator = chineseText): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(t.locale, { hour12: false });
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

function assetStatus(asset: DataAsset, progress?: number, liveStatus?: 'uploading' | 'canceling' | 'cancelled' | 'completed' | 'failed' | 'deleted', t: TextTranslator = chineseText) {
  const effectiveStatus = liveStatus === 'uploading' || liveStatus === 'completed' || liveStatus === 'failed' ? liveStatus : asset.status;
  const meta = statusMeta[effectiveStatus] ?? statusMeta.failed;
  const Icon = meta.icon;
  const isCanceling = liveStatus === 'canceling';
  const isCancelled = liveStatus === 'cancelled';
  const isActiveUpload = liveStatus === 'uploading' || (liveStatus === undefined && progress !== undefined && progress < 100);
  const isFailed = liveStatus === 'failed';
  const isSpinning = isCanceling || liveStatus === 'uploading' || (liveStatus === undefined && (isActiveUpload || asset.status === 'uploading' || asset.status === 'deleting'));
  return (
    <div className="min-w-[112px]">
      <span className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${isCanceling || isCancelled ? statusMeta.deleting.className : isFailed ? statusMeta.failed.className : isActiveUpload ? statusMeta.uploading.className : meta.className}`}>
        <Icon className={`h-3.5 w-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
        {isCanceling ? t("data.canceling733d8c") : isCancelled ? t("admin.canceleda5ffdc") : isFailed ? t("admin.failed3e3c80") : isActiveUpload ? t("data.uploading2c0454", {p0: String(progress ?? 0)}) : localizeDisplay(meta.label, t)}
      </span>
      {isActiveUpload && <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-canvas-subtle"><div className="h-full bg-accent-emphasis transition-[width]" style={{ width: `${progress ?? 0}%` }} /></div>}
    </div>
  );
}

export default function DataCenterPage() {
  const t = useText();
  const { currentOrg, hasPermission } = useAuth();
  const [localImportOpen,setLocalImportOpen]=React.useState(false);
  const downloadLocalTemplate=async()=>{
   try { await downloadImportWorkbook(localDataTemplate(t.locale,config?.local_import_directory||'/data'), 'local-data-import.xlsx'); }
   catch (cause) { setError(errorText(cause, t)); }
  };
  const { capacity, refreshCapacity, activeUpload, queuedCount = 0, retries = {}, retryFile, startUpload: runUpload, cancelFile, forgetFile, pruneFiles, markFileFailed, cancelUpload, clearUpload } = useUpload();
  const [assets, setAssets] = React.useState<DataAsset[]>([]);
  const [config, setConfig] = React.useState<DataCenterConfig | null>(null);
  const [storageStats, setStorageStats] = React.useState<UploadStorageStats | null>(null);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [vcfMode,setVcfMode]=React.useState(false);
 const [typeFilter,setTypeFilter]=React.useState('');
 const [uploadOpen, setUploadOpen] = React.useState(false);
  const [checkingCapacity, setCheckingCapacity] = React.useState(false);
  const admissionRef = React.useRef(false);
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
  const [recoveryDismissed, setRecoveryDismissed] = React.useState(false);
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
    setLoadFailed(false);
    setError('');
    try {
      const [assetResult, configResult, statsResult] = await Promise.all([
        listDataAssets(query, typeFilter==='vcf'?{readType:'vcf'}:undefined),
        getDataCenterConfig(),
        refreshCapacity(),
      ]);
      if (requestId !== loadRequestRef.current) return;
      // BED files are managed only in Workflow Center. Storage stats remain
      // the unfiltered organization aggregate so BED still consumes quota.
      setAssets(sortPairedAssets((assetResult.items ?? []).filter((asset) => asset.read_type !== 'bed' && (typeFilter!=='fastq'||asset.read_type!=='vcf'))));
      setConfig(configResult);
      setStorageStats(statsResult);
      setHasLoaded(true);
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setLoadFailed(true);
      setError(err instanceof Error ? errorText(err, t) : t("data.unableToLoadDataAssets555043"));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [t,typeFilter,refreshCapacity]);

  React.useEffect(() => { void load(''); }, [load]);
  React.useEffect(() => {
    const refresh = () => { void refreshCapacity().catch(() => undefined); };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [refreshCapacity]);

  const retryStatusKey = Object.entries(retries).map(([id, item]) => `${id}:${item.status}`).join(',');
  React.useEffect(() => { if (retryStatusKey) void load(search); }, [retryStatusKey, load, search]);

  const activeFileKey = (activeUpload?.files ?? []).map((file) => file.fileId).join(',');
  const activeUploadStatus = activeUpload?.status;
  React.useEffect(() => {
    if (activeFileKey) void load(search);
  }, [activeFileKey, activeUploadStatus, load, search]);

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

  const totalBytes = (capacity ?? storageStats)?.total_bytes ?? 0;
  const reservedBytes = (capacity ?? storageStats)?.reserved_bytes ?? 0;
  const readyCount = React.useMemo(() => assets.filter((asset) => asset.status === 'completed').length, [assets]);
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const storageQuotaBytes = isSaaS && (currentOrg?.storageQuotaBytes ?? 0) > 0
    ? currentOrg?.storageQuotaBytes ?? null
    : null;
  const storageQuotaLabel = storageQuotaBytes ? formatBytes(storageQuotaBytes, t) : t("data.unlimited725811");
  const availableBytes = storageQuotaBytes === null ? null : Math.max(0, storageQuotaBytes - totalBytes - reservedBytes);
  const storageQuotaReached = availableBytes === 0;
  const storageUsagePercent = storageQuotaBytes === null ? null : ((totalBytes + reservedBytes) / storageQuotaBytes) * 100;
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
      setError(err instanceof Error ? errorText(err, t) : t("data.downloadFailede0dab2"));
    }
  };

  const handleUpload = async () => {
    if (admissionRef.current) return;
    if (!read1 && !read2) { setError(t("data.selectAtLeastOneReadOrReadbc8cd9")); return; }
    if (config?.temporary && !uploadPolicyAcknowledged) { setError(t("data.selectIConfirmFirst4667d6")); return; }
    const oversizedFile = [read1, read2].find((file) => file && config?.temporary && config.max_file_size_bytes > 0 && file.size > config.max_file_size_bytes);
    if (oversizedFile) { setError(t("data.exceedsTheSaasLimitOfGbPer9884ea", {p0: String(oversizedFile.name)})); return; }
    setError('');
    admissionRef.current = true;
    setCheckingCapacity(true);
    let accepted = false;
    try {
      await runUpload({ read1, read2, uploadPolicyAcknowledged, internalId, quotaBytes: storageQuotaBytes, onAccepted: () => {
        accepted = true;
        setUploadOpen(false);
        setRead1(null);
        setRead2(null);
        setInternalId('');
        setUploadPolicyAcknowledged(false);
        admissionRef.current = false;
        setCheckingCapacity(false);
      } });
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("data.uploadFaileda6f805"));
    } finally {
      if (!accepted) {
        admissionRef.current = false;
        setCheckingCapacity(false);
      }
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
      if (liveFile) markFileFailed(deleting.id, err instanceof Error ? errorText(err, t) : t("data.deleteFailed72250c"));
      setError(err instanceof Error ? errorText(err, t) : t("data.deleteFailed72250c"));
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
      setError(err instanceof Error ? errorText(err, t) : t("data.unableToCancelUpload7c0a32"));
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
      setError(err instanceof Error ? errorText(err, t) : t("data.unableToUpdateInternalId2dac48"));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRetryFile = async (file: File | undefined) => {
    const asset = assets.find((item) => item.id === retryAssetIdRef.current);
    if (!asset || !file) return;
    if (file.name !== asset.file_name) {
      setError(t("data.selectTheOriginalFile8f6960", {p0: String(asset.file_name)}));
      retryAssetIdRef.current = null;
      if (retryInputRef.current) retryInputRef.current.value = '';
      return;
    }
    if (asset.file_size > 0 && file.size !== asset.file_size) {
      setError(t("data.fileSizeMismatchExpecteda09d26", {p0: String(formatBytes(asset.file_size, t))}));
      retryAssetIdRef.current = null;
      if (retryInputRef.current) retryInputRef.current.value = '';
      return;
    }
    retryAssetIdRef.current = null;
    if (retryInputRef.current) retryInputRef.current.value = '';
    setError('');
    try {
      await retryFile(asset.id, file);
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("data.uploadRetryFailed61b24c"));
    }
  };

  const columns: Column<DataAsset>[] = [
    {
      id: 'file',
      header: t("data.file49deaf"),
      accessor: (asset) => <HoverText value={asset.file_name} className="font-medium text-fg-default" />,
      width: 260,
      minWidth: 260,
    },
    {
      id: 'internalId',
      header: t("data.internalIdabcc9d"),
      accessor: (asset) => asset.internal_id
        ? <HoverText value={asset.internal_id} className="font-medium text-fg-default" />
        : <span className="text-fg-muted">-</span>,
      width: 160,
      minWidth: 160,
    },
    {
      id: 'uuid',
      header: 'UUID',
      accessor: (asset) => <IdCell id={asset.id} full />,
      width: 300,
      minWidth: 300,
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
      header: t("data.sizefd2070"),
      accessor: (asset) => <span className="tabular-nums text-fg-muted">{formatBytes(asset.file_size, t)}</span>,
      width: 100,
      minWidth: 100,
      align: 'right',
    },
    {
      id: 'provider',
      header: t("data.storage091ca5"),
      accessor: (asset) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-fg-muted">
          {asset.provider === 's3' ? <Cloud className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}
          {asset.provider === 's3' ? t("data.objectStorage0f1b43") : t("data.locale8666c")}
        </span>
      ),
      width: 120,
      minWidth: 120,
    },
    {
      id: 'status',
      header: t("admin.status62e951"),
      accessor: (asset) => assetStatus(asset, retries[asset.id]?.progress ?? fileProgress[asset.id], retries[asset.id]?.status ?? fileLiveStatus[asset.id], t),
      width: 140,
      minWidth: 140,
    },
    {
      id: 'createdAt',
      header: t("data.uploadedAt109db2"),
      accessor: (asset) => <span className="whitespace-nowrap text-fg-muted">{formatTime(asset.created_at, t)}</span>,
      width: 170,
      minWidth: 170,
    },
    {
      id: 'expiresAt',
      header: t("data.expiresAt3144a9"),
      accessor: (asset) => <span className="whitespace-nowrap text-fg-muted">{asset.expires_at ? formatTime(asset.expires_at, t) : t("data.permanent409752")}</span>,
      width: 170,
      minWidth: 170,
    },
    {
      id: 'actions',
      header: t("admin.actionsf3ea6d"),
      accessor: (asset) => (
        <TableActions>
          {config?.download_allowed && <TableAction action="download" label={t("data.download2b9d01")} disabled={asset.status !== 'completed'}
            hint={asset.status === 'completed' ? t("data.downloadFile2922ce") : t("data.downloadAvailableAfterUploadCompletes289170")} onClick={() => void handleDownload(asset)} />}
          {(asset.status === 'pending' || asset.status === 'uploading' || asset.status === 'failed') && <TableAction action="upload" label={t("data.reuploadbd40ef")} hint={t("data.uploadAgain53e50e")} aria-label={t("data.uploadAgain53e50e")}
            disabled={retries[asset.id]?.status === 'uploading' || fileLiveStatus[asset.id] === 'uploading'} onClick={() => { retryAssetIdRef.current = asset.id; if (retryInputRef.current) { retryInputRef.current.value = ''; retryInputRef.current.click(); } }} />}
          <TableAction permission={['data.manage', 'samples.write']} action="edit" label={t("admin.edita7f814")} hint={t("data.editInternalId05f8a1")} aria-label={t("data.editInternalId05f8a1")} onClick={() => { setEditing(asset); setEditingInternalId(asset.internal_id ?? ''); }} />
          <TableAction action="delete" label={t("data.delete3755f5")} tone="danger" onClick={() => setDeleting(asset)} />
        </TableActions>
      ),
      width: 208,
      minWidth: 208,
      align: 'center',
      pinned: 'right',
    },
  ];

  return (
    <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden p-6 xl:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="yj-page-title">{t("data.dataCenter189979")}</h2>
          <p className="mt-2 text-sm text-fg-muted">{t("data.manageOrganizationSequencingDataForSampleMatching655f38")}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 max-sm:[&>div:last-child]:col-span-2 sm:grid-cols-3 xl:grid-cols-5">
          <MetricTile label={t("data.dataAssetsbcb32e")} value={hasLoaded ? assets.length : '—'} icon={<Database className="h-4 w-4" />} />
          <MetricTile label={t("data.availableFiles98360c")} value={hasLoaded ? readyCount : '—'} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
          <MetricTile
            label={t("uploadCapacity.used")}
            value={hasLoaded ? `${formatBytes(totalBytes, t)} / ${storageQuotaLabel}` : '—'}
            icon={<HardDrive className="h-4 w-4" />}
            tone="info"
            capacityFill={storageUsagePercent !== null && storageUsageTone
              ? { percent: storageUsagePercent, tone: storageUsageTone }
              : undefined}
          />
          <MetricTile label={t("uploadCapacity.reserved")} value={hasLoaded ? formatBytes(reservedBytes, t) : '—'} icon={<Upload className="h-4 w-4" />} tone="warning" />
          <MetricTile label={t("uploadCapacity.available")} value={hasLoaded ? availableBytes === null ? t("data.unlimited725811") : formatBytes(availableBytes, t) : '—'} icon={<HardDrive className="h-4 w-4" />} tone="success" />
        </div>
      </div>
      {isSaaS && <p className="mb-4 text-xs leading-5 text-fg-muted">{t("uploadCapacity.hint")}</p>}

      {config?.temporary && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
          <p className="whitespace-nowrap"><strong className="font-medium">{t("data.dataRetainedFore9bd90")}{config.retention_days} {t("data.daysf8bb05")}</strong><span className="ml-3">{t("data.uploadAndDeletionOnlyFilesCannotBeff9045")}</span></p>
        </div>
      )}

      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg"><span>{error}</span>{loadFailed && <Button permission={null} action="retry" variant="secondary" size="small" disabled={loading} onClick={() => void load(search)}>{t("billing.retryLoading7b4939")}</Button>}</div>}

      {activeUpload?.status === 'needs_file' && !recoveryChecking && !recoveryDismissed && (
        <div className="mb-4 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3 text-sm text-warning-fg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" aria-label={t("uploadExperience.dismissRecovery")} className="order-last ml-auto rounded-md p-1 hover:bg-warning-muted/40" onClick={() => setRecoveryDismissed(true)}><X className="h-4 w-4" /></button>
            <span>{recoveryLookupFailed ? t("data.someUploadStatusesCannotBeConfirmedRefresh42ae61") : t("data.someUploadsRemainUnfinishedAfterRefreshingSelecte51a79")}</span>
            <button type="button" className="shrink-0 rounded-md border border-warning-muted px-2.5 py-1 text-xs font-medium text-warning-fg hover:bg-warning-muted/40" onClick={() => clearUpload()}>
              {t("data.discardRecoveryRecord683763")}</button>
          </div>
        </div>
      )}

      {storageQuotaReached && (
        <div className="mb-4 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {t("data.storageIsFullDeleteUnusedDataOr56d3c8")}</div>
      )}

      <p role="status" className="mb-3 text-sm text-fg-muted">{t("uploadExperience.queueHint", { p0: queuedCount })}</p>
      <div className="yj-panel min-w-0 overflow-hidden">
        <div className="yj-panel-header flex-wrap gap-3 px-5 py-4">
          <div className="flex min-w-[280px] flex-1 items-center gap-2">
            <div className="w-full max-w-[420px]">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("data.searchFilenameInternalIdOrUuid462576")} leftElement={<Search className="h-4 w-4" />} onKeyDown={(event) => { if (event.key === 'Enter') void load(search); }} />
            </div>
            <HoverHint content={t("admin.refresh38108e")}><ActionButton size="small" iconOnly action="refresh" variant="ghost" type="button" className="rounded-md p-2 text-fg-muted hover:bg-canvas-subtle hover:text-fg-default"  aria-label={t("admin.refresh38108e")} onClick={() => void load(search)} /></HoverHint>
          </div>
          <select aria-label={t('vcfAnnotation.allTypes')} className="h-8 rounded-md border border-border-default bg-canvas-default px-3 py-0 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-emphasis" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="">{t('vcfAnnotation.allTypes')}</option><option value="vcf">{t('vcfAnnotation.vcfOnly')}</option><option value="fastq">{t('vcfAnnotation.fastqOnly')}</option></select>
          <Button action="upload" disabled={canceling} onClick={()=>{setVcfMode(true);setRead1(null);setRead2(null);setUploadPolicyAcknowledged(false);setUploadOpen(true);}}>{t('vcfAnnotation.upload')}</Button>
          {getRuntimeBackendFlavor() !== 'squid' && <>
           <Button permission={null} action="download" disabled={!config?.local_import_directory} onClick={downloadLocalTemplate}>{t('samples.downloadTemplatea3afb2')}</Button>
           <Button permission={['data.manage','samples.write']} action="upload" disabled={!config?.local_import_directory} onClick={()=>setLocalImportOpen(true)}>{t('localDataImport.title')}</Button>
          </>}
          <Button action="upload" variant="primary"  disabled={canceling} onClick={() => { if (!uploadBusy) { setUploadPolicyAcknowledged(false); setVcfMode(Boolean(activeUpload?.files.some(f=>f.readType==='vcf'))); } setUploadOpen(true); }}>{canceling ? t("data.canceling6bc0d6") : uploading ? t("data.viewUpload955ec2", {p0: String(progress)}) : t("data.uploadDatad1b00d")}</Button>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" />{t("data.loadingDataAssetsfde260")}</div>
        ) : loadFailed && assets.length === 0 ? null : assets.length > 0 ? (
          <DataTable
            data={assets}
            columns={localizeDisplay(columns, t)}
            rowKey="id"
            density="compact"
            className="yj-data-table right-pinned-actions-table data-center-table"
          />
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-fg-muted"><Database className="mb-2 h-6 w-6" /><p className="text-sm">{search.trim() ? t("data.noMatchingDataAssets29b140") : t("data.noDataAssets5862af")}</p></div>
        )}
      </div>
      {localImportOpen && getRuntimeBackendFlavor() !== 'squid' && <LocalDataImportModal directory={config?.local_import_directory||''} onClose={()=>setLocalImportOpen(false)} onImported={()=>void load(search)}/>}
      <input ref={retryInputRef} type="file" className="hidden" onChange={(event) => void handleRetryFile(event.target.files?.[0])} />

      <AppModal
        open={uploadOpen}
        size="large"
        title={t("data.uploadSequencingDataee326e")}
        onOpenChange={(open) => { if (canceling && !open) return; setUploadOpen(open); if (!open && !uploadBusy) setUploadPolicyAcknowledged(false); }}
        footer={
          <>
            {uploading && <Button action="upload" variant="danger" disabled={canceling || !activeUploadJobId} onClick={() => setCancelUploadConfirmOpen(true)}>{t("data.cancelUpload6b9dee")}</Button>}
            <Button variant="secondary" disabled={canceling} onClick={() => { setUploadOpen(false); if (!uploadBusy) { setUploadPolicyAcknowledged(false); setInternalId(''); } }}>{uploadBusy ? t("data.hideInDataCenter16727b") : t("admin.cancel4d0b46")}</Button>
            <Button action="upload" variant="primary" disabled={checkingCapacity || canceling || (storageQuotaReached && activeUpload?.status !== 'needs_file') || (!read1 && !read2) || Boolean(config?.temporary && !uploadPolicyAcknowledged)} onClick={() => void handleUpload()}>{checkingCapacity ? t("uploadCapacity.checking") : canceling ? t("data.cancelingf44a50") : uploading ? t("uploadExperience.addToQueue") : t("data.startUpload456565")}</Button>
          </>
        }
      >
        <div className="space-y-6">
          {error && <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>}
          {config?.temporary && <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("data.uploadedFilesAreDeletedAfter56abf0")}{config.retention_days} {t("data.daysSaasDoesNotOfferDownloadsMaximumab8001")}</span></div><Checkbox checked={uploadPolicyAcknowledged} disabled={canceling} onCheckedChange={(checked) => setUploadPolicyAcknowledged(checked === true)} label={t("data.iConfirm7bd7e7")} /></div>}
          {isSaaS && <div className="space-y-2 text-xs text-fg-muted"><div className="flex flex-wrap gap-x-5 gap-y-2"><span>{t("uploadCapacity.used")}: {formatBytes(totalBytes, t)} / {storageQuotaLabel}</span><span>{t("uploadCapacity.reserved")}: {formatBytes(reservedBytes, t)}</span><span>{t("uploadCapacity.available")}: {availableBytes === null ? t("data.unlimited725811") : formatBytes(availableBytes, t)}</span></div><p>{t("uploadCapacity.hint")}</p></div>}
          <section>
            <ModalSectionHeading icon={<Upload className="h-4 w-4" />} title={vcfMode?t("vcfAnnotation.file"):t("data.sequencingFiles55cf00")} description={vcfMode?t("vcfAnnotation.sampleHint"):t("data.selectReadAndReadSeparatelyUploadingJustcdd8fe")} />
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("data.internalIdRecommendedb0481f")}</label>
              <Input value={internalId} disabled={canceling || !hasPermission('samples.write')} title={!hasPermission('samples.write') ? t('permissions.denied') : undefined} maxLength={100} onChange={(event) => setInternalId(event.target.value)} placeholder={t("data.enterTheInternalIdFromSamplesEe7533f")} />
              <p className="mt-1.5 text-xs text-fg-muted">{t("data.automaticMatchingPrefersThisIdFilenamesAred0991f")}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0"><span className="mb-1.5 block text-xs font-medium text-fg-muted">{vcfMode?t("vcfAnnotation.file"):"Read1（R1 FASTQ）"}</span><FilePicker label={vcfMode?t("vcfAnnotation.file"):t("data.readFilese79622")} accept={vcfMode?".vcf,.vcf.gz,.vcf.bgz":".fastq,.fq,.fastq.gz,.fq.gz"} file={read1} disabled={canceling} onChange={setRead1} /></div>
              {!vcfMode && <div className="min-w-0"><span className="mb-1.5 block text-xs font-medium text-fg-muted">Read2（R2 FASTQ）</span><FilePicker label={t("data.readFiles88c0f2")} accept=".fastq,.fq,.fastq.gz,.fq.gz" file={read2} disabled={canceling} onChange={setRead2} /></div>}
            </div>
          </section>
          {uploadBusy && <section className="border-t border-[var(--yj-border-subtle)] pt-5"><ModalSectionHeading icon={<Cloud className="h-4 w-4" />} title={canceling ? t("data.cancelingUpload5eb505") : t("data.uploadProgress211354")} description={canceling ? t("data.stoppingTransferAndCleaningObjectStoragePlease8085f0") : t("data.keepThisPageOpenCompletedFilesArecc7e43")} /><div className="mb-1.5 flex justify-between text-xs text-fg-muted"><span>{canceling ? t("data.canceling733d8c") : t("data.uploadingf8d6e4")}</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded bg-canvas-subtle"><div className="h-full bg-accent-emphasis transition-[width]" style={{ width: `${progress}%` }} /></div></section>}
        </div>
      </AppModal>

      <AppModal
        open={editing !== null}
        size="small"
        title={t("data.editInternalId05f8a1")}
        onOpenChange={(open) => { if (!open && !savingEdit) setEditing(null); }}
        footer={<><Button variant="secondary" disabled={savingEdit} onClick={() => setEditing(null)}>{t("admin.cancel4d0b46")}</Button><Button loading={savingEdit} loadingLabel={t("admin.savingd70d42")} action="save" variant="primary" disabled={savingEdit} onClick={() => void handleEdit()}>{t("data.savefadf24")}</Button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">{editing?.file_name}</p>
          <label className="block text-xs font-medium text-fg-muted">{t("data.sampleInternalIde68c77")}</label>
          <Input value={editingInternalId} maxLength={100} disabled={savingEdit} onChange={(event) => setEditingInternalId(event.target.value)} placeholder={t("data.forExampleSample7b660b")} />
          <p className="text-xs leading-5 text-fg-muted">{t("data.automaticMatchingWillPreferThisIdClear7d750c")}</p>
        </div>
      </AppModal>

      <AppModal
        open={cancelUploadConfirmOpen}
        size="small"
        title={t("data.cancelEntireUpload56f75f")}
        onOpenChange={(open) => { if (!canceling) setCancelUploadConfirmOpen(open); }}
        footer={<><Button action="upload" variant="secondary" disabled={canceling} onClick={() => setCancelUploadConfirmOpen(false)}>{t("data.continueUploadade9a3")}</Button><Button loading={canceling} loadingLabel={t("data.cancelingf44a50")} variant="danger" disabled={canceling} onClick={() => void handleCancelUpload()}>{t("data.confirmCancellationAndDeletiond7ceb6")}</Button></>}
      >
        <p className="text-sm leading-6 text-fg-muted">{t("data.cancelTheEntireUploadAndDeleteAlla3c6d1")}</p>
      </AppModal>

      <AppModal
        open={deleting !== null}
        size="small"
        title={t("data.deleteDataAsset5e81e5")}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>{t("admin.cancel4d0b46")}</Button><Button action="delete" variant="danger"  onClick={() => void handleDelete()}>{t("data.confirmDeletion3c06ab")}</Button></>}
      >
        <p className="text-sm leading-6 text-fg-muted">{t("data.permanentlyDeletef2b694")}<span className="font-medium text-fg-default">{deleting?.file_name}</span> {t("data.andItsStoredObjectThisCannotBe97aee3")}</p>
      </AppModal>
    </div>
  );
}
