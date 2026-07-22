'use client';

import * as React from 'react';
import Link from 'next/link';
import { Coins } from 'lucide-react';
import { BILLING_UPDATED_EVENT, getBillingBalance } from '@/lib/billing';
import { getRuntimeBackendFlavor } from '@/lib/runtime-config';

export function BillingDisplay() {
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
      className="flex h-8 min-w-[112px] items-center justify-center gap-1.5 rounded-md border border-[var(--yj-border-subtle)] px-2.5 text-sm hover:bg-[var(--yj-panel-muted)] transition-colors"
      aria-label={`费用中心，当前余额 ${balance ?? '--'} Credit`}
    >
      <Coins className="w-4 h-4" />
      <span className={isLow ? 'text-danger-fg font-medium' : 'text-fg-default font-medium'}>
        {balance ?? '--'} Credit
      </span>
    </Link>
  );
}
