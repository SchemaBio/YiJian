'use client';

import * as React from 'react';
import Link from 'next/link';
import { PageContent } from '@/components/layout';
import { AppModal, EmptyState, ModalSectionHeading } from '@/components/shared';
import { Button, DataTable, FormItem, Input, Select, Tag, type Column } from '@schema/ui-kit';
import { Coins, Database, ExternalLink, Loader2, Plus, Search } from 'lucide-react';
import { listDataAssets, type DataAsset } from '@/lib/data-assets';
import { createCNVBaseline, listCNVBaselines, type CNVBaseline, type CNVBaselineStatus } from '@/lib/cnv-baselines';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
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

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [baselines, data] = await Promise.all([listCNVBaselines(), listDataAssets('', { status: 'completed' })]);
      setItems([...BUILTIN_CNV_BASELINES, ...baselines]);
      setAssets(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 CNV 基线失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void loadData(); }, [loadData]);

  const read1Options = React.useMemo(() => assetOptions(assets.filter((asset) => asset.read_type === 'read1')), [assets]);
  const read2Options = React.useMemo(() => assetOptions(assets.filter((asset) => asset.read_type === 'read2')), [assets]);
  const bedOptions = React.useMemo(() => assetOptions(assets.filter((asset) => asset.read_type === 'bed' && asset.reference_genome === genome)), [assets, genome]);
  const selectedInputBytes = React.useMemo(() => {
    const selected = new Set([...read1IDs, ...read2IDs]);
    return assets.reduce((total, asset) => total + (selected.has(asset.id) ? asset.file_size : 0), 0);
  }, [assets, read1IDs, read2IDs]);
  const estimatedCredits = selectedInputBytes > 0 ? Math.ceil(selectedInputBytes / (1024 ** 3)) : 0;

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
    setSubmitting(true); setFormError('');
    try {
      const created = await createCNVBaseline({ name: name.trim(), reference_genome: genome, bed_asset_id: bedID, read1_asset_ids: read1IDs, read2_asset_ids: read2IDs });
      setItems((current) => [created, ...current]);
      setSubmitting(false);
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建 CNV 基线任务失败');
      setSubmitting(false);
    }
  };

  const columns: Column<CNVBaseline>[] = [
    { id: 'name', header: '基线名称', accessor: 'name', width: 190, align: 'left' },
    { id: 'reference', header: '参考基因组', accessor: (row) => <Tag variant="info">{row.reference_genome}</Tag>, width: 120, align: 'center' },
    { id: 'data', header: '数据组', accessor: (row) => row.is_builtin ? '-' : `${row.read_pairs.length} 对 R1/R2`, width: 110, align: 'center' },
    ...(isSaaS ? [{ id: 'credits', header: '积分', accessor: (row: CNVBaseline) => row.is_builtin ? '-' : `${row.credits_charged || row.credit_cost} 积分`, width: 90, align: 'center' as const }] : []),
    { id: 'bed', header: 'BED 文件', accessor: (row) => <span className="block truncate" title={row.bed.file_name}>{row.bed.file_name}</span>, width: 220, align: 'left' },
    { id: 'status', header: '状态', accessor: (row) => row.is_builtin ? <Tag variant="neutral">内置占位</Tag> : <Tag variant={statusVariant(row.status)}>{statusLabels[row.status]}{row.status === 'running' ? ` ${row.progress}%` : ''}</Tag>, width: 130, align: 'center' },
    { id: 'output', header: '基线输出路径', accessor: (row) => <span className="block max-w-[300px] truncate font-mono text-xs" title={row.output_path || row.error}>{row.is_builtin ? '待替换为正式内置资源' : row.output_path || (row.status === 'failed' ? row.error || '执行失败' : '-')}</span>, width: 300, align: 'left' },
    { id: 'created', header: '创建时间', accessor: (row) => row.is_builtin ? '-' : formatTime(row.created_at), width: 170, align: 'center' },
    { id: 'task', header: '任务', accessor: (row) => row.is_builtin ? '-' : <Link href={`/tasks/${encodeURIComponent(row.task_id)}`} className="inline-flex items-center gap-1 text-accent-fg hover:underline">查看<ExternalLink className="h-3.5 w-3.5" /></Link>, width: 90, align: 'center' },
  ];

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header"><div><h2 className="yj-page-title">CNV 基线</h2><p className="yj-page-subtitle">直接使用已上传数据建立 CNV 分析基线。</p></div></div>
      <div className="yj-toolbar-panel">
        <div className="w-72"><Input placeholder="搜索名称、基因组或 BED..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} leftElement={<Search className="h-4 w-4" />} /></div>
        <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>建立 CNV 基线</Button>
      </div>
      {error && <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>}
      {loading ? <div className="yj-empty-state"><Loader2 className="h-6 w-6 animate-spin text-accent-fg" /><p className="text-fg-muted">正在加载 CNV 基线...</p></div> : filteredItems.length === 0 ? <EmptyState className="yj-panel" icon={<Database />} title="暂无 CNV 基线" description="选择已上传的 R1/R2 数据和 BED 文件建立基线。" /> : <DataTable data={filteredItems} columns={columns} rowKey="id" density="default" striped />}

      <AppModal open={modalOpen} onOpenChange={(open) => !open && closeModal()} title="建立 CNV 基线" size="large" footer={<><Button variant="secondary" onClick={closeModal} disabled={submitting}>取消</Button><Button variant="primary" onClick={handleCreate} disabled={submitting || !name.trim() || !bedID || read1IDs.length === 0 || read1IDs.length !== read2IDs.length} leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}>{submitting ? '正在投递...' : '启动建立流程'}</Button></>}>
        <div className="space-y-5">
          <ModalSectionHeading icon={<Database className="h-4 w-4" />} title="CNV 基线建立流程" description="此任务不关联样本，只使用已上传且状态可用的数据文件。" />
          {formError && <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{formError}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormItem label="基线名称" required><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="如 GRCh38-WES-normal-2026Q3" /></FormItem>
            <FormItem label="参考基因组" required><Select value={genome} onChange={(value) => { setGenome((Array.isArray(value) ? value[0] : value) as ReferenceGenome); setBedID(''); }} options={genomeOptions} /></FormItem>
          </div>
          <FormItem label="R1 数据" required hint="可多选；选择顺序需与 R2 一一对应"><Select multiple searchable value={read1IDs} onChange={(value) => setRead1IDs(Array.isArray(value) ? value : [value])} options={read1Options} placeholder="选择一个或多个 R1 文件" /></FormItem>
          <FormItem label="R2 数据" required hint={`已选择 ${read1IDs.length} 个 R1 / ${read2IDs.length} 个 R2`}><Select multiple searchable value={read2IDs} onChange={(value) => setRead2IDs(Array.isArray(value) ? value : [value])} options={read2Options} placeholder="选择数量一致的 R2 文件" error={read2IDs.length > 0 && read1IDs.length !== read2IDs.length} /></FormItem>
          <FormItem label="BED 文件" required hint={`仅显示 ${genome} 的可用 BED 文件`}><Select searchable value={bedID} onChange={(value) => setBedID(Array.isArray(value) ? value[0] : value)} options={bedOptions} placeholder={bedOptions.length ? '选择 BED 文件' : `暂无 ${genome} BED 文件`} disabled={bedOptions.length === 0} /></FormItem>
          {isSaaS && <div className="flex items-center justify-between gap-4 rounded-md border border-border-default bg-canvas-subtle px-4 py-3"><div className="flex items-center gap-2"><Coins className="h-4 w-4 text-accent-fg" /><div><div className="text-sm font-medium text-fg-default">预计消耗 {estimatedCredits} 积分</div><div className="mt-0.5 text-xs text-fg-muted">按所选 R1 和 R2 总大小计费，每 1 GB 消耗 1 积分，不足 1 GB 按 1 GB 计。</div></div></div><div className="shrink-0 text-xs text-fg-muted">{(selectedInputBytes / (1024 ** 3)).toFixed(2)} GB</div></div>}
        </div>
      </AppModal>
    </PageContent>
  );
}
