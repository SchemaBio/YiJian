'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, translateUI, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { TableActions, TableAction } from '@/components/shared/TableActions';
import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';

import { HoverHint } from '@/components/shared/HoverHint';

import {useAuth} from '@/components/providers/AuthProvider';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import { AppModal, ConfirmDialog, EmptyState, ModalSectionHeading } from '@/components/shared';
import { DataTable, Input, Select, Tag, type Column } from '@schema/ui-kit';
import { Database, Loader2, Pause, Play, Search, Workflow } from 'lucide-react';
import { api } from '@/lib/api';
import {readResourcePages} from '@/lib/resource-pages';
import {ResourcePager} from '@/components/shared/ResourcePager';
import { listAllBEDAssets, type DataAsset } from '@/lib/data-assets';
import { listCNVBaselines, type CNVBaseline } from '@/lib/cnv-baselines';
import { builtinBEDId, builtinBEDLabel, builtinCNVBaselineId, builtinCNVBaselineLabel, resourceDisplayName } from '@/lib/builtin-resources';

type BasePipelineType = 'wes_single' | 'wes_family';
type BuiltinPipelineID = 'builtin-wes-single' | 'builtin-wes-family' | 'builtin-wes-single-hg38' | 'builtin-wes-family-hg38';
type PipelineStatus = 'active' | 'inactive';
type ReferenceGenome = 'hg19' | 'hg38';

interface Pipeline {
 resourceAvailable:boolean;resourceError:string;
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

function normalizePipeline(value: unknown, t: TextTranslator = chineseText): Pipeline {
  const raw = (value ?? {}) as Record<string, unknown>;
  const base = stringOf(raw, 'baseType', 'base_type', 'wes_single');
  const genome = stringOf(raw, 'referenceGenome', 'reference_genome', 'hg19').toLowerCase();
  return {
    id: String(raw.id ?? ''),resourceAvailable:raw.resource_available!==false,resourceError:String(raw.resource_error??''),
    name: stringOf(raw, 'name', 'name'),
    basePipeline: base === 'wes_family' ? 'wes_family' : 'wes_single',
    version: stringOf(raw, 'version', 'version'),
    description: stringOf(raw, 'description', 'description'),
    bedFile: stringOf(raw, 'bedFile', 'bed_file', t("pipeline.builtInDefaultBed44f413")),
    bedAssetId: stringOf(raw, 'bedAssetId', 'bed_asset_id'),
    referenceGenome: genome === 'hg38' || genome === 'grch38' ? 'hg38' : 'hg19',
    cnvBaseline: stringOf(raw, 'cnvBaseline', 'cnv_baseline', t("pipeline.builtInDefaultCnvBaselinea21291")),
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
  const t = useText();
  const { referenceGenome } = basePipelineDefinition(form.basePipelineId);
  const genome = resourceGenome(referenceGenome);
  const bedOptions = [
    { value: builtinBEDId(referenceGenome), label: t("pipeline.defaultb310c5", {p0: String(builtinBEDLabel(referenceGenome, t))}) },
    ...beds.filter((item) => item.status === 'completed' && item.validation_status==='valid' && item.reference_genome === genome)
      .map((item) => ({ value: item.id, label: item.file_name })),
  ];
  const baselineOptions = [
    { value: builtinCNVBaselineId(referenceGenome), label: t("pipeline.defaultb310c5", {p0: String(builtinCNVBaselineLabel(referenceGenome, t))}) },
    ...baselines.filter((item) => item.status === 'completed' && item.reference_genome === genome)
      .map((item) => ({ value: item.id, label: item.name })),
  ];
  const change = (field: keyof PipelineFormData, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return <div className="space-y-6">
    <section>
      <ModalSectionHeading icon={<Workflow className="h-4 w-4" />} title={t("pipeline.pipelineInformation7661d4")} />
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("pipeline.basePipelined9745b")}</label>
          <Select value={form.basePipelineId} options={localizeDisplay(BASE_OPTIONS, t)} onChange={(value) => {
            const basePipelineId = (Array.isArray(value) ? value[0] : value) as BuiltinPipelineID;
            const nextGenome = basePipelineDefinition(basePipelineId).referenceGenome;
            setForm((current) => ({ ...current, basePipelineId, bedAssetId: builtinBEDId(nextGenome), cnvBaselineId: builtinCNVBaselineId(nextGenome) }));
          }} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("pipeline.pipelineNameb80393")}</label><Input value={form.name} onChange={(event) => change('name', event.target.value)} placeholder={t("pipeline.enterPipelineNamee9399a")} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("pipeline.pipelineDescriptiond34441")}</label><Input value={form.description} onChange={(event) => change('description', event.target.value)} placeholder={t("pipeline.describeWhenToUseThisPipeline1444ff")} /></div>
        </div>
      </div>
    </section>
    <section className="border-t border-border-default pt-5">
      <ModalSectionHeading icon={<Database className="h-4 w-4" />} title={t("pipeline.analysisResourcesa59d6e")} description={t("pipeline.theBasePipelineBedAndCnvBaseline0c2734")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("pipeline.bedFiles8ee058")}</label><Select searchable value={form.bedAssetId} options={bedOptions} onChange={(value) => change('bedAssetId', Array.isArray(value) ? value[0] : value)} /></div>
        <div><label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("pipeline.cnvBaselinefd84b0")}</label><Select searchable value={form.cnvBaselineId} options={localizeDisplay(baselineOptions, t)} onChange={(value) => change('cnvBaselineId', Array.isArray(value) ? value[0] : value)} /></div>
      </div>
    </section>
  </div>;
}

function PipelineModal({ open, title, initial, beds, baselines, onClose, onSubmit }: {
  open: boolean; title: string; initial: PipelineFormData; beds: DataAsset[]; baselines: CNVBaseline[];
  onClose: () => void; onSubmit: (data: PipelineFormData) => Promise<void>;
}) {
  const t = useText();
  const [form, setForm] = React.useState(initial);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => { if (open) { setForm(initial); setError(''); } }, [open, initial]);
  const submit = async () => {
    if (!form.name.trim() || submitting) return;
    setSubmitting(true); setError('');
    try { await onSubmit(form); onClose(); } catch (err) { setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToSavePipeline972970")); } finally { setSubmitting(false); }
  };
  return <AppModal open={open} onOpenChange={(next) => !next && !submitting && onClose()} title={translateUI(title, t)} size="large" footer={<><Button variant="secondary" onClick={onClose} disabled={submitting}>{t("admin.cancel4d0b46")}</Button><Button loading={submitting} loadingLabel={t("admin.savingd70d42")} action="save" variant="primary" onClick={submit} disabled={!form.name.trim() || submitting} >{t("pipeline.savePipeline082fa6")}</Button></>}>
    {error && <div className="mb-4 rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{error}</div>}
    <PipelineFields form={form} setForm={setForm} beds={beds} baselines={baselines} />
  </AppModal>;
}

function PipelineListPageContent() {
  const t = useText();
  const [search, setSearch] = React.useState('');
 const [page,setPage]=React.useState(1);React.useEffect(()=>setPage(1),[search]);
 const loadController=React.useRef<AbortController|null>(null);
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [beds, setBeds] = React.useState<DataAsset[]>([]);
  const [baselines, setBaselines] = React.useState<CNVBaseline[]>([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Pipeline | null>(null);
  const [deleting, setDeleting] = React.useState<Pipeline | null>(null);

  const load = React.useCallback(async () => {
 loadController.current?.abort();const controller=new AbortController();loadController.current=controller;
 setLoading(true); setError('');
 try {
      const [pipelineResponse, bedResponse, baselineResponse] = await Promise.all([
        readResourcePages<unknown>('/v1/pipelines',{},controller.signal),
        listAllBEDAssets(controller.signal), listCNVBaselines(),
      ]);
      if(controller.signal.aborted)return;
 setPipelines(unwrapList(pipelineResponse).map(item => normalizePipeline(item, t)).filter((item) => item.id));
      setBeds(bedResponse); setBaselines(baselineResponse); setError('');
    } catch (err) { if(!controller.signal.aborted)setError(err instanceof Error ? errorText(err, t) : t("pipeline.unableToLoadPipelinesAndAnalysisResources4b9f6c")); }
    finally { if(!controller.signal.aborted)setLoading(false); }
  }, [t]);
  React.useEffect(() => { void load();return()=>loadController.current?.abort(); }, [load]);

  const initialEdit = React.useMemo<PipelineFormData>(() => editing ? {
    name: editing.name, basePipelineId: builtinPipelineId(editing.basePipeline, editing.referenceGenome), description: editing.description,
    bedAssetId: editing.bedAssetId || builtinBEDId(editing.referenceGenome),
    cnvBaselineId: editing.cnvBaselineId || builtinCNVBaselineId(editing.referenceGenome),
  } : EMPTY_FORM, [editing]);

  const create = async (form: PipelineFormData) => {
    const created = normalizePipeline(await api.post<unknown>('/v1/pipelines', payload(form)), t);
    setPipelines((items) => [...items.filter((item) => item.isBuiltin), created, ...items.filter((item) => !item.isBuiltin)]);
  };
  const update = async (form: PipelineFormData, pipeline = editing) => {
    if (!pipeline) return;
    const updated = normalizePipeline(await api.put<unknown>(`/v1/pipelines/${encodeURIComponent(pipeline.id)}`, payload(form, pipeline.status, pipeline.version)), t);
    setPipelines((items) => items.map((item) => item.id === pipeline.id ? updated : item));
  };
  const toggle = async (pipeline: Pipeline) => {
    const form: PipelineFormData = { name: pipeline.name, basePipelineId: builtinPipelineId(pipeline.basePipeline, pipeline.referenceGenome), description: pipeline.description, bedAssetId: pipeline.bedAssetId || builtinBEDId(pipeline.referenceGenome), cnvBaselineId: pipeline.cnvBaselineId || builtinCNVBaselineId(pipeline.referenceGenome) };
    const status = pipeline.status === 'active' ? 'inactive' : 'active';
    const updated = normalizePipeline(await api.put<unknown>(`/v1/pipelines/${encodeURIComponent(pipeline.id)}`, payload(form, status, pipeline.version)), t);
    setPipelines((items) => items.map((item) => item.id === pipeline.id ? updated : item));
  };
  const remove = async () => {
    if (!deleting) return;
    await api.delete(`/v1/pipelines/${encodeURIComponent(deleting.id)}`);
    setPipelines((items) => items.filter((item) => item.id !== deleting.id)); setDeleting(null);
  };

  const filtered = pipelines.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  const columns: Column<Pipeline>[] = [
    { id: 'name', header: t("history.pipelineName323a83"), accessor: (row) => <div className="text-left"><div className="font-medium text-fg-default">{row.name}</div>{row.isBuiltin && <div className="mt-0.5 text-xs text-fg-muted">{t("pipeline.systemBuiltInae8da0")}</div>}</div>, width: 210, align: 'left' },
    { id: 'base', header: t("pipeline.basePipeline41689b"), accessor: (row) => <Tag variant="neutral">{row.basePipeline === 'wes_family' ? t("pipeline.wesFamilyAnalysise07024") : t("pipeline.wesSingleSampleAnalysis400a61")}</Tag>, width: 150, align: 'center' },
    { id: 'genome', header: t("pipeline.referenceGenome903ba5"), accessor: (row) => row.referenceGenome, width: 110, align: 'center' },
    { id: 'bed', header: t("pipeline.bedFiles8ee058"), accessor: (row) => <HoverHint content={row.resourceError||row.bedFile}><span className="block truncate" >{resourceDisplayName(row.bedAssetId, row.bedFile, t)}{!row.resourceAvailable&&<span className="ml-2 text-danger-fg">{row.resourceError}</span>}</span></HoverHint>, width: 210, align: 'left' },
    { id: 'cnv', header: t("pipeline.cnvBaselinefd84b0"), accessor: (row) => <HoverHint content={row.cnvBaseline}><span className="block truncate" >{resourceDisplayName(row.cnvBaselineId, row.cnvBaseline, t)}</span></HoverHint>, width: 210, align: 'left' },
    { id: 'status', header: t("admin.status62e951"), accessor: (row) => <Tag variant={row.status === 'active' ? 'success' : 'neutral'}>{row.status === 'active' ? t("admin.enabledd4e9ca") : t("admin.disabledd989e5")}</Tag>, width: 90, align: 'center' },
    { id: 'actions', header: t("admin.actionsf3ea6d"), accessor: (row) => row.isBuiltin ? <span className="text-xs text-fg-muted">{t("pipeline.readOnlyffc1d0")}</span> : <TableActions>
      <TableAction action="edit" label={t("admin.edita7f814")} onClick={() => setEditing(row)} />
      <TableAction label={row.status === 'active' ? t("admin.disabledd989e5") : t("admin.enabledd4e9ca")} leftIcon={row.status === 'active' ? <Pause /> : <Play />} onClick={() => void toggle(row)} />
      <TableAction action="delete" label={t("data.delete3755f5")} tone="danger" onClick={() => setDeleting(row)} />
    </TableActions>, width: 224, minWidth: 224, align: 'center', pinned: 'right' },
  ];

  return <PageContent className="yj-page-shell">
    <div className="yj-page-header"><h2 className="yj-page-title">{t("pipeline.pipelineList8414de")}</h2></div>
    <div className="yj-toolbar-panel"><div className="w-full sm:w-64"><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("pipeline.searchPipelinesa96425")} leftElement={<Search className="h-4 w-4" />} /></div><Button action="add" variant="primary"  onClick={() => setCreating(true)}>{t("pipeline.newPipelineeb4246")}</Button></div>
    {error && <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}<ActionButton action="retry" variant="ghost" type="button" className="yj-tool-button ml-3" onClick={()=>void load()}>{t("pipeline.retrye2d53a")}</ActionButton></div>}
    {loading ? <div role="status" className="yj-panel flex items-center justify-center gap-2 py-12 text-sm text-fg-muted"><Loader2 className="h-4 w-4 animate-spin" />{t("pipeline.loadingPipelines010e7f")}</div> : filtered.length ? <DataTable data={filtered.slice((page-1)*20,page*20)} columns={localizeDisplay(columns, t)} rowKey="id" density="default" className="yj-data-table right-pinned-actions-table pipeline-center-table" /> : !error && <EmptyState className="yj-panel" icon={<Workflow />} title={search.trim()?t("pipeline.noMatchingPipelinesff529c"):t("pipeline.noAnalysisPipelines7092a3")} description={search.trim()?t("pipeline.adjustYourSearchAndRetryf591c7"):t("pipeline.createOrganizationSpecificPipelinesFromBuiltIn5a5a74")} />}
    <ResourcePager page={page} total={filtered.length} onChange={setPage}/><PipelineModal open={creating} title={t("pipeline.newAnalysisPipeline3debde")} initial={EMPTY_FORM} beds={beds} baselines={baselines} onClose={() => setCreating(false)} onSubmit={create} />
    <PipelineModal open={editing !== null} title={t("pipeline.editAnalysisPipeline7f991e")} initial={initialEdit} beds={beds} baselines={baselines} onClose={() => setEditing(null)} onSubmit={update} />
    <ConfirmDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)} title={t("data.confirmDeletion3c06ab")} message={t("pipeline.deletePipelineThisCannotBeUndone6191b0", {p0: String(deleting?.name ?? '')})} variant="danger" onConfirm={remove} />
  </PageContent>;
}

export default function PipelineListPage(){const {user,currentOrg}=useAuth();return <PipelineListPageContent key={`${user?.id??""}:${currentOrg?.id??""}`} />;}
