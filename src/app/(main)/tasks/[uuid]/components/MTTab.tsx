'use client';

import * as React from 'react';
import { DataTable, Tag, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { MitochondrialVariant, MitochondrialPathogenicity, TableFilterState, PaginatedResult } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getMitochondrialVariants, reportVariant, reviewVariant } from '../result-api';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { IGVViewer, PositionLink } from './IGVViewer';
import { ReviewCheckbox, ReportCheckbox, ReviewColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
import { MTDetailPanel } from './MTDetailPanel';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

interface MTTabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

// 致病性配置
const PATHOGENICITY_CONFIG: Record<MitochondrialPathogenicity, { label: string; variant: 'danger' | 'warning' | 'neutral' | 'info' | 'success' }> = {
  Pathogenic: { label: '致病', variant: 'danger' },
  Likely_Pathogenic: { label: '可能致病', variant: 'warning' },
  VUS: { label: '意义未明', variant: 'neutral' },
  Likely_Benign: { label: '可能良性', variant: 'info' },
  Benign: { label: '良性', variant: 'success' },
  Unknown: { label: '未提供', variant: 'neutral' },
};

export function MTTab({ 
  taskId, 
  filterState: externalFilterState,
  onFilterChange 
}: MTTabProps) {
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<MitochondrialVariant> | null>(null);
  const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [operationError, setOperationError] = React.useState<string | null>(null);
	const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { reviewed: boolean; reported: boolean }>>({});
  React.useEffect(()=>{
    const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table==='mt')setReviewStatus({});};
    window.addEventListener('yijian:result-overlays-synced',sync);
    return()=>window.removeEventListener('yijian:result-overlays-synced',sync);
  },[taskId]);

  // IGV 查看器状态
  const [igvState, setIgvState] = React.useState<{
    isOpen: boolean;
    chromosome: string;
    position: number;
  }>({ isOpen: false, chromosome: '', position: 0 });

  // 详情面板状态
  const [selectedVariant, setSelectedVariant] = React.useState<MitochondrialVariant | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = React.useState(false);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  // 点击行打开详情面板
  const handleRowClick = React.useCallback((variant: MitochondrialVariant) => {
    setSelectedVariant(variant);
    setDetailPanelOpen(true);
  }, []);

  // 关闭详情面板
  const handleCloseDetailPanel = React.useCallback(() => {
    setDetailPanelOpen(false);
  }, []);

  // 打开 IGV 查看器
  const handleOpenIGV = React.useCallback((chromosome: string, position: number) => {
    setIgvState({ isOpen: true, chromosome, position });
  }, []);

  // 关闭 IGV 查看器
  const handleCloseIGV = React.useCallback(() => {
    setIgvState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // 处理审核状态变更
  const handleReviewChange = React.useCallback(async (id: string, checked: boolean, currentState: { reviewed: boolean; reported: boolean }) => {
		setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reviewed: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
		try {
			await reviewVariant(taskId, 'mt', id, checked);
		} catch (cause) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
			setOperationError(cause instanceof Error ? cause.message : '更新复核状态失败');
		} finally {
			setPendingVariantIDs((previous) => {
				const next = new Set(previous); next.delete(id); return next;
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
			await reportVariant(taskId, 'mt', id, checked);
		} catch (cause) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
			setOperationError(cause instanceof Error ? cause.message : '标记回报失败');
		} finally {
			setPendingVariantIDs((previous) => {
				const next = new Set(previous); next.delete(id); return next;
			});
		}
  }, [taskId]);

  // 获取变异的审核状态
  const getReviewState = React.useCallback((variant: MitochondrialVariant) => {
    return reviewStatus[variant.id] ?? { reviewed: variant.reviewed, reported: variant.reported };
  }, [reviewStatus]);

	const sortedData = result?.data ?? [];

  React.useEffect(() => {
		const controller = new AbortController();
    async function loadData() {
      setLoading(true);
		setError(null);
		try {
			const data = await getMitochondrialVariants(taskId, filterState, controller.signal);
			if (!controller.signal.aborted) setResult(data);
		} catch (cause) {
			if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '无法加载线粒体结果');
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

  const handlePathogenicityFilter = React.useCallback((pathogenicity: string) => {
    const newFilters = { ...filterState.filters };
    if (pathogenicity) {
      newFilters.pathogenicity = pathogenicity;
    } else {
      delete newFilters.pathogenicity;
    }
    setFilterState({ ...filterState, filters: newFilters, page: 1 });
  }, [filterState, setFilterState]);

  const columns: Column<MitochondrialVariant>[] = [
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
      id: 'position',
      header: '位置',
      accessor: (row) => (
        <PositionLink
          chromosome="chrM"
          position={row.position}
          label={`m.${row.position}`}
          onClick={handleOpenIGV}
        />
      ),
      width: 80,
      sortable: true,
    },
    {
      id: 'change',
      header: '参考/变异',
      accessor: (row) => `${row.ref}>${row.alt}`,
      width: 80,
    },
    {
      id: 'gene',
      header: '基因',
      accessor: 'gene',
      width: 100,
      sortable: true,
    },
    {
      id: 'heteroplasmy',
      header: '异质性比例',
      accessor: (row) => `${(row.heteroplasmy * 100).toFixed(1)}%`,
      width: 100,
      sortable: true,
    },
    {
      id: 'pathogenicity',
      header: '致病性',
      accessor: (row) => {
        const config = PATHOGENICITY_CONFIG[row.pathogenicity];
        return <Tag variant={config.variant}>{config.label}</Tag>;
      },
      width: 100,
      sortable: true,
    },
    {
      id: 'associatedDisease',
      header: '关联疾病',
      accessor: 'associatedDisease',
      width: 200,
    },
    {
      id: 'haplogroup',
      header: '单倍群',
      accessor: (row) => row.haplogroup || '-',
      width: 80,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div>
      <ParquetColumnFilterBar taskId={taskId} table="mt" columns={result?.columns ?? []} columnTypes={result?.columnTypes} state={filterState} onChange={setFilterState} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Input
              placeholder="搜索基因、疾病..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>

          <select
            value={(filterState.filters.pathogenicity as string) || ''}
            onChange={(e) => handlePathogenicityFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default"
          >
            <option value="">全部致病性</option>
            {Object.entries(PATHOGENICITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        <div className="text-sm text-fg-muted">
          共 {result?.total ?? 0} 条线粒体变异
        </div>
      </div>

		{error && !loading ? (
			<div className="rounded-lg border border-danger-emphasis bg-danger-subtle p-4 text-sm text-danger-fg">{error}</div>
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
            onRowClick={handleRowClick}
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
          暂无线粒体变异数据
        </div>
      )}
		{operationError && (
			<div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{operationError}</div>
		)}

      {/* IGV 查看器 */}
      <IGVViewer
		taskId={taskId}
        chromosome={igvState.chromosome}
        position={igvState.position}
        isOpen={igvState.isOpen}
        onClose={handleCloseIGV}
      />

      {/* 线粒体变异详情面板 */}
      <MTDetailPanel
        variant={selectedVariant}
        isOpen={detailPanelOpen}
        onClose={handleCloseDetailPanel}
        onOpenIGV={handleOpenIGV}
      />
    </div>
  );
}
