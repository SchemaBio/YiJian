'use client';

import * as React from 'react';
import Link from 'next/link';
import { PageContent } from '@/components/layout';
import { AppModal, EmptyState, ModalSectionHeading } from '@/components/shared';
import { Button, DataTable, FormItem, Input, Select, Tag, type Column } from '@schema/ui-kit';
import { AlertTriangle, Coins, Database, ExternalLink, Loader2, Plus, Search } from 'lucide-react';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import { createCNVBaseline, listCNVBaselines, type CNVBaseline, type CNVBaselineStatus } from '@/lib/cnv-baselines';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { AssetMultiSelect } from './AssetMultiSelect';
import { getBillingConfig } from '@/lib/billing';
import { useAuth } from '@/components/providers/AuthProvider';
import { BUILTIN_CNV_BASELINES } from '@/lib/builtin-resources';

type ReferenceGenome = 'GRCh37' | 'GRCh38';

const genomeOptions = [
  { value: 'GRCh37', label: 'GRCh37 (hg19)' },
  { value: 'GRCh38', label: 'GRCh38 (hg38)' },
];

const statusLabels: Record<CNVBaselineStatus, string> = {
  queued: '排队中', waiting_for_data: '等待数据', running: '运行中', completed: '已完成', failed: '失败', cancelled: '已取消',
};

function statusVariant(status: CNVBaselineStatus): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'running' || status === 'queued' || status === 'waiting_for_data') return 'warning';
  return 'neutral';
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
}

function assetOptions(assets: DataAsset[]) {
  return assets.map((asset) => ({ value: asset.id, label: `${asset.file_name} · ${asset.id.slice(0, 8)}` }));
}

export default function BaselinePage() {
  const { user, currentOrg } = useAuth();
  const scope = `${user?.id || ''}:${currentOrg?.id || ''}`;
  const loadGeneration = React.useRef(0);
  const assetController = React.useRef<AbortController | null>(null);
  const [creditRate, setCreditRate] = React.useState<number | null>(null);
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [searchQuery, setSearchQuery] = React.useState('');
  const [items, setItems] = React.useState<CNVBaseline[]>([]);
  const [assets, setAssets] = React.useState<DataAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [name, setName] = React.useState('');
  const [genome, setGenome] = React.useState<ReferenceGenome>('GRCh38');
  const [bedID, setBedID] = React.useState('');
  const [read1IDs, setRead1IDs] = React.useState<string[]>([]);
  const [read2IDs, setRead2IDs] = React.useState<string[]>([]);
  const [read1Open, setRead1Open] = React.useState(false), [read2Open, setRead2Open] = React.useState(false);

  const loadData = React.useCallback(async () => {
    const generation = ++loadGeneration.current;
    assetController.current?.abort();
    const controller = new AbortController(); assetController.current = controller;
    setLoading(true); setError(''); setCreditRate(null);
    try {
      const dataPromise = (async () => {
        const all: DataAsset[] = []; let page = 1;
        while (true) {
          const result = await listDataAssets('', { status: 'completed', page, signal: controller.signal });
          all.push(...result.items);
          if (page >= result.total_pages) break;
          page += 1;
        }
        return Array.from(new Map(all.map(asset => [asset.id, asset])).values());
      })();
      const [baselines, data] = await Promise.all([listCNVBaselines(), dataPromise]);
      if (generation !== loadGeneration.current || controller.signal.aborted) return;
      setItems([...BUILTIN_CNV_BASELINES, ...baselines]); setAssets(data);
    } catch (err) {
      if (generation === loadGeneration.current && !controller.signal.aborted) setError(err instanceof Error ? err.message : '加载 CNV 基线失败');
    } finally { if (generation === loadGeneration.current) setLoading(false); }
  }, [scope]);

  React.useEffect(() => {
    setModalOpen(false); setName(''); setBedID(''); setRead1IDs([]); setRead2IDs([]); setAssets([]); setItems([]); setFormError('');
    void loadData();
    return () => { ++loadGeneration.current; assetController.current?.abort(); };
  }, [loadData]);
  React.useEffect(() => {
    if (!isSaaS) return;
    let disposed = false;
    void getBillingConfig().then(config => { if (!disposed) setCreditRate(config.cnv_baseline_credits_per_gib ?? null); }).catch(() => {});
    return () => { disposed = true; };
  }, [isSaaS, scope]);
  React.useEffect(() => {
    if (!items.some(item => !item.is_builtin && ['queued', 'waiting_for_data', 'running'].includes(item.status))) return;
    let disposed = false;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void listCNVBaselines().then(rows => { if (!disposed) setItems([...BUILTIN_CNV_BASELINES, ...rows]); }).catch(() => {});
    }, 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [items, scope]);

  const read1Options = React.useMemo(() => assetOptions(assets.filter((asset) => asset.read_type === 'read1')), [assets]);
  const read2Options = React.useMemo(() => assetOptions(assets.filter((asset) => asset.read_type === 'read2')), [assets]);
  const bedOptions = React.useMemo(() => assetOptions(assets.filter((asset) => asset.read_type === 'bed' && asset.validation_status==='valid' && asset.reference_genome === genome)), [assets, genome]);
  const selectedInputBytes = React.useMemo(() => {
    const selected = new Set([...read1IDs, ...read2IDs]);
    return assets.reduce((total, asset) => total + (selected.has(asset.id) ? asset.file_size : 0), 0);
  }, [assets, read1IDs, read2IDs]);
  const estimatedCredits = creditRate === null ? null : Math.ceil(selectedInputBytes / (1024 ** 3)) * creditRate;

  const filteredItems = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.name.toLowerCase().includes(query) || item.reference_genome.toLowerCase().includes(query) || item.bed.file_name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false); setName(''); setBedID(''); setRead1IDs([]); setRead2IDs([]); setFormError('');
  };

  const handleCreate = async () => {
    if (submitting) return;
    if (!name.trim() || !bedID || read1IDs.length === 0 || read1IDs.length !== read2IDs.length) {
      setFormError('请填写名称，选择 BED，并选择数量一致的 R1 与 R2 文件。');
      return;
    }
    const generation = loadGeneration.current;
    setSubmitting(true); setFormError('');
    try {
      const created = await createCNVBaseline({ name: name.trim(), reference_genome: genome, bed_asset_id: bedID, read1_asset_ids: read1IDs, read2_asset_ids: read2IDs });
      if (generation !== loadGeneration.current) return;
      setItems((current) => [created, ...current]);
      setModalOpen(false); setName(''); setBedID(''); setRead1IDs([]); setRead2IDs([]); setFormError('');
      setSubmitting(false);
    } catch (err) {
      if (generation === loadGeneration.current) setFormError(err instanceof Error ? err.message : '创建 CNV 基线任务失败');
    } finally { setSubmitting(false); }
  };

  const columns: Column<CNVBaseline>[] = [
    { id: 'name', header: '基线名称', accessor: 'name', width: 190, align: 'left' },
    { id: 'reference', header: '参考基因组', accessor: (row) => <Tag variant="info">{row.reference_genome}</Tag>, width: 120, align: 'center' },
    { id: 'data', header: '数据组', accessor: (row) => row.is_builtin ? '-' : `${row.read_pairs.length} 对 R1/R2`, width: 110, align: 'center' },
    ...(isSaaS ? [{ id: 'credits', header: '积分', accessor: (row: CNVBaseline) => row.is_builtin ? '-' : `${row.credits_charged || row.credit_cost} 积分`, width: 90, align: 'center' as const }] : []),
    { id: 'bed', header: 'BED 文件', accessor: (row) => <span className="block truncate" title={row.bed.file_name}>{row.bed.file_name}</span>, width: 220, align: 'left' },
    { id: 'status', header: '状态', accessor: (row) => row.is_builtin ? <Tag variant="success">内置可用</Tag> : row.start_error ? <Tag variant="danger">投递异常</Tag> : <Tag variant={statusVariant(row.status)}>{statusLabels[row.status]}{row.status === 'running' ? ` ${row.progress}%` : ''}</Tag>, width: 130, align: 'center' },
    { id: 'output', header: '基线输出', accessor: (row) => <span className="block max-w-[300px] truncate font-mono text-xs" title={row.start_error || row.output_path || row.error}>{row.is_builtin ? '系统内置资源' : row.start_error || row.output_path || (row.status === 'failed' ? row.error || '执行失败' : '-')}</span>, width: 300, align: 'left' },
    { id: 'created', header: '创建时间', accessor: (row) => row.is_builtin ? '-' : formatTime(row.created_at), width: 170, align: 'center' },
    { id: 'task', header: '任务', accessor: (row) => row.is_builtin ? '-' : <Link href={`/tasks/${encodeURIComponent(row.task_id)}`} className="inline-flex items-center gap-1 text-accent-fg hover:underline">查看<ExternalLink className="h-3.5 w-3.5" /></Link>, width: 90, align: 'center' },
  ];

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header"><div><h2 className="yj-page-title">CNV 基线</h2><p className="yj-page-subtitle">使用所选正常样本对系统内置 CNV 基线进行校正。</p></div></div>
      <div className="mb-2 flex items-start gap-3 rounded-md border border-warning-muted bg-warning-subtle px-4 py-3 text-sm leading-6 text-warning-fg">
        <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
        <span>CNV 基线由系统内置基线结合所选样本进行校正生成。该结果仅供分析参考，准确度尚未经充分验证，请结合其他检测方法和临床证据综合判断。</span>
      </div>
      <div className="yj-toolbar-panel">
        <div className="w-72"><Input placeholder="搜索名称、基因组或 BED..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} leftElement={<Search className="h-4 w-4" />} /></div>
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} disabled={loading || !!error} onClick={() => setModalOpen(true)}>校正内置 CNV 基线</Button>
      </div>
      {error && <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>}
      {loading ? <div className="yj-empty-state"><Loader2 className="h-6 w-6 animate-spin text-accent-fg" /><p className="text-fg-muted">正在加载 CNV 基线...</p></div> : filteredItems.length === 0 ? <EmptyState className="yj-panel" icon={<Database />} title="暂无 CNV 基线" description="选择已上传的 R1/R2 数据和 BED 文件建立基线。" /> : <DataTable data={filteredItems} columns={columns} rowKey="id" density="default" striped />}

      <AppModal closeOnEscape={!read1Open && !read2Open} open={modalOpen} onOpenChange={(open) => !open && closeModal()} title="校正内置 CNV 基线" size="large" footer={<><Button variant="secondary" onClick={closeModal} disabled={submitting}>取消</Button><Button variant="primary" onClick={handleCreate} disabled={submitting || !name.trim() || !bedID || read1IDs.length === 0 || read1IDs.length !== read2IDs.length} leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}>{submitting ? '正在投递...' : '启动校正流程'}</Button></>}>
        <div className="space-y-5">
          <ModalSectionHeading icon={<Database className="h-4 w-4" />} title="CNV 基线校正流程" description="系统将内置基线与所选正常样本合并校正，不会从零建立基线。" />
          <div className="rounded-md border border-warning-muted bg-warning-subtle px-3 py-2 text-xs leading-5 text-warning-fg">CNV 基线由系统内置基线结合所选样本进行校正生成。结果仅供参考，准确度尚未经充分验证。</div>
          {formError && <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{formError}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormItem label="基线名称" required><Input maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="如 GRCh38-WES-normal-2026Q3" /></FormItem>
            <FormItem label="参考基因组" required><Select value={genome} onChange={(value) => { setGenome((Array.isArray(value) ? value[0] : value) as ReferenceGenome); setBedID(''); }} options={genomeOptions} /></FormItem>
          </div>
          <FormItem label="R1 数据" required hint="可多选；选择顺序需与 R2 一一对应"><AssetMultiSelect label="R1 数据" value={read1IDs} onChange={setRead1IDs} onOpenChange={setRead1Open} options={read1Options} disabled={submitting} /></FormItem>
          <FormItem label="R2 数据" required hint={`已选择 ${read1IDs.length} 个 R1 / ${read2IDs.length} 个 R2`}><AssetMultiSelect label="R2 数据" value={read2IDs} onChange={setRead2IDs} onOpenChange={setRead2Open} options={read2Options} disabled={submitting} /></FormItem>
          {(read1IDs.length > 0 || read2IDs.length > 0) && <div className="overflow-x-auto rounded-md border border-border-default"><table className="w-full min-w-[460px] text-left text-xs"><caption className="border-b border-border-default bg-canvas-subtle px-3 py-2 text-left">提交配对预览 · 按选择顺序对应，请确认每行属于同一样本</caption><thead><tr><th className="p-2">组</th><th className="p-2">R1</th><th className="p-2">R2</th></tr></thead><tbody>{Array.from({ length: Math.max(read1IDs.length, read2IDs.length) }, (_, index) => <tr key={index} className="border-t border-border-default"><td className="p-2">{index + 1}</td><td className="max-w-48 break-all p-2">{assets.find(asset => asset.id === read1IDs[index])?.file_name || '未选择'}</td><td className="max-w-48 break-all p-2">{assets.find(asset => asset.id === read2IDs[index])?.file_name || '未选择'}</td></tr>)}</tbody></table></div>}
          <FormItem label="BED 文件" required hint={`仅显示 ${genome} 的可用 BED 文件`}><Select searchable value={bedID} onChange={(value) => setBedID(Array.isArray(value) ? value[0] : value)} options={bedOptions} placeholder={bedOptions.length ? '选择 BED 文件' : `暂无 ${genome} BED 文件`} disabled={bedOptions.length === 0} /></FormItem>
          {isSaaS && <div className="flex items-center justify-between gap-4 rounded-md border border-border-default bg-canvas-subtle px-4 py-3"><div className="flex items-center gap-2"><Coins className="h-4 w-4 text-accent-fg" /><div><div className="text-sm font-medium text-fg-default">{estimatedCredits === null ? '预计积分暂不可用' : `预计消耗 ${estimatedCredits} 积分`}</div><div className="mt-0.5 text-xs text-fg-muted">按 R1/R2 总大小向上取整计费。{creditRate === null ? '最终金额以服务端计费配置为准。' : `每 GiB ${creditRate} 积分，不足 1 GiB 按 1 GiB 计。`}</div></div></div><div className="shrink-0 text-xs text-fg-muted">{(selectedInputBytes / (1024 ** 3)).toFixed(2)} GiB</div></div>}
        </div>
      </AppModal>
    </PageContent>
  );
}
