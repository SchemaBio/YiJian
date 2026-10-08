'use client';

import { GeneLinks } from './GeneLinks';

import * as React from 'react';
import { DataTable, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { PaginatedResult, ROHRegion, TableFilterState } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getROHRegions, reportVariant, pinVariant } from '../result-api';
import { filterableColumns } from './ResultColumnFilter';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { PinCheckbox, ReportCheckbox, PinColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

interface ROHTabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

export function ROHTab({ taskId, filterState: externalFilterState, onFilterChange }: ROHTabProps) {
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
          setRequestError(error instanceof Error ? error.message : '无法加载 ROH 区域');
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
      setOperationError(error instanceof Error ? error.message : '更新置顶状态失败');
    } finally {
      setPendingVariantIDs((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }, [taskId]);

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
      setOperationError(error instanceof Error ? error.message : '标记回报失败');
    } finally {
      setPendingVariantIDs((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }, [taskId]);

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
    { id: 'chromosome', header: '染色体', accessor: 'chromosome', width: 80, sortable: true },
    { id: 'startPosition', header: '起始位置', accessor: 'startPosition', width: 120, sortable: true },
    { id: 'endPosition', header: '终止位置', accessor: 'endPosition', width: 120, sortable: true },
    {
      id: 'sizeMb',
      header: '长度',
      accessor: (row) => `${row.sizeMb.toFixed(2)}Mb`,
      width: 100,
      sortable: true,
    },
    { id: 'variantCount', header: '位点数', accessor: 'variantCount', width: 90, sortable: true },
    {
      id: 'homozygosity',
      header: '纯合比例',
      accessor: (row) => `${row.homozygosity.toFixed(2)}%`,
      width: 100,
      sortable: true,
    },
    {
      id: 'genes',
      header: '隐性疾病基因',
      accessor: (row) => <GeneLinks genes={row.genes} />,
      width: 220,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="variant-tab-panel flex h-full min-h-0 flex-col overflow-hidden">
      <ParquetColumnFilterBar taskId={taskId} table="roh" columns={result?.columns ?? []} columnTypes={result?.columnTypes} state={filterState} onChange={setFilterState} />
      <div className="flex items-center justify-between mb-4">
        <div className="w-64">
          <Input
            placeholder="搜索染色体、基因..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="text-sm text-fg-muted">共 {result?.total ?? 0} 条ROH区域</div>
      </div>

      {requestError ? (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-3 text-sm text-danger-fg">
          {requestError}
          <button onClick={() => setFilterState({ ...filterState })} className="ml-3 underline">重试</button>
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
            columns={filterableColumns(columns, result, filterState, setFilterState, 'roh')}
            rowKey="id"
            striped
            density="compact"
            sortColumn={filterState.sortColumn}
            sortDirection={filterState.sortDirection}
            onSortChange={handleSortChange}
          />

          {totalPages > 1 && (
            <div className="flex shrink-0 items-center justify-between mt-2">
              <div className="text-sm text-fg-muted">
                第 {filterState.page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterState({ ...filterState, page: filterState.page - 1 })}
                  disabled={filterState.page <= 1}
                  className="px-3 py-1 text-sm border border-border-default rounded hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <button
                  onClick={() => setFilterState({ ...filterState, page: filterState.page + 1 })}
                  disabled={filterState.page >= totalPages}
                  className="px-3 py-1 text-sm border border-border-default rounded hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-fg-muted">暂无ROH区域数据</div>
      )}
      {operationError && (
        <div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{operationError}</div>
      )}
    </div>
  );
}
