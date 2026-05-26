'use client';

import * as React from 'react';
import { Coins } from 'lucide-react';
import { getRuntimeApiBaseUrl } from '@/lib/runtime-config';

export function BillingDisplay() {
  const [balance, setBalance] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${getRuntimeApiBaseUrl()}/v1/billing/balance`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d?.data?.balance != null) setBalance(d.data.balance);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;

  const isLow = balance !== null && balance < 0;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Coins className="w-4 h-4" />
      <span className={isLow ? 'text-red-500 font-medium' : 'text-green-600'}>
        {balance ?? '--'} credits
      </span>
    </div>
  );
}
