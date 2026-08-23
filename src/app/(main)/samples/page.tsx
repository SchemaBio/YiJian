'use client';

import * as React from 'react';
import { Button, Input, DataTable, Tooltip } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import {
  AlertCircle,
  CheckCircle,
  Database,
  Download,
  FileCheck,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { NewSampleModal, EditSampleModal, DataLinkModal } from './components';
import type { NewSampleFormData, EditSampleFormData } from './components';
import { ConfirmDialog, HoverText, IdCell, MetricTile } from '@/components/shared';
import { api } from '@/lib/api';
import { listSamples, normalizeSample, samplePayload } from '@/lib/samples';
import type { Sample } from './types';
import { GENDER_CONFIG } from './types';

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || '-'
    : date.toLocaleString('zh-CN', { hour12: false });
}

function areSamplesEqual(previous: Sample[], next: Sample[]): boolean {
  return previous.length === next.length && previous.every((sample, index) => {
    const candidate = next[index];
    const hpoTermsEqual = sample.hpoTerms.length === candidate.hpoTerms.length
      && sample.hpoTerms.every((term, termIndex) => (
        term.id === candidate.hpoTerms[termIndex].id
        && term.name === candidate.hpoTerms[termIndex].name
      ));
    const matchedPairEqual = sample.matchedPair === candidate.matchedPair
      || (sample.matchedPair !== null
        && candidate.matchedPair !== null
        && sample.matchedPair.r1Path === candidate.matchedPair.r1Path
        && sample.matchedPair.r2Path === candidate.matchedPair.r2Path);

    return sample.id === candidate.id
      && sample.internalId === candidate.internalId
      && sample.gender === candidate.gender
      && sample.age === candidate.age
      && sample.sampleType === candidate.sampleType
      && sample.batch === candidate.batch
      && sample.clinicalDiagnosis === candidate.clinicalDiagnosis
      && hpoTermsEqual
      && matchedPairEqual
      && sample.matchStatus === candidate.matchStatus
      && sample.matchMode === candidate.matchMode
      && sample.autoMatchEnabled === candidate.autoMatchEnabled
      && sample.remark === candidate.remark
      && sample.createdAt === candidate.createdAt
      && sample.updatedAt === candidate.updatedAt;
  });
}

function HpoCell({ hpoTerms }: { hpoTerms: { id: string; name: string }[] }) {
  if (!hpoTerms || hpoTerms.length === 0) {
    return <span className="text-xs text-fg-muted">未录入</span>;
  }

  const visibleTerms = hpoTerms.slice(0, 2);
  const hiddenCount = hpoTerms.length - visibleTerms.length;

  return (
    <Tooltip
      content={
        <div className="text-xs space-y-1">
          {hpoTerms.map((term) => (
            <div key={term.id}>
              <span className="text-blue-300 font-mono">{term.id}</span>
              <span className="text-gray-300 ml-1">{term.name}</span>
            </div>
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap gap-1">
        {visibleTerms.map((term) => (
          <span
            key={term.id}
            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700"
          >
            {term.id}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="inline-flex items-center rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] px-1.5 py-0.5 text-[11px] text-fg-muted">
            +{hiddenCount}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

function MatchedCell({ sample }: { sample: Sample }) {
  const status = {
    matched: {
      label: '已匹配',
      detail: sample.matchMode === 'manual' ? '已由用户手动选择 Read1/Read2，自动匹配不会覆盖。' : '系统已按样本内部编号自动匹配 Read1/Read2。',
      className: 'border-green-200 bg-green-50 text-green-700',
      icon: <CheckCircle className="h-3.5 w-3.5" />,
    },
    partial: {
      label: '部分匹配',
      detail: '系统只找到 Read1 或 Read2，请补充另一端数据或手动关联。',
      className: 'border-orange-200 bg-orange-50 text-orange-700',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    conflict: {
      label: '匹配冲突',
      detail: '发现多个同名候选，系统不会自动选择，请手动关联。',
      className: 'border-red-200 bg-red-50 text-red-700',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    missing: {
      label: '文件缺失',
      detail: '已关联的数据已到期或无法访问，请重新上传并关联。',
      className: 'border-red-200 bg-red-50 text-red-700',
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
    unmatched: {
      label: sample.autoMatchEnabled ? '待匹配' : '未启用',
      detail: sample.autoMatchEnabled
        ? '系统定时按文件名中的样本编号匹配 Read1/Read2，也可立即手动关联。'
        : '此样本未启用自动匹配，可手动关联数据。',
      className: 'border-gray-200 bg-gray-50 text-gray-600',
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
  }[sample.matchStatus];

  return (
    <Tooltip content={
      <div className="max-w-xs space-y-1 text-xs">
        <p>{status.detail}</p>
        {sample.matchedPair && <><p><span className="text-gray-400">R1:</span> {sample.matchedPair.r1Path}</p><p><span className="text-gray-400">R2:</span> {sample.matchedPair.r2Path}</p></>}
      </div>
    }>
      <div className="inline-flex flex-col items-center gap-1">
        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${status.className}`}>
          {status.icon}
          {status.label}
        </span>
        {sample.matchStatus === 'matched' && sample.matchMode && (
          <span className="text-[10px] text-fg-muted">{sample.matchMode === 'manual' ? '手动关联' : '自动匹配'}</span>
        )}
      </div>
    </Tooltip>
  );
}

export default function SamplesPage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isNewSampleModalOpen, setIsNewSampleModalOpen] = React.useState(false);
  const [editingSample, setEditingSample] = React.useState<Sample | null>(null);
  const [linkingSample, setLinkingSample] = React.useState<Sample | null>(null);
  const [deleteTargets, setDeleteTargets] = React.useState<Sample[]>([]);
  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [samplesError, setSamplesError] = React.useState('');
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());

  const matchedCount = React.useMemo(
    () => samples.filter((sample) => sample.matchStatus === 'matched').length,
    [samples]
  );
  const unmatchedCount = samples.length - matchedCount;
  const selectedSamples = React.useMemo(
    () => samples.filter((sample) => selectedRows.has(sample.id)),
    [samples, selectedRows]
  );


  const loadSamples = React.useCallback(async () => {
    try {
      const loadedSamples = await listSamples({ page: '1', page_size: '100' });
      const loadedIds = new Set(loadedSamples.map((sample) => sample.id));
      setSamples((previous) => areSamplesEqual(previous, loadedSamples) ? previous : loadedSamples);
      setSelectedRows((previous) => {
        const retainedIds = Array.from(previous).filter((id) => loadedIds.has(id));
        return retainedIds.length === previous.size ? previous : new Set(retainedIds);
      });
      setSamplesError('');
    } catch (err) {
      setSamplesError(err instanceof Error ? err.message : 'Failed to load samples');
    }
  }, []);

  React.useEffect(() => {
    void loadSamples();
    const timer = window.setInterval(() => void loadSamples(), 15000);
    return () => window.clearInterval(timer);
  }, [loadSamples]);

  const handleDownloadTemplate = () => {
    const templateContent = `样本编号,内部编号,性别,样本类型,批次,临床诊断
S001,INT-001,男,全血,BATCH-2024-001,遗传性心肌病待查`;
    const blob = new Blob(['\ufeff' + templateContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '样本导入模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredSamples = React.useMemo(() => {
    if (!searchQuery) return samples;
    const query = searchQuery.toLowerCase();
    return samples.filter(
      (sample) =>
        sample.id.toLowerCase().includes(query) ||
        sample.internalId.toLowerCase().includes(query) ||
        sample.batch.toLowerCase().includes(query) ||
        sample.clinicalDiagnosis.toLowerCase().includes(query)
    );
  }, [searchQuery, samples]);

  const handleCreateSample = async (data: NewSampleFormData) => {
    try {
      const created = await api.post<unknown>('/v1/samples', samplePayload(data));
      setSamples(prev => [normalizeSample(created), ...prev].filter(sample => sample.id));
      setSamplesError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create sample';
      setSamplesError(message);
      throw new Error(message);
    }
  };

  const handleEditSample = async (id: string, data: EditSampleFormData) => {
    try {
      const updated = await api.put<unknown>(`/v1/samples/${encodeURIComponent(id)}`, samplePayload(data));
      setSamples((prev) => prev.map((sample) => sample.id === id ? normalizeSample(updated) : sample));
      setEditingSample(null);
      setSamplesError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update sample';
      setSamplesError(message);
      throw new Error(message);
    }
  };

  const handleDeleteSamples = async () => {
    if (deleteTargets.length === 0) return;
    const results = await Promise.allSettled(
      deleteTargets.map((sample) => api.delete<void>(`/v1/samples/${encodeURIComponent(sample.id)}`))
    );
    const deletedIds = new Set<string>();
    const failedTargets: Sample[] = [];
    results.forEach((result, index) => {
      const sample = deleteTargets[index];
      if (result.status === 'fulfilled') deletedIds.add(sample.id);
      else failedTargets.push(sample);
    });

    if (deletedIds.size > 0) {
      setSamples((prev) => prev.filter((sample) => !deletedIds.has(sample.id)));
      setSelectedRows((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
    if (failedTargets.length > 0) {
      setDeleteTargets(failedTargets);
      const message = `${failedTargets.length} 个样本删除失败，请重试`;
      setSamplesError(message);
      throw new Error(message);
    }
    setSamplesError('');
  };

  const handleSelectionChange = (nextSelection: Set<string>) => {
    setSelectedRows(new Set(nextSelection));
  };

  const columns: Column<Sample>[] = [
    {
      id: 'internalId',
      header: '内部编号',
      accessor: (row) => <HoverText value={row.internalId} className="text-sm font-semibold text-[var(--yj-text-strong)]" />,
      width: 154,
      minWidth: 140,
      maxWidth: 220,
    },
    {
      id: 'uuid',
      header: 'UUID',
      accessor: (row) => <IdCell id={row.id} truncateLength={12} />,
      width: 142,
      minWidth: 132,
      maxWidth: 190,
    },
    {
      id: 'gender',
      header: '性别',
      accessor: (row) => {
        const gender = GENDER_CONFIG[row.gender];
        return (
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${gender.color}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {gender.label}
          </span>
        );
      },
      width: 72,
      minWidth: 68,
      maxWidth: 90,
      align: 'center',
    },
    {
      id: 'age',
      header: '年龄',
      accessor: (row) => row.age !== undefined
        ? <span className="whitespace-nowrap text-sm tabular-nums text-fg-default">{row.age} 岁</span>
        : <span className="text-xs text-fg-muted">未录入</span>,
      width: 78,
      minWidth: 72,
      maxWidth: 96,
      align: 'center',
    },
    {
      id: 'sampleType',
      header: '样本类型',
      accessor: (row) => (
        <span className="inline-flex whitespace-nowrap rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] px-2 py-1 text-xs text-fg-default">
          {row.sampleType}
        </span>
      ),
      width: 96,
      minWidth: 88,
      maxWidth: 120,
      align: 'center',
    },
    {
      id: 'batch',
      header: '批次',
      accessor: (row) => row.batch
        ? <span className="block truncate font-mono text-xs text-fg-default" title={row.batch}>{row.batch}</span>
        : <span className="text-xs text-fg-muted">未分配</span>,
      width: 132,
      minWidth: 120,
      maxWidth: 190,
    },
    {
      id: 'clinicalDiagnosis',
      header: '临床诊断',
      accessor: (row) => (
        <span className={`block max-w-[240px] truncate text-sm ${row.clinicalDiagnosis ? 'text-fg-default' : 'text-fg-muted'}`} title={row.clinicalDiagnosis}>
          {row.clinicalDiagnosis || '未录入'}
        </span>
      ),
      width: 210,
      minWidth: 190,
      maxWidth: 280,
    },
    {
      id: 'hpoTerms',
      header: 'HPO 表型',
      accessor: (row) => <HpoCell hpoTerms={row.hpoTerms} />,
      width: 176,
      minWidth: 160,
      maxWidth: 240,
    },
    {
      id: 'matchedPair',
      header: '测序数据',
      accessor: (row) => <MatchedCell sample={row} />,
      width: 126,
      minWidth: 118,
      maxWidth: 150,
      align: 'center',
    },
    {
      id: 'remark',
      header: '备注',
      accessor: (row) => (
        <span className={row.remark ? 'block max-w-[180px] truncate text-sm text-fg-default' : 'text-xs text-fg-muted'}>
          {row.remark || '无'}
        </span>
      ),
      width: 160,
      minWidth: 140,
      maxWidth: 220,
    },
    {
      id: 'createdAt',
      header: '创建时间',
      accessor: (row) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-fg-muted">{formatDateTime(row.createdAt)}</span>
      ),
      width: 156,
      minWidth: 150,
      maxWidth: 190,
    },
    {
      id: 'actions',
      header: '操作',
      accessor: (row) => (
        <div className="flex items-center justify-center gap-1" onClick={(event) => event.stopPropagation()}>
          <button
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-700"
            onClick={() => setLinkingSample(row)}
            aria-label="关联测序数据"
            title={row.matchedPair ? '更新数据关联' : '手动关联数据'}
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
            onClick={() => setEditingSample(row)}
            aria-label="编辑"
            title="编辑"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            onClick={() => setDeleteTargets([row])}
            aria-label="删除"
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
      width: 108,
      minWidth: 104,
      maxWidth: 120,
      align: 'center',
      pinned: 'right',
    },
  ];

  return (
    <div className="h-full overflow-auto p-6 xl:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 className="yj-page-title">
            样本管理
          </h2>
          <p className="mt-2 text-sm text-fg-muted">
            管理样本登记、临床信息和测序数据匹配状态
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricTile
            label="样本总数"
            value={samples.length}
            icon={<Database className="h-4 w-4" />}
          />
          <MetricTile
            label="已匹配"
            value={matchedCount}
            icon={<FileCheck className="h-4 w-4" />}
            tone="success"
          />
          <MetricTile
            label="待匹配"
            value={unmatchedCount}
            icon={<AlertCircle className="h-4 w-4" />}
            tone="warning"
          />
        </div>
      </div>

      <div className="yj-panel overflow-hidden">
        <div className="yj-panel-header flex-wrap gap-4 px-5 py-4">
          <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-3">
            <div className="w-full max-w-[380px]">
              <Input
                id="samples-search"
                placeholder="搜索样本编号、内部编号、批次或诊断..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftElement={<Search className="h-4 w-4" />}
              />
            </div>
            <span className="text-sm text-fg-muted">
              当前显示 {filteredSamples.length} / {samples.length} 条
            </span>
            {selectedRows.size > 0 && (
              <span className="whitespace-nowrap rounded-md bg-[var(--yj-sage-subtle)] px-2 py-1 text-xs font-medium text-green-700">
                已选择 {selectedRows.size} 项
              </span>
            )}
          </div>
          <div className="yj-toolbar w-full flex-wrap sm:w-auto sm:flex-nowrap">
            <Button
              variant="danger"
              leftIcon={<Trash2 className="h-4 w-4" />}
              disabled={selectedSamples.length === 0}
              onClick={() => setDeleteTargets(selectedSamples)}
            >
              批量删除{selectedSamples.length > 0 ? ` (${selectedSamples.length})` : ''}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
              onClick={handleDownloadTemplate}
            >
              下载模板
            </Button>
            <Button variant="secondary" leftIcon={<Upload className="h-4 w-4" />}>
              批量导入
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsNewSampleModalOpen(true)}
            >
              新建样本
            </Button>
          </div>
        </div>

        <div className="p-4">
          {samplesError && (
            <div className="mb-3 rounded-md border border-danger-emphasis bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
              {samplesError}
            </div>
          )}
          {filteredSamples.length > 0 ? (
            <DataTable
              data={filteredSamples}
              columns={columns}
              rowKey="id"
              selectable
              selectionMode="multiple"
              selectedRows={selectedRows}
              onSelectionChange={handleSelectionChange}
              onRowDoubleClick={(row) => setEditingSample(row)}
              stickyHeader
              density="comfortable"
              className="yj-data-table sample-management-table"
            />
          ) : (
            <div className="yj-empty-state">
              <div>
                <span className="yj-empty-state-icon"><Database className="h-5 w-5" /></span>
                <p className="text-sm font-medium text-fg-default">暂无样本</p>
                <p className="mt-1 text-xs text-fg-muted">调整筛选条件或新建样本。</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <NewSampleModal
        isOpen={isNewSampleModalOpen}
        onClose={() => setIsNewSampleModalOpen(false)}
        onSubmit={handleCreateSample}
      />

      <EditSampleModal
        isOpen={editingSample !== null}
        onClose={() => setEditingSample(null)}
        onSubmit={handleEditSample}
        sample={editingSample}
      />

      <DataLinkModal
        open={linkingSample !== null}
        sample={linkingSample}
        onOpenChange={(open) => {
          if (!open) setLinkingSample(null);
        }}
        onSaved={loadSamples}
      />

      <ConfirmDialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setDeleteTargets([]);
        }}
        title={deleteTargets.length > 1 ? '批量删除样本' : '删除样本'}
        message={deleteTargets.length > 1
          ? `确定删除选中的 ${deleteTargets.length} 个样本吗？相关的数据关联也会解除，此操作无法撤销。`
          : `确定删除样本“${deleteTargets[0]?.internalId ?? ''}”吗？相关的数据关联也会解除，此操作无法撤销。`}
        confirmLabel={deleteTargets.length > 1 ? `删除 ${deleteTargets.length} 个样本` : '确认删除'}
        variant="danger"
        onConfirm={handleDeleteSamples}
      />
    </div>
  );
}
