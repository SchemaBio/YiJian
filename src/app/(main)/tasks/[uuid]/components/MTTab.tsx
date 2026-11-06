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
import type { MitochondrialVariant, MitochondrialPathogenicity, TableFilterState, PaginatedResult } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getMitochondrialVariants, focusVariant, pinVariant, saveResultRowAdjustment } from '../result-api';
import type { InspectorSection } from '@/components/shared/WorkspaceInspector';
import type { MTEvidence } from './MTACMGEditor';
import { filterableColumns, resultColumnLabels } from './ResultColumnFilter';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { IGVViewer, PositionLink } from './IGVViewer';
import { PinCheckbox, FocusCheckbox, PinColumnHeader, FocusColumnHeader } from './ReviewCheckboxes';
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
  const t = useText();
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<MitochondrialVariant> | null>(null);
  const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [operationError, setOperationError] = React.useState<string | null>(null);
	const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { pinned: boolean; focused: boolean }>>({});
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
  const [initialSection, setInitialSection] = React.useState<InspectorSection>('annotation');
  const taskRef = React.useRef(taskId);
  taskRef.current = taskId;

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  // 点击行打开详情面板
  const openDetails = (variant: MitochondrialVariant, section: InspectorSection) => {
    setSelectedVariant(variant);
    setInitialSection(section);
    setDetailPanelOpen(true);
  };

  const handleSaveAssessment = async (variant: MitochondrialVariant, evidence: MTEvidence) => {
    const saved = await saveResultRowAdjustment(taskId, 'mt', variant.id, variant.adjustmentVersion ?? 0, { mtAssessment: evidence });
    if (taskRef.current !== taskId) return;
    const update = (row: MitochondrialVariant) => row.id === variant.id ? {
      ...row,
      mtAssessment: saved.adjustment.adjustments.mtAssessment as MitochondrialVariant['mtAssessment'],
      adjustmentVersion: saved.adjustment.version,
    } : row;
    setSelectedVariant(current => current && update(current));
    setResult(current => current && { ...current, data: current.data.map(update) });
  };

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

  // 处理置顶状态变更
  const handlePinChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; focused: boolean }) => {
		setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, pinned: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
		try {
			await pinVariant(taskId, 'mt', id, checked);
		} catch (cause) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
			setOperationError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToUpdatePinStatus77c5f1"));
		} finally {
			setPendingVariantIDs((previous) => {
				const next = new Set(previous); next.delete(id); return next;
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
			await focusVariant(taskId, 'mt', id, checked);
		} catch (cause) {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
			setOperationError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToMarkForFocus8d3bd6"));
		} finally {
			setPendingVariantIDs((previous) => {
				const next = new Set(previous); next.delete(id); return next;
			});
		}
  }, [taskId, t]);

  // 获取变异的置顶状态
  const getReviewState = React.useCallback((variant: MitochondrialVariant) => {
    return reviewStatus[variant.id] ?? { pinned: variant.pinned, focused: variant.focused };
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
			if (!controller.signal.aborted) setError(cause instanceof Error ? errorText(cause, t) : t("tasks.unableToLoadMitochondrialResults8c7db0"));
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
      id: 'position',
      header: t("history.position88c344"),
      accessor: (row) => (
        <PositionLink
          chromosome="chrM"
          position={row.position}
          label={translateUI(`m.${row.position}`, t)}
          onClick={handleOpenIGV}
        />
      ),
      width: 80,
      sortable: true,
    },
    {
      id: 'hgvs',
      header: 'HGVS',
      accessor: row => row.hgvs ?? '-',
      width: 140,
    },
    {
      id: 'change',
      header: t("tasks.referenceAlternateabcf6a"),
      accessor: (row) => `${row.ref}>${row.alt}`,
      width: 80,
    },
    {
      id: 'gene',
      header: t("history.gene9ef2ed"),
      accessor: (row) => <GeneLinks genes={row.gene} />,
      width: 100,
      sortable: true,
    },
    {
      id: 'heteroplasmy',
      header: t("tasks.heteroplasmyFractionba19ec"),
      accessor: (row) => `${formatNumericString((row.heteroplasmy * 100).toFixed(1), t.locale)}%`,
      width: 100,
      sortable: true,
    },
    {
      id: 'depth',
      header: t("tasks.dpReadDepth438651"),
      accessor: (row) => row.depth === null ? '-' : row.depth.toLocaleString(t.locale),
      width: 110,
    },
    {
      id: 'altReadCounts',
      header: t("tasks.mtAltReadCount"),
      accessor: (row) => row.altReadCounts.map(count => count?.toLocaleString(t.locale) ?? '-').join(' / ') || '-',
      width: 120,
    },
    {
      id: 'pathogenicity',
      header: t('tasks.acmgAssessment6a7cd5'),
      accessor: (row) => {
        const config = PATHOGENICITY_CONFIG[row.mtAssessment?.classification ?? row.pathogenicity];
        return <button type="button" className="inline-flex flex-col items-center gap-1 rounded text-sm hover:underline"
          onClick={event => { event.stopPropagation(); openDetails(row, 'assessment'); }}>
          <Tag variant={config.variant}>{translateUI(config.label, t)}</Tag>
          <span className="text-xs text-fg-muted">{t(row.mtAssessment ? 'mtDetail.manualClassification' : 'mtDetail.reportClassification')}</span>
        </button>;
      },
      width: 130,
    },
    {
      id: 'associatedDisease',
      header: t("history.associatedDiseasea79330"),
      accessor: 'associatedDisease',
      width: 200,
    },
    {
      id: 'haplogroup',
      header: t("history.haplogroupd4fd42"),
      accessor: (row) => row.haplogroup || '-',
      width: 80,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="variant-tab-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="yj-variant-toolbar">
      <ParquetColumnFilterBar taskId={taskId} table="mt" columns={localizeDisplay(result?.columns ?? [], t)} columnTypes={result?.columnTypes} columnLabels={resultColumnLabels(columns, result, 'mt', t)} state={filterState} onChange={setFilterState} />
      <div className="yj-variant-controls-row">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-52 max-w-full shrink-0 sm:w-64">
            <Input
              className="yj-variant-search [&_input]:min-w-0 [&_input]:w-0"
              placeholder={t("tasks.searchGeneOrDisease26b2d3")}
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
            <option value="">{t("tasks.allPathogenicityClasses41bc41")}</option>
            {Object.entries(PATHOGENICITY_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{translateUI(config.label, t)}</option>
            ))}
          </select>
        </div>

        <div className="text-sm text-fg-muted">
          {t("history.total497064")}{result?.total ?? 0} {t("tasks.mitochondrialVariants764fd0")}</div>
      </div>
      </div>

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
            columns={localizeDisplay(filterableColumns(columns, result, filterState, setFilterState, 'mt', t), t)}
            rowKey="id"
            striped
            density="compact"
            sortColumn={filterState.sortColumn}
            sortDirection={filterState.sortDirection}
            onSortChange={handleSortChange}
            onRowClick={row => openDetails(row, 'annotation')}
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
          {t("tasks.noMitochondrialVariantData1e6694")}</div>
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
        initialSection={initialSection}
        onSaveAssessment={handleSaveAssessment}
      />
    </div>
  );
}
