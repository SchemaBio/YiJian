'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@schema/ui-kit';
import { Tag } from '@/components/shared/Tag';
import { ArrowLeft, Clock3, Coins, CreditCard } from 'lucide-react';
import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { calculateEstimatedCredits, getBillingBalance, getBillingConfig, type BillingBalance, type BillingConfig } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

const PRESET_CREDITS = [100, 500, 1000, 5000];

export default function RechargePage() {
  const t = useText();
  const router = useRouter();
  const { user, currentOrg } = useAuth();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [balance, setBalance] = React.useState<BillingBalance | null>(null);
  const [config, setConfig] = React.useState<BillingConfig | null>(null);
  const [amount, setAmount] = React.useState(500);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loadError, setLoadError] = React.useState('');
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    if (!isSaaS) {
      router.replace('/dashboard');
      return;
    }
    let active = true;
    setLoadError('');
    Promise.all([getBillingBalance(), getBillingConfig()])
      .then(([nextBalance, nextConfig]) => {
        if (!active) return;
        setBalance(nextBalance);
        setConfig(nextConfig);
      })
      .catch((err) => { if (active) setLoadError(err instanceof Error ? errorText(err, t) : t("billing.unableToLoadCreditAdditionInformation21a1a2")); });
    return () => { active = false; };
  }, [isSaaS, router, retry]);

  const minuteRate = config ? config.credits_per_minute * config.credit_rate_multiplier : null;
  const estimatedMinutes = minuteRate !== null && Number.isFinite(minuteRate) && minuteRate > 0
    ? Math.floor(amount / minuteRate)
    : null;
  const exampleTaskCost = calculateEstimatedCredits(60, config);

  const copyRequest = async () => {
    const request = [
      t("billing.schemabioSaasCreditRequest67d08d"),
      t("billing.organization7d9842", {p0: String(currentOrg?.name ?? '-'), p1: String(currentOrg?.id ?? '-')}),
      t("billing.accountf0457e", {p0: String(user?.email ?? '-')}),
      t("billing.requestedCredits04e7bf", {p0: String(amount)}),
      t("billing.currentBalance080c02", {p0: String(balance?.balance ?? '-')}),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(request);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("billing.unableToCopyTheRequestCheckClipboard9e1894"));
    }
  };

  if (!isSaaS) return null;

  return (
    <PageContent className="yj-page-shell">
      <div className="yj-page-header">
        <div>
          <Link href="/billing" className="mb-2 inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg-default">
            <ArrowLeft className="h-4 w-4" />
            {t("billing.backToBilling844842")}</Link>
          <div className="flex items-center gap-2">
            <h2 className="yj-page-title">{t("billing.addCreditsfa03c4")}</h2>
            <Tag variant="warning">{t("billing.manualReview61d90f")}</Tag>
          </div>
          <p className="yj-page-subtitle">{t("billing.chooseACreditAmountAndCreateAb9ec63")}</p>
        </div>
      </div>

      {loadError && <div role="alert" className="mb-4 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{loadError}<ActionButton action="retry" variant="ghost" type="button" className="yj-tool-button ml-3" onClick={() => setRetry(value => value + 1)}>{t("billing.retryLoading7b4939")}</ActionButton></div>}
      {error && (
        <div role="alert" className="mb-4 rounded-md border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="yj-panel p-5">
          <div className="mb-5 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent-fg" />
            <h3 className="text-base font-medium text-fg-default">{t("admin.creditsToAdd3d02b4")}</h3>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESET_CREDITS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                aria-pressed={amount === preset}
                className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                  amount === preset
                    ? 'border-accent-emphasis bg-accent-subtle text-accent-fg'
                    : 'border-border-default bg-canvas-default text-fg-default hover:bg-canvas-subtle'
                }`}
              >
                {preset} {t("billing.creditse6d317")}</button>
            ))}
          </div>

          <div className="mt-5 max-w-xs">
            <label htmlFor="recharge-amount" className="mb-2 block text-sm font-medium text-fg-default">{t("billing.customAmount6dea5d")}</label>
            <Input
              id="recharge-amount"
              aria-label={t("billing.customCreditAmountc6dcf8")}
              type="number"
              min="1"
              step="100"
              value={amount}
              onChange={(event) => setAmount(Math.max(1, Math.trunc(Number(event.target.value)) || 1))}
            />
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-border-default pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm text-fg-muted">{t("billing.requestedAmount2e583a")}</p>
              <p className="text-2xl font-semibold text-fg-default">{amount} {t("billing.creditse6d317")}</p>
            </div>
            <Button action="copy"
              variant="primary"
              className="w-full min-w-[168px] justify-center sm:w-auto"

              onClick={() => void copyRequest()}
            >
              {copied ? t("billing.copiede381a5") : t("billing.copyCreditRequeste67917")}
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="yj-panel p-4">
            <div className="flex items-center gap-2 text-fg-muted">
              <Coins className="h-4 w-4" />
              <span className="text-sm">{t("billing.currentBalancef11215")}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-fg-default">{balance?.balance ?? '--'} {t("billing.creditse6d317")}</p>
          </div>
          <div className="yj-panel p-4">
            <div className="flex items-center gap-2 text-fg-muted">
              <Clock3 className="h-4 w-4" />
              <span className="text-sm">{t("billing.estimatedRuntimeFromThisAddition05038e")}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-fg-default">{t("billing.about91e623")}{estimatedMinutes ?? '--'} {t("billing.minutes5b0acd")}</p>
            <p className="mt-2 text-xs text-fg-muted">{t("billing.estimatedReservationForAMinuteTask31dcf2")}{exampleTaskCost ?? '--'} {t("billing.creditsFinalBillingUsesActualRuntimea39e18")}</p>
          </div>
          <div className="yj-panel p-4 text-sm text-fg-muted">
            <p className="font-medium text-fg-default">{t("billing.creditPosting806aed")}</p>
            <p className="mt-2">{t("billing.creditsArePostedAfterPlatformConfirmationSee40fdf0")}</p>
          </div>
        </aside>
      </div>
    </PageContent>
  );
}
