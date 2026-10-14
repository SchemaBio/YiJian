'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';


import { IGVViewer, PositionLink } from './IGVViewer';
import { parseSTRLocus } from './str-locus';
import { GeneLinks } from './GeneLinks';

import * as React from 'react';
import { DataTable, Tag, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { STR, STRStatus, TableFilterState, PaginatedResult } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getSTRs, focusVariant, pinVariant } from '../result-api';
import { filterableColumns, resultColumnLabels } from './ResultColumnFilter';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { PinCheckbox, FocusCheckbox, PinColumnHeader, FocusColumnHeader } from './ReviewCheckboxes';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

interface STRTabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

// STR状态颜色配置
const STR_STATUS_CONFIG: Record<STRStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  Normal: { label: '正常', variant: 'success' },
  Premutation: { label: '前突变', variant: 'warning' },
  FullMutation: { label: '全突变', variant: 'danger' },
  Unknown: { label: '未提供', variant: 'neutral' },
};

export function STRTab({
  taskId,
  filterState: externalFilterState,
  onFilterChange
}: STRTabProps) {
  const t = useText();
  const [igvState, setIGVState] = React.useState<{ chromosome: string; position: number; endPosition?: number } | null>(null);
  React.useEffect(() => setIGVState(null), [taskId]);
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<STR> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { pinned: boolean; focused: boolean }>>({});
  React.useEffect(()=>{
    const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table==='str')setReviewStatus({});};
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
        const data = await getSTRs(taskId, filterState, controller.signal);
        if (!controller.signal.aborted) setResult(data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRequestError(error instanceof Error ? errorText(error, t) : t("tasks.unableToLoadRepeatExpansionResultscec5d5"));
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

  const handleStatusFilter = React.useCallback((status: string) => {
    const newFilters = { ...filterState.filters };
    if (status) {
      newFilters.status = status;
    } else {
      delete newFilters.status;
    }
    setFilterState({ ...filterState, filters: newFilters, page: 1 });
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
      await pinVariant(taskId, 'str', id, checked);
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
      await focusVariant(taskId, 'str', id, checked);
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
  const getReviewState = React.useCallback((variant: STR) => {
    return reviewStatus[variant.id] ?? { pinned: variant.pinned, focused: variant.focused };
  }, [reviewStatus]);

  const sortedData = result?.data ?? [];

  const columns: Column<STR>[] = [
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
      id: 'gene',
      header: t("history.gene9ef2ed"),
      accessor: (row) => <GeneLinks genes={row.gene} />,
      width: 100,
      sortable: true,
    },
    {
      id: 'locus',
      header: t("history.locus6a6cc9"),
      accessor: row => {
        const coordinates = parseSTRLocus(row.locus);
        return coordinates ? <PositionLink chromosome={coordinates.chromosome} position={coordinates.position} label={translateUI(row.locus, t)} onClick={() => setIGVState(coordinates)} /> : row.locus;
      },
      width: 100,
      sortable: true,
    },
    {
      id: 'repeatUnit',
      header: t("history.repeatUnit61e6fe"),
      accessor: 'repeatUnit',
      width: 100,
    },
    {
      id: 'repeatCount',
      header: t("history.repeatCountbfcb1f"),
      accessor: (row) => row.repeatCount,
      width: 100,
      sortable: true,
    },
    {
      id: 'normalRange',
      header: t("history.normalRangecc88cc"),
      accessor: (row) => `${row.normalRangeMin}-${row.normalRangeMax}`,
      width: 100,
    },
    {
      id: 'status',
      header: t("admin.status62e951"),
      accessor: (row) => {
        const config = STR_STATUS_CONFIG[row.status];
        return <Tag variant={config.variant}>{translateUI(config.label, t)}</Tag>;
      },
      width: 100,
      sortable: true,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="variant-tab-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="yj-variant-toolbar">
      <ParquetColumnFilterBar taskId={taskId} table="str" columns={localizeDisplay(result?.columns ?? [], t)} columnTypes={result?.columnTypes} columnLabels={resultColumnLabels(columns, result, 'str', t)} state={filterState} onChange={setFilterState} />
      <div className="yj-variant-controls-row">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-52 max-w-full shrink-0 sm:w-64">
            <Input
              className="yj-variant-search [&_input]:min-w-0 [&_input]:w-0"
              placeholder={t("tasks.searchGenesOrLoci3f8752")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>

          {/* 基因列表筛选 */}

          <select
            value={(filterState.filters.status as string) || ''}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default"
          >
            <option value="">{t("tasks.allStatuses1a4c26")}</option>
            {Object.entries(STR_STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{translateUI(config.label, t)}</option>
            ))}
          </select>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span>{t("history.total497064")}{result?.total ?? 0} {t("tasks.repeatExpansions368fd0")}</span>
        </div>
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
            columns={localizeDisplay(filterableColumns(columns, result, filterState, setFilterState, 'str', t), t)}
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
          {t("tasks.noRepeatExpansionData3d089a")}</div>
      )}
      {operationError && (
        <div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {operationError}
        </div>
      )}
      {igvState && <IGVViewer taskId={taskId} chromosome={igvState.chromosome} position={igvState.position} endPosition={igvState.endPosition} isOpen onClose={() => setIGVState(null)} />}
    </div>
  );
}
