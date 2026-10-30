'use client';
import { errorText } from '@/i18n/errors';

import { useText } from '@/i18n/useText';


import { ActionButton as Button, ActionButton } from '@/components/shared/ActionButton';


import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@schema/ui-kit';
import { ArrowLeft, Clock3, Coins, Check, FileText } from 'lucide-react';
import { PageContent } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import { calculateEstimatedCredits, getBillingBalance, getBillingConfig, type BillingBalance, type BillingConfig } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';
import { parseCreditQuantity } from '@/lib/payments';
import { StripeRechargePanel } from '@/components/shared/StripeRechargePanel';

const PRESET_CREDITS = [100, 500, 1000, 5000];

export default function RechargePage() {
  const t = useText();
  const router = useRouter();
  const { user, currentOrg } = useAuth();
  const isSaaS = getRuntimeBackendFlavor() === 'squid';
  const [balance, setBalance] = React.useState<BillingBalance | null>(null);
  const [config, setConfig] = React.useState<BillingConfig | null>(null);
  const [amountInput, setAmountInput] = React.useState('500');
  const amount = parseCreditQuantity(amountInput);
  const quantityError = amount === null ? t('payments.quantityError') : '';
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
    ? (amount === null ? null : Math.floor(amount / minuteRate))
    : null;
  const exampleTaskCost = calculateEstimatedCredits(60, config);

  const copyRequest = async () => {
    if (amount === null) return;
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

  const selection = (
    <section className="yj-panel min-w-0 overflow-hidden" aria-labelledby="credit-selection-title">
      <div className="border-b border-border-default px-5 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent-fg"><Coins className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <p className="mb-0.5 text-xs font-medium tracking-wide text-fg-muted">{t('stripePayments.selectStep')}</p>
            <h3 id="credit-selection-title" className="text-base font-semibold text-fg-default">{t("admin.creditsToAdd3d02b4")}</h3>
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="group" aria-label={t('stripePayments.presetAmounts')}>
          {PRESET_CREDITS.map(preset => (
            <button key={preset} type="button" aria-pressed={amount === preset}
              onClick={() => { setAmountInput(String(preset)); setCopied(false); }}
              className={`relative flex min-h-[100px] flex-col items-start justify-center rounded-lg border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emphasis focus-visible:ring-offset-2 ${amount === preset ? 'border-accent-emphasis bg-accent-subtle text-fg-default ring-1 ring-accent-emphasis' : 'border-border-default bg-canvas-default text-fg-default hover:border-accent-muted hover:bg-canvas-subtle'}`}>
              {amount === preset && <Check className="absolute right-2.5 top-2.5 h-4 w-4" aria-hidden="true" />}
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{preset.toLocaleString()}</span>
              <span className="mt-1 text-xs text-fg-muted">{t("billing.creditse6d317")}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-5 border-t border-border-default pt-5 sm:grid-cols-2"><div>
          <label htmlFor="recharge-amount" className="mb-2 block text-sm font-medium text-fg-default">{t("billing.customAmount6dea5d")}</label>
          <div className="flex max-w-sm items-center gap-3">
            <Input id="recharge-amount" aria-label={t("billing.customCreditAmountc6dcf8")} type="number" min="1" max="5000" step="1" inputMode="numeric"
              value={amountInput} aria-invalid={amount === null} aria-describedby="recharge-quantity-help" className="h-11 text-base tabular-nums"
              onChange={event => { setAmountInput(event.target.value); setCopied(false); }} />
            <span className="shrink-0 text-sm text-fg-muted">{t("billing.creditse6d317")}</span>
          </div>
          <p id="recharge-quantity-help" role={quantityError ? 'alert' : undefined} className={`mt-2 text-xs leading-5 ${quantityError ? 'text-danger-fg' : 'text-fg-muted'}`}>{quantityError || t('payments.quantityHelp')}</p>
        </div>
        <div className="rounded-lg border border-border-default bg-canvas-subtle p-4">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-fg-muted">{t("billing.estimatedRuntimeFromThisAddition05038e")}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-fg-default">{t("billing.about91e623")}{estimatedMinutes?.toLocaleString() ?? '--'} <span className="text-sm font-normal text-fg-muted">{t("billing.minutes5b0acd")}</span></p>
              <p className="mt-2 text-xs leading-5 text-fg-muted">{t("billing.estimatedReservationForAMinuteTask31dcf2")}{exampleTaskCost ?? '--'} {t("billing.creditsFinalBillingUsesActualRuntimea39e18")}</p>
            </div>
          </div>
        </div>
      </div></div>
    </section>
  );
  const manualRequest = (
    <section className="yj-panel p-5 sm:p-6">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-fg-default"><FileText className="h-4 w-4 text-fg-muted" aria-hidden="true" />{t('stripePayments.manualTitle')}</div>
      <p className="mb-4 text-xs leading-5 text-fg-muted">{t("billing.creditsArePostedAfterPlatformConfirmationSee40fdf0")}</p>
      <Button action={copied ? 'copied' : 'copy'} variant="secondary" className="w-full justify-center sm:w-auto" onClick={() => void copyRequest()} disabled={amount === null}>
        {copied ? t("billing.copiede381a5") : t("billing.copyCreditRequeste67917")}
      </Button>
      <span role="status" className="sr-only">{copied ? t("billing.copiede381a5") : ''}</span>
    </section>
  );
  return (
    <PageContent className="yj-page-shell"><div className="mx-auto w-full max-w-[1280px]">
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link href="/billing" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg-default"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t("billing.backToBilling844842")}</Link>
          <h2 className="yj-page-title">{t("billing.addCreditsfa03c4")}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border-default bg-canvas-default px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle text-accent-fg"><Coins className="h-4 w-4" aria-hidden="true" /></span>
          <div><p className="text-xs text-fg-muted">{t("billing.currentBalancef11215")}</p><p className="mt-0.5 text-xl font-semibold tabular-nums text-fg-default">{balance?.balance.toLocaleString() ?? '—'} <span className="text-xs font-normal text-fg-muted">{t("billing.creditse6d317")}</span></p></div>
        </div>
        <p className="yj-page-subtitle col-span-2 sm:col-span-1">{t('stripePayments.pageDescription')}</p>
      </div>
      {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{loadError}<ActionButton action="retry" variant="ghost" size="small" onClick={() => setRetry(v => v + 1)}>{t("billing.retryLoading7b4939")}</ActionButton></div>}
      {error && <div role="alert" className="mb-4 rounded-lg border border-danger-muted bg-danger-subtle px-4 py-3 text-sm text-danger-fg">{error}</div>}
      {currentOrg?.id ? <StripeRechargePanel quantity={amount} orgId={String(currentOrg.id)} selection={selection} manualRequest={manualRequest} /> : selection}
    </div></PageContent>
  );
}
