'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Input, Select } from '@schema/ui-kit';
import { Coins, Search, Loader2, Upload, SlidersHorizontal, Database, FileText } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
import { confirmUpload, requestPairedUploadJob, uploadToCOS } from '@/lib/api';
import {
  pipelinesApi,
  samplesApi,
  templatesApi,
  type TaskPipelineOption,
  type TaskSampleListItem,
  type TaskTemplateOption,
} from '@/lib/task-resources';
import { calculateEstimatedCredits, getBillingBalance, getBillingConfig, type BillingBalance, type BillingConfig } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

export interface NewTaskFormData {
  sampleId: string;
  internalId: string;
  pipelineId: string;
  pipelineName: string;
  pipelineVersion: string;
  remark: string;
  template: string;
  inputs: Record<string, unknown>;
  uploadJobId: string;
}

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewTaskFormData) => void | Promise<void>;
}

export function NewTaskModal({ isOpen, onClose, onSubmit }: NewTaskModalProps) {
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [sampleSearch, setSampleSearch] = React.useState('');
  const [samples, setSamples] = React.useState<TaskSampleListItem[]>([]);
  const [pipelines, setPipelines] = React.useState<TaskPipelineOption[]>([]);
  const [templates, setTemplates] = React.useState<TaskTemplateOption[]>([]);
  const [selectedSample, setSelectedSample] = React.useState<TaskSampleListItem | null>(null);
  const [selectedPipeline, setSelectedPipeline] = React.useState<string>('');
  const [uploadJobId, setUploadJobId] = React.useState('');
  const [remark, setRemark] = React.useState('');
  const [r1File, setR1File] = React.useState<File | null>(null);
  const [r2File, setR2File] = React.useState<File | null>(null);
  const [uploadingFiles, setUploadingFiles] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadNotice, setUploadNotice] = React.useState('');
  const [loadingResources, setLoadingResources] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [resourceError, setResourceError] = React.useState('');
  const [billingBalance, setBillingBalance] = React.useState<BillingBalance | null>(null);
  const [billingConfig, setBillingConfig] = React.useState<BillingConfig | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    async function loadResources() {
      setLoadingResources(true);
      setResourceError('');
      try {
        const [sampleItems, pipelineItems, templateItems] = await Promise.all([
          samplesApi.list(),
          pipelinesApi.list().catch(() => []),
          templatesApi.list().catch(() => []),
        ]);
        if (cancelled) return;
        setSamples(sampleItems);
        setPipelines(pipelineItems);
        setTemplates(templateItems);
        const firstValue = pipelineItems[0]?.id || templateItems[0]?.name || '';
        setSelectedPipeline(prev => prev || firstValue);
        if (isSaaS) {
          const [nextBalance, nextConfig] = await Promise.all([getBillingBalance(), getBillingConfig()]);
          if (cancelled) return;
          setBillingBalance(nextBalance);
          setBillingConfig(nextConfig);
        }
      } catch (err) {
        if (!cancelled) {
          setResourceError(err instanceof Error ? err.message : '加载任务资源失败');
        }
      } finally {
        if (!cancelled) setLoadingResources(false);
      }
    }

    loadResources();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isSaaS]);

  // 筛选样本
  const filteredSamples = React.useMemo(() => {
    if (!sampleSearch) return samples;
    const query = sampleSearch.toLowerCase();
    return samples.filter(
      s => s.id.toLowerCase().includes(query) || s.internalId.toLowerCase().includes(query)
    );
  }, [sampleSearch, samples]);

  const pipelineOptions = React.useMemo(() => {
    if (pipelines.length > 0) {
      return pipelines.map(p => ({
        value: p.id,
        label: `${p.name}${p.version ? ` (${p.version})` : ''}`,
      }));
    }
    return templates.map(t => ({
      value: t.name,
      label: t.displayName && t.displayName !== t.name ? `${t.displayName} (${t.name})` : t.name,
    }));
  }, [pipelines, templates]);

  const resolveTemplate = (pipeline: TaskPipelineOption | undefined) => {
    if (pipeline?.template) return pipeline.template;
    const byBaseType: Record<string, string> = {
      wes_single: 'single',
      // Octopus' built-in trio/family WDL is trio.wdl; the catalog exposes it
      // as germline_trio with shortName "trio".
      wes_family: 'trio',
      panel: 'panel',
    };
    const baseTemplate = pipeline?.baseType ? byBaseType[pipeline.baseType] : '';
    if (baseTemplate && (templates.length === 0 || templates.some(t => t.name === baseTemplate))) {
      return baseTemplate;
    }

    const target = `${pipeline?.id ?? selectedPipeline} ${pipeline?.name ?? ''}`.toLowerCase();
    const matchedTemplate = templates.find(t => target.includes(t.name.toLowerCase()));
    return matchedTemplate?.name || templates[0]?.name || pipeline?.id || selectedPipeline;
  };

  const uploadJobID = uploadJobId.trim();
  const hasSequencingInput = Boolean(selectedSample?.matchedPair || uploadJobID);
  const estimatedCredits = calculateEstimatedCredits(60, billingConfig);
  const projectedBalance = billingBalance && estimatedCredits !== null
    ? billingBalance.balance - estimatedCredits
    : null;
  const insufficientCredits = projectedBalance !== null && billingConfig !== null
    && projectedBalance < billingConfig.min_balance;

  const buildInputs = (sample: TaskSampleListItem) => {
    return {
      sample_name: sample.internalId || sample.id,
      sample_id: sample.id,
    };
  };

  const handleSubmit = async () => {
    if (!selectedSample || !selectedPipeline || submitting || uploadingFiles) return;
    if (!hasSequencingInput) {
      setResourceError('请选择已匹配测序数据的样本，或填写上传任务 ID。');
      return;
    }

    const pipeline = pipelines.find(p => p.id === selectedPipeline);
    const template = resolveTemplate(pipeline);
    if (!template) return;

    setSubmitting(true);
    setResourceError('');
    try {
      await onSubmit({
        sampleId: selectedSample.id,
        internalId: selectedSample.internalId,
        // Octopus treats a non-empty pipelineId as a concrete persisted
        // Pipeline lookup. When the UI falls back to the template catalog, do
        // not submit the template name as pipelineId or CreateTask will fail
        // with "pipeline not found".
        pipelineId: pipeline?.id || '',
        pipelineName: pipeline?.name || template,
        pipelineVersion: pipeline?.version || '',
        remark,
        template,
        inputs: buildInputs(selectedSample),
        uploadJobId: uploadJobID,
      });
      handleClose();
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : '创建任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePairedUpload = async () => {
    if (!r1File || !r2File || uploadingFiles) {
      setResourceError('请选择 R1 和 R2 FASTQ 文件后再上传。');
      return;
    }

    setUploadingFiles(true);
    setUploadProgress(0);
    setUploadNotice('');
    setResourceError('');
    try {
      const job = await requestPairedUploadJob(r1File, r2File, selectedSample?.id);
      const r1 = job.files.find(file => file.read_type === 'read1');
      const r2 = job.files.find(file => file.read_type === 'read2');
      if (!r1 || !r2) {
        throw new Error('上传任务未返回完整的 R1/R2 上传地址');
      }

      await uploadToCOS(r1.upload_url, r1File, pct => setUploadProgress(Math.round(pct / 2)));
      if (r1.storage_type === 'presigned') await confirmUpload(r1.file_id);
      await uploadToCOS(r2.upload_url, r2File, pct => setUploadProgress(50 + Math.round(pct / 2)));
      if (r2.storage_type === 'presigned') await confirmUpload(r2.file_id);
      setUploadJobId(job.job_id);
      setUploadProgress(100);
      setUploadNotice(`上传任务 ${job.job_id} 已就绪`);
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : '上传双端 FASTQ 文件失败');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleClose = () => {
    if (submitting || uploadingFiles) return;
    setSampleSearch('');
    setSelectedSample(null);
    setSelectedPipeline('');
    setUploadJobId('');
    setRemark('');
    setR1File(null);
    setR2File(null);
    setUploadProgress(0);
    setUploadNotice('');
    setResourceError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title="新建分析任务"
      size="large"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting || uploadingFiles}>取消</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loadingResources || uploadingFiles || submitting || !selectedSample || !selectedPipeline || !hasSequencingInput}
            leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          >
            {submitting ? '创建中...' : '创建任务'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {loadingResources && (
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在加载样本和流程...
          </div>
        )}
        {resourceError && (
          <div className="text-sm text-danger-fg bg-danger-subtle border border-danger-emphasis rounded-md px-3 py-2">
            {resourceError}
          </div>
        )}

        <section>
          <ModalSectionHeading
            icon={<SlidersHorizontal className="h-4 w-4" />}
            title="任务配置"
            description="选择待分析样本和分析流程，系统将根据匹配数据估算运行时长"
          />
          <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg-default mb-2">选择样本 *</label>
          <div className="relative mb-2">
            <Input placeholder="搜索样本编号或内部编号..." value={sampleSearch} onChange={(e) => setSampleSearch(e.target.value)} leftElement={<Search className="w-4 h-4" />} />
          </div>
          <div className="border border-border rounded-md max-h-40 overflow-y-auto">
            {filteredSamples.map(sample => (
              <div
                key={sample.id}
                onClick={() => setSelectedSample(sample)}
                className={`px-3 py-2 cursor-pointer transition-colors ${selectedSample?.id === sample.id ? 'bg-accent-subtle text-accent-fg' : 'hover:bg-canvas-subtle'}`}
              >
                <div className="text-sm font-mono">{sample.id.substring(0, 8)}...</div>
                <div className="text-xs text-fg-muted">
                  {sample.internalId}
                  {!sample.matchedPair ? ' · no matched_pair' : ''}
                </div>
              </div>
            ))}
            {filteredSamples.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-fg-muted">未找到匹配的样本</div>
            )}
          </div>
          {selectedSample && (
            <div className="mt-2 text-sm text-accent-fg">已选择: {selectedSample.internalId}</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-default mb-2">分析流程 *</label>
          <Select value={selectedPipeline} onChange={(v) => setSelectedPipeline(Array.isArray(v) ? v[0] : v)} options={pipelineOptions} placeholder="请选择分析流程" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border-default bg-canvas-subtle px-3 py-2.5">
            <p className="text-sm font-medium text-fg-default">系统预计耗时</p>
            <p className="mt-1 text-xs leading-5 text-fg-muted">按已匹配 R1/R2 的合计大小计算；数据未匹配时为 60 分钟。</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-default mb-2">上传任务 ID</label>
            <Input value={uploadJobId} onChange={(e) => setUploadJobId(e.target.value)} placeholder="上传任务 UUID（可选）" disabled={uploadingFiles} />
          </div>
        </div>

        {isSaaS && (
          <div className={`flex items-center justify-between gap-4 border-y py-3 ${insufficientCredits ? 'border-danger-muted' : 'border-border-default'}`}>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-accent-fg" />
              <div>
                <div className="text-sm font-medium text-fg-default">基础预估扣费 {estimatedCredits ?? '--'} 积分</div>
                <div className="text-xs text-fg-muted">按 60 分钟展示；提交后由系统按数据量确定预估</div>
              </div>
            </div>
            <div className="text-right">
              <div className={insufficientCredits ? 'text-sm font-medium text-danger-fg' : 'text-sm font-medium text-fg-default'}>
                余额 {billingBalance?.balance ?? '--'}
              </div>
              <Link href="/billing/recharge" className="text-xs text-accent-fg hover:underline">充值</Link>
            </div>
          </div>
        )}

          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<Database className="h-4 w-4" />}
            title="测序数据"
            description="可直接上传双端 FASTQ，上传完成后会自动关联到当前任务"
          />
        <div className="rounded-md border border-border bg-canvas-subtle p-3">
          <div className="mb-2 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-fg-default">双端 FASTQ 上传</div>
              <div className="text-xs text-fg-muted">
                上传 R1/R2 文件并自动填写上传任务 ID。
              </div>
            </div>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handlePairedUpload}
              disabled={!r1File || !r2File || uploadingFiles || submitting}
              leftIcon={uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            >
              {uploadingFiles ? `上传中 ${uploadProgress}%` : '上传双端文件'}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block rounded border border-dashed border-border bg-canvas-default px-3 py-2 text-xs text-fg-muted">
              <span className="block font-medium text-fg-default">R1 FASTQ</span>
              <span className="block truncate">{r1File?.name || '选择 R1 文件'}</span>
              <input
                type="file"
                accept=".fq,.fastq,.fq.gz,.fastq.gz,.gz"
                className="hidden"
                disabled={uploadingFiles || submitting}
                onChange={(e) => setR1File(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="block rounded border border-dashed border-border bg-canvas-default px-3 py-2 text-xs text-fg-muted">
              <span className="block font-medium text-fg-default">R2 FASTQ</span>
              <span className="block truncate">{r2File?.name || '选择 R2 文件'}</span>
              <input
                type="file"
                accept=".fq,.fastq,.fq.gz,.fastq.gz,.gz"
                className="hidden"
                disabled={uploadingFiles || submitting}
                onChange={(e) => setR2File(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          {uploadNotice && (
            <div className="mt-2 text-xs text-success-fg">{uploadNotice}</div>
          )}
        </div>

        {selectedSample && !selectedSample.matchedPair && !uploadJobID && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            当前样本未匹配测序数据，请先在样本详情绑定 R1/R2，或填写上传任务 ID。
          </div>
        )}
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<FileText className="h-4 w-4" />}
            title="备注"
            description="补充记录本次分析任务的说明信息"
          />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-fg-muted">备注内容</label>
          <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="请输入备注信息（可选）" />
        </div>
        </section>
      </div>
    </AppModal>
  );
}
