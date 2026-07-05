'use client';

import { PageContent } from '@/components/layout';
import { Button, Input, DataTable, Tag, Select } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Plus, Search, Play, Pause, Pencil, Trash2 } from 'lucide-react';
import * as React from 'react';
import { AppModal, ConfirmDialog } from '@/components/shared';
import { api } from '@/lib/api';

// 基础流程类型
type BasePipelineType =
  | 'wes_single'    // WES单样本分析
  | 'wes_family'    // WES家系分析
  | 'panel';        // Panel分析

interface Pipeline {
  id: string;
  name: string;
  basePipeline: BasePipelineType;
  version: string;
  description: string;
  bedFile: string;
  referenceGenome: string;
  cnvBaseline?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// 基础流程选项
const BASE_PIPELINE_OPTIONS = [
  { value: 'wes_single', label: 'WES单样本分析' },
  { value: 'wes_family', label: 'WES家系分析' },
  { value: 'panel', label: 'Panel分析' },
];

// 参考基因组选项
const REFERENCE_GENOME_OPTIONS = [
  { value: 'hg19', label: 'hg19 (GRCh37)' },
  { value: 'hg38', label: 'hg38 (GRCh38)' },
];

// BED 文件选项
const BED_FILE_OPTIONS = [
  { value: 'Agilent_SureSelect_V7.bed', label: 'Agilent SureSelect V7' },
  { value: 'Agilent_SureSelect_V6.bed', label: 'Agilent SureSelect V6' },
  { value: 'IDT_xGen_V2.bed', label: 'IDT xGen Exome V2' },
  { value: 'Twist_Exome_V2.bed', label: 'Twist Exome V2' },
  { value: 'Cardio_Panel_v2.bed', label: '心血管疾病Panel' },
  { value: 'Neuro_Panel_v1.bed', label: '神经系统疾病Panel' },
  { value: 'Custom_Panel.bed', label: '自定义Panel' },
];

// CNV 基线选项
const CNV_BASELINE_OPTIONS = [
  { value: 'none', label: '不使用' },
  { value: 'CNV_Baseline_WES_V1.txt', label: 'WES CNV基线 V1' },
  { value: 'CNV_Baseline_WES_V2.txt', label: 'WES CNV基线 V2' },
];

const getBasePipelineLabel = (type: BasePipelineType): string => {
  return BASE_PIPELINE_OPTIONS.find(o => o.value === type)?.label || type;
};

type MaybeList<T> = T[] | { items?: T[]; data?: T[] | { items?: T[] }; total?: number };

function unwrapList<T>(value: MaybeList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (value.data && !Array.isArray(value.data) && Array.isArray(value.data.items)) return value.data.items;
  return [];
}

function rawString(raw: Record<string, unknown>, camel: string, snake: string, fallback = ''): string {
  const value = raw[camel] ?? raw[snake];
  return typeof value === 'string' ? value : fallback;
}

function normalizePipeline(rawValue: unknown): Pipeline {
  const raw = (rawValue ?? {}) as Record<string, unknown>;
  const baseType = rawString(raw, 'baseType', 'base_type', 'wes_single') as BasePipelineType;
  const status = rawString(raw, 'status', 'status', 'inactive');
  return {
    id: String(raw.id ?? ''),
    name: rawString(raw, 'name', 'name'),
    basePipeline: baseType === 'wes_single' || baseType === 'wes_family' || baseType === 'panel' ? baseType : 'wes_single',
    version: rawString(raw, 'version', 'version'),
    description: rawString(raw, 'description', 'description'),
    bedFile: rawString(raw, 'bedFile', 'bed_file'),
    referenceGenome: rawString(raw, 'referenceGenome', 'reference_genome'),
    cnvBaseline: rawString(raw, 'cnvBaseline', 'cnv_baseline') || undefined,
    status: status === 'active' ? 'active' : 'inactive',
    createdAt: rawString(raw, 'createdAt', 'created_at'),
    updatedAt: rawString(raw, 'updatedAt', 'updated_at'),
  };
}

function pipelinePayload(data: NewPipelineFormData, status?: Pipeline['status'], version = 'v1.0.0') {
  return {
    name: data.name,
    base_type: data.basePipeline,
    version,
    description: data.description,
    bed_file: data.bedFile,
    reference_genome: data.referenceGenome,
    cnv_baseline: data.cnvBaseline !== 'none' ? data.cnvBaseline : '',
    ...(status ? { status } : {}),
  };
}

interface NewPipelineFormData {
  name: string;
  basePipeline: BasePipelineType;
  description: string;
  bedFile: string;
  referenceGenome: string;
  cnvBaseline: string;
}

// 新建流程弹窗
function NewPipelineModal({
  isOpen,
  onClose,
  onSubmit
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewPipelineFormData) => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState<NewPipelineFormData>({
    name: '',
    basePipeline: 'wes_single',
    description: '',
    bedFile: 'Agilent_SureSelect_V7.bed',
    referenceGenome: 'hg38',
    cnvBaseline: 'none',
  });

  const handleChange = (field: keyof NewPipelineFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!formData.name || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(formData);
      setFormData({
        name: '',
        basePipeline: 'wes_single',
        description: '',
        bedFile: 'Agilent_SureSelect_V7.bed',
        referenceGenome: 'hg38',
        cnvBaseline: 'none',
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create pipeline');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="新建分析流程"
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!formData.name || submitting}>
            {submitting ? '创建中...' : '创建流程'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">基础流程 *</label>
          <Select value={formData.basePipeline} onChange={(v) => handleChange('basePipeline', Array.isArray(v) ? v[0] : v)} options={BASE_PIPELINE_OPTIONS} />
          <p className="text-xs text-gray-500 mt-1">选择要基于的分析流程类型</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">流程名称 *</label>
          <Input value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="请输入流程名称" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">流程描述</label>
          <Input value={formData.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="请输入流程描述" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">参考基因组版本 *</label>
          <Select value={formData.referenceGenome} onChange={(v) => handleChange('referenceGenome', Array.isArray(v) ? v[0] : v)} options={REFERENCE_GENOME_OPTIONS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">BED 文件 *</label>
          <Select value={formData.bedFile} onChange={(v) => handleChange('bedFile', Array.isArray(v) ? v[0] : v)} options={BED_FILE_OPTIONS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">CNV 基线文件</label>
          <Select value={formData.cnvBaseline} onChange={(v) => handleChange('cnvBaseline', Array.isArray(v) ? v[0] : v)} options={CNV_BASELINE_OPTIONS} />
          <p className="text-xs text-gray-500 mt-1">用于拷贝数变异分析的基线文件</p>
        </div>
      </form>
    </AppModal>
  );
}

// 编辑流程弹窗
function EditPipelineModal({
  isOpen,
  onClose,
  onSubmit,
  pipeline,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: NewPipelineFormData) => void | Promise<void>;
  pipeline: Pipeline | null;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState('');
  const [formData, setFormData] = React.useState<NewPipelineFormData>({
    name: '',
    basePipeline: 'wes_single',
    description: '',
    bedFile: 'Agilent_SureSelect_V7.bed',
    referenceGenome: 'hg38',
    cnvBaseline: 'none',
  });

  React.useEffect(() => {
    if (pipeline) {
      setSubmitError('');
      setFormData({
        name: pipeline.name,
        basePipeline: pipeline.basePipeline,
        description: pipeline.description,
        bedFile: pipeline.bedFile,
        referenceGenome: pipeline.referenceGenome,
        cnvBaseline: pipeline.cnvBaseline || 'none',
      });
    }
  }, [pipeline]);

  const handleChange = (field: keyof NewPipelineFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!pipeline || !formData.name || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(pipeline.id, formData);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update pipeline');
    } finally {
      setSubmitting(false);
    }
  };

  if (!pipeline) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
      title="编辑分析流程"
      size="medium"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!formData.name || submitting}>
            {submitting ? '保存中...' : '保存修改'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">基础流程 *</label>
          <Select value={formData.basePipeline} onChange={(v) => handleChange('basePipeline', Array.isArray(v) ? v[0] : v)} options={BASE_PIPELINE_OPTIONS} />
          <p className="text-xs text-gray-500 mt-1">选择要基于的分析流程类型</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">流程名称 *</label>
          <Input value={formData.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="请输入流程名称" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">流程描述</label>
          <Input value={formData.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="请输入流程描述" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">参考基因组版本 *</label>
          <Select value={formData.referenceGenome} onChange={(v) => handleChange('referenceGenome', Array.isArray(v) ? v[0] : v)} options={REFERENCE_GENOME_OPTIONS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">BED 文件 *</label>
          <Select value={formData.bedFile} onChange={(v) => handleChange('bedFile', Array.isArray(v) ? v[0] : v)} options={BED_FILE_OPTIONS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">CNV 基线文件</label>
          <Select value={formData.cnvBaseline} onChange={(v) => handleChange('cnvBaseline', Array.isArray(v) ? v[0] : v)} options={CNV_BASELINE_OPTIONS} />
          <p className="text-xs text-gray-500 mt-1">用于拷贝数变异分析的基线文件</p>
        </div>
      </form>
    </AppModal>
  );
}

// 删除确认弹窗
function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  pipelineName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  pipelineName: string;
}) {
  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="确认删除"
      message={`确定要删除流程「${pipelineName}」吗？此操作不可撤销。`}
      variant="danger"
      onConfirm={onConfirm}
    />
  );
}

export default function PipelineListPage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [pipelineError, setPipelineError] = React.useState('');
  const [isNewModalOpen, setIsNewModalOpen] = React.useState(false);
  const [editingPipeline, setEditingPipeline] = React.useState<Pipeline | null>(null);
  const [deletingPipeline, setDeletingPipeline] = React.useState<Pipeline | null>(null);

  const loadPipelines = React.useCallback(async () => {
    try {
      const response = await api.get<MaybeList<unknown>>('/v1/pipelines', {
        params: { page: '1', page_size: '100' },
      });
      setPipelines(unwrapList(response).map(normalizePipeline).filter(pipeline => pipeline.id));
      setPipelineError('');
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Failed to load pipelines');
    }
  }, []);

  React.useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  const handleToggleStatus = async (pipeline: Pipeline) => {
    const nextStatus = pipeline.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await api.put<unknown>(
        `/v1/pipelines/${encodeURIComponent(pipeline.id)}`,
        pipelinePayload({
          name: pipeline.name,
          basePipeline: pipeline.basePipeline,
          description: pipeline.description,
          bedFile: pipeline.bedFile,
          referenceGenome: pipeline.referenceGenome,
          cnvBaseline: pipeline.cnvBaseline || 'none',
        }, nextStatus, pipeline.version || 'v1.0.0')
      );
      setPipelines(prev => prev.map(p => p.id === pipeline.id ? normalizePipeline(updated) : p));
      setPipelineError('');
    } catch (err) {
      setPipelineError(err instanceof Error ? err.message : 'Failed to update pipeline status');
    }
  };

  const handleCreatePipeline = async (data: NewPipelineFormData) => {
    try {
      const created = await api.post<unknown>('/v1/pipelines', pipelinePayload(data));
      setPipelines(prev => [normalizePipeline(created), ...prev].filter(pipeline => pipeline.id));
      setPipelineError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create pipeline';
      setPipelineError(message);
      throw new Error(message);
    }
  };

  const handleEditPipeline = async (id: string, data: NewPipelineFormData) => {
    try {
      const current = pipelines.find(p => p.id === id);
      const updated = await api.put<unknown>(`/v1/pipelines/${encodeURIComponent(id)}`, pipelinePayload(data, current?.status, current?.version || 'v1.0.0'));
      setPipelines(prev => prev.map(p => p.id === id ? normalizePipeline(updated) : p));
      setPipelineError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update pipeline';
      setPipelineError(message);
      throw new Error(message);
    }
  };

  const handleDeletePipeline = async (id: string) => {
    try {
      await api.delete<void>(`/v1/pipelines/${encodeURIComponent(id)}`);
      setPipelines(prev => prev.filter(p => p.id !== id));
      setDeletingPipeline(null);
      setPipelineError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete pipeline';
      setPipelineError(message);
      throw new Error(message);
    }
  };

  const filteredPipelines = React.useMemo(() => {
    if (!searchQuery) return pipelines;
    const query = searchQuery.toLowerCase();
    return pipelines.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );
  }, [searchQuery, pipelines]);

  const columns: Column<Pipeline>[] = [
    { id: 'name', header: '流程名称', accessor: 'name', width: 180, align: 'center' },
    {
      id: 'basePipeline',
      header: '基础流程',
      accessor: (row) => (
        <Tag variant="info">{getBasePipelineLabel(row.basePipeline)}</Tag>
      ),
      width: 130,
      align: 'center',
    },
    { id: 'version', header: '版本', accessor: 'version', width: 80, align: 'center' },
    { id: 'referenceGenome', header: '参考基因组', accessor: 'referenceGenome', width: 100, align: 'center' },
    { id: 'bedFile', header: 'BED 文件', accessor: 'bedFile', width: 180, align: 'center' },
    {
      id: 'status',
      header: '状态',
      accessor: (row) => (
        <Tag variant={row.status === 'active' ? 'success' : 'neutral'}>
          {row.status === 'active' ? '启用' : '停用'}
        </Tag>
      ),
      width: 80,
      align: 'center',
    },
    { id: 'updatedAt', header: '更新时间', accessor: 'updatedAt', width: 110, align: 'center' },
    {
      id: 'actions',
      header: '操作',
      accessor: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setEditingPipeline(row)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-blue-600 transition-colors"
            title="编辑"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded transition-colors ${
              row.status === 'active'
                ? 'hover:bg-orange-50 dark:hover:bg-orange-900/20 text-gray-600 dark:text-gray-400 hover:text-orange-600'
                : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-600 dark:text-gray-400 hover:text-green-600'
            }`}
            title={row.status === 'active' ? '停用' : '启用'}
          >
            {row.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setDeletingPipeline(row)}
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-600 transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      width: 100,
      align: 'center',
    },
  ];

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <h2 className="yj-page-title">流程列表</h2>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-64">
          <Input
            placeholder="搜索流程..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftElement={<Search className="w-4 h-4" />}
          />
        </div>
        <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsNewModalOpen(true)}>
          新建流程
        </Button>
      </div>

      {pipelineError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pipelineError}
        </div>
      )}

      <DataTable
        data={filteredPipelines}
        columns={columns}
        rowKey="id"
        density="default"
        striped
      />

      <NewPipelineModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleCreatePipeline}
      />

      <EditPipelineModal
        isOpen={editingPipeline !== null}
        onClose={() => setEditingPipeline(null)}
        onSubmit={handleEditPipeline}
        pipeline={editingPipeline}
      />

      <DeleteConfirmModal
        isOpen={deletingPipeline !== null}
        onClose={() => setDeletingPipeline(null)}
        onConfirm={() => deletingPipeline && handleDeletePipeline(deletingPipeline.id)}
        pipelineName={deletingPipeline?.name || ''}
      />
    </PageContent>
  );
}
