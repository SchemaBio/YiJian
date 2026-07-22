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
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { NewSampleModal, EditSampleModal } from './components';
import type { NewSampleFormData, EditSampleFormData } from './components';
import { api } from '@/lib/api';
import { listSamples, normalizeSample, samplePayload } from '@/lib/samples';
import type { Sample } from './types';
import { GENDER_CONFIG } from './types';

function ColumnHeader({ group, label }: { group: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        {group}
      </span>
      <span className="text-xs font-semibold text-[var(--yj-text-strong)]">
        {label}
      </span>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  const toneClass = {
    neutral: 'text-fg-muted bg-[var(--yj-panel-subtle)]',
    success: 'text-green-700 bg-[var(--yj-sage-subtle)]',
    warning: 'text-orange-700 bg-orange-50',
  }[tone];

  return (
    <div className="min-w-[136px] rounded-2xl border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-bg)] px-4 py-3 shadow-[var(--yj-shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-fg-muted">{label}</div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 text-[24px] font-semibold leading-none tracking-tight text-[var(--yj-text-strong)]">
        {value}
      </div>
    </div>
  );
}

function IdCell({ id }: { id: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip content={id} placement="top" variant="default">
      <span
        className={`font-mono text-xs cursor-pointer ${
          copied ? 'text-green-600' : 'text-accent-fg hover:underline'
        }`}
        onClick={handleClick}
      >
        {id.substring(0, 8)}
      </span>
    </Tooltip>
  );
}

function SubjectCell({ sample }: { sample: Sample }) {
  const genderInfo = GENDER_CONFIG[sample.gender];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`text-xs font-medium ${genderInfo.color}`}>
        {genderInfo.label}
      </span>
      <span className="text-xs text-fg-muted">
        {sample.age !== undefined ? `${sample.age}岁` : '年龄未知'}
      </span>
      <span className="rounded-md border border-[var(--yj-border-subtle)] bg-[var(--yj-panel-subtle)] px-1.5 py-0.5 text-xs text-fg-default">
        {sample.sampleType}
      </span>
    </div>
  );
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
  if (sample.matchedPair) {
    return (
      <Tooltip
        content={
          <div className="text-xs space-y-1">
            <div><span className="text-gray-400">R1:</span> {sample.matchedPair.r1Path}</div>
            <div><span className="text-gray-400">R2:</span> {sample.matchedPair.r2Path}</div>
          </div>
        }
      >
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
          <CheckCircle className="h-3.5 w-3.5" />
          已匹配
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={<div className="text-xs text-gray-300">暂无匹配测序数据</div>}>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500">
        <XCircle className="h-3.5 w-3.5" />
        待匹配
      </span>
    </Tooltip>
  );
}

export default function SamplesPage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isNewSampleModalOpen, setIsNewSampleModalOpen] = React.useState(false);
  const [editingSample, setEditingSample] = React.useState<Sample | null>(null);
  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [samplesError, setSamplesError] = React.useState('');
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());

  const matchedCount = React.useMemo(
    () => samples.filter((sample) => sample.matchedPair).length,
    [samples]
  );
  const unmatchedCount = samples.length - matchedCount;


  const loadSamples = React.useCallback(async () => {
    try {
      setSamples(await listSamples({ page: '1', page_size: '100' }));
      setSamplesError('');
    } catch (err) {
      setSamplesError(err instanceof Error ? err.message : 'Failed to load samples');
    }
  }, []);

  React.useEffect(() => {
    loadSamples();
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

  const handleDeleteSample = async (id: string) => {
    try {
      await api.delete<void>(`/v1/samples/${encodeURIComponent(id)}`);
      setSamples((prev) => prev.filter((sample) => sample.id !== id));
      setSelectedRows((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSamplesError('');
    } catch (err) {
      setSamplesError(err instanceof Error ? err.message : 'Failed to delete sample');
    }
  };

  const handleSelectionChange = (nextSelection: Set<string>) => {
    const latest = Array.from(nextSelection).slice(-1);
    setSelectedRows(new Set(latest));
  };

  const columns: Column<Sample>[] = [
    {
      id: 'sample',
      header: <ColumnHeader group="标识" label="样本 / 内部编号" />,
      accessor: (row) => (
        <div className="flex flex-col gap-1">
          <IdCell id={row.id} />
          <span className="font-mono text-xs text-fg-muted">{row.internalId}</span>
        </div>
      ),
      width: 145,
      pinned: 'left',
    },
    {
      id: 'batch',
      header: <ColumnHeader group="标识" label="批次" />,
      accessor: (row) => <span className="font-mono text-xs">{row.batch}</span>,
      width: 140,
    },
    {
      id: 'subject',
      header: <ColumnHeader group="受检者" label="性别 / 年龄 / 类型" />,
      accessor: (row) => <SubjectCell sample={row} />,
      width: 150,
    },
    {
      id: 'clinicalDiagnosis',
      header: <ColumnHeader group="临床" label="临床诊断" />,
      accessor: (row) => (
        <span className="block max-w-[220px] truncate text-sm text-fg-default" title={row.clinicalDiagnosis}>
          {row.clinicalDiagnosis}
        </span>
      ),
      width: 210,
    },
    {
      id: 'hpoTerms',
      header: <ColumnHeader group="临床" label="HPO 表型" />,
      accessor: (row) => <HpoCell hpoTerms={row.hpoTerms} />,
      width: 175,
    },
    {
      id: 'matchedPair',
      header: <ColumnHeader group="数据" label="测序数据" />,
      accessor: (row) => <MatchedCell sample={row} />,
      width: 132,
      align: 'center',
    },
    {
      id: 'remark',
      header: <ColumnHeader group="追踪" label="备注" />,
      accessor: (row) => (
        <span className={row.remark ? 'block max-w-[180px] truncate text-sm text-fg-default' : 'text-xs text-fg-muted'}>
          {row.remark || '无'}
        </span>
      ),
      width: 170,
    },
    {
      id: 'createdAt',
      header: <ColumnHeader group="追踪" label="创建时间" />,
      accessor: (row) => (
        <span className="font-mono text-xs text-fg-muted">{row.createdAt}</span>
      ),
      width: 155,
    },
    {
      id: 'actions',
      header: <ColumnHeader group="操作" label="动作" />,
      accessor: (row) => (
        <div className="flex items-center justify-center gap-1" onClick={(event) => event.stopPropagation()}>
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
            onClick={() => handleDeleteSample(row.id)}
            aria-label="删除"
            title="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
      width: 82,
      align: 'center',
      pinned: 'right',
    },
  ];

  return (
    <div className="h-full overflow-auto p-6 xl:p-8">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-[32px] font-semibold leading-tight tracking-tight text-[var(--yj-text-strong)]">
            样本管理
          </h2>
          <p className="mt-2 text-sm text-fg-muted">
            管理样本登记、临床信息和测序数据匹配状态
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
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
        <div className="yj-panel-header gap-4 px-5 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="w-[380px]">
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
          </div>
          <div className="yj-toolbar shrink-0">
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
              selectionMode="single"
              selectedRows={selectedRows}
              onSelectionChange={handleSelectionChange}
              onRowClick={(row) => setSelectedRows(new Set([row.id]))}
              onRowDoubleClick={(row) => setEditingSample(row)}
              striped
              stickyHeader
              density="compact"
              className="yj-data-table"
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
    </div>
  );
}
