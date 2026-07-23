'use client';

import * as React from 'react';
import Link from 'next/link';
import { Coins, Loader2 } from 'lucide-react';
import { getTaskBilling, type TaskBillingSummary } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

interface TaskCostValueProps {
  summary?: TaskBillingSummary;
  loading?: boolean;
}

export function TaskCostValue({ summary, loading = false }: TaskCostValueProps) {
  if (loading) {
    return <Loader2 className="mx-auto h-4 w-4 animate-spin text-fg-muted" />;
  }
  if (!summary || summary.transactionCount === 0) {
    return <span className="text-xs text-fg-muted">未扣费</span>;
  }

  const fullyRefunded = summary.deducted > 0 && summary.netCost === 0;
  return (
    <div className="text-center">
      <div className="font-medium text-fg-default">{summary.netCost} 积分</div>
      <div className="text-xs text-fg-muted">
        {fullyRefunded ? '已退款' : summary.refunded > 0 ? `已退 ${summary.refunded}` : '净扣费'}
      </div>
    </div>
  );
}

export function TaskCostDetail({ taskId }: { taskId: string }) {
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [summary, setSummary] = React.useState<TaskBillingSummary | null>(null);
  const [loading, setLoading] = React.useState(isSaaS);

  React.useEffect(() => {
    if (!isSaaS || !taskId) return;
    let cancelled = false;
    getTaskBilling(taskId)
      .then((nextSummary) => {
        if (!cancelled) setSummary(nextSummary);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSaaS, taskId]);

  if (!isSaaS) return null;

  return (
    <Link
      href="/billing"
      className="flex items-center gap-2 rounded-md border border-border-default px-3 py-2 hover:bg-canvas-subtle transition-colors"
    >
      <Coins className="h-4 w-4 text-accent-fg" />
      <div>
        <div className="text-xs text-fg-muted">任务费用</div>
        {loading ? (
          <div className="text-sm text-fg-muted">加载中...</div>
        ) : summary && summary.transactionCount > 0 ? (
          <div className="text-sm font-medium text-fg-default">
            {summary.netCost} 积分
            {summary.refunded > 0 && <span className="ml-1 text-xs font-normal text-fg-muted">已退 {summary.refunded}</span>}
          </div>
        ) : (
          <div className="text-sm text-fg-muted">未扣费</div>
        )}
      </div>
    </Link>
  );
}
