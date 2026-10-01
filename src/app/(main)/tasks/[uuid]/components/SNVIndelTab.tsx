'use client';

import * as React from 'react';
import { DataTable, Tag, Input } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Search, ListFilter } from 'lucide-react';
import type { SNVIndel, TableFilterState, PaginatedResult, ACMGEvidenceEntry, ACMGClassification } from '../types';
import { DEFAULT_FILTER_STATE } from '../types';
import { getSNVIndels, ACMG_CONFIG, getGeneLists, reportVariant, reviewVariant, saveResultRowAdjustment, type GeneListOption } from '../result-api';
import { IGVViewer, PositionLink } from './IGVViewer';
import { VariantDetailPanel } from './VariantDetailPanel';
import { formatPopulationFrequency, sourceAnnotation } from '../utils/snv-annotations';
import { ReviewCheckbox, ReportCheckbox, ReviewColumnHeader, ReportColumnHeader } from './ReviewCheckboxes';
import { ParquetColumnFilterBar } from './ParquetColumnFilterBar';

interface SNVIndelTabProps {
  taskId: string;
  filterState?: TableFilterState;
  onFilterChange?: (state: TableFilterState) => void;
}

export function SNVIndelTab({ 
  taskId, 
  filterState: externalFilterState,
  onFilterChange 
}: SNVIndelTabProps) {
  const [internalFilterState, setInternalFilterState] = React.useState<TableFilterState>(DEFAULT_FILTER_STATE);
  const [result, setResult] = React.useState<PaginatedResult<SNVIndel> | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  const scopeRef = React.useRef(taskId); scopeRef.current = taskId;
  const [loading, setLoading] = React.useState(true);
	const [requestError, setRequestError] = React.useState<string | null>(null);
	const [operationError, setOperationError] = React.useState<string | null>(null);
	const [pendingVariants, setPendingVariants] = React.useState<Set<string>>(() => new Set());
  const [geneLists, setGeneLists] = React.useState<GeneListOption[]>([]);
  const [reviewStatus, setReviewStatus] = React.useState<Record<string, { reviewed: boolean; reported: boolean }>>({});
  React.useEffect(()=>{
    const sync=(event:Event)=>{const d=(event as CustomEvent).detail;if(d?.taskId===taskId&&d?.table==='snv-indel')setReviewStatus({});};
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
  const [selectedVariant, setSelectedVariant] = React.useState<SNVIndel | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = React.useState(false);

  React.useEffect(() => { setSelectedVariant(null); setDetailPanelOpen(false); setReviewStatus({}); }, [taskId]);

  const filterState = externalFilterState ?? internalFilterState;
  const setFilterState = onFilterChange ?? setInternalFilterState;

  // 打开 IGV 查看器
  const handleOpenIGV = React.useCallback((chromosome: string, position: number) => {
    setIgvState({ isOpen: true, chromosome, position });
  }, []);

  // 关闭 IGV 查看器
  const handleCloseIGV = React.useCallback(() => {
    setIgvState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // 点击行打开详情面板
  const handleRowClick = React.useCallback((variant: SNVIndel) => {
    setSelectedVariant(variant);
    setDetailPanelOpen(true);
  }, []);

  // 关闭详情面板
  const handleCloseDetailPanel = React.useCallback(() => {
    setDetailPanelOpen(false);
  }, []);

  // 处理审核状态变更
  const handleReviewChange = React.useCallback((id: string, checked: boolean, currentState: { reviewed: boolean; reported: boolean }) => {
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reviewed: checked }
    }));
		setPendingVariants(previous => new Set(previous).add(id));
		setOperationError(null);
		void reviewVariant(taskId, 'snv-indel', id, checked).catch(cause => {
			setReviewStatus(prev => ({ ...prev, [id]: currentState }));
			setOperationError(cause instanceof Error ? cause.message : '审核状态保存失败');
		}).finally(() => setPendingVariants(previous => {
			const next = new Set(previous); next.delete(id); return next;
		}));
  }, [taskId]);

  // 处理回报状态变更
  const handleReportChange = React.useCallback((id: string, checked: boolean, currentState: { reviewed: boolean; reported: boolean }) => {
    setReviewStatus(prev => ({
      ...prev,
      [id]: { ...currentState, reported: checked }
    }));
		setPendingVariants(previous => new Set(previous).add(id));
		setOperationError(null);
		void reportVariant(taskId, 'snv-indel', id, checked).catch(cause => {
			setReviewStatus(prev => ({ ...prev, [id]: currentState }));
			setOperationError(cause instanceof Error ? cause.message : '回报标记保存失败');
		}).finally(() => setPendingVariants(previous => {
			const next = new Set(previous); next.delete(id); return next;
		}));
  }, [taskId]);

  // 获取变异的审核状态
  const getReviewState = React.useCallback((variant: SNVIndel) => {
    return reviewStatus[variant.id] ?? { reviewed: variant.reviewed, reported: variant.reported };
  }, [reviewStatus]);

	const sortedData = result?.data ?? [];
	const [searchInput, setSearchInput] = React.useState(filterState.searchQuery);
	React.useEffect(() => setSearchInput(filterState.searchQuery), [filterState.searchQuery]);
	React.useEffect(() => {
		const timer = window.setTimeout(() => {
			if (searchInput !== filterState.searchQuery) setFilterState({ ...filterState, searchQuery: searchInput, page: 1 });
		}, 300);
		return () => window.clearTimeout(timer);
	}, [filterState, searchInput, setFilterState]);

  // 加载基因列表
  React.useEffect(() => {
    async function loadGeneLists() {
      const lists = await getGeneLists();
      setGeneLists(lists);
    }
    loadGeneLists();
  }, []);

  // 加载数据
  React.useEffect(() => {
		const controller = new AbortController();
    async function loadData() {
      setLoading(true);
		setRequestError(null);
		try {
			const data = await getSNVIndels(taskId, filterState, controller.signal);
			if (!controller.signal.aborted) setResult(data);
		} catch (cause) {
			if (!controller.signal.aborted) setRequestError(cause instanceof Error ? cause.message : '无法加载 SNP / InDel 结果');
		} finally {
			if (!controller.signal.aborted) setLoading(false);
		}
    }
		void loadData();
		return () => controller.abort();
  }, [taskId, filterState, reloadToken]);

  // 处理搜索
  // 处理排序
  const handleSortChange = React.useCallback((column: string, direction: 'asc' | 'desc' | null) => {
    setFilterState({
      ...filterState,
      sortColumn: direction ? column : undefined,
      sortDirection: direction ?? undefined,
    });
  }, [filterState, setFilterState]);

  // 处理ACMG筛选
  const handleACMGFilter = React.useCallback((classification: ACMGClassification | '') => {
    const newFilters = { ...filterState.filters };
    if (classification) {
      newFilters.acmgClassification = classification;
    } else {
      delete newFilters.acmgClassification;
    }
    setFilterState({ ...filterState, filters: newFilters, page: 1 });
  }, [filterState, setFilterState]);

  // 处理基因列表筛选
  const handleGeneListFilter = React.useCallback((geneListId: string) => {
    setFilterState({ 
      ...filterState, 
      geneListId: geneListId || undefined, 
      page: 1 
    });
  }, [filterState, setFilterState]);

  const handleUpdateClassification = React.useCallback(async (variant: SNVIndel, evidence: ACMGEvidenceEntry[], override: ACMGClassification | '', overrideReason: string, reason: string, reset = false) => {
    const saved = await saveResultRowAdjustment(taskId, 'snv-indel', variant.id, variant.adjustmentVersion ?? 0, reset ? { resetAcmg: true } : {
      acmgEvidence: evidence,
      acmgOverride: override,
      acmgOverrideReason: overrideReason,
    }, reason);
    if (scopeRef.current !== taskId) return;
    setReloadToken(value => value + 1);
    setSelectedVariant(current => current?.id !== variant.id ? current : {
      ...variant,
      acmgEvidence: evidence,
      acmgOverride: override || undefined,
      acmgOverrideReason: overrideReason,
      acmgClassification: reset ? variant.automaticAcmg?.classification : saved.adjustment.adjustments.acmgClassification as ACMGClassification | undefined,
      acmgState: String(saved.adjustment.adjustments.acmgState ?? ''),
      acmgAssessmentSource: reset ? 'automatic' : override ? 'manual_override' : 'manual_evidence',
      acmgCriteria: evidence.map(item => item.code),
      adjustmentVersion: saved.adjustment.version,
    });
  }, [taskId]);

  const handleSaveInterpretation = React.useCallback(async (variant: SNVIndel, interpretation: string, reason: string) => {
    const saved = await saveResultRowAdjustment(taskId, 'snv-indel', variant.id, variant.adjustmentVersion ?? 0, { interpretation }, reason);
    if (scopeRef.current !== taskId) return;
    setReloadToken(value => value + 1);
    setSelectedVariant(current => current?.id !== variant.id ? current : { ...current, interpretation, adjustmentVersion: saved.adjustment.version });
  }, [taskId]);

  // 获取当前选中的基因列表信息
  const selectedGeneList = React.useMemo(() => {
    if (!filterState.geneListId) return null;
    return geneLists.find(list => list.id === filterState.geneListId);
  }, [filterState.geneListId, geneLists]);

  // 列定义
  const columns: Column<SNVIndel>[] = [
    {
      id: 'reviewed',
      header: <ReviewColumnHeader />,
      accessor: (row) => {
        const state = getReviewState(row);
        return (
          <ReviewCheckbox
            checked={state.reviewed}
            onChange={(checked) => handleReviewChange(row.id, checked, state)}
					disabled={pendingVariants.has(row.id)}
          />
        );
      },
      width: 60,
      align: 'center',
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
					disabled={pendingVariants.has(row.id)}
          />
        );
      },
      width: 60,
      align: 'center',
    },
    {
      id: 'gene',
      header: '基因',
      accessor: (row) => <span className="font-semibold text-accent-fg">{row.gene}</span>,
      width: 100,
      align: 'center',
      sortable: true,
    },
    {
      id: 'position',
      header: '变异位置',
      accessor: (row) => (
        <PositionLink
          chromosome={row.chromosome}
          position={row.position}
          onClick={handleOpenIGV}
        />
      ),
      width: 150,
      align: 'center',
      sortable: true,
    },
    {
      id: 'change',
      header: '参考/变异',
      accessor: (row) => `${row.ref}>${row.alt}`,
      width: 100,
      align: 'center',
    },
    {
      id: 'variantType',
      header: '变异类型',
      accessor: (row) => {
        const typeLabels = { SNV: 'SNP', Insertion: '插入', Deletion: '缺失', Complex: '复杂' };
        const variants: Record<SNVIndel['variantType'], 'neutral' | 'info' | 'warning'> = { SNV: 'neutral', Insertion: 'info', Deletion: 'warning', Complex: 'neutral' };
        return <Tag variant={variants[row.variantType]}>{typeLabels[row.variantType]}</Tag>;
      },
      width: 80,
      align: 'center',
    },
    {
      id: 'zygosity',
      header: '杂合性',
      accessor: (row) => {
        const labels = { Heterozygous: '杂合', Homozygous: '纯合', Hemizygous: '半合', Unknown: '未提供' };
        return row.zygosity === 'Unknown' ? <span className="text-fg-muted">未提供</span> : <span className="inline-flex rounded-full bg-canvas-inset px-2 py-0.5 text-xs font-medium text-fg-default">{labels[row.zygosity]}</span>;
      },
      width: 80,
      align: 'center',
    },
    {
      id: 'alleleFrequency',
      header: 'VAF（样本）',
      accessor: (row) => <span className="font-mono tabular-nums text-accent-fg">{(row.alleleFrequency * 100).toFixed(1)}%</span>,
      width: 80,
      align: 'center',
      sortable: true,
    },
    {
      id: 'depth',
      header: '深度',
      accessor: (row) => `${row.depth}X`,
      width: 70,
      align: 'center',
      sortable: true,
    },
    {
      id: 'gnomadAF', header: 'gnomAD 总体 AF',
      accessor: row => formatPopulationFrequency(sourceAnnotation(row, 'GnomAD_AF', row.gnomadAF)),
      width: 130, align: 'center', sortable: true,
    },
    {
      id: 'gnomadEasAF', header: 'gnomAD 东亚 AF',
      accessor: row => formatPopulationFrequency(sourceAnnotation(row, 'GnomAD_AF_EAS', row.gnomadEasAF)),
      width: 130, align: 'center', sortable: true,
    },
    {
      id: 'clinvarSignificance', header: 'ClinVar 临床意义',
      accessor: row => <span title={sourceAnnotation(row, 'ClinVar_Sig', row.clinvarSignificance)} className="block max-w-[180px] truncate">{sourceAnnotation(row, 'ClinVar_Sig', row.clinvarSignificance) || '未提供'}</span>,
      width: 180, sortable: true,
    },
    {
      id: 'acmgClassification',
      header: 'ACMG 评定',
      accessor: (row) => {
        const config = row.acmgClassification ? ACMG_CONFIG[row.acmgClassification] : undefined;
          return config
          ? <span title={row.acmgAssessmentSource === 'manual_override' ? '人工覆写分类' : row.acmgAssessmentSource === 'manual_evidence' ? '根据已保存的 ACMG 证据计算' : `自动初评${row.automaticAcmg?.profile ? ` · ${row.automaticAcmg.profile}` : ''}`}><Tag variant={config.variant} className="w-20 justify-center">{config.label}</Tag></span>
          : <span title={row.automaticAcmg?.pending?.join('；') || '当前数据没有足够的自动评估证据'}><Tag variant="neutral" className="w-20 justify-center">证据不足</Tag></span>;
      },
      width: 100,
      align: 'center',
      sortable: true,
    },
    {
      id: 'transcript',
      header: '转录本',
      accessor: 'transcript',
      width: 130,
      align: 'center',
    },
    {
      id: 'hgvsc',
      header: 'cDNA变化',
      accessor: 'hgvsc',
      width: 150,
      align: 'center',
    },
    {
      id: 'hgvsp',
      header: '蛋白质变化',
      accessor: 'hgvsp',
      width: 150,
      align: 'center',
    },
  ];

  // 分页信息
  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className={(detailPanelOpen) ? "pb-[52dvh]" : undefined}>
      <ParquetColumnFilterBar taskId={taskId} table="snv-indel" columns={result?.columns ?? []} columnTypes={result?.columnTypes} state={filterState} onChange={setFilterState} />
      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* 搜索框 */}
          <div className="w-64">
            <Input
              placeholder="搜索基因、位置..."
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
              leftElement={<Search className="w-4 h-4" />}
            />
          </div>

          {/* 基因列表筛选 */}
          <div className="relative">
            <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted pointer-events-none" />
            <select
              value={filterState.geneListId || ''}
              onChange={(e) => handleGeneListFilter(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default min-w-[180px] appearance-none cursor-pointer"
            >
              <option value="">全部基因</option>
              {geneLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name} ({list.geneCount})
                </option>
              ))}
            </select>
          </div>

          {/* ACMG筛选 */}
          <select
            value={(filterState.filters.acmgClassification as string) || ''}
            onChange={(e) => handleACMGFilter(e.target.value as ACMGClassification | '')}
            className="px-3 py-1.5 text-sm border border-border-default rounded-md bg-canvas-default text-fg-default"
          >
            <option value="">ACMG 评定（全部）</option>
            {Object.entries(ACMG_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-sm text-fg-muted">
          {selectedGeneList && (
            <span className="text-accent-fg">
              已筛选: {selectedGeneList.name}
            </span>
          )}
      <span>共 {result?.total ?? 0} 条 SNP/InDel</span>
        </div>
      </div>

      {/* 数据表格 */}
		{operationError && <div role="alert" className="mb-3 rounded-lg border border-danger-emphasis bg-danger-subtle p-3 text-sm text-danger-fg">{operationError}</div>}
		{requestError && !loading ? (
			<div className="rounded-lg border border-danger-emphasis bg-danger-subtle p-4 text-sm text-danger-fg">{requestError}</div>
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

          {/* 分页 */}
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
          暂无SNP/InDel变异数据
        </div>
      )}

      {/* IGV 查看器 */}
      <IGVViewer
		taskId={taskId}
        chromosome={igvState.chromosome}
        position={igvState.position}
        isOpen={igvState.isOpen}
        onClose={handleCloseIGV}
      />

      {/* 变异详情面板 */}
      <VariantDetailPanel
        taskId={taskId}
        variant={selectedVariant}
        isOpen={detailPanelOpen}
        onClose={handleCloseDetailPanel}
        onOpenIGV={handleOpenIGV}
        onUpdateClassification={handleUpdateClassification}
        onSaveInterpretation={handleSaveInterpretation}
      />
    </div>
  );
}
