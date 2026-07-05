'use client';

import * as React from 'react';
import { PageContent } from '@/components/layout';
import { Button, DataTable, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { CreditCard, Loader2, RefreshCw } from 'lucide-react';
import {
  getBillingBalance,
  getBillingConfig,
  getBillingTransactions,
  type BillingBalance,
  type BillingConfig,
  type BillingTransaction,
} from '@/lib/billing';

function formatTime(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function transactionVariant(type: string): 'success' | 'warning' | 'info' | 'neutral' {
  switch (type) {
    case 'recharge':
    case 'refund':
      return 'success';
    case 'deduction':
    case 'download':
      return 'warning';
    case 'adjust':
      return 'info';
    default:
      return 'neutral';
  }
}

function transactionLabel(type: string): string {
  switch (type) {
    case 'recharge':
      return '充值';
    case 'deduction':
      return '扣费';
    case 'refund':
      return '退款';
    case 'adjust':
      return '调整';
    case 'download':
      return '下载扣费';
    default:
      return type || '-';
  }
}

function ConfigItem({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-border-default bg-canvas-subtle p-3">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-fg-default">{value}</p>
      {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
    </div>
  );
}

export default function BillingSettingsPage() {
  const [balance, setBalance] = React.useState<BillingBalance | null>(null);
  const [config, setConfig] = React.useState<BillingConfig | null>(null);
  const [transactions, setTransactions] = React.useState<BillingTransaction[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const pageSize = 20;

  const loadData = React.useCallback(async (nextPage = page) => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextBalance, nextConfig, nextTransactions] = await Promise.all([
        getBillingBalance(),
        getBillingConfig(),
        getBillingTransactions(nextPage, pageSize),
      ]);
      setBalance(nextBalance);
      setConfig(nextConfig);
      setTransactions(nextTransactions.items ?? []);
      setTotal(nextTransactions.total ?? 0);
      setPage(nextTransactions.page ?? nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载计费数据失败');
      setBalance(null);
      setConfig(null);
      setTransactions([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    void loadData(1);
    // 初次加载固定第一页，避免 loadData 随 page 改变造成重复请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: Column<BillingTransaction>[] = [
    {
      id: 'type',
      header: '类型',
      accessor: (row) => <Tag variant={transactionVariant(row.type)}>{transactionLabel(row.type)}</Tag>,
      width: 110,
      align: 'center',
    },
    {
      id: 'amount',
      header: '点数变动',
      accessor: (row) => <span className={row.amount >= 0 ? 'text-success-fg' : 'text-warning-fg'}>{row.amount}</span>,
      width: 120,
      align: 'center',
    },
    { id: 'balance_after', header: '变动后余额', accessor: (row) => row.balance_after, width: 120, align: 'center' },
    { id: 'reference_id', header: '关联对象', accessor: (row) => row.reference_id || '-', width: 180, align: 'center' },
    { id: 'description', header: '说明', accessor: (row) => row.description || '-', width: 260, align: 'center' },
    { id: 'created_at', header: '发生时间', accessor: (row) => formatTime(row.created_at), width: 180, align: 'center' },
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <h2 className="yj-page-title">计费与余额</h2>
          <p className="yj-page-subtitle">
            数据来自 Squid `/api/v1/billing/balance`、`/api/v1/billing/transactions` 和 `/api/v1/billing/config`；本页只读展示真实后端状态。
          </p>
        </div>
        <Button variant="secondary" onClick={() => void loadData(page)} disabled={isLoading}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="yj-panel p-4 md:col-span-1">
          <div className="flex items-center gap-2 text-accent-fg">
            <CreditCard className="w-5 h-5" />
            <span className="text-sm">当前余额</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-fg-default">{balance?.balance ?? '--'}</p>
          <p className="mt-1 text-xs text-fg-muted">Org ID: {balance?.org_id ?? '-'}</p>
        </div>
        <div className="yj-panel p-4 md:col-span-3">
          <h3 className="text-base font-medium text-fg-default mb-3">计费配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ConfigItem label="每分钟点数" value={config?.credits_per_minute ?? '--'} />
            <ConfigItem label="倍率" value={config?.credit_rate_multiplier ?? '--'} />
            <ConfigItem label="最低余额" value={config?.min_balance ?? '--'} hint="低于该值时后端会拒绝新的扣费任务" />
          </div>
        </div>
      </div>

      <div className="yj-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-fg-default">交易记录</h3>
          <span className="text-xs text-fg-muted">共 {total} 条</span>
        </div>
        {isLoading && transactions.length === 0 ? (
          <div className="yj-empty-state py-10">
            <Loader2 className="w-6 h-6 animate-spin text-accent-fg" />
            <p className="text-fg-muted">正在加载交易记录...</p>
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-fg-muted">暂无交易记录</p>
        ) : (
          <DataTable data={transactions} columns={columns} rowKey="id" density="default" striped />
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1 || isLoading}
            onClick={() => void loadData(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-fg-muted">第 {page} / {totalPages} 页</span>
          <Button
            variant="secondary"
            disabled={page >= totalPages || isLoading}
            onClick={() => void loadData(page + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </PageContent>
  );
}
