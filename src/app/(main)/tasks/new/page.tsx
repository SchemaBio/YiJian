'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { Button, Input, Select, FormItem, Checkbox } from '@schema/ui-kit';
import { Coins, Play, Info } from 'lucide-react';
import { tasksApi } from '@/lib/tasks';
import {
  pipelinesApi,
  samplesApi,
  type TaskPipelineOption,
  type TaskSampleListItem,
} from '@/lib/task-resources';
import { calculateEstimatedCredits, getBillingBalance, getBillingConfig, type BillingBalance, type BillingConfig } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { getPedigree, listPedigrees } from '@/lib/pedigrees';
import type { Pedigree } from '@/app/(main)/samples/pedigree/types';

export default function NewAnalysisPage() {
  const router = useRouter();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [samples, setSamples] = React.useState<TaskSampleListItem[]>([]);
  const [pipelines, setPipelines] = React.useState<TaskPipelineOption[]>([]);
  const [pedigrees, setPedigrees] = React.useState<Pedigree[]>([]);
  const [loadError, setLoadError] = React.useState('');
  const [selectedSample, setSelectedSample] = React.useState('');
  const [selectedPipeline, setSelectedPipeline] = React.useState('');
  const [selectedPedigree, setSelectedPedigree] = React.useState('');
  const [taskName, setTaskName] = React.useState('');
  const [enableCNV, setEnableCNV] = React.useState(true);
  const [enableSV, setEnableSV] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [billingBalance, setBillingBalance] = React.useState<BillingBalance | null>(null);
  const [billingConfig, setBillingConfig] = React.useState<BillingConfig | null>(null);

  const selectedSampleInfo = samples.find((sample) => sample.id === selectedSample);
  const selectedPipelineInfo = pipelines.find((pipeline) => pipeline.id === selectedPipeline);
  const selectedPedigreeInfo = pedigrees.find((pedigree) => pedigree.id === selectedPedigree);
  const isTrio = selectedPipelineInfo?.baseType === 'wes_family' || selectedPipelineInfo?.template === 'trio';

  React.useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [sampleOptions, pipelineOptions, pedigreeOptions] = await Promise.all([
          samplesApi.list({ page: 1, page_size: 100 }),
          pipelinesApi.list(),
          listPedigrees(),
        ]);
        const pedigreeDetails = (await Promise.all(pedigreeOptions.map((item) => getPedigree(item.id)))).filter((item): item is Pedigree => item !== null);
        if (cancelled) return;
        setSamples(sampleOptions);
        setPipelines(pipelineOptions);
        setPedigrees(pedigreeDetails);
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

  const estimatedCredits = calculateEstimatedCredits(60, billingConfig);
  const projectedBalance = billingBalance && estimatedCredits !== null
    ? billingBalance.balance - estimatedCredits
    : null;
  const insufficientCredits = projectedBalance !== null && billingConfig !== null
    && projectedBalance < billingConfig.min_balance;

  React.useEffect(() => {
    const subject = isTrio ? selectedPedigreeInfo?.internalId : (selectedSampleInfo?.internalId || selectedSampleInfo?.id);
    if (subject && selectedPipelineInfo) {
      setTaskName(`${subject} ${selectedPipelineInfo.name} 分析`);
    }
  }, [isTrio, selectedPedigreeInfo, selectedSampleInfo, selectedPipelineInfo]);

  const handleSubmit = async () => {
    setFormError('');
    if (!selectedPipelineInfo || (isTrio ? !selectedPedigreeInfo : !selectedSampleInfo)) {
      setFormError(isTrio ? '请选择符合父母-先证者结构的家系。' : '请选择样本和分析流程。');
      return;
    }
    setSubmitting(true);
    try {
      const task = await tasksApi.create({
        sampleId: isTrio ? '' : selectedSampleInfo!.id,
        pedigreeId: isTrio ? selectedPedigreeInfo!.id : undefined,
        internalId: isTrio ? selectedPedigreeInfo!.internalId : selectedSampleInfo!.internalId,
        pipelineId: selectedPipelineInfo.id,
        pipelineName: selectedPipelineInfo.name,
        pipelineVersion: selectedPipelineInfo.version,
        remark: taskName,
        inputs: {
          enable_cnv: enableCNV,
          enable_sv: enableSV,
        },
      });
      router.push(`/tasks/${encodeURIComponent(task.id)}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '创建分析任务失败');
    } finally {
      setSubmitting(false);
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

        {!isTrio && <FormItem label="样本" required>
          <Select
            options={samples.map((sample) => ({
              value: sample.id,
              label: `${sample.internalId || sample.id}${!sample.matchedPair ? '（等待测序数据）' : '（R1/R2 已就绪）'}`,
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
                <span className="text-warning-fg">任务创建后将等待测序数据</span>
              )}
            </div>
          )}
        </FormItem>}

        {isTrio && <FormItem label="家系（父母 + 先证者）" required>
          <Select
            options={pedigrees.map((pedigree) => {
              const proband = pedigree.members.find((member) => member.id === pedigree.probandId || member.relation === 'proband');
              const father = pedigree.members.find((member) => member.id === proband?.fatherId);
              const mother = pedigree.members.find((member) => member.id === proband?.motherId);
              const ready = Boolean(proband?.sampleId && father?.sampleId && mother?.sampleId);
              return { value: pedigree.id, label: `${pedigree.internalId}${ready ? '（三人样本已关联）' : '（家系不完整）'}`, disabled: !ready };
            })}
            value={selectedPedigree}
            onChange={(value) => setSelectedPedigree(Array.isArray(value) ? value[0] : value)}
            placeholder="选择已存在的父母-先证者家系"
            searchable
          />
          <div className="mt-2 text-xs text-fg-muted">系统将读取先证者及其父母关联的 R1/R2，并自动生成 PED 文件；完整性会由后端再次校验。</div>
        </FormItem>}

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

        <div className="rounded-md border border-border-default bg-canvas-subtle px-4 py-3">
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

        {!isTrio && selectedSampleInfo && (
          <div className={`rounded-md border px-4 py-3 ${selectedSampleInfo.matchedPair ? 'border-success-muted bg-success-subtle' : 'border-warning-muted bg-warning-subtle'}`}>
            <div className={`text-sm font-medium ${selectedSampleInfo.matchedPair ? 'text-success-fg' : 'text-warning-fg'}`}>
              {selectedSampleInfo.matchedPair ? 'R1/R2 已就绪' : '等待测序数据'}
            </div>
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              {selectedSampleInfo.matchedPair
                ? '任务创建后自动开始分析。'
                : '可以立即创建任务；样本自动或手动匹配到完整 R1/R2 后，任务会自动开始分析。'}
            </p>
          </div>
        )}

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
            disabled={!selectedPipelineInfo || (isTrio ? !selectedPedigreeInfo : !selectedSampleInfo)}
          >
            {submitting ? '提交中...' : '提交任务'}
          </Button>
        </div>
      </div>
    </PageContent>
  );
}
