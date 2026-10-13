'use client';
import { useText } from '@/i18n/useText';



import * as React from 'react';
import Link from 'next/link';
import { Coins, Loader2 } from 'lucide-react';
import { BILLING_UPDATED_EVENT, getTaskBilling, type TaskBillingSummary } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

interface TaskCostValueProps {
  summary?: TaskBillingSummary;
  loading?: boolean;
}

export function TaskCostValue({ summary, loading = false }: TaskCostValueProps) {
  const t = useText();
  if (loading) {
    return <Loader2 className="mx-auto h-4 w-4 animate-spin text-fg-muted" />;
  }
  if (!summary || summary.transactionCount === 0) {
    return <span className="text-xs text-fg-muted">{t("billing.notCharged01d9e0")}</span>;
  }

  const fullyRefunded = summary.deducted > 0 && summary.netCost === 0;
  return (
    <div className="text-center">
      <div className="font-medium text-fg-default">{summary.netCost} {t("billing.creditse6d317")}</div>
      <div className="text-xs text-fg-muted">
        {summary.preDeducted > 0 ? t("billing.reservedfcf34c", {p0: String(summary.preDeducted)}) : fullyRefunded ? t("billing.refundedfb5536") : summary.refunded > 0 ? t("billing.refundedde0f20", {p0: String(summary.refunded)}) : t("billing.netCharge9a5b7d")}
      </div>
    </div>
  );
}

export function TaskCostDetail({ taskId, compact = false, status }: { taskId: string; compact?: boolean; status?: string }) {
  const t = useText();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [summary, setSummary] = React.useState<TaskBillingSummary | null>(null);
  const [loading, setLoading] = React.useState(isSaaS);

  React.useEffect(() => {
    if (!isSaaS || !taskId) return;
    let cancelled = false;
    let request = 0;
    const refresh = () => {
      const currentRequest = ++request;
      return getTaskBilling(taskId)
      .then((nextSummary) => {
        if (!cancelled && currentRequest === request) setSummary(nextSummary);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled && currentRequest === request) setLoading(false);
      });
    };
    void refresh();
    window.addEventListener(BILLING_UPDATED_EVENT, refresh);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      window.removeEventListener(BILLING_UPDATED_EVENT, refresh);
      window.clearInterval(interval);
    };
  }, [isSaaS, taskId, status]);

  if (!isSaaS) return null;

  return (
    <Link
      href="/billing"
      className={`flex shrink-0 items-center gap-2 rounded-md border border-border-default px-3 ${compact ? 'py-1.5' : 'py-2'} hover:bg-canvas-subtle transition-colors`}
    >
      <Coins className="h-4 w-4 text-accent-fg" />
      <div className={compact ? 'flex flex-wrap items-center gap-2' : undefined}>
        <div className="text-xs text-fg-muted">{t("billing.taskCostb905c1")}</div>
        {loading ? (
          <div className="text-sm text-fg-muted">{t("tasks.loading514c33")}</div>
        ) : summary && summary.transactionCount > 0 ? (
          <div className="text-sm font-medium text-fg-default">
            {summary.netCost} {t("billing.creditse6d317")}{summary.preDeducted > 0 ? (
              <span className="ml-1 text-xs font-normal text-fg-muted">{t("billing.reserved00211c")}{summary.preDeducted}</span>
            ) : summary.refunded > 0 ? (
              <span className="ml-1 text-xs font-normal text-fg-muted">{t("billing.refundede595b7")}{summary.refunded}</span>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-fg-muted">{t("billing.notCharged01d9e0")}</div>
        )}
      </div>
    </Link>
  );
}
