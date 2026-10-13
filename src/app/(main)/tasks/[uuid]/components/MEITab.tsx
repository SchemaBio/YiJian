'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { translateUI, localizeDisplay } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';


import { GeneLinks } from './GeneLinks';

import * as React from 'react';
import { formatPopulationFrequency } from '../utils/snv-annotations';
import { DataTable, Tag, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { MEIVariant, TableFilterState, PaginatedResult, ACMGClassification } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getMEIs, ACMG_CONFIG, reportVariant, pinVariant } from '../result-api';
import { filterableColumns, resultColumnLabels } from './ResultColumnFilter';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { IGVViewer, PositionLink } from './IGVViewer';
import { PinCheckbox, ReportCheckbox, PinColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

interface MEITabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

// MEI 类型标签
const MEI_TYPE_LABELS = {
  LINE1: 'LINE-1',
  Alu: 'Alu',
  SVA: 'SVA',
  Unknown: '未知',
};

// MEI 类型颜色
const MEI_TYPE_COLORS = {
  LINE1: 'bg-purple-100 text-purple-700 border-purple-200',
  Alu: 'bg-blue-100 text-blue-700 border-blue-200',
  SVA: 'bg-orange-100 text-orange-700 border-orange-200',
  Unknown: 'bg-gray-100 text-gray-700 border-gray-200',
};

const MEI_INSERTION_LABELS: Record<MEIVariant['insertionType'], string> = {
  insertion: '插入',
  deletion: '缺失',
  complex: '复杂',
  Unknown: '未提供',
};

// 影响类型标签
const IMPACT_LABELS = {
  exonic: '外显子区',
  intronic: '内含子区',
  UTR5: "5'UTR",
  UTR3: "3'UTR",
  intergenic: '基因间区',
};

export function MEITab({
  taskId,
  filterState: externalFilterState,
  onFilterChange
}: MEITabProps) {
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<MEIVariant> | null>(null);
  const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [operationError, setOperationError] = React.useState<string | null>(null);
	const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { pinned: boolean; reported: boolean }>>({});
  React.useEffect(()=>{
    const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table==='mei')setReviewStatus({});};
    window.addEventListener('yijian:result-overlays-synced',sync);
    return()=>window.removeEventListener('yijian:result-overlays-synced',sync);
  },[taskId]);
	const [igvState, setIgvState] = React.useState({ isOpen: false, chromosome: '', position: 0 });

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  // 处理置顶状态变更
  const handlePinChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; reported: boolean }) => {
		setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, pinned: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
		try {
			await pinVariant(taskId, 'mei', id, checked);
		} catch (cause) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
			setOperationError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToUpdatePinStatus77c5f1"));
		} finally {
			setPendingVariantIDs((previous) => {
				const next = new Set(previous); next.delete(id); return next;
			});
		}
  }, [taskId, t]);

  // 处理回报状态变更
  const handleReportChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; reported: boolean }) => {
		setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reported: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
		try {
			await reportVariant(taskId, 'mei', id, checked);
		} catch (cause) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
			setOperationError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToMarkForReport8d3bd6"));
		} finally {
			setPendingVariantIDs((previous) => {
				const next = new Set(previous); next.delete(id); return next;
			});
		}
  }, [taskId, t]);

  // 获取变异的置顶状态
  const getReviewState = React.useCallback((variant: MEIVariant) => {
    return reviewStatus[variant.id] ?? { pinned: variant.pinned, reported: variant.reported };
  }, [reviewStatus]);

	// 排序和分页均由服务端在一个执行尝试范围内完成，不能在当前页再按
	// 置顶状态重排，否则用户看到的页码与统计会不一致。
	const sortedData = result?.data ?? [];

  React.useEffect(() => {
		const controller = new AbortController();
    async function loadData() {
      setLoading(true);
		setError(null);
		try {
			const data = await getMEIs(taskId, filterState, controller.signal);
			if (!controller.signal.aborted) setResult(data);
		} catch (cause) {
			if (!controller.signal.aborted) setError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToLoadMeiResultsabf9a3"));
		} finally {
			if (!controller.signal.aborted) setLoading(false);
		}
    }
		void loadData();
		return () => controller.abort();
  }, [taskId, filterState]);

  // 处理搜索
  const handleSearch = React.useCallback((query: string) => {
    setFilterState({ ...filterState, searchQuery: query, page: 1 });
  }, [filterState, setFilterState]);
  const [searchInput, setSearchInput] = useDebouncedSearch(filterState.searchQuery, handleSearch);

  // 处理基因列表筛选
  // 获取当前选中的基因列表信息
  // 列定义
  const columns: Column<MEIVariant>[] = [
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
      align: 'center',
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
      align: 'center',
    },
    {
      id: 'gene',
      header: t("history.gene9ef2ed"),
      accessor: (row) => <GeneLinks genes={row.gene} />,
      width: 100,
      align: 'center',
      sortable: true,
    },
    {
      id: 'position',
      header: t("tasks.insertionPosition54ebf6"),
      accessor: (row) => (
        <PositionLink
          chromosome={row.chromosome}
          position={row.position}
							onClick={(chromosome, position) => setIgvState({ isOpen: true, chromosome, position })}
        />
      ),
      width: 150,
      align: 'center',
      sortable: true,
    },
    {
      id: 'meiType',
      header: t("history.meiType05cfc0"),
      accessor: (row) => (
        <span className={`px-2 py-0.5 text-xs rounded border ${MEI_TYPE_COLORS[row.meiType]}`}>
          {translateUI(MEI_TYPE_LABELS[row.meiType], t)}
        </span>
      ),
      width: 80,
      align: 'center',
    },
    {
      id: 'insertionType',
      header: t("tasks.insertionTypeaa636e"),
      accessor: (row) => {
        return MEI_INSERTION_LABELS[row.insertionType];
      },
      width: 80,
      align: 'center',
    },
    {
      id: 'strand',
      header: t("history.strand94d5ad"),
      accessor: (row) => row.strand === 'Unknown' ? t("history.notProvided071fb2") : row.strand,
      width: 50,
      align: 'center',
    },
    {
      id: 'length',
      header: t("history.lengtha53949"),
      accessor: (row) => `${row.length} bp`,
      width: 90,
      align: 'center',
      sortable: true,
    },
    {
      id: 'impact',
      header: t("tasks.affectedRegion38be27"),
      accessor: (row) => row.impact ? IMPACT_LABELS[row.impact as keyof typeof IMPACT_LABELS] || row.impact : '-',
      width: 90,
      align: 'center',
    },
    {
      id: 'zygosity',
      header: t("tasks.zygosity50c147"),
      accessor: (row) => {
        const labels = { Heterozygous: t("tasks.heterozygous0eee7c"), Homozygous: t("tasks.homozygousf691c3"), Hemizygous: t("tasks.hemizygous75566a"), Unknown: t("history.notProvided071fb2") };
        return labels[row.zygosity];
      },
      width: 80,
      align: 'center',
    },
    {
      id: 'supportingReads',
      header: t("tasks.supportingReads1addd1"),
      accessor: (row) => `${row.supportingReads}/${row.totalReads}`,
      width: 90,
      align: 'center',
      sortable: true,
    },
    {
      id: 'frequency',
      header: t("tasks.populationFrequency1705e3"),
      accessor: (row) => formatPopulationFrequency(row.frequency),
      width: 90,
      align: 'center',
      sortable: true,
    },
    {
      id: 'acmgClassification',
      header: t("history.acmgClassification7c3099"),
      accessor: (row) => {
        if (!row.acmgClassification) return '-';
        const config = ACMG_CONFIG[row.acmgClassification];
        return <Tag variant={config.variant} className="w-20 justify-center">{translateUI(config.label, t)}</Tag>;
      },
      width: 100,
      align: 'center',
    },
  ];

  // 分页信息
  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="variant-tab-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="yj-variant-toolbar">
      <ParquetColumnFilterBar taskId={taskId} table="mei" columns={localizeDisplay(result?.columns ?? [], t)} columnTypes={result?.columnTypes} columnLabels={resultColumnLabels(columns, result, 'mei', t)} state={filterState} onChange={setFilterState} />
      {/* 工具栏 */}
      <div className="yj-variant-controls-row">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* 搜索框 */}
          <div className="w-52 max-w-full shrink-0 sm:w-64">
            <Input
              className="yj-variant-search [&_input]:min-w-0 [&_input]:w-0"
              placeholder={t("tasks.searchGeneOrPosition732ec5")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>

          {/* 基因列表筛选 */}
        </div>

        {/* 统计信息 */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span>{t("history.total497064")}{result?.total ?? 0} {t("tasks.meiVariantsb214fc")}</span>
        </div>
      </div>
      </div>

      {/* 数据表格 */}
		{error && !loading ? (
			<div className="rounded-lg border border-danger-emphasis bg-danger-subtle p-4 text-sm text-danger-fg">{error}</div>
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
            columns={localizeDisplay(filterableColumns(columns, result, filterState, setFilterState, 'mei', t), t)}
            rowKey="id"
            striped
            density="compact"
            sortColumn={filterState.sortColumn}
            sortDirection={filterState.sortDirection}
            onSortChange={(column, direction) => {
              setFilterState({
                ...filterState,
                sortColumn: direction ? column : undefined,
                sortDirection: direction ?? undefined,
              });
            }}
          />

          {/* 分页 */}
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
          {t("tasks.noMeiVariantData0531ba")}</div>
      )}
		{operationError && (
			<div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{operationError}</div>
		)}

		<IGVViewer
			taskId={taskId}
			chromosome={igvState.chromosome}
			position={igvState.position}
			isOpen={igvState.isOpen}
			onClose={() => setIgvState(previous => ({ ...previous, isOpen: false }))}
		/>
    </div>
  );
}
