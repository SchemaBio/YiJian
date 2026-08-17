'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, Input, Select } from '@schema/ui-kit';
import { Coins, Search, Loader2, SlidersHorizontal, Database, FileText } from 'lucide-react';
import { AppModal, ModalSectionHeading } from '@/components/shared';
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
  const [remark, setRemark] = React.useState('');
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
    if (!selectedSample || !selectedPipeline || submitting) return;

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
      });
      handleClose();
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : '创建任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setSampleSearch('');
    setSelectedSample(null);
    setSelectedPipeline('');
    setRemark('');
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
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>取消</Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loadingResources || submitting || !selectedSample || !selectedPipeline}
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
                  {!sample.matchedPair ? ' · 等待测序数据' : ' · R1/R2 已就绪'}
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

        <div className="rounded-md border border-border-default bg-canvas-subtle px-3 py-2.5">
          <p className="text-sm font-medium text-fg-default">系统预计耗时</p>
          <p className="mt-1 text-xs leading-5 text-fg-muted">按样本关联的 R1/R2 数据量计算；等待数据时使用基础预估。</p>
        </div>

        {isSaaS && (
          <div className={`flex items-center justify-between gap-4 border-y py-3 ${insufficientCredits ? 'border-danger-muted' : 'border-border-default'}`}>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-accent-fg" />
              <div>
                <div className="text-sm font-medium text-fg-default">预计预扣 {estimatedCredits ?? '--'} 积分</div>
                <div className="text-xs text-fg-muted">按 60 分钟展示；最终按实际运行分钟结算</div>
              </div>
            </div>
            <div className="text-right">
              <div className={insufficientCredits ? 'text-sm font-medium text-danger-fg' : 'text-sm font-medium text-fg-default'}>
                余额 {billingBalance?.balance ?? '--'}
              </div>
              <div className="flex items-center justify-end gap-3 text-xs">
                <Link href="/billing" className="text-accent-fg hover:underline">计费规则</Link>
                <Link href="/billing/recharge" className="text-accent-fg hover:underline">充值</Link>
              </div>
            </div>
          </div>
        )}

          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<Database className="h-4 w-4" />}
            title="测序数据"
            description="任务始终读取样本当前生效的 R1/R2 数据关联"
          />
          {selectedSample ? (
            <div className={`rounded-md border px-3 py-3 ${selectedSample.matchedPair ? 'border-success-muted bg-success-subtle' : 'border-warning-muted bg-warning-subtle'}`}>
              <div className={`text-sm font-medium ${selectedSample.matchedPair ? 'text-success-fg' : 'text-warning-fg'}`}>
                {selectedSample.matchedPair ? 'R1/R2 已就绪' : '任务将等待测序数据'}
              </div>
              <div className="mt-1 text-xs leading-5 text-fg-muted">
                {selectedSample.matchedPair
                  ? '创建后任务自动开始分析。'
                  : '样本自动或手动匹配到完整 R1/R2 后，任务会自动开始分析。'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-fg-muted">选择样本后显示数据就绪状态。</div>
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
