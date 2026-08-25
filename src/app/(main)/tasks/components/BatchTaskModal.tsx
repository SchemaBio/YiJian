'use client';

import * as React from 'react';
import { Button } from '@schema/ui-kit';
import { CheckCircle2, Coins, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { AppModal } from '@/components/shared';
import { ApiError } from '@/lib/api';
import { calculateEstimatedCredits, getBillingBalance, getBillingConfig, notifyBillingUpdated, type BillingBalance, type BillingConfig } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { tasksApi, type TaskBatchCreateResponse, type TaskBatchInputRow, type TaskBatchPreviewResponse } from '@/lib/tasks';

const TASK_BATCH_TEMPLATE_URL = '/outputs/01a033ef-28c3-7ce2-83fa-633c8032fc26/task-batch-import-template.xlsx';

interface BatchTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.data && typeof error.data === 'object' && 'error' in error.data) {
    const message = (error.data as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error instanceof Error ? error.message : fallback;
}

function previewRowsToInput(preview: TaskBatchPreviewResponse): TaskBatchInputRow[] {
  return preview.rows.map((row) => ({
    row_number: row.row_number,
    sample_identifier: row.sample_identifier,
    pedigree_id: row.pedigree_id,
    pipeline_id: row.pipeline_id,
    remark: row.remark,
    enable_cnv: row.enable_cnv,
    enable_sv: row.enable_sv,
  }));
}

export function BatchTaskModal({ isOpen, onClose, onCompleted }: BatchTaskModalProps) {
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState('');
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
  const canSubmit = Boolean(preview && preview.total_rows > 0 && preview.invalid_rows === 0 && !insufficientCredits && !submitting);

  const reset = () => {
    setFileName('');
    setPreview(null);
    setResult(null);
    setError('');
    setLoading(false);
    setSubmitting(false);
    if (inputRef.current) inputRef.current.value = '';
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
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('仅支持 .xlsx 文件，请下载并填写平台模板。');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('XLSX 文件不能超过 2 MB。');
      return;
    }
    setLoading(true);
    try {
      setPreview(await tasksApi.previewBatch(file));
    } catch (err) {
      setError(readableError(err, '解析批量任务文件失败'));
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
      setError(readableError(err, '批量创建任务失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title="批量新建分析任务"
      size="large"
      closeOnOverlayClick={!loading && !submitting}
      closeOnEscape={!loading && !submitting}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading || submitting}>
            {result ? '完成' : '取消'}
          </Button>
          {!result && (
            <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? '正在批量创建…' : `确认创建${preview?.valid_rows ? ` ${preview.valid_rows} 个任务` : ''}`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={TASK_BATCH_TEMPLATE_URL}
            download="贻鉴-批量任务导入模板.xlsx"
            className="flex min-h-24 items-center gap-3 rounded-md border border-border-default bg-canvas-subtle px-4 py-3 transition-colors hover:border-accent-muted hover:bg-accent-subtle"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-canvas-default text-accent-fg">
              <Download className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-fg-default">下载 XLSX 模板</span>
              <span className="mt-1 block text-xs leading-5 text-fg-muted">包含填写说明、内置流程 ID 和布尔值下拉选项</span>
            </span>
          </a>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading || submitting}
            className="flex min-h-24 items-center gap-3 rounded-md border border-dashed border-border-default bg-canvas-default px-4 py-3 text-left transition-colors hover:border-accent-muted hover:bg-accent-subtle disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-canvas-subtle text-accent-fg">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </span>
            <span>
              <span className="block text-sm font-semibold text-fg-default">{loading ? '正在解析并校验…' : '上传已填写模板'}</span>
              <span className="mt-1 block text-xs leading-5 text-fg-muted">仅支持 XLSX，最多 100 个任务、2 MB</span>
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>

        {fileName && (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <FileSpreadsheet className="h-4 w-4" />
            当前文件：<span className="font-medium text-fg-default">{fileName}</span>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>
        )}

        {preview && !result && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-border-default bg-canvas-subtle px-3 py-2">
                <div className="text-xs text-fg-muted">任务行数</div>
                <div className="mt-1 text-lg font-semibold text-fg-default">{preview.total_rows}</div>
              </div>
              <div className="rounded-md border border-success-muted bg-success-subtle px-3 py-2">
                <div className="text-xs text-success-fg">校验通过</div>
                <div className="mt-1 text-lg font-semibold text-success-fg">{preview.valid_rows}</div>
              </div>
              <div className={`rounded-md border px-3 py-2 ${preview.invalid_rows ? 'border-danger-muted bg-danger-subtle' : 'border-border-default bg-canvas-subtle'}`}>
                <div className={preview.invalid_rows ? 'text-xs text-danger-fg' : 'text-xs text-fg-muted'}>错误行</div>
                <div className={preview.invalid_rows ? 'mt-1 text-lg font-semibold text-danger-fg' : 'mt-1 text-lg font-semibold text-fg-default'}>{preview.invalid_rows}</div>
              </div>
              <div className="rounded-md border border-border-default bg-canvas-subtle px-3 py-2">
                <div className="text-xs text-fg-muted">预计总耗时</div>
                <div className="mt-1 text-lg font-semibold text-fg-default">{preview.total_estimated_minutes} 分钟</div>
              </div>
            </div>

            {isSaaS && (
              <div className={`flex items-center justify-between gap-4 rounded-md border px-4 py-3 ${insufficientCredits ? 'border-danger-muted bg-danger-subtle' : 'border-border-default bg-canvas-subtle'}`}>
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-accent-fg" />
                  <div>
                    <div className="text-sm font-medium text-fg-default">预计合计预扣 {estimatedCredits ?? '--'} 积分</div>
                    <div className="text-xs text-fg-muted">按各任务的后端数据量估算求和；最终按实际运行分钟结算</div>
                  </div>
                </div>
                <div className={insufficientCredits ? 'text-sm font-medium text-danger-fg' : 'text-sm font-medium text-fg-default'}>
                  余额 {billingBalance?.balance ?? '--'}
                </div>
              </div>
            )}

            <div className="max-h-72 overflow-auto rounded-md border border-border-default">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-canvas-subtle text-left text-xs text-fg-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Excel 行</th>
                    <th className="px-3 py-2 font-medium">样本/家系</th>
                    <th className="px-3 py-2 font-medium">分析流程</th>
                    <th className="px-3 py-2 font-medium">预计耗时</th>
                    <th className="px-3 py-2 font-medium">校验结果</th>
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
                      <td className="px-3 py-2 whitespace-nowrap">{row.valid ? `${row.estimated_minutes} 分钟` : '--'}</td>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="inline-flex items-center gap-1 text-success-fg"><CheckCircle2 className="h-4 w-4" />通过</span>
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
              <div className="text-xs leading-5 text-danger-fg">请在 Excel 中修正错误行后重新上传。存在错误时不会创建任何任务。</div>
            )}
            {insufficientCredits && (
              <div className="text-xs leading-5 text-danger-fg">余额不足以覆盖本批次预计预扣，请充值或减少任务行数。</div>
            )}
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`rounded-md border px-4 py-3 ${result.failed_count || result.skipped_count ? 'border-warning-muted bg-warning-subtle' : 'border-success-muted bg-success-subtle'}`}>
              <div className="text-sm font-semibold text-fg-default">批量创建已完成</div>
              <div className="mt-1 text-xs text-fg-muted">成功 {result.created_count} 个，失败 {result.failed_count} 个，跳过 {result.skipped_count} 个。</div>
            </div>
            <div className="max-h-72 overflow-auto rounded-md border border-border-default">
              {result.results.map((item) => (
                <div key={`${item.row_number}-${item.status}`} className="flex items-start justify-between gap-4 border-b border-border-muted px-3 py-2 text-sm last:border-b-0">
                  <div>
                    <span className="font-medium text-fg-default">Excel 第 {item.row_number || '--'} 行</span>
                    {item.task?.id && <span className="ml-2 font-mono text-xs text-fg-muted">{item.task.id}</span>}
                    {item.error && <div className="mt-1 text-xs text-danger-fg">{item.error}</div>}
                  </div>
                  <span className={item.status === 'created' ? 'text-success-fg' : item.status === 'failed' ? 'text-danger-fg' : 'text-warning-fg'}>
                    {item.status === 'created' ? '已创建' : item.status === 'failed' ? '失败' : '已跳过'}
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
