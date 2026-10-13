'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { TableActions, TableAction } from '@/components/shared/TableActions';
import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';

import {ResourcePager} from '@/components/shared/ResourcePager';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import { AppModal, EmptyState, FilePicker, ModalSectionHeading } from '@/components/shared';
import { Checkbox, DataTable, FormItem, Input, Select, Tag, type Column } from '@schema/ui-kit';
import { AlertTriangle, FileText, HardDrive, Loader2, Search } from 'lucide-react';
import { deleteDataAsset, getDataCenterConfig, getUploadStorageStats, listAllBEDAssets, validateBEDAsset, uploadBEDFile, type DataAsset, type DataCenterConfig, type UploadStorageStats } from '@/lib/data-assets';
import { BUILTIN_BED_ASSETS, resourceDisplayName } from '@/lib/builtin-resources';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

type ReferenceGenome = 'GRCh37' | 'GRCh38';

const genomeOptions = [
  { value: 'GRCh37', label: 'GRCh37 (hg19)' },
  { value: 'GRCh38', label: 'GRCh38 (hg38)' },
];

function formatTime(value: string, t: TextTranslator = chineseText): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(t.locale, { hour12: false });
}

function formatBytes(value: number, t: TextTranslator = chineseText): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${formatNumericString((value / 1024).toFixed(1), t.locale)} KB`;
  if (value < 1024 * 1024 * 1024) return `${formatNumericString((value / 1024 / 1024).toFixed(1), t.locale)} MB`;
  if (value < 1024 ** 4) return `${formatNumericString((value / 1024 ** 3).toFixed(1), t.locale)} GB`;
  return `${formatNumericString((value / 1024 ** 4).toFixed(1), t.locale)} TB`;
}

function BedFilesPageContent() {
  const t = useText();
 const [page,setPage]=React.useState(1);
  const { currentOrg } = useAuth();
  const [searchQuery, setSearchQuery] = React.useState('');
 React.useEffect(()=>setPage(1),[searchQuery]);
  const [items, setItems] = React.useState<DataAsset[]>([]);
  const [config, setConfig] = React.useState<DataCenterConfig | null>(null);
  const [storageStats, setStorageStats] = React.useState<UploadStorageStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [referenceGenome, setReferenceGenome] = React.useState<ReferenceGenome>('GRCh38');
  const [uploading, setUploading] = React.useState(false);
  const [uploadPolicyAcknowledged, setUploadPolicyAcknowledged] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [uploadError, setUploadError] = React.useState('');
  const [deleting, setDeleting] = React.useState<DataAsset | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [validatingId, setValidatingId] = React.useState<string | null>(null);
  const validationBusy = React.useRef(false);
  const [references,setReferences]=React.useState<{kind:string;id:string;name:string}[]>([]);

  const loadController=React.useRef<AbortController|null>(null);
 const loadData = React.useCallback(async () => {
 loadController.current?.abort();const controller=new AbortController();loadController.current=controller;
    setIsLoading(true);
    setError(null);
    try {
      const [response, dataCenterConfig, uploadStorageStats] = await Promise.all([
        listAllBEDAssets(controller.signal),
        getDataCenterConfig(),
        getUploadStorageStats(),
      ]);
      if(controller.signal.aborted)return;
 setItems([...BUILTIN_BED_ASSETS, ...response]);
      setConfig(dataCenterConfig);
      setStorageStats(uploadStorageStats);
    } catch (err) {
      if(controller.signal.aborted)return;setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToLoadBedFilesf96f3f"));
      setItems([]);
    } finally {
      if(!controller.signal.aborted)setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => { void loadData();return()=>loadController.current?.abort(); }, [loadData]);
 React.useEffect(()=>{if(!items.some(x=>!x.is_builtin&&(x.validation_status==='pending'||x.validation_status==='validating')))return;const t=setInterval(()=>void loadData(),5000);return()=>clearInterval(t)},[items,loadData]);

  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const storageQuotaBytes = isSaaS && (currentOrg?.storageQuotaBytes ?? 0) > 0
    ? currentOrg?.storageQuotaBytes ?? null
    : null;
  const totalStorageBytes = storageStats?.total_bytes ?? 0;
  const storageQuotaReached = storageQuotaBytes !== null && totalStorageBytes >= storageQuotaBytes;

  const filteredFiles = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.file_name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query));
  }, [items, searchQuery]);

  const closeModal = () => {
    if (uploading) return;
    setModalOpen(false);
    setFile(null);
    setProgress(0);
    setUploadError('');
    setUploadPolicyAcknowledged(false);
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    if (config?.temporary && !uploadPolicyAcknowledged) {
      setUploadError(t("data.selectIConfirmFirst4667d6"));
      return;
    }
    if (storageQuotaBytes !== null && totalStorageBytes + file.size > storageQuotaBytes) {
      setUploadError(t("pipeline.selectedBedFilesExceedOrganizationCapacityUsedcffda8", {p0: String(formatBytes(totalStorageBytes, t)), p1: String(formatBytes(storageQuotaBytes, t))}));
      return;
    }
    setUploading(true);
    setUploadError('');
    setProgress(0);
    try {
      await uploadBEDFile(file, referenceGenome, uploadPolicyAcknowledged, setProgress);
      setUploading(false);
      setModalOpen(false);
      setFile(null);
      setProgress(0);
      setUploadPolicyAcknowledged(false);
      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToUploadBedFile45c01a"));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setError(null);setReferences([]);
    try {
      await deleteDataAsset(deleting.id);
      setDeleting(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToDeleteBedFile07fdd9"));
      const data=(err as {data?:{references?:{kind:string;id:string;name:string}[]}}).data;setReferences(data?.references??[]);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleValidate = async (row: DataAsset) => {
    if (validationBusy.current) return;
    validationBusy.current = true;
    setValidatingId(row.id);
    setError(null);
    try {
      await validateBEDAsset(row.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? errorText(err, t) : t("pipeline.validationFailed2da744"));
    } finally {
      validationBusy.current = false;
      setValidatingId(null);
    }
  };

  const columns: Column<DataAsset>[] = [
    {
      id: 'fileName', header: t("pipeline.filename1275f6"), width: 280, align: 'left',
      accessor: (row) => <HoverHint content={resourceDisplayName(row.id, row.file_name, t)}><span className="block truncate font-medium text-fg-default" >{resourceDisplayName(row.id, row.file_name, t)}{row.is_builtin && <Tag className="ml-2" variant="neutral">{t("pipeline.builtIn09ceea")}</Tag>}</span></HoverHint>,
    },
    {
      id: 'referenceGenome', header: t("pipeline.referenceGenome903ba5"), width: 130, align: 'center',
      accessor: (row) => <Tag variant="neutral">{row.reference_genome || '-'}</Tag>,
    },
    { id: 'size', header: t("pipeline.fileSize2ad8b0"), width: 110, align: 'right', accessor: (row) => row.is_builtin ? '-' : formatBytes(row.file_size, t) },
    {
      id: 'provider', header: t("pipeline.storageLocationc445d4"), width: 120, align: 'center',
      accessor: (row) => <span className="inline-flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-fg-muted" />{row.is_builtin ? t("pipeline.systemBuiltInae8da0") : row.provider === 's3' ? t("data.objectStorage0f1b43") : t("pipeline.localStorage429e2e")}</span>,
    },
    {
      id: 'status', header: t("admin.status62e951"), width: 100, align: 'center',
      accessor: (row) => row.is_builtin ? <Tag variant="success">{t("data.availablee91365")}</Tag> : <Tag variant={row.status === 'completed' && row.validation_status==='valid' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'}>{row.status === 'completed' ? ({valid:t("data.availablee91365"),invalid:t("pipeline.invalidContent76f2ac"),unavailable:t("pipeline.validationUnavailable6771d1"),validating:t("pipeline.validatingf64375"),pending:t("pipeline.awaitingValidation88a87f")}[row.validation_status??'pending']) : row.status === 'failed' ? t("admin.failed3e3c80") : t("data.uploading6818eb")}</Tag>,
    },
    { id: 'createdAt', header: t("data.uploadedAt109db2"), width: 180, align: 'center', accessor: (row) => row.is_builtin ? '-' : formatTime(row.created_at, t) },
    { id: 'actions', header: t("admin.actionsf3ea6d"), width: 152, minWidth: 152, maxWidth: 152, pinned: 'right', align: 'center', accessor: (row) => row.is_builtin
      ? <span className="text-xs text-fg-muted">{t("pipeline.readOnlyffc1d0")}</span>
      : <TableActions>
        {row.status === 'completed' && row.validation_status !== 'valid' && <TableAction action="refresh" label={t("pipeline.validate20feec")}
          hint={row.validation_status === 'validating' ? t("pipeline.validatingFilePleaseWait5f67b6") : t("pipeline.revalidateBedFile57c8f7")}
          loading={validatingId === row.id} loadingLabel={t("pipeline.validatingf64375")} disabled={validatingId !== null || row.validation_status === 'validating'} onClick={() => void handleValidate(row)} />}
        <TableAction action="delete" label={t("data.delete3755f5")} tone="danger" aria-label={t("pipeline.delete05cefd", {p0: String(row.file_name)})} disabled={validatingId === row.id}
          onClick={() => setDeleting(row)} />
      </TableActions> },
  ];

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">{t("pipeline.bedFiles8ee058")}</h2>
          <p className="yj-page-subtitle">{t("pipeline.manageCaptureRegionFilesAndReferenceGenomesf3513b")}</p>
        </div>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-full sm:w-72">
          <Input placeholder={t("pipeline.searchFilenameOrUuid7aaf70")} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} leftElement={<Search className="h-4 w-4" />} />
        </div>
        <Button action="upload" variant="primary" className="shrink-0 whitespace-nowrap"  onClick={() => { setUploadPolicyAcknowledged(false); setModalOpen(true); }}>{t("pipeline.uploadBedFilec83510")}</Button>
      </div>

      {error && <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}<ActionButton action="retry" variant="ghost" type="button" className="yj-tool-button ml-3" disabled={isLoading} onClick={() => void loadData()}>{t("billing.retryLoading7b4939")}</ActionButton></div>}

      {references.length>0&&<div className="rounded-md border border-warning-muted bg-warning-subtle p-3 text-sm">{t("pipeline.thisBedIsUsedByTheseResourcesb5c494")}<ul className="mt-2 space-y-1">{references.map(r=><li key={`${r.kind}:${r.id}`}><a className="text-accent-fg underline" href={r.kind==='task'?`/tasks/${r.id}`:r.kind==='baseline'?'/pipeline/baseline':'/pipeline'}>{r.name||r.id}</a></li>)}</ul></div>}
      {isLoading ? (
        <div className="yj-empty-state"><Loader2 className="h-6 w-6 animate-spin text-accent-fg" /><p className="text-fg-muted">{t("pipeline.loadingBedFilesa20c0f")}</p></div>
      ) : error && items.length === 0 ? null : filteredFiles.length === 0 ? (
        <EmptyState className="yj-panel" icon={<FileText />} title={searchQuery.trim() ? t("pipeline.noMatchingBedFiles4a8e2e") : t("pipeline.noBedFiles415a7a")} description={searchQuery.trim() ? t("pipeline.adjustYourSearchAndRetryf591c7") : t("pipeline.uploadedBedFilesCanBeSelectedIn41c346")} />
      ) : (
        <DataTable data={filteredFiles.slice((page-1)*20,page*20)} columns={localizeDisplay(columns, t)} rowKey="id" density="default" className="yj-data-table right-pinned-actions-table bed-center-table" />
      )}

      <ResourcePager page={page} total={filteredFiles.length} onChange={setPage} />
      <AppModal
        open={modalOpen}
        onOpenChange={(open) => !open && closeModal()}
        title={t("pipeline.uploadBedFilec83510")}
        size="medium"
        footer={<><Button variant="secondary" onClick={closeModal} disabled={uploading}>{t("admin.cancel4d0b46")}</Button><Button action="upload" variant="primary" onClick={handleUpload} disabled={!file || uploading || storageQuotaReached || Boolean(config?.temporary && !uploadPolicyAcknowledged)} >{uploading ? t("data.uploading2c0454", {p0: String(progress)}) : t("data.startUpload456565")}</Button></>}
      >
        <div className="space-y-5">
          <ModalSectionHeading icon={<FileText className="h-4 w-4" />} title={t("pipeline.fileInformation34f383")} description={t("pipeline.thisFileAppliesOnlyToTheSelected0148af")} />
          {uploadError && <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{uploadError}</div>}
          <FormItem label={t("pipeline.referenceGenome903ba5")} required>
            <Select value={referenceGenome} onChange={(value) => setReferenceGenome((Array.isArray(value) ? value[0] : value) as ReferenceGenome)} options={localizeDisplay(genomeOptions, t)} />
          </FormItem>
          <FormItem label={t("pipeline.bedFiles8ee058")} required hint={t("pipeline.supportsBedAndBedGzUpTo65773c")}>
            <FilePicker
              label={t("pipeline.bedFiles8ee058")}
              accept=".bed,.bed.gz,application/gzip"
              file={file}
              disabled={uploading}
              onChange={selected => { setFile(selected); setUploadError(''); }}
            />
          </FormItem>
          {config?.temporary && <div className="space-y-3 rounded-md border border-warning-muted bg-warning-subtle p-3 text-sm text-warning-fg"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("pipeline.iAllowLongTermStorageOfThis37917c")}</span></div><Checkbox checked={uploadPolicyAcknowledged} disabled={uploading} onCheckedChange={(checked) => setUploadPolicyAcknowledged(checked === true)} label={t("pipeline.iHaveReadAndAgree141d8c")} /></div>}
          {storageQuotaBytes !== null && <p className="text-xs text-fg-muted">{t("pipeline.allOrganizationDataSharesStorageCapacityUsed04200c")}{formatBytes(totalStorageBytes, t)}{t("data.totalCapacityd83765")}{formatBytes(storageQuotaBytes, t)}。</p>}
          {uploading && <div className="h-1.5 overflow-hidden rounded bg-canvas-subtle"><div className="h-full bg-accent-emphasis transition-[width]" style={{ width: `${progress}%` }} /></div>}
        </div>
      </AppModal>

      <AppModal
        open={deleting !== null}
        size="small"
        title={t("pipeline.deleteBedFile9a5f7b")}
        onOpenChange={(open) => { if (!open && !deleteBusy) setDeleting(null); }}
        footer={<><Button variant="secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>{t("admin.cancel4d0b46")}</Button><Button action="delete" variant="danger" disabled={deleteBusy} loading={deleteBusy}  onClick={() => void handleDelete()}>{t("data.confirmDeletion3c06ab")}</Button></>}
      >
        <p className="text-sm leading-6 text-fg-muted">{t("data.permanentlyDeletef2b694")}<span className="font-medium text-fg-default">{deleting?.file_name}</span> {t("data.andItsStoredObjectThisCannotBe97aee3")}</p>
      </AppModal>
    </PageContent>
  );
}

export default function BedFilesPage(){const {user,currentOrg}=useAuth();return <BedFilesPageContent key={`${user?.id??""}:${currentOrg?.id??""}`} />;}
