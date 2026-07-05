'use client';

import * as React from 'react';
import { DataTable, Tag, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search } from 'lucide-react';
import type { CNVExon, TableFilterState, PaginatedResult, CNVAssessment, LossAssessmentCriteria, GainAssessmentCriteria } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getCNVExons, reportVariant, reviewVariant } from '../result-api';
import { ReviewCheckbox, ReportCheckbox, ReviewColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
import { CNVDetailPanel } from './CNVDetailPanel';
import { CNVPathogenicityTag } from './CNVPathogenicityTag';
import { CNVAssessmentPanel } from './CNVAssessmentPanel';
import { useCNVAssessment } from '../hooks/useCNVAssessment';

interface CNVExonTabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

function cnvTypeLabel(type: CNVExon['type']): string {
  if (type === 'Amplification') return '扩增';
  if (type === 'Deletion') return '缺失';
  return '正常';
}

function cnvTypeVariant(type: CNVExon['type']): 'danger' | 'info' | 'neutral' {
  if (type === 'Amplification') return 'danger';
  if (type === 'Deletion') return 'info';
  return 'neutral';
}

export function CNVExonTab({ 
  taskId, 
  filterState: externalFilterState,
  onFilterChange 
}: CNVExonTabProps) {
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<CNVExon> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { reviewed: boolean; reported: boolean }>>({});

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
    initializeAssessment,
  } = useCNVAssessment(assessmentVariant);

  // 存储每个CNV的评估结果
  const [assessmentCache, setAssessmentCache] = React.useState<Record<string, CNVAssessment>>({});

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  // 点击行打开详情面板
  const handleRowClick = React.useCallback((variant: CNVExon) => {
    setSelectedVariant(variant);
    setDetailPanelOpen(true);
  }, []);

  // 关闭详情面板
  const handleCloseDetailPanel = React.useCallback(() => {
    setDetailPanelOpen(false);
  }, []);

  // 打开评估面板
  const handleOpenAssessmentPanel = React.useCallback((variant: CNVExon) => {
    if (variant.type === 'Normal') return;
    setAssessmentVariant(variant);
    initializeAssessment(variant);
    setAssessmentPanelOpen(true);
  }, [initializeAssessment]);

  // 关闭评估面板
  const handleCloseAssessmentPanel = React.useCallback(() => {
    setAssessmentPanelOpen(false);
  }, []);

  // 保存评估
  const handleSaveAssessment = React.useCallback((savedAssessment: CNVAssessment) => {
    setAssessmentCache(prev => ({
      ...prev,
      [savedAssessment.cnvId]: savedAssessment,
    }));
    saveAssessment();
    setAssessmentPanelOpen(false);
  }, [saveAssessment]);

  // 获取CNV的评估结果
  const getAssessmentForCNV = React.useCallback((cnvId: string): CNVAssessment | null => {
    return assessmentCache[cnvId] ?? null;
  }, [assessmentCache]);

  // 加载基因列表
  React.useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getCNVExons(taskId, filterState);
      setResult(data);
      setLoading(false);
    }
    loadData();
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

  // 处理审核状态变更
  const handleReviewChange = React.useCallback((id: string, checked: boolean, currentState: { reviewed: boolean; reported: boolean }) => {
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reviewed: checked }
    }));
    reviewVariant(taskId, 'cnv-exon', id, checked).catch(() => {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
    });
  }, [taskId]);

  // 处理回报状态变更
  const handleReportChange = React.useCallback((id: string, checked: boolean, currentState: { reviewed: boolean; reported: boolean }) => {
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reported: checked }
    }));
    reportVariant(taskId, 'cnv-exon', id, checked).catch(() => {
      setReviewStatus(prev => ({ ...prev, [id]: currentState }));
    });
  }, [taskId]);

  // 获取变异的审核状态
  const getReviewState = React.useCallback((variant: CNVExon) => {
    return reviewStatus[variant.id] ?? { reviewed: variant.reviewed, reported: variant.reported };
  }, [reviewStatus]);

  // 按审核/回报状态排序的数据
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

  const columns: Column<CNVExon>[] = [
    {
      id: 'reviewed',
      header: <ReviewColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return (
          <ReviewCheckbox
            checked={state.reviewed}
            onChange={(checked) => handleReviewChange(row.id, checked, state)}
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
      id: 'exon',
      header: '外显子',
      accessor: 'exon',
      width: 100,
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
        if (row.type === 'Normal') {
          return <Tag variant="neutral">不适用</Tag>;
        }
        const cachedAssessment = getAssessmentForCNV(row.id);
        const classification = cachedAssessment?.classification ?? 'VUS';
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
      accessor: (row) => row.copyNumber,
      width: 80,
      sortable: true,
    },
    {
      id: 'ratio',
      header: '比值',
      accessor: (row) => row.ratio.toFixed(2),
      width: 80,
      sortable: true,
    },
    {
      id: 'confidence',
      header: '置信度',
      accessor: (row) => `${(row.confidence * 100).toFixed(0)}%`,
      width: 80,
      sortable: true,
    },
  ];

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-64">
            <Input
              placeholder="搜索基因、外显子..."
              value={filterState.searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>

          {/* 基因列表筛选 */}

        </div>

        <div className="flex items-center gap-4 text-sm text-fg-muted">
          <span>共 {result?.total ?? 0} 条外显子CNV</span>
        </div>
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
          暂无外显子CNV变异数据
        </div>
      )}

      {/* CNV 详情面板 */}
      <CNVDetailPanel
        variant={selectedVariant}
        variantType="exon"
        isOpen={detailPanelOpen}
        onClose={handleCloseDetailPanel}
      />

      {/* CNV 评估面板 */}
      <CNVAssessmentPanel
        cnv={assessmentVariant}
        assessment={assessment}
        isOpen={assessmentPanelOpen}
        onClose={handleCloseAssessmentPanel}
        onSave={handleSaveAssessment}
        onReset={resetAssessment}
        onCriteriaChange={updateCriteria}
      />
    </div>
  );
}
