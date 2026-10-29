'use client';
import { useText } from '@/i18n/useText';



import * as React from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { BILLING_UPDATED_EVENT, getBillingBalance } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

export function BillingDisplay({ compact = false }: { compact?: boolean }) {
  const t = useText();
  const [balance, setBalance] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  const isSaaS = getRuntimeBackendFlavor() === 'squid';

  React.useEffect(() => {
    if (!isSaaS) return;

    let cancelled = false;
    const loadBalance = () => {
      getBillingBalance()
        .then((data) => {
          if (!cancelled && data?.balance != null) setBalance(data.balance);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    loadBalance();
    const interval = window.setInterval(loadBalance, 30000);
    window.addEventListener(BILLING_UPDATED_EVENT, loadBalance);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener(BILLING_UPDATED_EVENT, loadBalance);
    };
  }, [isSaaS]);

  if (!isSaaS) return null;

  if (loading) return null;

  const isLow = balance !== null && balance < 0;

  return (
    <Link
      href="/billing"
      className={`flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--yj-border-subtle)] hover:bg-[var(--yj-panel-muted)] transition-colors ${compact ? 'min-w-[72px] max-w-[96px] px-2 text-xs' : 'min-w-[112px] px-2.5 text-sm'}`}
      aria-label={t("billing.billingCenterCurrentBalanceCredits6e9910", {p0: String(balance ?? '--')})}
    >
      <Coins className="w-4 h-4 shrink-0" />
      <span className={`truncate ${isLow ? 'text-danger-fg font-medium' : 'text-fg-default font-medium'}`}>
        {balance ?? '--'}{!compact && <> {t("billing.creditse6d317")}</>}</span>
    </Link>
  );
}
