'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { localizeDisplay } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';


import { GeneLinks } from './GeneLinks';

import * as React from 'react';
import { DataTable, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { PaginatedResult, ROHRegion, TableFilterState } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getROHRegions, reportVariant, pinVariant } from '../result-api';
import { filterableColumns, resultColumnLabels } from './ResultColumnFilter';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { PinCheckbox, ReportCheckbox, PinColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

interface ROHTabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

export function ROHTab({ taskId, filterState: externalFilterState, onFilterChange }: ROHTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<ROHRegion> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { pinned: boolean; reported: boolean }>>({});
  React.useEffect(()=>{
    const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table==='roh')setReviewStatus({});};
    window.addEventListener('yijian:result-overlays-synced',sync);
    return()=>window.removeEventListener('yijian:result-overlays-synced',sync);
  },[taskId]);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setRequestError(null);
      try {
        const data = await getROHRegions(taskId, filterState, controller.signal);
        if (!controller.signal.aborted) setResult(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRequestError(error instanceof Error ? errorText(error, t) : t("tasks.unableToLoadRohRegions0cdbab"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadData();
    return () => controller.abort();
  }, [taskId, filterState]);

  const handleSearch = React.useCallback((query: string) => {
    setFilterState({ ...filterState, searchQuery: query, page: 1 });
  }, [filterState, setFilterState]);
  const [searchInput, setSearchInput] = useDebouncedSearch(filterState.searchQuery, handleSearch);

  const handleSortChange = React.useCallback((column: string, direction: 'asc' | 'desc' | null) => {
    setFilterState({
      ...filterState,
      sortColumn: direction ? column : undefined,
      sortDirection: direction ?? undefined,
    });
  }, [filterState, setFilterState]);

  const handlePinChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; reported: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, pinned: checked },
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await pinVariant(taskId, 'roh', id, checked);
    } catch (error) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
      setOperationError(error instanceof Error ? errorText(error, t) : t("tasks.unableToUpdatePinStatus77c5f1"));
    } finally {
      setPendingVariantIDs((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }, [taskId, t]);

  const handleReportChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; reported: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reported: checked },
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await reportVariant(taskId, 'roh', id, checked);
    } catch (error) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
      setOperationError(error instanceof Error ? errorText(error, t) : t("tasks.unableToMarkForReport8d3bd6"));
    } finally {
      setPendingVariantIDs((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }, [taskId, t]);

  const getReviewState = React.useCallback((region: ROHRegion) => {
    return reviewStatus[region.id] ?? { pinned: region.pinned, reported: region.reported };
  }, [reviewStatus]);

  const sortedData = result?.data ?? [];

  const columns: Column<ROHRegion>[] = [
    {
      id: 'reported',
      header: <ReportColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return <ReportCheckbox checked={state.reported} disabled={pendingVariantIDs.has(row.id)} onChange={(checked) => handleReportChange(row.id, checked, state)} />;
      },
      width: 60,
    },
    {
      id: 'pinned',
      header: <PinColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return <PinCheckbox checked={state.pinned} source={reviewStatus[row.id]?'manual':row.pinSource} reasons={row.pinReasons?.length?row.pinReasons:row.automaticAssessment?.pending} disabled={pendingVariantIDs.has(row.id)} onChange={(checked) => handlePinChange(row.id, checked, state)} />;
      },
      width: 60,
    },
    { id: 'chromosome', header: t("history.chromosome326659"), accessor: 'chromosome', width: 80, sortable: true },
    { id: 'startPosition', header: t("tasks.startPositione89b02"), accessor: 'startPosition', width: 120, sortable: true },
    { id: 'endPosition', header: t("tasks.endPositioncb3b4c"), accessor: 'endPosition', width: 120, sortable: true },
    {
      id: 'sizeMb',
      header: t("history.lengtha53949"),
      accessor: (row) => `${formatNumericString(row.sizeMb.toFixed(2), t.locale)}Mb`,
      width: 100,
      sortable: true,
    },
    { id: 'variantCount', header: t("tasks.locusCount6e52c3"), accessor: 'variantCount', width: 90, sortable: true },
    {
      id: 'homozygosity',
      header: t("tasks.homozygousFraction3d63fc"),
      accessor: (row) => `${formatNumericString(row.homozygosity.toFixed(2), t.locale)}%`,
      width: 100,
      sortable: true,
    },
    {
      id: 'genes',
      header: t("tasks.recessiveDiseaseGenes1759f9"),
      accessor: (row) => <GeneLinks genes={row.genes} />,
      width: 220,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="variant-tab-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="yj-variant-toolbar">
      <ParquetColumnFilterBar taskId={taskId} table="roh" columns={localizeDisplay(result?.columns ?? [], t)} columnTypes={result?.columnTypes} columnLabels={resultColumnLabels(columns, result, 'roh', t)} state={filterState} onChange={setFilterState} />
      <div className="yj-variant-controls-row">
        <div className="w-52 max-w-full shrink-0 sm:w-64">
          <Input
              className="yj-variant-search [&_input]:min-w-0 [&_input]:w-0"
            placeholder={t("tasks.searchChromosomesOrGenes1bdc34")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="text-sm text-fg-muted">{t("history.total497064")}{result?.total ?? 0} {t("tasks.rohRegions1282ce")}</div>
      </div>
      </div>

      {requestError ? (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-3 text-sm text-danger-fg">
          {requestError}
          <ActionButton action="retry" variant="ghost" onClick={() => setFilterState({ ...filterState })} className="ml-3 underline">{t("pipeline.retrye2d53a")}</ActionButton>
        </div>
      ) : loading && !result ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-emphasis" />
        </div>
      ) : result ? (
        <>
          <DataTable
            className="variant-results-table min-h-0 flex-1"
            stickyHeader
            data={sortedData}
            columns={localizeDisplay(filterableColumns(columns, result, filterState, setFilterState, 'roh', t), t)}
            rowKey="id"
            striped
            density="compact"
            sortColumn={filterState.sortColumn}
            sortDirection={filterState.sortDirection}
            onSortChange={handleSortChange}
          />

          {totalPages > 1 && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 mt-2">
              <div className="text-sm text-fg-muted">
                {t("history.pagef49534")}{filterState.page} / {totalPages} {t("history.labelaf8438")}</div>
              <div className="flex items-center gap-2">
                <ActionButton variant="ghost"
                  onClick={() => setFilterState({ ...filterState, page: filterState.page - 1 })}
                  disabled={filterState.page <= 1}
                  className="yj-tool-button"
                >
                  {t("history.previousb41561")}</ActionButton>
                <ActionButton variant="ghost"
                  onClick={() => setFilterState({ ...filterState, page: filterState.page + 1 })}
                  disabled={filterState.page >= totalPages}
                  className="yj-tool-button"
                >
                  {t("history.next67a246")}</ActionButton>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-fg-muted">{t("tasks.noRohRegionData6dbcee")}</div>
      )}
      {operationError && (
        <div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{operationError}</div>
      )}
    </div>
  );
}
