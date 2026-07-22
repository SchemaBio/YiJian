'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { Button, Input, Select, FormItem, Checkbox } from '@schema/ui-kit';
import { Coins, Play, Info, Loader2, Upload } from 'lucide-react';
import { requestPairedUploadJob, uploadToCOS } from '@/lib/api';
import { tasksApi } from '@/lib/tasks';
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

export default function NewAnalysisPage() {
  const router = useRouter();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [samples, setSamples] = React.useState<TaskSampleListItem[]>([]);
  const [pipelines, setPipelines] = React.useState<TaskPipelineOption[]>([]);
  const [templates, setTemplates] = React.useState<TaskTemplateOption[]>([]);
  const [loadError, setLoadError] = React.useState('');
  const [selectedSample, setSelectedSample] = React.useState('');
  const [selectedPipeline, setSelectedPipeline] = React.useState('');
  const [taskName, setTaskName] = React.useState('');
  const [uploadJobId, setUploadJobId] = React.useState('');
  const [r1File, setR1File] = React.useState<File | null>(null);
  const [r2File, setR2File] = React.useState<File | null>(null);
  const [uploadingFiles, setUploadingFiles] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadNotice, setUploadNotice] = React.useState('');
  const [enableCNV, setEnableCNV] = React.useState(true);
  const [enableSV, setEnableSV] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(120);
  const [billingBalance, setBillingBalance] = React.useState<BillingBalance | null>(null);
  const [billingConfig, setBillingConfig] = React.useState<BillingConfig | null>(null);

  const selectedSampleInfo = samples.find((sample) => sample.id === selectedSample);
  const selectedPipelineInfo = pipelines.find((pipeline) => pipeline.id === selectedPipeline);
  const uploadJobID = uploadJobId.trim();
  const hasSequencingInput = Boolean(selectedSampleInfo?.matchedPair || uploadJobID);

  React.useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [sampleOptions, pipelineOptions, templateOptions] = await Promise.all([
          samplesApi.list({ page: 1, page_size: 100 }),
          pipelinesApi.list(),
          templatesApi.list().catch(() => []),
        ]);
        if (cancelled) return;
        setSamples(sampleOptions);
        setPipelines(pipelineOptions);
        setTemplates(templateOptions);
        setSelectedPipeline((current) => current || pipelineOptions[0]?.id || '');
        setLoadError('');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : '加载任务选项失败');
        }
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!isSaaS) return;
    let cancelled = false;
    Promise.all([getBillingBalance(), getBillingConfig()])
      .then(([nextBalance, nextConfig]) => {
        if (cancelled) return;
        setBillingBalance(nextBalance);
        setBillingConfig(nextConfig);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isSaaS]);

  const estimatedCredits = calculateEstimatedCredits(estimatedMinutes, billingConfig);
  const projectedBalance = billingBalance && estimatedCredits !== null
    ? billingBalance.balance - estimatedCredits
    : null;
  const insufficientCredits = projectedBalance !== null && billingConfig !== null
    && projectedBalance < billingConfig.min_balance;

  const resolvePipelineTemplate = React.useCallback((pipeline: TaskPipelineOption): string => {
    if (pipeline.template) return pipeline.template;
    const byBaseType: Record<string, string> = {
      wes_single: 'single',
      wes_family: 'trio',
      panel: 'panel',
    };
    const baseTemplate = pipeline.baseType ? byBaseType[pipeline.baseType] : '';
    if (baseTemplate && (templates.length === 0 || templates.some(template => template.name === baseTemplate))) {
      return baseTemplate;
    }

    const target = `${pipeline.id} ${pipeline.name}`.toLowerCase();
    const matchedTemplate = templates.find(template => target.includes(template.name.toLowerCase()));
    return matchedTemplate?.name || templates[0]?.name || '';
  }, [templates]);

  React.useEffect(() => {
    if (selectedSampleInfo && selectedPipelineInfo) {
      setTaskName(`${selectedSampleInfo.internalId || selectedSampleInfo.id} ${selectedPipelineInfo.name} 分析`);
    }
  }, [selectedSampleInfo, selectedPipelineInfo]);

  const handleSubmit = async () => {
    setFormError('');
    if (!selectedSampleInfo || !selectedPipelineInfo) {
      setFormError('请选择样本和分析流程。');
      return;
    }
    if (!hasSequencingInput) {
      setFormError('所选样本没有匹配的测序数据，请填写上传任务 ID 或上传双端 FASTQ 文件。');
      return;
    }
    const template = resolvePipelineTemplate(selectedPipelineInfo);
    if (!template) {
      setFormError('当前分析流程没有可用的 WDL 模板。');
      return;
    }

    setSubmitting(true);
    try {
      const task = await tasksApi.create({
        sampleId: selectedSampleInfo.id,
        internalId: selectedSampleInfo.internalId,
        pipelineId: selectedPipelineInfo.id,
        pipelineName: selectedPipelineInfo.name,
        pipelineVersion: selectedPipelineInfo.version,
        remark: taskName,
        template,
        inputs: {
          enable_cnv: enableCNV,
          enable_sv: enableSV,
        },
        ...(uploadJobID ? { uploadJobId: uploadJobID } : {}),
        estimatedMinutes,
      });
      router.push(`/tasks/${encodeURIComponent(task.id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建分析任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePairedUpload = async () => {
    if (!r1File || !r2File || uploadingFiles) {
      setFormError('请选择 R1 和 R2 FASTQ 文件后再上传。');
      return;
    }

    setUploadingFiles(true);
    setUploadProgress(0);
    setUploadNotice('');
    setFormError('');
    try {
      const job = await requestPairedUploadJob(r1File, r2File, selectedSampleInfo?.id);
      const r1 = job.files.find(file => file.read_type === 'read1');
      const r2 = job.files.find(file => file.read_type === 'read2');
      if (!r1 || !r2) {
        throw new Error('上传任务未返回完整的 R1/R2 上传地址');
      }

      await uploadToCOS(r1.upload_url, r1File, pct => setUploadProgress(Math.round(pct / 2)));
      await uploadToCOS(r2.upload_url, r2File, pct => setUploadProgress(50 + Math.round(pct / 2)));
      setUploadJobId(job.job_id);
      setUploadProgress(100);
      setUploadNotice(`上传任务 ${job.job_id} 已就绪`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '上传双端 FASTQ 文件失败');
    } finally {
      setUploadingFiles(false);
    }
  };

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <h2 className="yj-page-title">新建分析任务</h2>
      </div>

      <div className="yj-panel yj-form-card space-y-6">
        <div className="yj-info-panel">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-fg-muted" />
            <span className="text-sm font-medium text-fg-default">任务编号</span>
          </div>
          <p className="text-xs text-fg-muted">
            任务创建成功后自动分配 UUID。
          </p>
        </div>

        {loadError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {formError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <FormItem label="样本" required>
          <Select
            options={samples.map((sample) => ({
              value: sample.id,
              label: `${sample.internalId || sample.id}${!sample.matchedPair ? '（未匹配测序数据）' : ''}`,
            }))}
            value={selectedSample}
            onChange={(value) => setSelectedSample(Array.isArray(value) ? value[0] : value)}
            placeholder="选择样本"
            searchable
          />
          {selectedSampleInfo && (
            <div className="mt-2 text-xs text-fg-muted">
              {selectedSampleInfo.matchedPair ? (
                <span className="text-success-fg">测序数据已就绪</span>
              ) : (
                <span className="text-danger-fg">未匹配测序数据</span>
              )}
            </div>
          )}
        </FormItem>

        <FormItem label="分析流程" required>
          <Select
            options={pipelines.map((pipeline) => ({
              value: pipeline.id,
              label: `${pipeline.name}${pipeline.version ? ` (${pipeline.version})` : ''}`,
            }))}
            value={selectedPipeline}
            onChange={(value) => setSelectedPipeline(Array.isArray(value) ? value[0] : value)}
            placeholder="选择分析流程"
            searchable
          />
        </FormItem>

        <FormItem label="任务备注">
          <Input
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="任务备注（可选）"
          />
        </FormItem>

        <FormItem label="预计耗时（分钟）">
          <Input
            type="number"
            min="1"
            value={estimatedMinutes}
            onChange={(event) => setEstimatedMinutes(Math.max(1, Math.trunc(Number(event.target.value)) || 1))}
          />
        </FormItem>

        {isSaaS && (
          <div className={`flex items-center justify-between gap-4 border-y py-3 ${insufficientCredits ? 'border-danger-muted' : 'border-border-default'}`}>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-accent-fg" />
              <div>
                <div className="text-sm font-medium text-fg-default">预计扣费 {estimatedCredits ?? '--'} Credit</div>
                <div className="text-xs text-fg-muted">任务启动时预扣，完成后按实际运行时间结算</div>
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

        <div className="rounded-md border border-border bg-canvas-subtle p-3">
          <div className="mb-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-fg-default">双端 FASTQ 上传</div>
              <div className="text-xs text-fg-muted">
                可使用已完成的上传任务，或直接上传 R1/R2 文件。
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
            <label className="block text-xs text-fg-muted">
              上传任务 ID
              <Input
                value={uploadJobId}
                onChange={(e) => setUploadJobId(e.target.value)}
                placeholder="已完成的上传任务 UUID"
                disabled={uploadingFiles || submitting}
              />
            </label>
          </div>
          {uploadNotice && (
            <div className="mt-2 text-xs text-success-fg">{uploadNotice}</div>
          )}
          {selectedSampleInfo && !selectedSampleInfo.matchedPair && !uploadJobID && (
            <div className="mt-2 text-xs text-amber-700">
              当前样本未匹配测序数据，创建任务前需要填写有效的上传任务 ID。
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-fg-default mb-3">高级选项</h3>
          <div className="space-y-2">
            <Checkbox
              checked={enableCNV}
              onCheckedChange={(checked) => setEnableCNV(checked === true)}
              label="启用 CNV 分析"
            />
            <Checkbox
              checked={enableSV}
              onCheckedChange={(checked) => setEnableSV(checked === true)}
              label="启用 SV 分析"
            />
          </div>
        </div>

        <div className="pt-5 border-t border-[var(--yj-border-subtle)] flex items-center justify-end">
          <Button
            variant="primary"
            leftIcon={<Play className="w-4 h-4" />}
            onClick={handleSubmit}
            loading={submitting}
            disabled={!hasSequencingInput || !selectedPipelineInfo || uploadingFiles}
          >
            {submitting ? '提交中...' : '提交任务'}
          </Button>
        </div>
      </div>
    </PageContent>
  );
}
