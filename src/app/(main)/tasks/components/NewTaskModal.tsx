'use client';
import { LocalizedError } from '@/i18n/errors';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { pipelineDisplayName } from '@/lib/builtin-resources';


import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import Link from 'next/link';
import { Input, Select } from '@schema/ui-kit';
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
import { tasksApi } from '@/lib/tasks';

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
  const t = useText();
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
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(60);
  const [estimateStatus, setEstimateStatus] = React.useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');

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
          setResourceError(err instanceof Error ? errorText(err, t) : t("tasks.unableToLoadTaskResources12ee7c"));
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
        label: `${pipelineDisplayName(p.id, p.name, t)}${p.version ? ` (${p.version})` : ''}`,
      }));
    }
    return templates.map(t => ({
      value: t.name,
      label: t.displayName && t.displayName !== t.name ? `${t.displayName} (${t.name})` : t.name,
    }));
  }, [pipelines, templates, t]);

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

  React.useEffect(() => {
    const pipeline = pipelines.find(item => item.id === selectedPipeline);
    if (!selectedSample?.id || !pipeline?.id) {
      setEstimatedMinutes(60);
      setEstimateStatus('idle');
      return;
    }

    let cancelled = false;
    setEstimateStatus('loading');
    tasksApi.estimate({ sampleId: selectedSample.id, pipelineId: pipeline.id })
      .then((estimate) => {
        if (cancelled) return;
        const minutes = Math.max(1, Math.ceil(Number(estimate.estimated_minutes)));
        if (!Number.isFinite(minutes)) throw new LocalizedError("interface.invalidTaskEstimateb0d35f", undefined, "Invalid task estimate");
        setEstimatedMinutes(minutes);
        setEstimateStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setEstimatedMinutes(60);
        setEstimateStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, [pipelines, selectedPipeline, selectedSample?.id]);

  const estimatedCredits = estimateStatus === 'idle' || estimateStatus === 'loading'
    ? null
    : calculateEstimatedCredits(estimatedMinutes, billingConfig);
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
      setResourceError(err instanceof Error ? errorText(err, t) : t("tasks.unableToCreateTaskc0144e"));
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
      title={t("tasks.newAnalysisTask1d4697")}
      size="large"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>{t("admin.cancel4d0b46")}</Button>
          <Button action="add" loading={submitting} loadingLabel={t("pipeline.creating8c6348")}
            variant="primary"
            onClick={handleSubmit}
            disabled={loadingResources || submitting || !selectedSample || !selectedPipeline}

          >
            {t("tasks.createTaskcf42fd")}</Button>
        </>
      }
    >
      <div className="space-y-6">
        {loadingResources && (
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("tasks.loadingSamplesAndPipelinesfebc8d")}</div>
        )}
        {resourceError && (
          <div className="text-sm text-danger-fg bg-danger-subtle border border-danger-emphasis rounded-md px-3 py-2">
            {resourceError}
          </div>
        )}

        <section>
          <ModalSectionHeading
            icon={<SlidersHorizontal className="h-4 w-4" />}
            title={t("tasks.taskSettings9323d0")}
            description={t("tasks.selectASampleAndPipelineRuntimeIs8d0a44")}
          />
          <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-fg-default mb-2">{t("tasks.selectSample47fc82")}</label>
          <div className="relative mb-2">
            <Input placeholder={t("tasks.searchSampleOrInternalId698a41")} value={sampleSearch} onChange={(e) => setSampleSearch(e.target.value)} leftElement={<Search className="w-4 h-4" />} />
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
                  {!sample.matchedPair ? t("tasks.awaitingSequencingData4671bd") : t("tasks.rRReady50a422")}
                </div>
              </div>
            ))}
            {filteredSamples.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-fg-muted">{t("samples.noMatchingSamplesc0d84a")}</div>
            )}
          </div>
          {selectedSample && (
            <div className="mt-2 text-sm text-accent-fg">{t("tasks.selected34a0eb")}{selectedSample.internalId}</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-fg-default mb-2">{t("tasks.analysisPipeline22bb4b")}</label>
          <Select value={selectedPipeline} onChange={(v) => setSelectedPipeline(Array.isArray(v) ? v[0] : v)} options={pipelineOptions} placeholder={t("tasks.selectAnAnalysisPipeline6634d0")} />
        </div>

        <div className="rounded-md border border-border-default bg-canvas-subtle px-3 py-2.5">
          <p className="text-sm font-medium text-fg-default">{t("tasks.estimatedRuntime46b89b")}</p>
          <p className="mt-1 text-xs leading-5 text-fg-muted">
            {estimateStatus === 'loading'
              ? t("tasks.estimatingFromSelectedInput244ab0")
              : estimateStatus === 'ready'
                ? t("tasks.estimatedMinutesBasedOnLinkedRR037883", {p0: String(estimatedMinutes)})
                : estimateStatus === 'fallback'
                  ? t("tasks.estimationUnavailableUsingTheBasicMinuteEstimatef3a858")
                  : t("tasks.selectASampleAndPipelineToEstimate04c387")}
          </p>
        </div>

        {isSaaS && (
          <div className={`flex items-center justify-between gap-4 border-y py-3 ${insufficientCredits ? 'border-danger-muted' : 'border-border-default'}`}>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-accent-fg" />
              <div>
                <div className="text-sm font-medium text-fg-default">{t("tasks.estimatedReservationaa9641")}{estimatedCredits ?? '--'} {t("billing.creditse6d317")}</div>
                <div className="text-xs text-fg-muted">
                  {estimateStatus === 'loading'
                    ? t("tasks.calculatingReservationFinalSettlementUsesActualRuntime65b79b")
                    : estimateStatus === 'ready'
                      ? t("tasks.basedOnTheServerEstimateOfMinutes5ccf25", {p0: String(estimatedMinutes)})
                      : estimateStatus === 'fallback'
                        ? t("tasks.basedOnTheBasicMinuteEstimateFinal595562")
                        : t("tasks.selectInputAndPipelineToCalculateThe42aed3")}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={insufficientCredits ? 'text-sm font-medium text-danger-fg' : 'text-sm font-medium text-fg-default'}>
                {t("tasks.balance239d15")}{billingBalance?.balance ?? '--'}
              </div>
              <div className="flex items-center justify-end gap-3 text-xs">
                <Link href="/billing" className="text-accent-fg hover:underline">{t("settings.billingRulesab2727")}</Link>
                <Link href="/billing/recharge" className="text-accent-fg hover:underline">{t("billing.addCreditsfa03c4")}</Link>
              </div>
            </div>
          </div>
        )}

          </div>
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<Database className="h-4 w-4" />}
            title={t("samples.sequencingDataef4c3a")}
            description={t("tasks.tasksAlwaysUseTheSampleCurrentEffective938efe")}
          />
          {selectedSample ? (
            <div className={`rounded-md border px-3 py-3 ${selectedSample.matchedPair ? 'border-success-muted bg-success-subtle' : 'border-warning-muted bg-warning-subtle'}`}>
              <div className={`text-sm font-medium ${selectedSample.matchedPair ? 'text-success-fg' : 'text-warning-fg'}`}>
                {selectedSample.matchedPair ? t("tasks.rRReady9c9d5e") : t("tasks.taskWillAwaitSequencingDataa6dc7f")}
              </div>
              <div className="mt-1 text-xs leading-5 text-fg-muted">
                {selectedSample.matchedPair
                  ? t("tasks.analysisStartsAutomaticallyAfterCreation30cb09")
                  : t("tasks.analysisStartsWhenACompleteRRc928c2")}
              </div>
            </div>
          ) : (
            <div className="text-sm text-fg-muted">{t("tasks.selectASampleToSeeDataReadiness9eb3aa")}</div>
          )}
        </section>

        <section className="border-t border-[var(--yj-border-subtle)] pt-5">
          <ModalSectionHeading
            icon={<FileText className="h-4 w-4" />}
            title={t("admin.notese03614")}
            description={t("tasks.addNotesForThisAnalysisTaskd56408")}
          />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-fg-muted">{t("samples.notes11abee")}</label>
          <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={t("tasks.enterOptionalNotes168748")} />
        </div>
        </section>
      </div>
    </AppModal>
  );
}
