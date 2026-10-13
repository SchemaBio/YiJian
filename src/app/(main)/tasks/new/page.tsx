'use client';
import { LocalizedError } from '@/i18n/errors';

import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { pipelineDisplayName } from '@/lib/builtin-resources';


import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { Input, Select, FormItem, Checkbox } from '@schema/ui-kit';
import { Coins, AlertTriangle } from 'lucide-react';
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
  const t = useText();
  const router = useRouter();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [samples, setSamples] = React.useState<TaskSampleListItem[]>([]);
  const [pipelines, setPipelines] = React.useState<TaskPipelineOption[]>([]);
  const [pedigrees, setPedigrees] = React.useState<Pedigree[]>([]);
  const pedigreeCache = React.useRef<Pedigree[] | null>(null);
  const [loadError, setLoadError] = React.useState('');
  const [familyError, setFamilyError] = React.useState('');
  const [optionsRetry, setOptionsRetry] = React.useState(0);
  const [optionsLoading, setOptionsLoading] = React.useState(true);
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
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(60);
  const [estimateStatus, setEstimateStatus] = React.useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');

  const selectedSampleInfo = samples.find((sample) => sample.id === selectedSample);
  const selectedPipelineInfo = pipelines.find((pipeline) => pipeline.id === selectedPipeline);
  const selectedPedigreeInfo = pedigrees.find((pedigree) => pedigree.id === selectedPedigree);
  const isTrio = selectedPipelineInfo?.baseType === 'wes_family' || selectedPipelineInfo?.template === 'trio';

  React.useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const [sampleOptions, pipelineOptions] = await Promise.all([
          samplesApi.list({ page: 1, page_size: 100 }),
          pipelinesApi.list(),
        ]);
        if (cancelled) return;
        setSamples(sampleOptions);
        setPipelines(pipelineOptions);
        setSelectedPipeline((current) => current || pipelineOptions[0]?.id || '');
        setLoadError('');
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? errorText(err, t) : t("tasks.unableToLoadTaskOptionsa4066d"));
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [optionsRetry]);

  React.useEffect(() => {
    if (!isTrio || pedigreeCache.current !== null) return;
    let cancelled = false;
    setFamilyError('');
    listPedigrees()
      .then(items => Promise.all(items.map(item => getPedigree(item.id))))
      .then(items => {
        if (cancelled) return;
        const details = items.filter((item): item is Pedigree => item !== null);
        pedigreeCache.current = details;
        setPedigrees(details);
      })
      .catch(err => {
        if (!cancelled) setFamilyError(err instanceof Error ? errorText(err, t) : t("tasks.unableToLoadPedigreeOptionsc1568c"));
      });
    return () => { cancelled = true; };
  }, [isTrio, optionsRetry]);

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

  React.useEffect(() => {
    const pipelineId = selectedPipelineInfo?.id;
    const sampleId = isTrio ? undefined : selectedSampleInfo?.id;
    const pedigreeId = isTrio ? selectedPedigreeInfo?.id : undefined;
    if (!pipelineId || (!sampleId && !pedigreeId)) {
      setEstimatedMinutes(60);
      setEstimateStatus('idle');
      return;
    }

    let cancelled = false;
    setEstimateStatus('loading');
    tasksApi.estimate({ sampleId, pedigreeId, pipelineId })
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
  }, [isTrio, selectedPedigreeInfo?.id, selectedPipelineInfo?.id, selectedSampleInfo?.id]);

  const estimatedCredits = estimateStatus === 'idle' || estimateStatus === 'loading'
    ? null
    : calculateEstimatedCredits(estimatedMinutes, billingConfig);
  const projectedBalance = billingBalance && estimatedCredits !== null
    ? billingBalance.balance - estimatedCredits
    : null;
  const insufficientCredits = projectedBalance !== null && billingConfig !== null
    && projectedBalance < billingConfig.min_balance;

  React.useEffect(() => {
    const subject = isTrio ? selectedPedigreeInfo?.internalId : (selectedSampleInfo?.internalId || selectedSampleInfo?.id);
    if (subject && selectedPipelineInfo) {
      setTaskName(t("tasks.analysis8a0847", {p0: String(subject), p1: String(selectedPipelineInfo.name)}));
    }
  }, [isTrio, selectedPedigreeInfo, selectedSampleInfo, selectedPipelineInfo]);

  const handleSubmit = async () => {
    setFormError('');
    if (!selectedPipelineInfo || (isTrio ? !selectedPedigreeInfo : !selectedSampleInfo)) {
      setFormError(isTrio ? t("tasks.selectAPedigreeContainingParentsAndProbandc87287") : t("tasks.selectASampleAndAnalysisPipeline53d997"));
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
      setFormError(err instanceof Error ? errorText(err, t) : t("tasks.unableToCreateAnalysisTaskf869b5"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <h2 className="yj-page-title">{t("tasks.newAnalysisTask1d4697")}</h2>
      </div>

      {isSaaS && <aside role="note" aria-label={t("tasks.bamRetentionPeriodaed91e")} className="mb-5 flex items-start gap-3 rounded-md border border-warning-muted bg-warning-subtle px-4 py-4 text-warning-fg">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div><h3 className="text-sm font-semibold">{t("tasks.bamFilesAreRetainedForDaysAfter742e02")}</h3><p className="mt-1 text-sm leading-6">{t("tasks.expiredBamFilesAreDeletedAndCannot78d4ce")}</p><p className="mt-1 text-xs">{t("tasks.resultTablesAndSavedManualInterpretationsRemain29352c")}</p></div>
      </aside>}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="yj-panel min-w-0 space-y-5 p-5">
        {(loadError || (isTrio && familyError)) && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
            <span>{loadError || familyError}</span>
            <Button action="retry" variant="secondary" size="small" disabled={optionsLoading} onClick={() => setOptionsRetry(value => value + 1)}>{t("billing.retryLoading7b4939")}</Button>
          </div>
        )}

        {formError && (
          <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
            {formError}
          </div>
        )}

        {!isTrio && <FormItem label={t("history.sample610da8")} required>
          <Select
            options={samples.map((sample) => ({
              value: sample.id,
              label: `${sample.internalId || sample.id}${!sample.matchedPair ? t("tasks.awaitingSequencingData3a9d51") : t("tasks.rRReady51ae02")}`,
            }))}
            value={selectedSample}
            onChange={(value) => setSelectedSample(Array.isArray(value) ? value[0] : value)}
            placeholder={t("samples.selectSamplef0e89f")}
            searchable
          />
        </FormItem>}

        {isTrio && <FormItem label={t("tasks.pedigreeParentsProband5d1fa4")} required>
          <Select
            options={pedigrees.map((pedigree) => {
              const proband = pedigree.members.find((member) => member.id === pedigree.probandId || member.relation === 'proband');
              const father = pedigree.members.find((member) => member.id === proband?.fatherId);
              const mother = pedigree.members.find((member) => member.id === proband?.motherId);
              const ready = Boolean(proband?.sampleId && father?.sampleId && mother?.sampleId);
              return { value: pedigree.id, label: `${pedigree.internalId}${ready ? t("tasks.threeSamplesLinked6adf03") : t("tasks.incompletePedigree17b6c3")}`, disabled: !ready };
            })}
            value={selectedPedigree}
            onChange={(value) => setSelectedPedigree(Array.isArray(value) ? value[0] : value)}
            placeholder={t("tasks.selectAnExistingParentsProbandPedigree0bd878")}
            searchable
          />
          <div className="mt-2 text-xs text-fg-muted">{t("tasks.sequencingDataFromTheProbandAndBoth16349c")}</div>
        </FormItem>}

        <FormItem label={t("tasks.analysisPipelinef22c14")} required>
          <Select
            options={pipelines.map((pipeline) => ({
              value: pipeline.id,
              label: `${pipelineDisplayName(pipeline.id, pipeline.name, t)}${pipeline.version ? ` (${pipeline.version})` : ''}`,
            }))}
            value={selectedPipeline}
            onChange={(value) => setSelectedPipeline(Array.isArray(value) ? value[0] : value)}
            placeholder={t("tasks.selectAnalysisPipeline196adf")}
            searchable
          />
        </FormItem>

        <FormItem label={t("tasks.taskNotesd34f05")}>
          <Input
            aria-label={t("tasks.taskNotesd34f05")}
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder={t("tasks.taskNotesOptional477837")}
          />
        </FormItem>

        <div>
          <h3 className="text-sm font-medium text-fg-default mb-3">{t("tasks.advancedOptions378a54")}</h3>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <Checkbox
              checked={enableCNV}
              onCheckedChange={(checked) => setEnableCNV(checked === true)}
              label={t("tasks.enableCnvAnalysisf42731")}
            />
            <Checkbox
              checked={enableSV}
              onCheckedChange={(checked) => setEnableSV(checked === true)}
              label={t("tasks.enableSvAnalysisc73efc")}
            />
          </div>
        </div>

      </section>
      <aside className="yj-panel min-w-0 space-y-5 p-5" aria-label={t("tasks.taskEstimateAndSubmission7f6c48")}>
        <div className="border-b border-border-default pb-4">
          <p className="text-sm font-medium text-fg-default">{t("tasks.estimatedRuntime46b89b")}</p>
          <p className="mt-1 text-xs leading-5 text-fg-muted">
            {estimateStatus === 'loading'
              ? t("tasks.estimatingFromSelectedInput244ab0")
              : estimateStatus === 'ready'
                ? t("tasks.estimatedMinutesBasedOnLinkedRR037883", {p0: String(estimatedMinutes)})
                : estimateStatus === 'fallback'
                  ? t("tasks.estimationUnavailableUsingTheBasicMinuteEstimatef3a858")
                  : t("tasks.selectASampleOrPedigreeAndPipeline3b5654")}
          </p>
        </div>

        {isSaaS && (
          <div className={`flex flex-wrap items-center justify-between gap-4 border-b pb-4 ${insufficientCredits ? 'border-danger-muted' : 'border-border-default'}`}>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-accent-fg" />
              <div>
                <div className="text-sm font-medium text-fg-default">{t("tasks.estimatedReservationaa9641")}{estimatedCredits ?? '--'} {t("billing.creditse6d317")}</div>
                <div className="text-xs text-fg-muted">
                  {t("tasks.finalSettlementUsesActualRuntime296a82")}</div>
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

        {!isTrio && selectedSampleInfo && (
          <div className={`rounded-md border px-4 py-3 ${selectedSampleInfo.matchedPair ? 'border-success-muted bg-success-subtle' : 'border-warning-muted bg-warning-subtle'}`}>
            <div className={`text-sm font-medium ${selectedSampleInfo.matchedPair ? 'text-success-fg' : 'text-warning-fg'}`}>
              {selectedSampleInfo.matchedPair ? t("tasks.rRReady9c9d5e") : t("common.awaitingSequencingData844492")}
            </div>
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              {selectedSampleInfo.matchedPair
                ? t("tasks.analysisStartsAutomaticallyAfterTaskCreation262d0e")
                : t("tasks.youMayCreateTheTaskNowAnalysis400a3f")}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button action="start"
            variant="primary"
            className="w-full"

            onClick={handleSubmit}
            loading={submitting}
            disabled={!selectedPipelineInfo || (isTrio ? !selectedPedigreeInfo : !selectedSampleInfo)}
          >
            {submitting ? t("tasks.submitting3a1624") : t("tasks.submitTask09de9e")}
          </Button>
        </div>
      </aside>
      </div>
    </PageContent>
  );
}
