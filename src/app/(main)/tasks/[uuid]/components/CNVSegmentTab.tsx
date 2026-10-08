'use client';
import { HoverHint } from '@/components/shared/HoverHint';


import { GeneLinks } from './GeneLinks';

import * as React from 'react';
import { TableViewControls, useTableView } from '@/components/shared/TableViewControls';
import { DataTable, Tag, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { CNVSegment, TableFilterState, PaginatedResult, CNVAssessment, LossAssessmentCriteria, GainAssessmentCriteria } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getCNVSegments, reportVariant, pinVariant, saveCNVAssessment } from '../result-api';
import { filterableColumns } from './ResultColumnFilter';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { PinCheckbox, ReportCheckbox, PinColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
import { CNVDetailPanel } from './CNVDetailPanel';
import { CNVPathogenicityTag } from './CNVPathogenicityTag';
import { CNVAssessmentPanel } from './CNVAssessmentPanel';
import { useCNVAssessment } from '../hooks/useCNVAssessment';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

interface CNVSegmentTabProps {
  taskId: string;
  referenceId?: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

function cnvTypeLabel(type: CNVSegment['type']): string {
  if (type === 'Amplification') return '扩增';
  if (type === 'Deletion') return '缺失';
  if (type === 'Normal') return '正常';
  return '未提供';
}

function cnvTypeVariant(type: CNVSegment['type']): 'danger' | 'info' | 'neutral' {
  if (type === 'Amplification') return 'danger';
  if (type === 'Deletion') return 'info';
  return 'neutral';
}

export function CNVSegmentTab({
  taskId,
  referenceId,
  filterState: externalFilterState,
  onFilterChange
}: CNVSegmentTabProps) {
  const tableView = useTableView();
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<CNVSegment> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [assessmentError, setAssessmentError] = React.useState<string | null>(null);
  const [assessmentSaving, setAssessmentSaving] = React.useState(false);
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { pinned: boolean; reported: boolean }>>({});
  React.useEffect(()=>{
    const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table==='cnv-segment')setReviewStatus({});};
    window.addEventListener('yijian:result-overlays-synced',sync);
    return()=>window.removeEventListener('yijian:result-overlays-synced',sync);
  },[taskId]);

  // 详情面板状态
  const [selectedVariant, setSelectedVariant] = React.useState<CNVSegment | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = React.useState(false);

  // 评估面板状态
  const [assessmentVariant, setAssessmentVariant] = React.useState<CNVSegment | null>(null);
  const [assessmentPanelOpen, setAssessmentPanelOpen] = React.useState(false);

  // 评估状态管理
  const {
    assessment,
    updateCriteria,
    resetAssessment,
    saveAssessment,
    loadAssessment,
    initializeAssessment,
  } = useCNVAssessment(assessmentVariant);

  // 存储每个CNV的评估结果
  const [assessmentCache, setAssessmentCache] = React.useState<Record<string, CNVAssessment>>({});

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  // 点击行打开详情面板
  const handleRowClick = React.useCallback((variant: CNVSegment) => {
    setAssessmentPanelOpen(false);
    setSelectedVariant({ ...variant, assessment: assessmentCache[variant.id] ?? variant.assessment });
    setDetailPanelOpen(true);
  }, [assessmentCache]);

  // 关闭详情面板
  const handleCloseDetailPanel = React.useCallback(() => {
    setDetailPanelOpen(false);
  }, []);

  // 打开评估面板
  const handleOpenAssessmentPanel = React.useCallback((variant: CNVSegment) => {
    if (variant.type === 'Normal' || variant.type === 'Unknown') return;
    const cached = assessmentCache[variant.id] ?? variant.assessment;
    setAssessmentVariant({ ...variant, adjustmentVersion: cached?.adjustmentVersion ?? variant.adjustmentVersion });
    if (cached) {
      loadAssessment(cached);
    } else {
      initializeAssessment(variant);
    }
    setDetailPanelOpen(false);
    setAssessmentPanelOpen(true);
    setAssessmentError(null);
  }, [assessmentCache, initializeAssessment, loadAssessment]);

  // 关闭评估面板
  const handleCloseAssessmentPanel = React.useCallback(() => {
    setAssessmentPanelOpen(false);
  }, []);

  // 保存评估
  const handleSaveAssessment = React.useCallback(async (_savedAssessment: CNVAssessment) => {
    if (!assessmentVariant) return;
    const finalized = saveAssessment();
    if (!finalized) return;
    setAssessmentSaving(true);
    setAssessmentError(null);
    try {
      const persisted = await saveCNVAssessment(taskId, 'cnv-segment', assessmentVariant.id, finalized, assessmentVariant.adjustmentVersion ?? 0);
      setAssessmentCache(prev => ({
        ...prev,
        [persisted.cnvId]: persisted,
      }));
      setResult(prev => prev ? { ...prev, data: prev.data.map(item => item.id === persisted.cnvId ? { ...item, adjustmentVersion: persisted.adjustmentVersion } : item) } : prev);
      setAssessmentPanelOpen(false);
    } catch (err) {
      setAssessmentError(err instanceof Error ? err.message : '保存 CNV 评估失败');
    } finally {
      setAssessmentSaving(false);
    }
  }, [assessmentVariant, saveAssessment, taskId]);

  // 获取CNV的评估结果
  const getAssessmentForCNV = React.useCallback((cnvId: string): CNVAssessment | null => {
    return assessmentCache[cnvId] ?? null;
  }, [assessmentCache]);

  // 加载基因列表
  React.useEffect(() => {
    const controller = new AbortController();
    async function loadData() {
      setLoading(true);
      setRequestError(null);
      try {
        const data = await getCNVSegments(taskId, filterState, controller.signal);
        if (controller.signal.aborted) return;
        setResult(data);
        setAssessmentCache(prev => {
          const next = { ...prev };
          for (const item of data.data) {
            delete next[item.id];
            if (item.assessment) next[item.id] = item.assessment;
          }
          return next;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setRequestError(error instanceof Error ? error.message : '无法加载片段 CNV 结果');
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

  const handleTypeFilter = React.useCallback((type: string) => {
    const newFilters = { ...filterState.filters };
    if (type) {
      newFilters.type = type;
    } else {
      delete newFilters.type;
    }
    setFilterState({ ...filterState, filters: newFilters, page: 1 });
  }, [filterState, setFilterState]);

  // 处理置顶状态变更
  const handlePinChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; reported: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, pinned: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await pinVariant(taskId, 'cnv-segment', id, checked);
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

  // 处理回报状态变更
  const handleReportChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; reported: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reported: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await reportVariant(taskId, 'cnv-segment', id, checked);
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

  // 获取变异的置顶状态
  const getReviewState = React.useCallback((variant: CNVSegment) => {
    return reviewStatus[variant.id] ?? { pinned: variant.pinned, reported: variant.reported };
  }, [reviewStatus]);

  const columns: Column<CNVSegment>[] = [
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
      header: '染色体',
      accessor: 'chromosome',
      width: 80,
      sortable: true,
    },
    {
      id: 'startPosition',
      header: '起始位置',
      accessor: (row) => row.startPosition,
      width: 120,
      sortable: true,
    },
    {
      id: 'endPosition',
      header: '终止位置',
      accessor: (row) => row.endPosition,
      width: 120,
    },
    {
      id: 'length',
      header: '长度',
      accessor: (row) => {
        if (row.length >= 1000000) return `${(row.length / 1000000).toFixed(2)}Mb`;
        if (row.length >= 1000) return `${(row.length / 1000).toFixed(1)}kb`;
        return `${row.length}bp`;
      },
      width: 100,
      sortable: true,
    },
    {
      id: 'iscnCandidate',
      header: 'ISCN 候选',
      accessor: row => <HoverHint content="基于 CN 估计取整的候选注释，需确认拷贝状态；坐标为 1-based"><span className="block whitespace-normal break-words font-mono text-xs" >{row.iscnCandidate || (row.type === 'Normal' ? '—' : '拷贝状态或带区待确认')}</span></HoverHint>,
      width: 300,
    },
    {
      id: 'type',
      header: '类型',
      accessor: (row) => {
        return (
          <Tag variant={cnvTypeVariant(row.type)}>
            {cnvTypeLabel(row.type)}
          </Tag>
        );
      },
      width: 80,
      sortable: true,
    },
    {
      id: 'pathogenicity',
      header: '致病性',
      accessor: (row) => {
        if (row.type === 'Normal' || row.type === 'Unknown') {
          return <Tag variant="neutral">不适用</Tag>;
        }
        const cachedAssessment = getAssessmentForCNV(row.id);
        // 如果有缓存的评估结果，使用缓存；否则显示默认VUS
        if (!cachedAssessment) return <button type="button" onClick={event => { event.stopPropagation(); handleOpenAssessmentPanel(row); }} className="text-xs text-accent-fg hover:underline">待评估 · 计算器</button>;
        if(cachedAssessment.assessmentState==='insufficient_evidence')return <HoverHint content={cachedAssessment.autoEvidenceNotes?.join('；')}><button type="button" onClick={event=>{event.stopPropagation();handleOpenAssessmentPanel(row);}} className="text-xs text-fg-muted hover:underline" >证据不足 · 计算器</button></HoverHint>;
        const classification = cachedAssessment.classification;
        const score = cachedAssessment?.totalScore ?? 0;
        const isUserModified = cachedAssessment?.isUserModified ?? false;

        return (
          <CNVPathogenicityTag
            cnvType={row.type}
            classification={classification}
            score={score}
            isUserModified={isUserModified}
            onClick={() => handleOpenAssessmentPanel(row)}
          />
        );
      },
      width: 100,
    },
    {
      id: 'copyNumber',
      header: '拷贝数',
      accessor: (row) => row.copyNumber ?? '未提供',
      width: 80,
    },
    {
      id: 'genes',
      header: '涉及基因',
      accessor: (row) => <GeneLinks genes={row.genes} />,
      width: 200,
    },
    {
      id: 'confidence',
      header: '置信度',
      accessor: (row) => row.confidence === null ? '未提供' : `${(row.confidence * 100).toFixed(0)}%`,
      width: 80,
      sortable: true,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div data-density={tableView.density} className={`variant-tab-panel yj-interpretation-panel flex h-full min-h-0 flex-col overflow-hidden ${detailPanelOpen || assessmentPanelOpen ? 'yj-has-inspector' : ''}`}>
      <ParquetColumnFilterBar taskId={taskId} table="cnv-segment" columns={result?.columns ?? []} columnTypes={result?.columnTypes} state={filterState} onChange={setFilterState} viewControls={<TableViewControls columns={columns} view={tableView} />} />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Input
              placeholder="搜索染色体..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>

          {/* 基因列表筛选 */}

          <select
            value={(filterState.filters.type as string) || ''}
            onChange={(e) => handleTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default"
          >
            <option value="">全部类型</option>
            <option value="Amplification">扩增</option>
            <option value="Deletion">缺失</option>
            <option value="Normal">正常</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-sm text-fg-muted">
          <span>共 {result?.total ?? 0} 条片段CNV</span>
        </div>
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
            data={result.data}
            columns={filterableColumns(tableView.apply(columns), result, filterState, setFilterState, 'cnv-segment')}
            rowKey="id"
            striped
            density={tableView.density}
            sortColumn={filterState.sortColumn}
            sortDirection={filterState.sortDirection}
            onSortChange={handleSortChange}
            selectedRows={new Set(detailPanelOpen && selectedVariant ? [selectedVariant.id] : [])}
            onRowClick={handleRowClick}
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
        <div className="text-center py-12 text-fg-muted">
          暂无片段CNV变异数据
        </div>
      )}

      {/* CNV 详情面板 */}
      <CNVDetailPanel
        taskId={taskId}
        onOpenAssessment={variant => handleOpenAssessmentPanel(variant as CNVSegment)}
        variant={selectedVariant}
        variantType="segment"
        isOpen={detailPanelOpen}
        onClose={handleCloseDetailPanel}
        allSegments={result?.data || []}
        referenceId={referenceId}
      />

      {/* CNV 评估面板 */}
      {assessmentError && (
        <div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {assessmentError}
        </div>
      )}
      {operationError && (
        <div className="mt-3 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {operationError}
        </div>
      )}
      {assessmentSaving && (
        <div className="mt-3 text-sm text-fg-muted">正在保存 CNV 评估…</div>
      )}
      <CNVAssessmentPanel
        cnv={assessmentVariant}
        assessment={assessment}
        isOpen={assessmentPanelOpen}
        onClose={handleCloseAssessmentPanel}
        onSave={handleSaveAssessment}
        saving={assessmentSaving}
        error={assessmentError}
        onReset={resetAssessment}
        onCriteriaChange={updateCriteria}
      />
    </div>
  );
}
