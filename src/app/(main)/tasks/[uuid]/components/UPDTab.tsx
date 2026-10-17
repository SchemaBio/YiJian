'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';


import { GeneLinks } from './GeneLinks';

import * as React from 'react';
import { DataTable, Input } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { UPDRegion, UPDType, TableFilterState, PaginatedResult } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getUPDRegions, focusVariant, pinVariant } from '../result-api';
import { filterableColumns, resultColumnLabels } from './ResultColumnFilter';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { PinCheckbox, FocusCheckbox, PinColumnHeader, FocusColumnHeader } from './ReviewCheckboxes';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

interface UPDTabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

// UPD类型配置
const UPD_TYPE_CONFIG: Record<UPDType, { label: string; variant: 'info' | 'warning' | 'neutral' }> = {
  Isodisomy: { label: '等位UPD', variant: 'warning' },
  Heterodisomy: { label: '异位UPD', variant: 'info' },
  Unknown: { label: '未提供', variant: 'neutral' },
};

export function UPDTab({
  taskId,
  filterState: externalFilterState,
  onFilterChange
}: UPDTabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<UPDRegion> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { pinned: boolean; focused: boolean }>>({});
  React.useEffect(()=>{
    const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table==='upd')setReviewStatus({});};
    window.addEventListener('yijian:result-overlays-synced',sync);
    return()=>window.removeEventListener('yijian:result-overlays-synced',sync);
  },[taskId]);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  // 加载基因列表
  React.useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      setLoading(true);
      setRequestError(null);
      try {
        const data = await getUPDRegions(taskId, filterState, controller.signal);
        if (!controller.signal.aborted) setResult(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRequestError(error instanceof Error ? errorText(error, t) : t("tasks.unableToLoadUpdRegions7b3250"));
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

  // 处理置顶状态变更
  const handlePinChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; focused: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, pinned: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await pinVariant(taskId, 'upd', id, checked);
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

  // 处理关注状态变更
  const handleFocusChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; focused: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, focused: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await focusVariant(taskId, 'upd', id, checked);
    } catch (error) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
      setOperationError(error instanceof Error ? errorText(error, t) : t("tasks.unableToMarkForFocus8d3bd6"));
    } finally {
      setPendingVariantIDs((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }, [taskId, t]);

  // 获取变异的置顶状态
  const getReviewState = React.useCallback((variant: UPDRegion) => {
    return reviewStatus[variant.id] ?? { pinned: variant.pinned, focused: variant.focused };
  }, [reviewStatus]);

  const sortedData = result?.data ?? [];

  const columns: Column<UPDRegion>[] = [
    {
      id: 'focused',
      header: <FocusColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return (
          <FocusCheckbox
            checked={state.focused}
            onChange={(checked) => handleFocusChange(row.id, checked, state)}
            disabled={pendingVariantIDs.has(row.id)}
          />
        );
      },
      width: 60,
    },
    {
      id: 'pinned',
      header: <PinColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return (
          <PinCheckbox
            reasons={row.pinReasons?.length?row.pinReasons:row.automaticAssessment?.pending}
            source={row.pinSource}
            checked={state.pinned}
            onChange={(checked) => handlePinChange(row.id, checked, state)}
            disabled={pendingVariantIDs.has(row.id)}
          />
        );
      },
      width: 60,
    },
    {
      id: 'chromosome',
      header: t("history.chromosome326659"),
      accessor: 'chromosome',
      width: 80,
      sortable: true,
    },
    {
      id: 'startPosition',
      header: t("tasks.startPositione89b02"),
      accessor: (row) => row.startPosition,
      width: 120,
      sortable: true,
    },
    {
      id: 'endPosition',
      header: t("tasks.endPositioncb3b4c"),
      accessor: (row) => row.endPosition,
      width: 120,
    },
    {
      id: 'length',
      header: t("history.lengtha53949"),
      accessor: (row) => {
        if (row.length >= 1000000) return `${formatNumericString((row.length / 1000000).toFixed(2), t.locale)}Mb`;
        if (row.length >= 1000) return `${formatNumericString((row.length / 1000).toFixed(1), t.locale)}kb`;
        return `${row.length}bp`;
      },
      width: 100,
      sortable: true,
    },
    {
      id: 'type',
      header: t("history.typee4e46c"),
      accessor: (row) => {
        const config = UPD_TYPE_CONFIG[row.type];
        return <Tag variant={config.variant}>{translateUI(config.label, t)}</Tag>;
      },
      width: 100,
      sortable: true,
    },
    {
      id: 'genes',
      header: t("history.affectedGenes9fbbad"),
      accessor: (row) => <GeneLinks genes={row.genes} />,
      width: 200,
    },
    {
      id: 'parentOfOrigin',
      header: t("tasks.parentOfOrigin808f6f"),
      accessor: (row) => {
        const labels = { Maternal: t("tasks.maternal7a353e"), Paternal: t("tasks.paternal9d5a70"), Unknown: t("samples.unknownd9c32a") };
        return row.parentOfOrigin ? labels[row.parentOfOrigin] : '-';
      },
      width: 80,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="variant-tab-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="yj-variant-toolbar">
      <ParquetColumnFilterBar taskId={taskId} table="upd" columns={localizeDisplay(result?.columns ?? [], t)} columnTypes={result?.columnTypes} columnLabels={resultColumnLabels(columns, result, 'upd', t)} state={filterState} onChange={setFilterState} />
      <div className="yj-variant-controls-row">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-52 max-w-full shrink-0 sm:w-64">
            <Input
              className="yj-variant-search [&_input]:min-w-0 [&_input]:w-0"
              placeholder={t("tasks.searchChromosomed961dd")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>

          {/* 基因列表筛选 */}

        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span>{t("history.total497064")}{result?.total ?? 0} {t("tasks.updRegionsaa1daa")}</span>
        </div>
      </div>
      </div>

      {requestError ? (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-3 text-sm text-danger-fg">
          {requestError}
          <ActionButton permission={null} action="retry" variant="ghost" onClick={() => setFilterState({ ...filterState })} className="ml-3 underline">{t("pipeline.retrye2d53a")}</ActionButton>
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
            columns={localizeDisplay(filterableColumns(columns, result, filterState, setFilterState, 'upd', t), t)}
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
        <div className="text-center py-12 text-fg-muted">
          {t("tasks.noUpdRegionDatae755f0")}</div>
      )}
      {operationError && (
        <div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{operationError}</div>
      )}
    </div>
  );
}
