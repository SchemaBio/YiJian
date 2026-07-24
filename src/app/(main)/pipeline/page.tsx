'use client';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import { AppModal, ConfirmDialog, EmptyState, ModalSectionHeading } from '@/components/shared';
import { Button, DataTable, Input, Select, Tag, type Column } from '@schema/ui-kit';
import { Database, Loader2, Pause, Pencil, Play, Plus, Search, Trash2, Workflow } from 'lucide-react';
import { api } from '@/lib/api';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import { listCNVBaselines, type CNVBaseline } from '@/lib/cnv-baselines';
import { builtinBEDId, builtinBEDLabel, builtinCNVBaselineId, builtinCNVBaselineLabel } from '@/lib/builtin-resources';

type BasePipelineType = 'wes_single' | 'wes_family';
type BuiltinPipelineID = 'builtin-wes-single' | 'builtin-wes-family' | 'builtin-wes-single-hg38' | 'builtin-wes-family-hg38';
type PipelineStatus = 'active' | 'inactive';
type ReferenceGenome = 'hg19' | 'hg38';

interface Pipeline {
  id: string;
  name: string;
  basePipeline: BasePipelineType;
  version: string;
  description: string;
  bedFile: string;
  bedAssetId: string;
  referenceGenome: ReferenceGenome;
  cnvBaseline: string;
  cnvBaselineId: string;
  status: PipelineStatus;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PipelineFormData {
  name: string;
  basePipelineId: BuiltinPipelineID;
  description: string;
  bedAssetId: string;
  cnvBaselineId: string;
}

type MaybeList<T> = T[] | { items?: T[]; data?: T[] | { items?: T[] } };

const BASE_OPTIONS = [
  { value: 'builtin-wes-single', label: 'WES单样本分析' },
  { value: 'builtin-wes-family', label: 'WES家系分析' },
  { value: 'builtin-wes-single-hg38', label: 'WES单样本分析（hg38）' },
  { value: 'builtin-wes-family-hg38', label: 'WES家系分析（hg38）' },
];
const EMPTY_FORM: PipelineFormData = {
  name: '', basePipelineId: 'builtin-wes-single', description: '', bedAssetId: builtinBEDId('hg19'),
  cnvBaselineId: builtinCNVBaselineId('hg19'),
};

function basePipelineDefinition(id: BuiltinPipelineID): { baseType: BasePipelineType; referenceGenome: ReferenceGenome } {
  return {
    baseType: id.includes('family') ? 'wes_family' : 'wes_single',
    referenceGenome: id.endsWith('hg38') ? 'hg38' : 'hg19',
  };
}

function builtinPipelineId(baseType: BasePipelineType, referenceGenome: ReferenceGenome): BuiltinPipelineID {
  if (referenceGenome === 'hg38') {
    return baseType === 'wes_family' ? 'builtin-wes-family-hg38' : 'builtin-wes-single-hg38';
  }
  return baseType === 'wes_family' ? 'builtin-wes-family' : 'builtin-wes-single';
}

function unwrapList<T>(value: MaybeList<T>): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  if (value.data && !Array.isArray(value.data) && Array.isArray(value.data.items)) return value.data.items;
  return [];
}

function stringOf(raw: Record<string, unknown>, camel: string, snake: string, fallback = ''): string {
  const value = raw[camel] ?? raw[snake];
  return typeof value === 'string' ? value : fallback;
}

function normalizePipeline(value: unknown): Pipeline {
  const raw = (value ?? {}) as Record<string, unknown>;
  const base = stringOf(raw, 'baseType', 'base_type', 'wes_single');
  const genome = stringOf(raw, 'referenceGenome', 'reference_genome', 'hg19').toLowerCase();
  return {
    id: String(raw.id ?? ''),
    name: stringOf(raw, 'name', 'name'),
    basePipeline: base === 'wes_family' ? 'wes_family' : 'wes_single',
    version: stringOf(raw, 'version', 'version'),
    description: stringOf(raw, 'description', 'description'),
    bedFile: stringOf(raw, 'bedFile', 'bed_file', '内置默认 BED'),
    bedAssetId: stringOf(raw, 'bedAssetId', 'bed_asset_id'),
    referenceGenome: genome === 'hg38' || genome === 'grch38' ? 'hg38' : 'hg19',
    cnvBaseline: stringOf(raw, 'cnvBaseline', 'cnv_baseline', '内置默认 CNV 基线'),
    cnvBaselineId: stringOf(raw, 'cnvBaselineId', 'cnv_baseline_id'),
    status: stringOf(raw, 'status', 'status') === 'inactive' ? 'inactive' : 'active',
    isBuiltin: Boolean(raw.isBuiltin ?? raw.is_builtin),
    createdAt: stringOf(raw, 'createdAt', 'created_at'),
    updatedAt: stringOf(raw, 'updatedAt', 'updated_at'),
  };
}

function payload(data: PipelineFormData, status?: PipelineStatus, version = 'v1.0.0') {
  return {
    name: data.name.trim(), base_pipeline_id: data.basePipelineId, version,
    description: data.description.trim(),
    bed_asset_id: data.bedAssetId,
    cnv_baseline_id: data.cnvBaselineId,
    ...(status ? { status } : {}),
  };
}

function resourceGenome(value: ReferenceGenome): 'GRCh37' | 'GRCh38' {
  return value === 'hg38' ? 'GRCh38' : 'GRCh37';
}

function PipelineFields({ form, setForm, beds, baselines }: {
  form: PipelineFormData;
  setForm: React.Dispatch<React.SetStateAction<PipelineFormData>>;
  beds: DataAsset[];
  baselines: CNVBaseline[];
}) {
  const { referenceGenome } = basePipelineDefinition(form.basePipelineId);
  const genome = resourceGenome(referenceGenome);
  const bedOptions = [
    { value: builtinBEDId(referenceGenome), label: `${builtinBEDLabel(referenceGenome)}（默认）` },
    ...beds.filter((item) => item.status === 'completed' && item.reference_genome === genome)
      .map((item) => ({ value: item.id, label: item.file_name })),
  ];
  const baselineOptions = [
    { value: builtinCNVBaselineId(referenceGenome), label: `${builtinCNVBaselineLabel(referenceGenome)}（默认）` },
    ...baselines.filter((item) => item.status === 'completed' && item.reference_genome === genome)
      .map((item) => ({ value: item.id, label: item.name })),
  ];
  const change = (field: keyof PipelineFormData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return <div className="space-y-6">
    <section>
      <ModalSectionHeading icon={<Workflow className="h-4 w-4" />} title="流程信息" description="以系统内置 WES 流程为基础建立组织自己的流程" />
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-fg-muted">基础流程 *</label>
          <Select value={form.basePipelineId} options={BASE_OPTIONS} onChange={(value) => {
            const basePipelineId = (Array.isArray(value) ? value[0] : value) as BuiltinPipelineID;
            const nextGenome = basePipelineDefinition(basePipelineId).referenceGenome;
            setForm((current) => ({ ...current, basePipelineId, bedAssetId: builtinBEDId(nextGenome), cnvBaselineId: builtinCNVBaselineId(nextGenome) }));
          }} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-xs font-medium text-fg-muted">流程名称 *</label><Input value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="请输入流程名称" /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-fg-muted">流程描述</label><Input value={form.description} onChange={(event) => change('description', event.target.value)} placeholder="说明该流程的适用场景" /></div>
        </div>
      </div>
    </section>
    <section className="border-t border-border-default pt-5">
      <ModalSectionHeading icon={<Database className="h-4 w-4" />} title="分析资源" description="不选择自定义资源时自动使用基础流程的内置 BED 和 CNV 基线" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label className="mb-1.5 block text-xs font-medium text-fg-muted">BED 文件</label><Select searchable value={form.bedAssetId} options={bedOptions} onChange={(value) => change('bedAssetId', Array.isArray(value) ? value[0] : value)} /></div>
        <div><label className="mb-1.5 block text-xs font-medium text-fg-muted">CNV 基线</label><Select searchable value={form.cnvBaselineId} options={baselineOptions} onChange={(value) => change('cnvBaselineId', Array.isArray(value) ? value[0] : value)} /></div>
      </div>
    </section>
  </div>;
}

function PipelineModal({ open, title, initial, beds, baselines, onClose, onSubmit }: {
  open: boolean; title: string; initial: PipelineFormData; beds: DataAsset[]; baselines: CNVBaseline[];
  onClose: () => void; onSubmit: (data: PipelineFormData) => Promise<void>;
}) {
  const [form, setForm] = React.useState(initial);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => { if (open) { setForm(initial); setError(''); } }, [open, initial]);
  const submit = async () => {
    if (!form.name.trim() || submitting) return;
    setSubmitting(true); setError('');
    try { await onSubmit(form); onClose(); } catch (err) { setError(err instanceof Error ? err.message : '保存流程失败'); } finally { setSubmitting(false); }
  };
  return <AppModal open={open} onOpenChange={(next) => !next && !submitting && onClose()} title={title} size="large" footer={<><Button variant="secondary" onClick={onClose} disabled={submitting}>取消</Button><Button variant="primary" onClick={submit} disabled={!form.name.trim() || submitting} leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>{submitting ? '保存中...' : '保存流程'}</Button></>}>
    {error && <div className="mb-4 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{error}</div>}
    <PipelineFields form={form} setForm={setForm} beds={beds} baselines={baselines} />
  </AppModal>;
}

export default function PipelineListPage() {
  const [search, setSearch] = React.useState('');
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [beds, setBeds] = React.useState<DataAsset[]>([]);
  const [baselines, setBaselines] = React.useState<CNVBaseline[]>([]);
  const [error, setError] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Pipeline | null>(null);
  const [deleting, setDeleting] = React.useState<Pipeline | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [pipelineResponse, bedResponse, baselineResponse] = await Promise.all([
        api.get<MaybeList<unknown>>('/v1/pipelines', { params: { page: '1', page_size: '100' } }),
        listDataAssets('', { readType: 'bed', status: 'completed' }), listCNVBaselines(),
      ]);
      setPipelines(unwrapList(pipelineResponse).map(normalizePipeline).filter((item) => item.id));
      setBeds(bedResponse.items); setBaselines(baselineResponse); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : '加载流程与分析资源失败'); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const initialEdit = React.useMemo<PipelineFormData>(() => editing ? {
    name: editing.name, basePipelineId: builtinPipelineId(editing.basePipeline, editing.referenceGenome), description: editing.description,
    bedAssetId: editing.bedAssetId || builtinBEDId(editing.referenceGenome),
    cnvBaselineId: editing.cnvBaselineId || builtinCNVBaselineId(editing.referenceGenome),
  } : EMPTY_FORM, [editing]);

  const create = async (form: PipelineFormData) => {
    const created = normalizePipeline(await api.post<unknown>('/v1/pipelines', payload(form)));
    setPipelines((items) => [...items.filter((item) => item.isBuiltin), created, ...items.filter((item) => !item.isBuiltin)]);
  };
  const update = async (form: PipelineFormData, pipeline = editing) => {
    if (!pipeline) return;
    const updated = normalizePipeline(await api.put<unknown>(`/v1/pipelines/${encodeURIComponent(pipeline.id)}`, payload(form, pipeline.status, pipeline.version)));
    setPipelines((items) => items.map((item) => item.id === pipeline.id ? updated : item));
  };
  const toggle = async (pipeline: Pipeline) => {
    const form: PipelineFormData = { name: pipeline.name, basePipelineId: builtinPipelineId(pipeline.basePipeline, pipeline.referenceGenome), description: pipeline.description, bedAssetId: pipeline.bedAssetId || builtinBEDId(pipeline.referenceGenome), cnvBaselineId: pipeline.cnvBaselineId || builtinCNVBaselineId(pipeline.referenceGenome) };
    const status = pipeline.status === 'active' ? 'inactive' : 'active';
    const updated = normalizePipeline(await api.put<unknown>(`/v1/pipelines/${encodeURIComponent(pipeline.id)}`, payload(form, status, pipeline.version)));
    setPipelines((items) => items.map((item) => item.id === pipeline.id ? updated : item));
  };
  const remove = async () => {
    if (!deleting) return;
    await api.delete(`/v1/pipelines/${encodeURIComponent(deleting.id)}`);
    setPipelines((items) => items.filter((item) => item.id !== deleting.id)); setDeleting(null);
  };

  const filtered = pipelines.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  const columns: Column<Pipeline>[] = [
    { id: 'name', header: '流程名称', accessor: (row) => <div className="text-left"><div className="font-medium text-fg-default">{row.name}</div>{row.isBuiltin && <div className="mt-0.5 text-xs text-fg-muted">系统内置</div>}</div>, width: 210, align: 'left' },
    { id: 'base', header: '基础流程', accessor: (row) => <Tag variant="info">{row.basePipeline === 'wes_family' ? 'WES家系分析' : 'WES单样本分析'}</Tag>, width: 150, align: 'center' },
    { id: 'genome', header: '参考基因组', accessor: (row) => row.referenceGenome, width: 110, align: 'center' },
    { id: 'bed', header: 'BED 文件', accessor: (row) => <span className="block truncate" title={row.bedFile}>{row.bedFile}</span>, width: 210, align: 'left' },
    { id: 'cnv', header: 'CNV 基线', accessor: (row) => <span className="block truncate" title={row.cnvBaseline}>{row.cnvBaseline}</span>, width: 210, align: 'left' },
    { id: 'status', header: '状态', accessor: (row) => <Tag variant={row.status === 'active' ? 'success' : 'neutral'}>{row.status === 'active' ? '启用' : '停用'}</Tag>, width: 90, align: 'center' },
    { id: 'actions', header: '操作', accessor: (row) => row.isBuiltin ? <span className="text-xs text-fg-muted">只读</span> : <div className="flex justify-center gap-1"><button className="rounded p-1.5 text-fg-muted hover:bg-canvas-subtle hover:text-accent-fg" title="编辑" onClick={() => setEditing(row)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1.5 text-fg-muted hover:bg-canvas-subtle" title={row.status === 'active' ? '停用' : '启用'} onClick={() => void toggle(row)}>{row.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button><button className="rounded p-1.5 text-fg-muted hover:bg-danger-subtle hover:text-danger-fg" title="删除" onClick={() => setDeleting(row)}><Trash2 className="h-4 w-4" /></button></div>, width: 110, align: 'center' },
  ];

  return <PageContent className="yj-page-shell">
    <div className="yj-page-header"><h2 className="yj-page-title">流程列表</h2></div>
    <div className="yj-toolbar-panel"><div className="w-64"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索流程..." leftElement={<Search className="h-4 w-4" />} /></div><Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>新建流程</Button></div>
    {error && <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>}
    {filtered.length ? <DataTable data={filtered} columns={columns} rowKey="id" density="default" striped /> : <EmptyState className="yj-panel" icon={<Workflow />} title="暂无分析流程" description="可基于内置 WES 流程建立组织自己的分析流程。" />}
    <PipelineModal open={creating} title="新建分析流程" initial={EMPTY_FORM} beds={beds} baselines={baselines} onClose={() => setCreating(false)} onSubmit={create} />
    <PipelineModal open={editing !== null} title="编辑分析流程" initial={initialEdit} beds={beds} baselines={baselines} onClose={() => setEditing(null)} onSubmit={update} />
    <ConfirmDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} title="确认删除" message={`确定要删除流程「${deleting?.name ?? ''}」吗？此操作不可撤销。`} variant="danger" onConfirm={remove} />
  </PageContent>;
}
