'use client';
﻿
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';
import { chineseText, localizeDisplay, type TextTranslator } from '@/i18n/text';

import { ActionButton as Button } from '@/components/shared/ActionButton';


import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContent } from '@/components/layout';
import { DataTable } from '@schema/ui-kit';
import type { Column } from '@schema/ui-kit';
import { Clock3, Coins, CreditCard, Gauge, Loader2, ShieldCheck } from 'lucide-react';
import {
  billingReferenceTaskId,
  BILLING_UPDATED_EVENT,
  getBillingBalance,
  getBillingConfig,
  getBillingTransactions,
  type BillingBalance,
  type BillingConfig,
  type BillingTransaction,
} from '@/lib/billing';
import { billingDisplayType, billingTransactionLabel, billingTransactionDescription } from '@/lib/billing-presentation';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { MetricTile } from '@/components/shared';
import { SupportDialog } from '@/components/support/SupportDialog';

function formatTime(value: string, t: TextTranslator = chineseText): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(t.locale, { hour12: false });
}


function formatCredits(value: number | null | undefined, t: TextTranslator = chineseText): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return value.toLocaleString(t.locale, { maximumFractionDigits: 2 });
}

export default function BillingSettingsPage() {
  const t = useText();
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

  const loadData = React.useCallback(async (nextPage = page, silent = false) => {
    if (!silent) setIsLoading(true);
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
      setError(err instanceof Error ? errorText(err, t) : t("settings.unableToLoadBillingData56a0f8"));
      setBalance(null);
      setConfig(null);
      setTransactions([]);
      setTotal(0);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [page, t]);

  React.useEffect(() => {
    if (!isSaaS) {
      router.replace('/dashboard');
      return;
    }
    void loadData(1);
    // 初次加载固定第一页，避免 loadData 随 page 改变造成重复请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaaS, router]);

  React.useEffect(() => {
    if (!isSaaS) return;
    const refresh = () => void loadData(page, true);
    window.addEventListener(BILLING_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    const pending = transactions.some(row => row.billing_basis === 'ai_assistance' && row.billing_state === 'reserved');
    const interval = pending ? window.setInterval(refresh, 3000) : undefined;
    return () => {
      window.removeEventListener(BILLING_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [isSaaS, loadData, page, transactions]);

  const columns: Column<BillingTransaction>[] = [
    {
      id: 'type',
      header: t("history.typee4e46c"),
      accessor: (row) => <span className="yj-transaction-tag" data-type={billingDisplayType(row)}>{billingTransactionLabel(row, t)}</span>,
      width: 110,
      align: 'center',
    },
    {
      id: 'amount',
      header: t("settings.creditChange01fe0c"),
      accessor: (row) => <span className={`font-medium tabular-nums ${row.amount === 0 ? 'text-fg-muted' : row.amount > 0 ? 'text-success-fg' : 'text-warning-fg'}`}>{row.amount > 0 ? '+' : ''}{formatCredits(row.amount, t)}</span>,
      width: 120,
      align: 'center',
    },
    { id: 'balance_after', header: t("settings.balanceAfterChanged3fbfc"), accessor: (row) => <span className="tabular-nums">{formatCredits(row.balance_after, t)}</span>, width: 120, align: 'center' },
    {
      id: 'reference_id',
      header: t("settings.associatedTask766b4b"),
      accessor: (row) => (row.related_task_id || (row.reference_id && row.billing_basis !== 'ai_assistance')) ? (
        <Link href={`/tasks/${encodeURIComponent(row.related_task_id || billingReferenceTaskId(row.reference_id!))}`} className="whitespace-nowrap font-mono text-xs text-accent-fg hover:underline">
          {row.related_task_id || billingReferenceTaskId(row.reference_id!)}
        </Link>
      ) : '-',
      width: 300,
      align: 'center',
    },
    { id: 'description', header: t("settings.details26670d"), accessor: (row) => billingTransactionDescription(row, t), width: 260, align: 'center' },
    { id: 'created_at', header: t("settings.occurredAt51f85a"), accessor: (row) => formatTime(row.created_at, t), width: 180, align: 'center' },
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
          <h2 className="yj-page-title">{t("settings.billingCenterfad652")}</h2>
          <p className="yj-page-subtitle">
            {t("settings.viewOrganizationCreditsTaskRatesAndTransactionsd2bfc2")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SupportDialog trigger="button" context="billing" />
          <Button action="refresh"
            variant="secondary"
            className="min-w-[88px] justify-center"

            onClick={() => void loadData(page)}
            disabled={isLoading}
          >
            {t("admin.refresh38108e")}</Button>
          <Link
            href="/billing/recharge"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent-emphasis px-4 text-sm text-fg-on-emphasis hover:opacity-90"
          >
            <CreditCard className="w-4 h-4" />
            {t("billing.addCreditsfa03c4")}</Link>
        </div>
      </div>

      <div className="space-y-6">
        {error && (
          <div role="alert" className="rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
            {error}
          </div>
        )}



        <section aria-label={t("settings.billingOverview5589cd")} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MetricTile label={t("settings.currentCredits97193d")} value={formatCredits(balance?.balance, t)} icon={<Coins className="h-4 w-4" />} tone="success" />
          <MetricTile label={t("settings.availableRuntime6381fd")} value={availableMinutes === null ? '--' : t("settings.minutes121a50", {p0: String(availableMinutes)})} icon={<Clock3 className="h-4 w-4" />} tone="info" />
          <MetricTile label={t("admin.creditsPerMinute9ab621")} value={formatCredits(creditsPerMinute, t)} icon={<Gauge className="h-4 w-4" />} />
          <MetricTile label={t("settings.downloadRate17eab2")} value={config?.download_credits == null ? '--' : t("settings.creditsDownloadb1ee07", {p0: String(formatCredits(config.download_credits, t))})} icon={<CreditCard className="h-4 w-4" />} />
        </section>



        <section className="yj-panel overflow-hidden" aria-labelledby="billing-details-title">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--yj-border-subtle)] px-5 py-4">
            <div>
              <h3 id="billing-details-title" className="text-base font-medium text-fg-default">{t("settings.creditTransactions282a0a")}</h3>
              <p className="mt-1 text-xs text-fg-muted">{t("settings.taskReservationsSettlementRefundsAndCreditAdditionsac62c0")}</p>
            </div>
            <span className="shrink-0 text-xs text-fg-muted">{t("history.total497064")}{error || isLoading ? '—' : total} {t("history.recordseb8c2d")}</span>
          </div>
          <div className="min-w-0 overflow-x-auto">
            {isLoading && transactions.length === 0 ? (
              <div className="yj-empty-state py-12">
                <Loader2 className="h-6 w-6 animate-spin text-accent-fg" />
                <p className="text-fg-muted">{t("settings.loadingTransactions882d8f")}</p>
              </div>
            ) : error ? <p className="px-5 py-10 text-center text-sm text-fg-muted">{t("settings.transactionsUnavailable023134")}</p> : transactions.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-fg-muted">{t("settings.noTransactionsfe493e")}</p>
            ) : (
              <div className="min-w-[900px]"><DataTable data={transactions} columns={localizeDisplay(columns, t)} rowKey="id" density="default" striped /></div>
            )}
          </div>
          {!error && totalPages > 1 && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--yj-border-subtle)] px-5 py-4">
            <Button
              variant="secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => void loadData(page - 1)}
            >
              {t("history.previousb41561")}</Button>
            <span className="px-1 text-sm text-fg-muted">{t("history.pagef49534")}{page} / {totalPages} {t("history.labelaf8438")}</span>
            <Button
              variant="secondary"
              disabled={page >= totalPages || isLoading}
              onClick={() => void loadData(page + 1)}
            >
              {t("history.next67a246")}</Button>
          </div>}
        </section>
        <section className="yj-panel px-5 py-5" aria-labelledby="billing-rules-title">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent-fg" />
            <h3 id="billing-rules-title" className="text-sm font-medium text-fg-default">{t("settings.billingRulesab2727")}</h3>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-border-default">
            <div className="min-w-0 lg:pr-6">
              <p className="text-xs text-fg-muted">{t("settings.baseRateeae98b")}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-fg-default">{formatCredits(config?.credits_per_minute, t)} <span className="whitespace-nowrap text-xs font-normal text-fg-muted">{t("settings.creditsMinutedcbb84")}</span></p>
            </div>
            <div className="min-w-0 border-t border-border-default pt-5 lg:border-t-0 lg:px-6 lg:pt-0">
              <p className="text-xs text-fg-muted">{t("settings.billingMultiplier04bece")}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-fg-default">{formatCredits(config?.credit_rate_multiplier, t)}x</p>
            </div>
            <div className="min-w-0 border-t border-border-default pt-5 lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="text-xs text-fg-muted">{t("settings.minimumRetainedCredits18c7ea")}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-fg-default">{formatCredits(config?.min_balance, t)}</p>
              <p className="mt-2 text-xs leading-5 text-fg-muted">{t("settings.tasksCannotStartIfTheBalanceAfterd07f6e")}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-border-default pt-5">
            <p className="text-xs font-medium text-fg-default">{t("settings.creditCalculation7583a8")}</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-fg-muted">
              <p>
                {t("settings.creditsPerMinuteBaseCreditsPerMinuteba42eb")}{config && (
                  <span className="ml-2 tabular-nums text-fg-default">
                    {t("settings.current21ddbc")}{formatCredits(config.credits_per_minute, t)} × {formatCredits(config.credit_rate_multiplier, t)} = {formatCredits(creditsPerMinute, t)} {t("settings.creditsMinutefd06c7")}</span>
                )}
              </p>
              <p>{t("settings.taskStartsAndRetriesReserveCreditsBasedecddd9")}</p>
              <p>{t("settings.timeBasedCloudBillingRunsFromSuccessful8b3bb0")}</p>
              <p>{t("settings.billingStartsWhenTheNodeStartsAnd410661")}</p>
              <p>{t("settings.resultsAndReportDownloadsCostcf694d")}{formatCredits(config?.download_credits, t)} {t("settings.creditsEach31033b")}</p>
              <p>{t("settings.cnvBaselineTasksAreBilledByInputfac0fc")}{formatCredits(config?.cnv_baseline_credits_per_gib, t)} {t("settings.creditsGibac5f8a")}</p>
              <p className="text-xs text-fg-muted">{t("settings.reservationsAreNotFinalChargesDifferencesSettleb226d9")}</p>
            </div>
          </div>
        </section>
      </div>
    </PageContent>
  );
}
