'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { Button, DataTable, Tag } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Clock3, Coins, CreditCard, Gauge, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  getBillingBalance,
  getBillingConfig,
  getBillingTransactions,
  type BillingBalance,
  type BillingConfig,
  type BillingTransaction,
} from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { MetricTile } from '@/components/shared';

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

function formatCredits(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export default function BillingSettingsPage() {
  const router = useRouter();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
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
    if (!isSaaS) {
      router.replace('/dashboard');
      return;
    }
    void loadData(1);
    // 初次加载固定第一页，避免 loadData 随 page 改变造成重复请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaaS, router]);

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
      header: '积分变动',
      accessor: (row) => <span className={`font-medium tabular-nums ${row.amount >= 0 ? 'text-success-fg' : 'text-warning-fg'}`}>{row.amount > 0 ? '+' : ''}{formatCredits(row.amount)}</span>,
      width: 120,
      align: 'center',
    },
    { id: 'balance_after', header: '变动后积分', accessor: (row) => <span className="tabular-nums">{formatCredits(row.balance_after)}</span>, width: 120, align: 'center' },
    {
      id: 'reference_id',
      header: '关联任务',
      accessor: (row) => row.reference_id ? (
        <Link href={`/tasks/${encodeURIComponent(row.reference_id)}`} className="font-mono text-xs text-accent-fg hover:underline">
          {row.reference_id.slice(0, 8)}...
        </Link>
      ) : '-',
      width: 150,
      align: 'center',
    },
    { id: 'description', header: '说明', accessor: (row) => row.description || '-', width: 260, align: 'center' },
    { id: 'created_at', header: '发生时间', accessor: (row) => formatTime(row.created_at), width: 180, align: 'center' },
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const creditsPerMinute = config
    ? config.credits_per_minute * config.credit_rate_multiplier
    : null;
  const usableCredits = balance && config
    ? Math.max(0, balance.balance - config.min_balance)
    : null;
  const availableMinutes = creditsPerMinute && usableCredits !== null
    ? Math.floor(usableCredits / creditsPerMinute)
    : null;

  if (!isSaaS) return null;

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header flex-wrap gap-4">
        <div className="min-w-0">
          <h2 className="yj-page-title">费用中心</h2>
          <p className="yj-page-subtitle">
            查看组织积分余额、任务费率与收支记录。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            className="min-w-[88px] justify-center"
            leftIcon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            onClick={() => void loadData(page)}
            disabled={isLoading}
          >
            刷新
          </Button>
          <Link
            href="/billing/recharge"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-emphasis px-4 text-sm text-fg-on-emphasis hover:opacity-90"
          >
            <CreditCard className="w-4 h-4" />
            充值
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
            {error}
          </div>
        )}

        <section aria-label="费用概览" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricTile label="当前积分" value={formatCredits(balance?.balance)} icon={<Coins className="h-4 w-4" />} tone="success" />
          <MetricTile label="可运行时长" value={availableMinutes === null ? '--' : `${availableMinutes} 分钟`} icon={<Clock3 className="h-4 w-4" />} tone="info" />
          <MetricTile label="每分钟积分" value={formatCredits(creditsPerMinute)} icon={<Gauge className="h-4 w-4" />} />
        </section>

        <section className="yj-panel px-5 py-5" aria-labelledby="billing-rules-title">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent-fg" />
            <h3 id="billing-rules-title" className="text-sm font-medium text-fg-default">计费规则</h3>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-border-default">
            <div className="min-w-0 lg:pr-6">
              <p className="text-xs text-fg-muted">基础费率</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-fg-default">{formatCredits(config?.credits_per_minute)} <span className="whitespace-nowrap text-xs font-normal text-fg-muted">积分 / 分钟</span></p>
            </div>
            <div className="min-w-0 border-t border-border-default pt-5 lg:border-t-0 lg:px-6 lg:pt-0">
              <p className="text-xs text-fg-muted">计费倍率</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-fg-default">{formatCredits(config?.credit_rate_multiplier)}x</p>
            </div>
            <div className="min-w-0 border-t border-border-default pt-5 lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="text-xs text-fg-muted">最低保留积分</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-fg-default">{formatCredits(config?.min_balance)}</p>
              <p className="mt-2 text-xs leading-5 text-fg-muted">预扣后低于此值时不能启动任务</p>
            </div>
          </div>
        </section>

        <section className="yj-panel overflow-hidden" aria-labelledby="billing-details-title">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--yj-border-subtle)] px-5 py-4">
            <div>
              <h3 id="billing-details-title" className="text-base font-medium text-fg-default">积分明细</h3>
              <p className="mt-1 text-xs text-fg-muted">任务预扣、结算、退款与充值流水</p>
            </div>
            <span className="shrink-0 text-xs text-fg-muted">共 {total} 条</span>
          </div>
          <div className="min-w-0 overflow-x-auto">
            {isLoading && transactions.length === 0 ? (
              <div className="yj-empty-state py-12">
                <Loader2 className="h-6 w-6 animate-spin text-accent-fg" />
                <p className="text-fg-muted">正在加载交易记录...</p>
              </div>
            ) : transactions.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-fg-muted">暂无交易记录</p>
            ) : (
              <DataTable data={transactions} columns={columns} rowKey="id" density="default" striped />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--yj-border-subtle)] px-5 py-4">
            <Button
              variant="secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => void loadData(page - 1)}
            >
              上一页
            </Button>
            <span className="px-1 text-sm text-fg-muted">第 {page} / {totalPages} 页</span>
            <Button
              variant="secondary"
              disabled={page >= totalPages || isLoading}
              onClick={() => void loadData(page + 1)}
            >
              下一页
            </Button>
          </div>
        </section>
      </div>
    </PageContent>
  );
}
