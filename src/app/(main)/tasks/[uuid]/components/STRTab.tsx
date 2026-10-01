'use client';

import * as React from 'react';
import { DataTable, Tag, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { STR, STRStatus, TableFilterState, PaginatedResult } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getSTRs, reportVariant, reviewVariant } from '../result-api';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { ReviewCheckbox, ReportCheckbox, ReviewColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
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
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<STR> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { reviewed: boolean; reported: boolean }>>({});

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
          setRequestError(error instanceof Error ? error.message : '无法加载动态突变结果');
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

  // 处理审核状态变更
  const handleReviewChange = React.useCallback(async (id: string, checked: boolean, currentState: { reviewed: boolean; reported: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reviewed: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await reviewVariant(taskId, 'str', id, checked);
    } catch (error) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
      setOperationError(error instanceof Error ? error.message : '更新复核状态失败');
    } finally {
      setPendingVariantIDs((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    }
  }, [taskId]);

  // 处理回报状态变更
  const handleReportChange = React.useCallback(async (id: string, checked: boolean, currentState: { reviewed: boolean; reported: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reported: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await reportVariant(taskId, 'str', id, checked);
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

  // 获取变异的审核状态
  const getReviewState = React.useCallback((variant: STR) => {
    return reviewStatus[variant.id] ?? { reviewed: variant.reviewed, reported: variant.reported };
  }, [reviewStatus]);

  const sortedData = result?.data ?? [];

  const columns: Column<STR>[] = [
    {
      id: 'reviewed',
      header: <ReviewColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return (
          <ReviewCheckbox
            checked={state.reviewed}
            onChange={(checked) => handleReviewChange(row.id, checked, state)}
            disabled={pendingVariantIDs.has(row.id)}
          />
        );
      },
      width: 60,
    },
    {
      id: 'reported',
      header: <ReportColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return (
          <ReportCheckbox
            checked={state.reported}
            onChange={(checked) => handleReportChange(row.id, checked, state)}
            disabled={pendingVariantIDs.has(row.id)}
          />
        );
      },
      width: 60,
    },
    {
      id: 'gene',
      header: '基因',
      accessor: 'gene',
      width: 100,
      sortable: true,
    },
    {
      id: 'transcript',
      header: '转录本',
      accessor: 'transcript',
      width: 130,
    },
    {
      id: 'locus',
      header: '位点',
      accessor: 'locus',
      width: 100,
      sortable: true,
    },
    {
      id: 'repeatUnit',
      header: '重复单元',
      accessor: 'repeatUnit',
      width: 100,
    },
    {
      id: 'repeatCount',
      header: '重复次数',
      accessor: (row) => row.repeatCount,
      width: 100,
      sortable: true,
    },
    {
      id: 'normalRange',
      header: '正常范围',
      accessor: (row) => `${row.normalRangeMin}-${row.normalRangeMax}`,
      width: 100,
    },
    {
      id: 'status',
      header: '状态',
      accessor: (row) => {
        const config = STR_STATUS_CONFIG[row.status];
        return <Tag variant={config.variant}>{config.label}</Tag>;
      },
      width: 100,
      sortable: true,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div>
      <ParquetColumnFilterBar columns={result?.columns ?? []} columnTypes={result?.columnTypes} state={filterState} onChange={setFilterState} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Input
              placeholder="搜索基因、位点..."
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
            <option value="">全部状态</option>
            {Object.entries(STR_STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4 text-sm text-fg-muted">
          <span>共 {result?.total ?? 0} 条动态突变</span>
        </div>
      </div>

      {requestError ? (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-3 text-sm text-danger-fg">
          {requestError}
          <button onClick={() => setFilterState({ ...filterState })} className="ml-3 underline">重试</button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-emphasis" />
        </div>
      ) : result && result.data.length > 0 ? (
        <>
          <DataTable
            data={sortedData}
            columns={columns}
            rowKey="id"
            striped
            density="compact"
            sortColumn={filterState.sortColumn}
            sortDirection={filterState.sortDirection}
            onSortChange={handleSortChange}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
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
        <div className="text-center py-12 text-fg-muted">
          暂无动态突变数据
        </div>
      )}
      {operationError && (
        <div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {operationError}
        </div>
      )}
    </div>
  );
}
