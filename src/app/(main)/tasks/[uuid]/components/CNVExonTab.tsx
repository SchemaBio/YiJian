'use client';
import { formatNumericString } from '@/i18n/format';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { ActionButton } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';


import { GeneLinks } from './GeneLinks';

import * as React from 'react';
import { TableViewControls, useTableView } from '@/components/shared/TableViewControls';
import { DataTable, Tag, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { CNVExon, TableFilterState, PaginatedResult, CNVAssessment, LossAssessmentCriteria, GainAssessmentCriteria } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getCNVExons, reportVariant, pinVariant, saveCNVAssessment, saveResultRowAdjustment } from '../result-api';
import { filterableColumns, resultColumnLabels } from './ResultColumnFilter';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';
import { PinCheckbox, ReportCheckbox, PinColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
import { CNVDetailPanel } from './CNVDetailPanel';
import type { CNVPlotAnchor } from './CNVPlotWindow';
import { CNVPathogenicityTag } from './CNVPathogenicityTag';
import { CNVAssessmentPanel } from './CNVAssessmentPanel';
import { useCNVAssessment } from '../hooks/useCNVAssessment';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';

interface CNVExonTabProps {
  taskId: string;
  referenceId?: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

function cnvTypeLabel(type: CNVExon['type'], t: TextTranslator = chineseText): string {
  if (type === 'Amplification') return t("history.duplication1aeb54");
  if (type === 'Deletion') return t("history.deletion2fe9b7");
  if (type === 'Normal') return t("history.normalf78d03");
  return t("history.notProvided071fb2");
}

function cnvTypeVariant(type: CNVExon['type']): 'danger' | 'info' | 'neutral' {
  if (type === 'Amplification') return 'danger';
  if (type === 'Deletion') return 'info';
  return 'neutral';
}

export function CNVExonTab({
  taskId,
  referenceId,
  filterState: externalFilterState,
  onFilterChange
}: CNVExonTabProps) {
  const t = useText();
  const scopeRef = React.useRef(taskId); scopeRef.current = taskId;
  const tableView = useTableView();
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<CNVExon> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [pendingVariantIDs, setPendingVariantIDs] = React.useState<Set<string>>(() => new Set());
  const [assessmentError, setAssessmentError] = React.useState<string | null>(null);
  const [assessmentSaving, setAssessmentSaving] = React.useState(false);
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { pinned: boolean; reported: boolean }>>({});
  React.useEffect(()=>{
    const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table==='cnv-exon')setReviewStatus({});};
    window.addEventListener('yijian:result-overlays-synced',sync);
    return()=>window.removeEventListener('yijian:result-overlays-synced',sync);
  },[taskId]);

  // 详情面板状态
  const [selectedVariant, setSelectedVariant] = React.useState<CNVExon | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = React.useState(false);

  // 评估面板状态
  const [assessmentVariant, setAssessmentVariant] = React.useState<CNVExon | null>(null);
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

  const clickedRow = React.useRef<Element | undefined>(undefined);
  const [plotAnchor, setPlotAnchor] = React.useState<CNVPlotAnchor>();
  React.useLayoutEffect(() => {
    const row = clickedRow.current;
    if (!row?.isConnected) { setPlotAnchor(undefined); return; }
    const bounds = row.getBoundingClientRect();
    setPlotAnchor({ top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right });
  }, [selectedVariant, detailPanelOpen]);

  // 点击行打开详情面板
  const handleRowClick = React.useCallback((variant: CNVExon) => {
    setAssessmentPanelOpen(false);
    setSelectedVariant({ ...variant, assessment: assessmentCache[variant.id] ?? variant.assessment });
    setDetailPanelOpen(true);
  }, [assessmentCache]);

  // 关闭详情面板
  const handleCloseDetailPanel = React.useCallback(() => {
    setDetailPanelOpen(false);
  }, []);

  // 打开评估面板
  const handleOpenAssessmentPanel = React.useCallback((variant: CNVExon) => {
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
      const persisted = await saveCNVAssessment(taskId, 'cnv-exon', assessmentVariant.id, finalized, assessmentVariant.adjustmentVersion ?? 0);
      setAssessmentCache(prev => ({
        ...prev,
        [persisted.cnvId]: persisted,
      }));
      setResult(prev => prev ? { ...prev, data: prev.data.map(item => item.id === persisted.cnvId ? { ...item, adjustmentVersion: persisted.adjustmentVersion } : item) } : prev);
      setAssessmentPanelOpen(false);
    } catch (err) {
      setAssessmentError(err instanceof Error ? errorText(err, t) : t("tasks.unableToSaveCnvAssessment5c60a2"));
    } finally {
      setAssessmentSaving(false);
    }
  }, [assessmentVariant, saveAssessment, taskId, t]);

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
        const data = await getCNVExons(taskId, filterState, controller.signal);
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
          setRequestError(error instanceof Error ? errorText(error, t) : t("tasks.unableToLoadExonCnvResults310562"));
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
  const handlePinChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; reported: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, pinned: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await pinVariant(taskId, 'cnv-exon', id, checked);
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

  // 处理回报状态变更
  const handleReportChange = React.useCallback(async (id: string, checked: boolean, currentState: { pinned: boolean; reported: boolean }) => {
    setOperationError(null);
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reported: checked }
    }));
    setPendingVariantIDs((previous) => new Set(previous).add(id));
    try {
      await reportVariant(taskId, 'cnv-exon', id, checked);
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

  // 获取变异的置顶状态
  const getReviewState = React.useCallback((variant: CNVExon) => {
    return reviewStatus[variant.id] ?? { pinned: variant.pinned, reported: variant.reported };
  }, [reviewStatus]);

  const columns: Column<CNVExon>[] = [
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
      id: 'gene',
      header: t("history.gene9ef2ed"),
      accessor: (row) => <GeneLinks genes={row.gene} />,
      width: 100,
      sortable: true,
    },
    {
      id: 'transcript',
      header: t("history.transcript96b6d7"),
      accessor: 'transcript',
      width: 130,
    },
    {
      id: 'exon',
      header: t("tasks.exonCount17ce3c"),
      accessor: 'exon',
      width: 100,
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
      id: 'iscnCandidate',
      header: t("tasks.iscnCandidate8351ad"),
      accessor: row => <HoverHint content={t("tasks.candidateFromRoundedCnEstimateConfirmCopyc6a777")}><span className="yj-iscn-full block whitespace-normal break-words font-mono text-xs" >{row.iscnCandidate || (row.type === 'Normal' ? '—' : t("tasks.copyStateOrCytobandUnconfirmed1ecdb7"))}</span></HoverHint>,
      width: 300,
    },
    {
      id: 'type',
      header: t("history.typee4e46c"),
      accessor: (row) => {
        return (
          <Tag variant={cnvTypeVariant(row.type)}>
            {cnvTypeLabel(row.type, t)}
          </Tag>
        );
      },
      width: 80,
      sortable: true,
    },
    {
      id: 'pathogenicity',
      header: t("history.pathogenicityfa6024"),
      accessor: (row) => {
        if (row.type === 'Normal' || row.type === 'Unknown') {
          return <Tag variant="neutral">{t("tasks.notApplicableeec46c")}</Tag>;
        }
        const cachedAssessment = getAssessmentForCNV(row.id);
        if (!cachedAssessment) return <button type="button" onClick={event => { event.stopPropagation(); handleOpenAssessmentPanel(row); }} className="text-xs text-accent-fg hover:underline">{t("tasks.awaitingAssessmentCalculator7816f6")}</button>;
        if(cachedAssessment.assessmentState==='insufficient_evidence')return <HoverHint content={cachedAssessment.autoEvidenceNotes?.join('；')}><button type="button" onClick={event=>{event.stopPropagation();handleOpenAssessmentPanel(row);}} className="text-xs text-fg-muted hover:underline" >{t("tasks.insufficientEvidenceCalculatorc6de1e")}</button></HoverHint>;
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
      header: t("history.copyNumber04d1ca"),
      accessor: (row) => row.copyNumber ?? t("history.notProvided071fb2"),
      width: 80,
    },
    {
      id: 'ratio',
      header: 'Copy ratio',
      accessor: (row) => row.ratio === null ? t("history.notProvided071fb2") : formatNumericString(row.ratio.toFixed(2), t.locale),
      width: 80,
    },
    {
      id: 'confidence',
      header: t("history.confidenceb78c2d"),
      accessor: (row) => ({HIGH:t("tasks.highb096b3"),MEDIUM:t("tasks.medium086907"),LOW:t("tasks.lowb9ee25")}[row.confidenceLabel ?? ''] ?? row.confidenceLabel) || t("history.notProvided071fb2"),
      width: 80,
      sortable: true,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div onClickCapture={event => {
      const row = (event.target as HTMLElement).closest('tbody tr');
      if (row) clickedRow.current = row;
    }} data-density={tableView.density} className={`variant-tab-panel yj-interpretation-panel flex h-full min-h-0 flex-col overflow-hidden ${detailPanelOpen || assessmentPanelOpen ? 'yj-has-inspector' : ''}`}>
      <div className="yj-variant-toolbar">
      <ParquetColumnFilterBar taskId={taskId} table="cnv-exon" columns={localizeDisplay(result?.columns ?? [], t)} columnTypes={result?.columnTypes} columnLabels={resultColumnLabels(columns, result, 'cnv-exon', t)} state={filterState} onChange={setFilterState} viewControls={<TableViewControls columns={localizeDisplay(columns, t)} view={tableView} />} />
      <div className="yj-variant-controls-row">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="w-52 max-w-full shrink-0 sm:w-64">
            <Input
              className="yj-variant-search [&_input]:min-w-0 [&_input]:w-0"
              placeholder={t("tasks.searchGenesOrExons2fe67e")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>

          {/* 基因列表筛选 */}

        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-fg-muted">
          <span>{t("history.total497064")}{result?.total ?? 0} {t("tasks.exonCnvs5e961a")}</span>
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
            data={result.data}
            columns={localizeDisplay(filterableColumns(tableView.apply(columns), result, filterState, setFilterState, 'cnv-exon', t), t)}
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
          {t("tasks.noExonCnvData066106")}</div>
      )}

      {/* CNV 详情面板 */}
      <CNVDetailPanel
        plotAnchor={plotAnchor}
        onSaveInterpretation={async (variant, interpretation) => {
          const saved = await saveResultRowAdjustment(taskId, 'cnv-exon', variant.id, variant.adjustmentVersion ?? 0, { interpretation }, t("tasks.updateCnvInterpretationfbe6af"));
          if (scopeRef.current !== taskId) return;
          const changes = { interpretation, adjustmentVersion: saved.adjustment.version };
          setAssessmentCache(current => current[variant.id] ? { ...current, [variant.id]: { ...current[variant.id], adjustmentVersion: saved.adjustment.version } } : current);
          setSelectedVariant(current => current?.id === variant.id ? { ...current, ...changes } : current);
          setResult(current => current ? { ...current, data: current.data.map(row => row.id === variant.id ? { ...row, ...changes } : row) } : current);
        }}
        taskId={taskId}
        onOpenAssessment={variant => handleOpenAssessmentPanel(variant as CNVExon)}
        variant={selectedVariant}
        variantType="exon"
        isOpen={detailPanelOpen}
        onClose={handleCloseDetailPanel}
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
        <div className="mt-3 text-sm text-fg-muted">{t("tasks.savingCnvAssessment4161a9")}</div>
      )}
      <CNVAssessmentPanel
        taskId={taskId}
        referenceId={referenceId}
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
