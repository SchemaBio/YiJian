'use client';
import { useBusinessPermissions } from '@/components/providers/BusinessPermissionProvider';
import { RetentionNotice } from '@/components/shared/ResearchPolicy';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';

import { CheckCircle2, Coins, XCircle } from 'lucide-react';
import { AppModal, FilePicker } from '@/components/shared';
import { ApiError } from '@/lib/api';
import { calculateEstimatedCredits, getBillingBalance, getBillingConfig, notifyBillingUpdated, type BillingBalance, type BillingConfig } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { tasksApi, type TaskBatchCreateResponse, type TaskBatchInputRow, type TaskBatchPreviewResponse } from '@/lib/tasks';


interface BatchTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
}

function readableError(error: unknown, fallback: string, t: TextTranslator = chineseText) {
  if (error instanceof ApiError && error.data && typeof error.data === 'object' && 'error' in error.data) {
    const message = (error.data as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error instanceof Error ? errorText(error, t) : fallback;
}

function previewRowsToInput(preview: TaskBatchPreviewResponse): TaskBatchInputRow[] {
  return preview.rows.map((row) => ({
    row_number: row.row_number,
    sample_identifier: row.sample_identifier,
    pedigree_id: row.pedigree_id,
    pipeline_id: row.pipeline_id,
    remark: row.remark,
    vcf_asset_id: row.vcf_asset_id, vcf_sample_name: row.vcf_sample_name,
    enable_cnv: row.enable_cnv,
    enable_sv: row.enable_sv,
  }));
}

export function BatchTaskModal({ isOpen, onClose, onCompleted }: BatchTaskModalProps) {
  const t = useText();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const {hasPermission}=useBusinessPermissions();
  const [acknowledged,setAcknowledged]=React.useState(false);
  React.useEffect(()=>{if(isOpen)setAcknowledged(false);},[isOpen]);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<TaskBatchPreviewResponse | null>(null);
  const [result, setResult] = React.useState<TaskBatchCreateResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [billingBalance, setBillingBalance] = React.useState<BillingBalance | null>(null);
  const [billingConfig, setBillingConfig] = React.useState<BillingConfig | null>(null);

  React.useEffect(() => {
    if (!isOpen || !isSaaS) return;
    let cancelled = false;
    Promise.all([getBillingBalance(), getBillingConfig()])
      .then(([balance, config]) => {
        if (cancelled) return;
        setBillingBalance(balance);
        setBillingConfig(config);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen, isSaaS]);

  const estimatedCredits = preview
    ? calculateEstimatedCredits(preview.total_estimated_minutes, billingConfig)
    : null;
  const projectedBalance = billingBalance && estimatedCredits !== null
    ? billingBalance.balance - estimatedCredits
    : null;
  const insufficientCredits = projectedBalance !== null && billingConfig !== null
    && projectedBalance < billingConfig.min_balance;
  const canSubmit = Boolean(preview && preview.total_rows > 0 && preview.invalid_rows === 0 && !insufficientCredits && !submitting && hasPermission('tasks.manage') && (!isSaaS || acknowledged));

  const reset = () => {
    setAcknowledged(false);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setLoading(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (loading || submitting) return;
    reset();
    onClose();
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setPreview(null);
    setResult(null);
    setFile(file);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError(t("tasks.onlyXlsxFilesAreSupportedDownloadAnd07f71c"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t("tasks.xlsxFilesCannotExceedMbc6b278"));
      return;
    }
    setLoading(true);
    try {
      setPreview(await tasksApi.previewBatch(file));
    } catch (err) {
      setError(readableError(err, t("tasks.unableToParseBatchTaskFile6ced7b"), t));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview || !canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await tasksApi.createBatch(previewRowsToInput(preview));
      setResult(response);
      if (response.created_count > 0) {
        notifyBillingUpdated();
        await onCompleted();
      }
    } catch (err) {
      setError(readableError(err, t("tasks.unableToCreateTasksInBatchdac4da"), t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title={t("tasks.uploadTaskInformation")}
      size="large"
      closeOnOverlayClick={!loading && !submitting}
      closeOnEscape={!loading && !submitting}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading || submitting}>
            {result ? t("tasks.done33246f") : t("admin.cancel4d0b46")}
          </Button>
          {!result && (
            <Button permission="tasks.manage" variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? t("tasks.creatingTasksacfd5f") : t("tasks.confirmCreationf3ec88", {p0: String(preview?.valid_rows ? ` ${preview.valid_rows} 个任务` : '')})}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <RetentionNotice kind="task" acknowledgement={isSaaS?{checked:acknowledged,onChange:setAcknowledged,disabled:loading||submitting}:undefined} />
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">{t("tasks.xlsxOnlyUpToTasksAndMb792731")}</p>
          <FilePicker label={t("tasks.uploadTaskInformation")} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" file={file} onChange={selected => void handleFile(selected)} disabled={loading || submitting || !hasPermission('tasks.manage')} />
          {loading && <p role="status" className="text-sm text-fg-muted">{t("tasks.parsingAndValidating1ebd9d")}</p>}
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>
        )}

        {preview && !result && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-border-default bg-canvas-subtle px-3 py-2">
                <div className="text-xs text-fg-muted">{t("tasks.taskRows436d49")}</div>
                <div className="mt-1 text-lg font-semibold text-fg-default">{preview.total_rows}</div>
              </div>
              <div className="rounded-md border border-success-muted bg-success-subtle px-3 py-2">
                <div className="text-xs text-success-fg">{t("tasks.valid7035f8")}</div>
                <div className="mt-1 text-lg font-semibold text-success-fg">{preview.valid_rows}</div>
              </div>
              <div className={`rounded-md border px-3 py-2 ${preview.invalid_rows ? 'border-danger-muted bg-danger-subtle' : 'border-border-default bg-canvas-subtle'}`}>
                <div className={preview.invalid_rows ? 'text-xs text-danger-fg' : 'text-xs text-fg-muted'}>{t("tasks.invalidRowsda79eb")}</div>
                <div className={preview.invalid_rows ? 'mt-1 text-lg font-semibold text-danger-fg' : 'mt-1 text-lg font-semibold text-fg-default'}>{preview.invalid_rows}</div>
              </div>
              <div className="rounded-md border border-border-default bg-canvas-subtle px-3 py-2">
                <div className="text-xs text-fg-muted">{t("tasks.estimatedTotalRuntimeb46f2c")}</div>
                <div className="mt-1 text-lg font-semibold text-fg-default">{preview.total_estimated_minutes} {t("billing.minutes5b0acd")}</div>
              </div>
            </div>

            {isSaaS && (
              <div className={`flex flex-wrap items-center justify-between gap-4 rounded-md border px-4 py-3 ${insufficientCredits ? 'border-danger-muted bg-danger-subtle' : 'border-border-default bg-canvas-subtle'}`}>
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-accent-fg" />
                  <div>
                    <div className="text-sm font-medium text-fg-default">{t("tasks.estimatedTotalReservationf6d94f")}{estimatedCredits ?? '--'} {t("billing.creditse6d317")}</div>
                    <div className="text-xs text-fg-muted">{t("tasks.sumOfServerInputSizeEstimatesFinal35bfa2")}</div>
                  </div>
                </div>
                <div className={insufficientCredits ? 'text-sm font-medium text-danger-fg' : 'text-sm font-medium text-fg-default'}>
                  {t("tasks.balance239d15")}{billingBalance?.balance ?? '--'}
                </div>
              </div>
            )}

            <div className="max-h-72 overflow-auto rounded-md border border-border-default">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-canvas-subtle text-left text-xs text-fg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("tasks.excelRow7dca4b")}</th>
                    <th className="px-3 py-2 font-medium">{t("tasks.samplePedigree481e9d")}</th>
                    <th className="px-3 py-2 font-medium">{t("tasks.analysisPipelinef22c14")}</th>
                    <th className="px-3 py-2 font-medium">{t("tasks.estimatedRuntime22cbce")}</th>
                    <th className="px-3 py-2 font-medium">{t("tasks.validationResult804e07")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.row_number} className="border-t border-border-muted align-top">
                      <td className="px-3 py-2 tabular-nums">{row.row_number}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-fg-default">{row.sample_internal_id || row.pedigree_id || row.sample_identifier || '--'}</div>
                        {row.sample_id && <div className="mt-0.5 font-mono text-xs text-fg-muted">{row.sample_id}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-fg-default">{row.pipeline_name || row.pipeline_id}</div>
                        <div className="mt-0.5 font-mono text-xs text-fg-muted">{row.pipeline_id}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.valid ? t("settings.minutes121a50", {p0: String(row.estimated_minutes)}) : '--'}</td>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="inline-flex items-center gap-1 text-success-fg"><CheckCircle2 className="h-4 w-4" />{t("settings.approvedcc423")}</span>
                        ) : (
                          <div className="space-y-1 text-danger-fg">
                            {row.errors.map((message) => <div key={message} className="flex gap-1"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{message}</span></div>)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.invalid_rows > 0 && (
              <div className="text-xs leading-5 text-danger-fg">{t("tasks.correctInvalidRowsInExcelAndUpload15256b")}</div>
            )}
            {insufficientCredits && (
              <div className="text-xs leading-5 text-danger-fg">{t("tasks.insufficientBalanceForThisBatchReservationAdd91655b")}</div>
            )}
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`rounded-md border px-4 py-3 ${result.failed_count || result.skipped_count ? 'border-warning-muted bg-warning-subtle' : 'border-success-muted bg-success-subtle'}`}>
              <div className="text-sm font-semibold text-fg-default">{t("tasks.batchCreationCompletedd1deb0")}</div>
              <div className="mt-1 text-xs text-fg-muted">{t("tasks.successfulc06796")}{result.created_count} {t("tasks.failed0d08cf")}{result.failed_count} {t("tasks.skipped083ffe")}{result.skipped_count} {t("tasks.label347106")}</div>
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-border-default">
              {result.results.map((item) => (
                <div key={`${item.row_number}-${item.status}`} className="flex flex-wrap items-start justify-between gap-4 border-b border-border-muted px-3 py-2 text-sm last:border-b-0">
                  <div>
                    <span className="font-medium text-fg-default">{t("tasks.excelRow3da3c8")}{item.row_number || '--'} {t("tasks.label0a4e6b")}</span>
                    {item.task?.id && <span className="ml-2 break-all font-mono text-xs text-fg-muted">{item.task.id}</span>}
                    {item.error && <div className="mt-1 text-xs text-danger-fg">{item.error}</div>}
                  </div>
                  <span className={item.status === 'created' ? 'text-success-fg' : item.status === 'failed' ? 'text-danger-fg' : 'text-warning-fg'}>
                    {item.status === 'created' ? t("tasks.created62cfc5") : item.status === 'failed' ? t("admin.failed3e3c80") : t("tasks.skipped9f38af")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}
