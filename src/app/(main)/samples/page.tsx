'use client';
import { useLiveRetention } from '@/lib/research-retention';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, translateUI, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { TableActions, TableAction } from '@/components/shared/TableActions';
import { ActionButton as Button } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';


import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { RetentionNotice, ExpiryCell } from '@/components/shared/ResearchPolicy';
import * as React from 'react';
import { Input, DataTable } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { AlertCircle, CheckCircle, Database, FileCheck, Link2, Search, XCircle } from 'lucide-react';
import { NewSampleModal, EditSampleModal, DataLinkModal } from './components';
import type { NewSampleFormData, EditSampleFormData } from './components';
import { ConfirmDialog, HoverText, IdCell, MetricTile } from '@/components/shared';
import { api } from '@/lib/api';
import { listSamples, normalizeSample, samplePayload } from '@/lib/samples';
import type { Sample } from './types';
import { GENDER_CONFIG } from './types';
import { downloadSampleList } from '@/lib/sample-export';

function formatDateTime(value: string, t: TextTranslator = chineseText): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || '-'
    : date.toLocaleString(t.locale, { hour12: false });
}

function areSamplesEqual(previous: Sample[], next: Sample[]): boolean {
  return previous.length === next.length && previous.every((sample, index) => {
    const candidate = next[index];
    const hpoTermsEqual = sample.hpoTerms.length === candidate.hpoTerms.length
      && sample.hpoTerms.every((term, termIndex) => (
        term.id === candidate.hpoTerms[termIndex].id
        && term.name === candidate.hpoTerms[termIndex].name
      ));
    const matchedPairEqual = sample.matchedPair === candidate.matchedPair
      || (sample.matchedPair !== null
        && candidate.matchedPair !== null
        && sample.matchedPair.r1Path === candidate.matchedPair.r1Path
        && sample.matchedPair.r2Path === candidate.matchedPair.r2Path);

    return sample.id === candidate.id
      && sample.internalId === candidate.internalId
      && sample.gender === candidate.gender
      && sample.age === candidate.age
      && sample.sampleType === candidate.sampleType
      && sample.batch === candidate.batch
      && sample.clinicalDiagnosis === candidate.clinicalDiagnosis
      && hpoTermsEqual
      && matchedPairEqual
      && sample.matchStatus === candidate.matchStatus
      && sample.matchMode === candidate.matchMode
      && sample.autoMatchEnabled === candidate.autoMatchEnabled
      && sample.remark === candidate.remark
      && sample.createdAt === candidate.createdAt
      && sample.updatedAt === candidate.updatedAt;
  });
}

function uniqueSamplesById(samples: Sample[]): Sample[] {
  const seen = new Set<string>();
  const unique: Sample[] = [];

  for (const sample of samples) {
    if (!sample.id || seen.has(sample.id)) continue;
    seen.add(sample.id);
    unique.push(sample);
  }

  return unique;
}

function HpoCell({ hpoTerms }: { hpoTerms: { id: string; name: string }[] }) {
  const t = useText();
  if (!hpoTerms || hpoTerms.length === 0) {
    return <span className="text-xs text-fg-muted">{t("samples.notEnteredd4bcc9")}</span>;
  }

  const visibleTerms = hpoTerms.slice(0, 2);
  const hiddenCount = hpoTerms.length - visibleTerms.length;

  return (
    <HoverHint
      content={
        <div className="text-sm space-y-1">
          {hpoTerms.map((term) => (
            <div key={term.id}>
              <span className="text-accent-fg font-mono">{term.id}</span>
              <span className="text-fg-default ml-1">{term.name}</span>
            </div>
          ))}
        </div>
      }
    >
      <div tabIndex={0} role="group" aria-label={t("samples.hpoPhenotypeDetailsad6278")} className="flex flex-wrap gap-1">
        {visibleTerms.map((term) => (
          <span
            key={term.id}
            className="inline-flex items-center rounded-md border border-accent-muted bg-accent-subtle px-1.5 py-0.5 font-mono text-[11px] text-accent-fg"
          >
            {term.id}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="inline-flex items-center rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] px-1.5 py-0.5 text-[11px] text-fg-muted">
            +{hiddenCount}
          </span>
        )}
      </div>
    </HoverHint>
  );
}

function MatchedCell({ sample }: { sample: Sample }) {
  const t = useText();
  const status = {
    matched: {
      label: t("samples.matched113028"),
      detail: sample.matchMode === 'manual' ? t("samples.readReadWereSelectedManuallyAutomaticMatching8468aa") : t("samples.readReadWereMatchedAutomaticallyUsingThe469d88"),
      className: 'border-success-muted bg-success-subtle text-success-fg',
      icon: <CheckCircle className="h-3.5 w-3.5" />,
    },
    partial: {
      label: t("samples.partiallyMatched4915a9"),
      detail: t("samples.onlyReadOrReadWasFoundAdd026051"),
      className: 'border-warning-muted bg-warning-subtle text-warning-fg',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    conflict: {
      label: t("samples.matchingConflict19785d"),
      detail: t("samples.multipleCandidatesShareThisNameAutomaticSelection208086"),
      className: 'border-danger-muted bg-danger-subtle text-danger-fg',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    missing: {
      label: t("data.fileMissingc3b3e1"),
      detail: t("samples.linkedDataExpiredOrIsInaccessibleUpload5125bc"),
      className: 'border-danger-muted bg-danger-subtle text-danger-fg',
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
    unmatched: {
      label: sample.autoMatchEnabled ? t("samples.awaitingMatching638d40") : t("samples.notEnabled8bb38e"),
      detail: sample.autoMatchEnabled
        ? t("samples.theSystemPeriodicallyMatchesReadReadBye48384")
        : t("samples.automaticMatchingIsDisabledForThisSamplef69a52"),
      className: 'border-border-default bg-canvas-subtle text-fg-muted',
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
  }[sample.matchStatus];

  return (
    <HoverHint content={
      <div className="max-w-xs space-y-1 text-sm">
        <p>{status.detail}</p>
        {sample.matchedPair && <><p><span className="text-fg-muted">R1:</span> {sample.matchedPair.r1Path}</p><p><span className="text-fg-muted">R2:</span> {sample.matchedPair.r2Path}</p></>}
      </div>
    }>
      <div tabIndex={0} role="group" aria-label={t("samples.sequencingDataMatchingDetails18b064")} className="inline-flex flex-col items-center gap-1">
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${status.className}`}>
          {status.icon}
          {translateUI(status.label, t)}
        </span>
      </div>
    </HoverHint>
  );
}

export default function SamplesPage() {
  const t = useText();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isNewSampleModalOpen, setIsNewSampleModalOpen] = React.useState(false);
  const [editingSample, setEditingSample] = React.useState<Sample | null>(null);
  const [linkingSample, setLinkingSample] = React.useState<Sample | null>(null);
  const [deleteTargets, setDeleteTargets] = React.useState<Sample[]>([]);
  const [rawSamples, setSamples] = React.useState<Sample[]>([]);
 const samples=useLiveRetention(rawSamples);
  const [samplesError, setSamplesError] = React.useState('');
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [readFailed, setReadFailed] = React.useState(false);
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());

  const matchedCount = React.useMemo(
    () => samples.filter((sample) => sample.matchStatus === 'matched').length,
    [samples]
  );
  const unmatchedCount = samples.length - matchedCount;
  const selectedSamples = React.useMemo(
    () => samples.filter((sample) => selectedRows.has(sample.id)),
    [samples, selectedRows]
  );


  const loadSamples = React.useCallback(async () => {
    setLoading(true);
    try {
      const loadedSamples = uniqueSamplesById(await listSamples({ page: '1', page_size: '100' }));
      const loadedIds = new Set(loadedSamples.map((sample) => sample.id));
      setSamples((previous) => areSamplesEqual(previous, loadedSamples) ? previous : loadedSamples);
      setSelectedRows((previous) => {
        const retainedIds = Array.from(previous).filter((id) => loadedIds.has(id));
        return retainedIds.length === previous.size ? previous : new Set(retainedIds);
      });
      setSamplesError('');
      setHasLoaded(true);
      setReadFailed(false);
    } catch (err) {
      setReadFailed(true);
      setSamplesError(err instanceof Error ? errorText(err, t) : t("samples.unableToReadSampledeec2e"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void loadSamples();
    const timer = window.setInterval(() => void loadSamples(), 15000);
    return () => window.clearInterval(timer);
  }, [loadSamples]);

  const handleDownloadTemplate = () => {
    const templateContent = t("samples.sampleIdInternalIdSexSampleType463874");
    const blob = new Blob(['\ufeff' + templateContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = t("samples.sampleImportTemplateCsvd79af8");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredSamples = React.useMemo(() => {
    if (!searchQuery) return samples;
    const query = searchQuery.toLowerCase();
    return samples.filter(
      (sample) =>
        sample.id.toLowerCase().includes(query) ||
        sample.internalId.toLowerCase().includes(query) ||
        sample.batch.toLowerCase().includes(query) ||
        sample.clinicalDiagnosis.toLowerCase().includes(query)
    );
  }, [searchQuery, samples]);

  const handleCreateSample = async (data: NewSampleFormData) => {
    try {
      const created = await api.post<unknown>('/v1/samples', samplePayload(data));
      const createdSample = normalizeSample(created);
      if (!createdSample.id) {
        throw new Error(t("samples.sampleCreatedButTheServerReturnedNo63d533"));
      }
      setSamples((prev) => uniqueSamplesById([createdSample, ...prev]));
      setSamplesError('');
    } catch (err) {
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToCreateSample8156e2");
      setSamplesError(message);
      throw new Error(message);
    }
  };

  const handleEditSample = async (id: string, data: EditSampleFormData) => {
    try {
      const updated = await api.put<unknown>(`/v1/samples/${encodeURIComponent(id)}`, samplePayload(data));
      setSamples((prev) => prev.map((sample) => sample.id === id ? normalizeSample(updated) : sample));
      setEditingSample(null);
      setSamplesError('');
    } catch (err) {
      const message = err instanceof Error ? errorText(err, t) : t("interface.failedToUpdateSample09681f");
      setSamplesError(message);
      throw new Error(message);
    }
  };

  const handleDeleteSamples = async () => {
    if (deleteTargets.length === 0) return;
    const results = await Promise.allSettled(
      deleteTargets.map((sample) => api.delete<void>(`/v1/samples/${encodeURIComponent(sample.id)}`))
    );
    const deletedIds = new Set<string>();
    const failedTargets: Sample[] = [];
    results.forEach((result, index) => {
      const sample = deleteTargets[index];
      if (result.status === 'fulfilled') deletedIds.add(sample.id);
      else failedTargets.push(sample);
    });

    if (deletedIds.size > 0) {
      setSamples((prev) => prev.filter((sample) => !deletedIds.has(sample.id)));
      setSelectedRows((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
    if (failedTargets.length > 0) {
      setDeleteTargets(failedTargets);
      const message = t("samples.unableToDeleteSamplesRetryc2e2ec", {p0: String(failedTargets.length)});
      setSamplesError(message);
      throw new Error(message);
    }
    setSamplesError('');
  };

  const handleSelectionChange = (nextSelection: Set<string>) => {
    setSelectedRows(new Set(nextSelection));
  };

  const columns: Column<Sample>[] = [
    ...(getRuntimeBackendFlavor() === 'squid' ? [{id:'expiresAt',header:t('research.expiresAt'),accessor:(row:Sample)=><ExpiryCell value={row.expiresAt} />,width:170}] : []),
    {
      id: 'internalId',
      header: t("data.internalIdabcc9d"),
      accessor: (row) => <HoverText value={row.internalId} className="text-sm font-semibold text-[var(--yj-text-strong)]" />,
      width: 154,
      minWidth: 140,
      maxWidth: 220,
    },
    {
      id: 'uuid',
      header: 'UUID',
      accessor: (row) => <IdCell id={row.id} full />,
      width: 300,
      minWidth: 300,
      maxWidth: 300,
    },
    {
      id: 'createdAt',
      header: t("admin.createdAt84e380"),
      accessor: (row) => <span className="whitespace-nowrap text-xs tabular-nums text-fg-muted">{formatDateTime(row.createdAt, t)}</span>,
      width: 156,
      minWidth: 150,
      maxWidth: 190,
    },
    {
      id: 'gender',
      header: t("samples.sexfe8aa4"),
      accessor: (row) => {
        const gender = GENDER_CONFIG[row.gender];
        return (
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${gender.color}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {translateUI(gender.label, t)}
          </span>
        );
      },
      width: 72,
      minWidth: 68,
      maxWidth: 90,
      align: 'center',
    },
    {
      id: 'age',
      header: t("samples.age28c02e"),
      accessor: (row) => row.age !== undefined
        ? <span className="whitespace-nowrap text-sm tabular-nums text-fg-default">{row.age} {t("samples.yearsb4e3bd")}</span>
        : <span className="text-xs text-fg-muted">{t("samples.notEnteredd4bcc9")}</span>,
      width: 78,
      minWidth: 72,
      maxWidth: 96,
      align: 'center',
    },
    {
      id: 'sampleType',
      header: t("samples.sampleType686c81"),
      accessor: (row) => (
        <span className="inline-flex whitespace-nowrap rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] px-2 py-1 text-xs text-fg-default">
          {t(row.sampleType)}
        </span>
      ),
      width: 96,
      minWidth: 88,
      maxWidth: 120,
      align: 'center',
    },
    {
      id: 'batch',
      header: t("samples.batch6b2cf2"),
      accessor: (row) => row.batch
        ? <HoverHint content={row.batch}><span className="block truncate font-mono text-xs text-fg-default" >{row.batch}</span></HoverHint>
        : <span className="text-xs text-fg-muted">{t("samples.unassigned3bb92e")}</span>,
      width: 132,
      minWidth: 120,
      maxWidth: 190,
    },
    {
      id: 'clinicalDiagnosis',
      header: t("samples.clinicalDiagnosis654a81"),
      accessor: (row) => (
        <HoverHint content={row.clinicalDiagnosis}><span className={`block max-w-[240px] truncate text-sm ${row.clinicalDiagnosis ? 'text-fg-default' : 'text-fg-muted'}`} >
          {row.clinicalDiagnosis || t("samples.notEnteredd4bcc9")}
        </span></HoverHint>
      ),
      width: 210,
      minWidth: 190,
      maxWidth: 280,
    },
    {
      id: 'hpoTerms',
      header: t("samples.hpoPhenotypesaa3ea5"),
      accessor: (row) => <HpoCell hpoTerms={row.hpoTerms} />,
      width: 176,
      minWidth: 160,
      maxWidth: 240,
    },
    {
      id: 'matchedPair',
      header: t("samples.sequencingDataef4c3a"),
      accessor: (row) => <MatchedCell sample={row} />,
      width: 126,
      minWidth: 118,
      maxWidth: 150,
      align: 'center',
    },
    {
      id: 'remark',
      header: t("admin.notese03614"),
      accessor: (row) => (
        <span className={row.remark ? 'block max-w-[180px] truncate text-sm text-fg-default' : 'text-xs text-fg-muted'}>
          {row.remark || t("samples.none720777")}
        </span>
      ),
      width: 160,
      minWidth: 140,
      maxWidth: 220,
    },
    {
      id: 'actions',
      header: t("admin.actionsf3ea6d"),
      accessor: (row) => (
        <TableActions>
          <TableAction label={t("samples.linkdc91aa")} leftIcon={<Link2 />} hint={row.matchedPair ? t("samples.updateDataAssociation3bcbb3") : t("samples.linkDataManuallydb3c91")} aria-label={t("samples.linkSequencingData7a6f18")} onClick={() => setLinkingSample(row)} />
          <TableAction action="edit" label={t("admin.edita7f814")} onClick={() => setEditingSample(row)} />
          <TableAction action="delete" label={t("data.delete3755f5")} tone="danger" onClick={() => setDeleteTargets([row])} />
        </TableActions>
      ),
      width: 194,
      minWidth: 194,
      maxWidth: 194,
      align: 'center',
      pinned: 'right',
    },
  ];

  return (
    <div className="h-full overflow-auto p-6 xl:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="yj-page-title">
            {t("samples.sampleManagement824d92")}</h2>
          <p className="mt-2 text-sm text-fg-muted">
            {t("samples.manageSampleRegistrationClinicalInformationAndSequencing452c6a")}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 max-sm:[&>div:last-child]:col-span-2 sm:w-auto sm:grid-cols-3">
          <MetricTile
            label={t("common.totalSamplesd7dd99")}
            value={hasLoaded ? samples.length : '—'}
            icon={<Database className="h-4 w-4" />}
          />
          <MetricTile
            label={t("samples.matched113028")}
            value={hasLoaded ? matchedCount : '—'}
            icon={<FileCheck className="h-4 w-4" />}
            tone="success"
          />
          <MetricTile
            label={t("samples.awaitingMatching638d40")}
            value={hasLoaded ? unmatchedCount : '—'}
            icon={<AlertCircle className="h-4 w-4" />}
            tone="warning"
          />
        </div>
      </div>

      <div className="yj-panel overflow-hidden">
        <div className="yj-panel-header flex-wrap gap-4 px-5 py-4">
          <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-3">
            <div className="w-full max-w-[380px]">
              <Input
                id="samples-search"
                placeholder={t("samples.searchSampleIdInternalIdBatchOr92f74f")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftElement={<Search className="h-4 w-4" />}
              />
            </div>
            <span className="text-sm text-fg-muted">
              {hasLoaded ? t("samples.showingRecordsfcdf7b", {p0: String(filteredSamples.length), p1: String(samples.length)}) : '—'}
            </span>
            {selectedRows.size > 0 && (
              <span className="whitespace-nowrap rounded-md bg-[var(--yj-sage-subtle)] px-2 py-1 text-xs font-medium text-green-700">
                {t("samples.selected6b6312")}{selectedRows.size} {t("samples.items12de8e")}</span>
            )}
          </div>
          <div className="yj-toolbar w-full flex-wrap sm:w-auto sm:flex-nowrap">
            <Button action="export" variant="secondary" disabled={readFailed || selectedSamples.length === 0} onClick={() => {
              try { downloadSampleList(selectedSamples, t.locale); }
              catch (cause) { setSamplesError(cause instanceof Error ? errorText(cause, t) : t("samples.unableToExportSampleListaf8c42")); }
            }}>
              {t("samples.exportSelectedSamples13970e")}{selectedSamples.length > 0 ? ` (${selectedSamples.length})` : ''}
            </Button>
            <Button action="delete"
              variant="danger"

              disabled={selectedSamples.length === 0}
              onClick={() => setDeleteTargets(selectedSamples)}
            >
              {t("samples.deleteSelected362aed")}{selectedSamples.length > 0 ? ` (${selectedSamples.length})` : ''}
            </Button>
            {getRuntimeBackendFlavor() !== 'squid' && <Button action="download"
              variant="secondary"

              onClick={handleDownloadTemplate}
            >
              {t("samples.downloadTemplatea3afb2")}</Button>}
            <HoverHint content={t("admin.refresh38108e")}><Button action="refresh" variant="secondary" aria-label={t("admin.refresh38108e")} disabled={loading} onClick={() => void loadSamples()} >{t("admin.refresh38108e")}</Button></HoverHint>
            <Button action="add"
              variant="primary"

              onClick={() => setIsNewSampleModalOpen(true)}
            >
              {t("samples.newSample595c27")}</Button>
          </div>
        </div>

        <div className="p-4">
          <RetentionNotice kind="sample" />
          {samplesError && (
            <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
              <span>{samplesError}</span>
              {readFailed && <Button action="retry" variant="secondary" size="small" disabled={loading} onClick={() => void loadSamples()}>{t("billing.retryLoading7b4939")}</Button>}
            </div>
          )}
          {!hasLoaded && loading ? <div className="yj-empty-state text-sm text-fg-muted">{t("samples.loadingSamples20c029")}</div> : readFailed && samples.length === 0 ? null : filteredSamples.length > 0 ? (
            <DataTable
              data={filteredSamples}
              columns={localizeDisplay(columns, t)}
              rowKey="id"
              selectable
              selectionMode="multiple"
              selectedRows={selectedRows}
              onSelectionChange={handleSelectionChange}
              onRowDoubleClick={(row) => setEditingSample(row)}
              stickyHeader
              density="comfortable"
              className="yj-data-table right-pinned-actions-table sample-management-table"
            />
          ) : (
            <div className="yj-empty-state">
              <div>
                <span className="yj-empty-state-icon"><Database className="h-5 w-5" /></span>
                <p className="text-sm font-medium text-fg-default">{searchQuery.trim() ? t("samples.noMatchingSamples9c4cc2") : t("samples.noSamples5f3ff3")}</p>
                <p className="mt-1 text-xs text-fg-muted">{searchQuery.trim() ? t("samples.adjustSearchCriteria018995") : t("samples.createASampleToRegisterClinicalInformation03cb00")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewSampleModal
        isOpen={isNewSampleModalOpen}
        onClose={() => setIsNewSampleModalOpen(false)}
        onSubmit={handleCreateSample}
      />

      <EditSampleModal
        isOpen={editingSample !== null}
        onClose={() => setEditingSample(null)}
        onSubmit={handleEditSample}
        sample={editingSample}
      />

      <DataLinkModal
        open={linkingSample !== null}
        sample={linkingSample}
        onOpenChange={(open) => {
          if (!open) setLinkingSample(null);
        }}
        onSaved={loadSamples}
      />

      <ConfirmDialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setDeleteTargets([]);
        }}
        title={deleteTargets.length > 1 ? t("samples.deleteMultipleSamplese8bb11") : t("samples.deleteSample09d69a")}
        message={deleteTargets.length > 1
          ? t("samples.deleteSelectedSamplesDataAssociationsWillAlsocf4605", {p0: String(deleteTargets.length)})
          : t("samples.deleteSampleDataAssociationsWillAlsoBe7e9048", {p0: String(deleteTargets[0]?.internalId ?? '')})}
        confirmLabel={deleteTargets.length > 1 ? t("samples.deleteSamples81c572", {p0: String(deleteTargets.length)}) : t("data.confirmDeletion3c06ab")}
        variant="danger"
        onConfirm={handleDeleteSamples}
      />
    </div>
  );
}
