'use client';

import * as React from 'react';
import { DataTable, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { PaginatedResult, ROHRegion, TableFilterState } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getROHRegions } from '../result-api';
import { ReviewCheckbox, ReportCheckbox, ReviewColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';

interface ROHTabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

export function ROHTab({ taskId, filterState: externalFilterState, onFilterChange }: ROHTabProps) {
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<ROHRegion> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { reviewed: boolean; reported: boolean }>>({});

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const data = await getROHRegions(taskId, filterState);
        if (!cancelled) setResult(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [taskId, filterState]);

  const handleSearch = React.useCallback((query: string) => {
    setFilterState({ ...filterState, searchQuery: query, page: 1 });
  }, [filterState, setFilterState]);

  const handleSortChange = React.useCallback((column: string, direction: 'asc' | 'desc' | null) => {
    setFilterState({
      ...filterState,
      sortColumn: direction ? column : undefined,
      sortDirection: direction ?? undefined,
    });
  }, [filterState, setFilterState]);

  const handleReviewChange = React.useCallback((id: string, checked: boolean) => {
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...prev[id], reviewed: checked, reported: prev[id]?.reported ?? false },
    }));
  }, []);

  const handleReportChange = React.useCallback((id: string, checked: boolean) => {
    setReviewStatus(prev => ({
      ...prev,
      [id]: { reviewed: prev[id]?.reviewed ?? false, reported: checked },
    }));
  }, []);

  const getReviewState = React.useCallback((region: ROHRegion) => {
    return reviewStatus[region.id] ?? { reviewed: region.reviewed, reported: region.reported };
  }, [reviewStatus]);

  const sortedData = React.useMemo(() => {
    if (!result?.data) return [];
    return [...result.data].sort((a, b) => {
      const stateA = getReviewState(a);
      const stateB = getReviewState(b);
      if (stateA.reported !== stateB.reported) return stateA.reported ? -1 : 1;
      if (stateA.reviewed !== stateB.reviewed) return stateA.reviewed ? -1 : 1;
      return 0;
    });
  }, [result?.data, getReviewState]);

  const columns: Column<ROHRegion>[] = [
    {
      id: 'reviewed',
      header: <ReviewColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return <ReviewCheckbox checked={state.reviewed} onChange={(checked) => handleReviewChange(row.id, checked)} />;
      },
      width: 60,
    },
    {
      id: 'reported',
      header: <ReportColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return <ReportCheckbox checked={state.reported} onChange={(checked) => handleReportChange(row.id, checked)} />;
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
      accessor: (row) => row.genes.join(', ') || '-',
      width: 220,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="w-64">
          <Input
            placeholder="搜索染色体、基因..."
            value={filterState.searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="text-sm text-fg-muted">共 {result?.total ?? 0} 条ROH区域</div>
      </div>

      {loading ? (
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
        <div className="text-center py-12 text-fg-muted">暂无ROH区域数据</div>
      )}
    </div>
  );
}
