'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, translateUI, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { TableActions, TableAction } from '@/components/shared/TableActions';
import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';


import * as React from 'react';
import { PageContent } from '@/components/layout';
import { AppModal, ConfirmDialog, EmptyState } from '@/components/shared';
import { DataTable, FormItem, Input, Select, type Column } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { AlertTriangle, Coins, Database, Loader2, Search } from 'lucide-react';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import { createCNVBaseline, deleteCNVBaseline, listCNVBaselines, type CNVBaseline, type CNVBaselineStatus } from '@/lib/cnv-baselines';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { AssetMultiSelect } from './AssetMultiSelect';
import { getBillingConfig } from '@/lib/billing';
import { useAuth } from '@/components/providers/AuthProvider';
import { BUILTIN_CNV_BASELINES, resourceDisplayName } from '@/lib/builtin-resources';
import { buildCNVSamplePairs, selectedCNVSamplePairs } from '@/lib/cnv-sample-pairs';

type ReferenceGenome = 'GRCh37' | 'GRCh38';

const genomeOptions = [
  { value: 'GRCh37', label: 'GRCh37 (hg19)' },
  { value: 'GRCh38', label: 'GRCh38 (hg38)' },
];

const statusLabels: Record<CNVBaselineStatus, string> = {
  queued: '排队中', waiting_for_data: '等待数据', running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消',
};

function statusVariant(status: CNVBaselineStatus): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'running' || status === 'queued' || status === 'waiting_for_data') return 'warning';
  return 'neutral';
}

function formatTime(value: string, t: TextTranslator = chineseText): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(t.locale, { hour12: false });
}

function assetOptions(assets: DataAsset[]) {
  return assets.map((asset) => ({ value: asset.id, label: `${asset.file_name} · ${asset.id.slice(0, 8)}` }));
}

export default function BaselinePage() {
  const t = useText();
  const { user, currentOrg } = useAuth();
  const scope = `${user?.id || ''}:${currentOrg?.id || ''}`;
  const loadGeneration = React.useRef(0);
  const assetController = React.useRef<AbortController | null>(null);
  const [creditRate, setCreditRate] = React.useState<number | null>(null);
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [searchQuery, setSearchQuery] = React.useState('');
  const [items, setItems] = React.useState<CNVBaseline[]>([]);
  const [assets, setAssets] = React.useState<DataAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CNVBaseline | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [name, setName] = React.useState('');
  const [genome, setGenome] = React.useState<ReferenceGenome>('GRCh38');
  const [bedID, setBedID] = React.useState('');
  const [pairIDs, setPairIDs] = React.useState<string[]>([]);
  const [pairsOpen, setPairsOpen] = React.useState(false);

  const loadData = React.useCallback(async () => {
    const generation = ++loadGeneration.current;
    assetController.current?.abort();
    const controller = new AbortController(); assetController.current = controller;
    setLoading(true); setError('');
    try {
      const dataPromise = (async () => {
        const all: DataAsset[] = []; let page = 1;
        while (true) {
          const result = await listDataAssets('', { status: 'completed', page, signal: controller.signal });
          all.push(...result.items);
          if (page >= result.total_pages) break;
          page += 1;
        }
        return Array.from(new Map(all.map(asset => [asset.id, asset])).values());
      })();
      const [baselines, data] = await Promise.all([listCNVBaselines(), dataPromise]);
      if (generation !== loadGeneration.current || controller.signal.aborted) return;
      setItems([...BUILTIN_CNV_BASELINES, ...baselines]); setAssets(data);
    } catch (err) {
      if (generation === loadGeneration.current && !controller.signal.aborted) setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToLoadCnvBaselines50b9e8"));
    } finally { if (generation === loadGeneration.current) setLoading(false); }
  }, [scope, t]);

  React.useEffect(() => {
    setModalOpen(false); setDeleting(null); setName(''); setBedID(''); setPairIDs([]); setAssets([]); setItems([]); setFormError('');
    void loadData();
    return () => { ++loadGeneration.current; assetController.current?.abort(); };
  }, [loadData]);
  React.useEffect(() => {
    setCreditRate(null);
    if (!isSaaS) return;
    let disposed = false;
    void getBillingConfig().then(config => { if (!disposed) setCreditRate(config.cnv_baseline_credits_per_gib ?? null); }).catch(() => {});
    return () => { disposed = true; };
  }, [isSaaS, scope]);
  React.useEffect(() => {
    if (!items.some(item => !item.is_builtin && ['queued', 'waiting_for_data', 'running'].includes(item.status))) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void listCNVBaselines().then(rows => { if (!disposed) setItems([...BUILTIN_CNV_BASELINES, ...rows]); }).catch(() => {});
    }, 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [items, scope]);

  const samplePairs = React.useMemo(() => buildCNVSamplePairs(assets), [assets]);
  const pairOptions = React.useMemo(() => samplePairs.map(pair => ({ value: pair.id, label: pair.label, description: `Read1: ${pair.read1.file_name}\nRead2: ${pair.read2.file_name}` })), [samplePairs]);
  const selectedPairs = React.useMemo(() => pairIDs.flatMap(id => samplePairs.filter(pair => pair.id === id)), [samplePairs, pairIDs]);
  const bedOptions = React.useMemo(() => assetOptions(assets.filter((asset) => asset.read_type === 'bed' && asset.validation_status==='valid' && asset.reference_genome === genome)), [assets, genome]);
  const selectedInputBytes = React.useMemo(() => {
    return selectedPairs.reduce((total, pair) => total + pair.read1.file_size + pair.read2.file_size, 0);
  }, [selectedPairs]);
  const estimatedCredits = creditRate === null ? null : Math.ceil(selectedInputBytes / (1024 ** 3)) * creditRate;

  const filteredItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.name.toLowerCase().includes(query) || item.reference_genome.toLowerCase().includes(query) || item.bed.file_name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false); setName(''); setBedID(''); setPairIDs([]); setFormError('');
  };

  const handleCreate = async () => {
    if (submitting) return;
    if (!name.trim() || !bedID || pairIDs.length === 0) {
      setFormError(t("pipeline.enterANameSelectBedAndChoose656623"));
      return;
    }
    const generation = loadGeneration.current;
    setSubmitting(true); setFormError('');
    try {
      const pairs = selectedCNVSamplePairs(assets, pairIDs);
      const created = await createCNVBaseline({ name: name.trim(), reference_genome: genome, bed_asset_id: bedID, read1_asset_ids: pairs.map(pair => pair.read1.id), read2_asset_ids: pairs.map(pair => pair.read2.id) });
      if (generation !== loadGeneration.current) return;
      setItems((current) => [created, ...current]);
      setModalOpen(false); setName(''); setBedID(''); setPairIDs([]); setFormError('');
      setSubmitting(false);
    } catch (err) {
      if (generation === loadGeneration.current) setFormError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToCreateCnvBaselineTask744668"));
    } finally { setSubmitting(false); }
  };

  const columns: Column<CNVBaseline>[] = [
    { id: 'name', header: t("pipeline.baselineName97a06f"), accessor: (row) => resourceDisplayName(row.id, row.name, t), width: 190, align: 'left' },
    { id: 'reference', header: t("pipeline.referenceGenome903ba5"), accessor: (row) => <Tag variant="info">{row.reference_genome}</Tag>, width: 120, align: 'center' },
    { id: 'data', header: t("pipeline.dataGroupse12c50"), accessor: (row) => row.is_builtin ? '-' : t("pipeline.rRPairs41bb65", {p0: String(row.read_pairs.length)}), width: 110, align: 'center' },
    ...(isSaaS ? [{ id: 'credits', header: t("pipeline.creditsb3e265"), accessor: (row: CNVBaseline) => row.is_builtin ? '-' : t("pipeline.credits0193ac", {p0: String(row.credits_charged || row.credit_cost)}), width: 90, align: 'center' as const }] : []),
    { id: 'bed', header: t("pipeline.bedFiles8ee058"), accessor: (row) => <HoverHint content={resourceDisplayName(row.bed.id, row.bed.file_name, t)}><span className="block truncate" >{resourceDisplayName(row.bed.id, row.bed.file_name, t)}</span></HoverHint>, width: 220, align: 'left' },
    { id: 'status', header: t("admin.status62e951"), accessor: (row) => row.is_builtin ? <Tag variant="success">{t("pipeline.builtInAvailablece8d4a")}</Tag> : row.start_error ? <Tag variant="danger">{t("pipeline.submissionError00b115")}</Tag> : <Tag variant={statusVariant(row.status)}>{translateUI(statusLabels[row.status], t)}{row.status === 'running' ? ` ${row.progress}%` : ''}</Tag>, width: 130, align: 'center' },
    { id: 'output', header: t("pipeline.baselineOutputc3704f"), accessor: (row) => <HoverHint content={row.start_error || row.output_path || row.error}><span className="block max-w-[300px] truncate font-mono text-xs" >{row.is_builtin ? t("pipeline.builtInResources3e067f") : row.start_error || row.output_path || (row.status === 'failed' ? row.error || t("pipeline.executionFailed9746cf") : '-')}</span></HoverHint>, width: 300, align: 'left' },
    { id: 'created', header: t("admin.createdAt84e380"), accessor: (row) => row.is_builtin ? '-' : formatTime(row.created_at, t), width: 170, align: 'center' },
    { id: 'actions', header: t("admin.actionsf3ea6d"), accessor: (row) => row.is_builtin
      ? <span className="text-xs text-fg-muted">{t("pipeline.readOnlyffc1d0")}</span>
      : <TableActions><TableAction action="delete" label={t("data.delete3755f5")} tone="danger" aria-label={t("pipeline.delete05cefd", {p0: String(row.name)})} disabled={['queued', 'waiting_for_data', 'running'].includes(row.status)} hint={['queued', 'waiting_for_data', 'running'].includes(row.status) ? t("pipeline.canBeDeletedAfterCalibrationFinishes14d5f8") : t("pipeline.deleteCustomBaseline25cb0b")} onClick={() => setDeleting(row)} /></TableActions>, width: 128, minWidth: 128, pinned: 'right', align: 'center' },
  ];

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header"><div><h2 className="yj-page-title">{t("pipeline.cnvBaselinefd84b0")}</h2><p className="yj-page-subtitle">{t("pipeline.calibrateBuiltInCnvBaselinesWithSelectedccc394")}</p></div></div>
      <div className="mb-2 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
        <span>{t("pipeline.cnvBaselinesAreCalibratedFromBuiltInb4f70e")}</span>
      </div>
      <div className="yj-toolbar-panel">
        <div className="w-full sm:w-72"><Input placeholder={t("pipeline.searchNameGenomeOrBed21acca")} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} leftElement={<Search className="h-4 w-4" />} /></div>
        <Button action="add" variant="primary" className="shrink-0 whitespace-nowrap"  disabled={loading || !!error} onClick={() => setModalOpen(true)}>{t("pipeline.calibrateBuiltInCnvBaseline652cda")}</Button>
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg"><span className="min-w-0 break-words">{error}</span><ActionButton permission={null} action="retry" variant="ghost" type="button" className="yj-tool-button" disabled={loading} onClick={() => void loadData()}>{t("billing.retryLoading7b4939")}</ActionButton></div>}
      {loading ? <div className="yj-empty-state"><Loader2 className="h-6 w-6 animate-spin text-accent-fg" /><p className="text-fg-muted">{t("pipeline.loadingCnvBaselinesdeab54")}</p></div> : error && items.length === 0 ? null : filteredItems.length === 0 ? <EmptyState className="yj-panel" icon={<Database />} title={searchQuery.trim() ? t("pipeline.noMatchingCnvBaselines4b0bd0") : t("pipeline.noCnvBaselinesc371fa")} description={searchQuery.trim() ? t("pipeline.adjustYourSearchAndRetryf591c7") : t("pipeline.selectUploadedRRDataAndBed712257")} /> : <DataTable data={filteredItems} columns={localizeDisplay(columns, t)} rowKey="id" density="default" className="yj-data-table right-pinned-actions-table baseline-center-table" />}

      <AppModal closeOnEscape={!pairsOpen} open={modalOpen} onOpenChange={(open) => !open && closeModal()} title={t("pipeline.calibrateBuiltInCnvBaseline652cda")} size="large" footer={<><Button variant="secondary" onClick={closeModal} disabled={submitting}>{t("admin.cancel4d0b46")}</Button><Button loading={submitting} loadingLabel={t("pipeline.submittinge2d944")} variant="primary" onClick={handleCreate} disabled={submitting || !name.trim() || !bedID || pairIDs.length === 0 || selectedPairs.length !== pairIDs.length} leftIcon={<Database className="h-4 w-4" />}>{t("pipeline.startCalibrationPipeline285e3b")}</Button></>}>
        <div className="space-y-5">
          <div role="note" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("pipeline.calibrateTheBuiltInBaselineWithSelected0c0f7a")}</span></div>
          {formError && <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{formError}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormItem label={t("pipeline.baselineName97a06f")} required><Input maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("pipeline.forExampleGrchWesNormalQ377821")} /></FormItem>
            <FormItem label={t("pipeline.referenceGenome903ba5")} required><Select value={genome} onChange={(value) => { setGenome((Array.isArray(value) ? value[0] : value) as ReferenceGenome); setBedID(''); }} options={localizeDisplay(genomeOptions, t)} /></FormItem>
          </div>
          <FormItem label={t("pipeline.sampleGroups5d1b88")} required hint={t("pipeline.sampleGroupsSelectedEachContainsPairedReadc7e5ae", {p0: String(selectedPairs.length)})}><AssetMultiSelect label={t("pipeline.sampleGroups5d1b88")} unit={t("组样本")} value={pairIDs} onChange={setPairIDs} onOpenChange={setPairsOpen} options={pairOptions} disabled={submitting} /></FormItem>
          <p className="text-xs leading-5 text-fg-muted">{t("pipeline.pairByDataIdFirstThenFilenamecbcd4d")}</p>
          {selectedPairs.length > 0 && <div className="overflow-x-auto rounded-md border border-border-default"><table className="w-full min-w-[460px] text-left text-xs"><caption className="border-b border-border-default bg-canvas-subtle px-3 py-2 text-left">{t("pipeline.selectedSampleGroupsReadReadSubmittedTogether8b17f0")}</caption><thead><tr><th className="p-2">{t("history.sample610da8")}</th><th className="p-2">Read1</th><th className="p-2">Read2</th></tr></thead><tbody>{selectedPairs.map(pair => <tr key={pair.id} className="border-t border-border-default"><td className="break-all p-2">{pair.label}</td><td className="max-w-48 break-all p-2">{pair.read1.file_name}</td><td className="max-w-48 break-all p-2">{pair.read2.file_name}</td></tr>)}</tbody></table></div>}
          <FormItem label={t("pipeline.bedFiles8ee058")} required hint={t("pipeline.onlyAvailableBedFilesForAreShown678dcf", {p0: String(genome)})}><Select searchable value={bedID} onChange={(value) => setBedID(Array.isArray(value) ? value[0] : value)} options={bedOptions} placeholder={bedOptions.length ? t("pipeline.selectBedFile4585dc") : t("pipeline.noBedFilesFor88b79e", {p0: String(genome)})} disabled={bedOptions.length === 0} /></FormItem>
          {isSaaS && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-default bg-canvas-subtle px-4 py-3"><div className="flex items-center gap-2"><Coins className="h-4 w-4 text-accent-fg" /><div><div className="text-sm font-medium text-fg-default">{estimatedCredits === null ? t("pipeline.estimatedCreditsUnavailable91c3b5") : t("pipeline.estimatedCostCredits1e7fdd", {p0: String(estimatedCredits)})}</div><div className="mt-0.5 text-xs text-fg-muted">{t("pipeline.billedOnTotalRRSizeRoundede291a1")}{creditRate === null ? t("pipeline.finalCostFollowsServerBillingSettingsc816c1") : t("pipeline.creditsPerGibLessThanGibIs700984", {p0: String(creditRate)})}</div></div></div><div className="shrink-0 text-xs text-fg-muted">{formatNumericString((selectedInputBytes / (1024 ** 3)).toFixed(2), t.locale)} GiB</div></div>}
        </div>
      </AppModal>
      <ConfirmDialog key={scope} open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} title={t("pipeline.deleteCnvBaseline87ea69")} confirmLabel={t("data.confirmDeletion3c06ab")} variant="danger" message={t("pipeline.deleteCustomBaselineTaskRecordsAndArchived2baf2e", {p0: String(deleting?.name ?? '')})} onConfirm={async () => {
        if (!deleting || deleting.is_builtin) return;
        const generation = loadGeneration.current;
        await deleteCNVBaseline(deleting.id);
        if (generation !== loadGeneration.current) return;
        await loadData();
      }} />
    </PageContent>
  );
}
