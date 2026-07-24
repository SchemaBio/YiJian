'use client';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import { AppModal, EmptyState, ModalSectionHeading } from '@/components/shared';
import { Button, Checkbox, DataTable, FormItem, Input, Select, Tag, type Column } from '@schema/ui-kit';
import { AlertTriangle, FileText, HardDrive, Loader2, Search, Upload } from 'lucide-react';
import { getDataCenterConfig, listDataAssets, uploadBEDFile, type DataAsset, type DataCenterConfig } from '@/lib/data-assets';
import { BUILTIN_BED_ASSETS } from '@/lib/builtin-resources';

type ReferenceGenome = 'GRCh37' | 'GRCh38';

const genomeOptions = [
  { value: 'GRCh37', label: 'GRCh37 (hg19)' },
  { value: 'GRCh38', label: 'GRCh38 (hg38)' },
];

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { hour12: false });
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function BedFilesPage() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [items, setItems] = React.useState<DataAsset[]>([]);
  const [config, setConfig] = React.useState<DataCenterConfig | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [referenceGenome, setReferenceGenome] = React.useState<ReferenceGenome>('GRCh38');
  const [uploading, setUploading] = React.useState(false);
  const [uploadPolicyAcknowledged, setUploadPolicyAcknowledged] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [uploadError, setUploadError] = React.useState('');

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [response, dataCenterConfig] = await Promise.all([
        listDataAssets('', { readType: 'bed' }),
        getDataCenterConfig(),
      ]);
      setItems([...BUILTIN_BED_ASSETS, ...response.items]);
      setConfig(dataCenterConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 BED 文件失败');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => { void loadData(); }, [loadData]);

  const filteredFiles = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.file_name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query));
  }, [items, searchQuery]);

  const closeModal = () => {
    if (uploading) return;
    setModalOpen(false);
    setFile(null);
    setProgress(0);
    setUploadError('');
    setUploadPolicyAcknowledged(false);
  };

  const handleUpload = async () => {
    if (!file || uploading) return;
    if (config?.temporary && !uploadPolicyAcknowledged) {
      setUploadError('请先勾选“我已确认”');
      return;
    }
    setUploading(true);
    setUploadError('');
    setProgress(0);
    try {
      await uploadBEDFile(file, referenceGenome, uploadPolicyAcknowledged, setProgress);
      setUploading(false);
      setModalOpen(false);
      setFile(null);
      setProgress(0);
      setUploadPolicyAcknowledged(false);
      await loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传 BED 文件失败');
    } finally {
      setUploading(false);
    }
  };

  const columns: Column<DataAsset>[] = [
    {
      id: 'fileName', header: '文件名', width: 280, align: 'left',
      accessor: (row) => <span className="block truncate font-medium text-fg-default" title={row.file_name}>{row.file_name}{row.is_builtin && <Tag className="ml-2" variant="neutral">内置占位</Tag>}</span>,
    },
    {
      id: 'referenceGenome', header: '参考基因组', width: 130, align: 'center',
      accessor: (row) => <Tag variant="info">{row.reference_genome || '-'}</Tag>,
    },
    { id: 'size', header: '文件大小', width: 110, align: 'right', accessor: (row) => row.is_builtin ? '-' : formatBytes(row.file_size) },
    {
      id: 'provider', header: '存储位置', width: 120, align: 'center',
      accessor: (row) => <span className="inline-flex items-center gap-1.5"><HardDrive className="h-4 w-4 text-fg-muted" />{row.is_builtin ? '系统内置' : row.provider === 's3' ? '对象存储' : '本地存储'}</span>,
    },
    {
      id: 'status', header: '状态', width: 100, align: 'center',
      accessor: (row) => row.is_builtin ? <Tag variant="neutral">占位</Tag> : <Tag variant={row.status === 'completed' ? 'success' : row.status === 'failed' ? 'danger' : 'warning'}>{row.status === 'completed' ? '可用' : row.status === 'failed' ? '失败' : '上传中'}</Tag>,
    },
    { id: 'createdAt', header: '上传时间', width: 180, align: 'center', accessor: (row) => row.is_builtin ? '-' : formatTime(row.created_at) },
  ];

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">BED 文件</h2>
          <p className="yj-page-subtitle">管理流程可用的捕获区域文件及其参考基因组。</p>
        </div>
      </div>

      <div className="yj-toolbar-panel">
        <div className="w-72">
          <Input placeholder="搜索文件名或 UUID..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} leftElement={<Search className="h-4 w-4" />} />
        </div>
        <Button variant="primary" leftIcon={<Upload className="h-4 w-4" />} onClick={() => { setUploadPolicyAcknowledged(false); setModalOpen(true); }}>上传 BED 文件</Button>
      </div>

      {error && <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>}

      {isLoading ? (
        <div className="yj-empty-state"><Loader2 className="h-6 w-6 animate-spin text-accent-fg" /><p className="text-fg-muted">正在加载 BED 文件...</p></div>
      ) : filteredFiles.length === 0 ? (
        <EmptyState className="yj-panel" icon={<FileText />} title="暂无 BED 文件" description="上传 BED 文件后即可在分析流程和 CNV 基线任务中选择。" />
      ) : (
        <DataTable data={filteredFiles} columns={columns} rowKey="id" density="default" striped />
      )}

      <AppModal
        open={modalOpen}
        onOpenChange={(open) => !open && closeModal()}
        title="上传 BED 文件"
        size="medium"
        footer={<><Button variant="secondary" onClick={closeModal} disabled={uploading}>取消</Button><Button variant="primary" onClick={handleUpload} disabled={!file || uploading || Boolean(config?.temporary && !uploadPolicyAcknowledged)} leftIcon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}>{uploading ? `上传中 ${progress}%` : '开始上传'}</Button></>}
      >
        <div className="space-y-5">
          <ModalSectionHeading icon={<FileText className="h-4 w-4" />} title="文件信息" description="BED 文件最大 20MB，上传后仅用于所选参考基因组。" />
          {uploadError && <div className="rounded-md border border-danger-muted bg-danger-subtle px-3 py-2 text-sm text-danger-fg">{uploadError}</div>}
          <FormItem label="参考基因组" required>
            <Select value={referenceGenome} onChange={(value) => setReferenceGenome((Array.isArray(value) ? value[0] : value) as ReferenceGenome)} options={genomeOptions} />
          </FormItem>
          <FormItem label="BED 文件" required hint="支持 .bed 和 .bed.gz，文件大小不超过 20MB">
            <input
              type="file"
              accept=".bed,.bed.gz,application/gzip"
              disabled={uploading}
              onChange={(event) => { setFile(event.target.files?.[0] ?? null); setUploadError(''); }}
              className="block w-full rounded-md border border-border-default bg-canvas-default px-3 py-2 text-sm text-fg-default file:mr-3 file:rounded file:border-0 file:bg-canvas-subtle file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </FormItem>
          {config?.temporary && <div className="space-y-3 rounded-md border border-warning-muted bg-warning-subtle p-3 text-sm text-warning-fg"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>上传文件将在 {config.retention_days} 天后自动删除，SaaS 模式不提供下载。</span></div><Checkbox checked={uploadPolicyAcknowledged} disabled={uploading} onCheckedChange={(checked) => setUploadPolicyAcknowledged(checked === true)} label="我已确认" /></div>}
          {uploading && <div className="h-1.5 overflow-hidden rounded bg-canvas-subtle"><div className="h-full bg-accent-emphasis transition-[width]" style={{ width: `${progress}%` }} /></div>}
        </div>
      </AppModal>
    </PageContent>
  );
}
