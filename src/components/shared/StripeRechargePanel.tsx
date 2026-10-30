'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, CheckCircle2, Clock3, CreditCard, FileText, ReceiptText, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { getServicePolicy, SERVICE_POLICY_VERSION, type ServicePolicy } from '@/lib/service-policy';
import policyCopy from '@/i18n/service-policy-v1.json';
import { ServicePolicyLinks } from './ServicePolicyDocument';
import { useText } from '@/i18n/useText';
import { ActionButton as Button } from '@/components/shared/ActionButton';
import { createCheckoutSession, formatPaymentMoney, getPaymentOptions, getPaymentOrder, getPaymentOrders, type PaymentOptions, type PaymentOrder } from '@/lib/payments';

export function StripeRechargePanel({ quantity, orgId, selection, manualRequest }: { quantity: number | null; orgId: string; selection?: ReactNode; manualRequest?: ReactNode }) {
  const t = useText();
  const c = policyCopy[t.locale];
  const [policy, setPolicy] = useState<ServicePolicy | null>(null);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => { let active = true; setPolicy(null); setAccepted(false); void getServicePolicy().then(p => { if (active) setPolicy(p); }).catch(() => { if (active) setError(c.loadError); }); return () => { active = false; }; }, [orgId, c.loadError]);
  const [options, setOptions] = useState<PaymentOptions | null>(null), [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [selected, setSelected] = useState<PaymentOrder | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const lock = useRef(false);
  const scope = useRef(orgId); scope.current = orgId;
  const refresh = useCallback(async () => {
    const owner = orgId;
    const [o, list] = await Promise.all([getPaymentOptions(), getPaymentOrders(page)]);
    if (scope.current !== owner) return;
    setOptions(o); setOrders(list.items || []); setTotal(list.total); setError('');
    const id = new URLSearchParams(window.location.search).get('order');
    if (id && /^[0-9a-f-]{36}$/.test(id)) {
      const row = await getPaymentOrder(id);
      if (scope.current === owner) setSelected(row);
    }
  }, [orgId, page]);
  useEffect(() => { setOptions(null); setSelected(null); setOrders([]); void refresh().catch(() => setError(t('stripePayments.loadFailed'))); }, [refresh, t]);
  useEffect(() => {
    if (!selected || !['creating', 'creation_pending', 'pending', 'processing'].includes(selected.state)) return;
    let attempts = 0, active = true;
    const timer = window.setInterval(() => {
      if (++attempts > 120) { window.clearInterval(timer); return; }
      void getPaymentOrder(selected.id).then(row => { if (active) setSelected(row); }).catch(() => undefined);
    }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [selected?.id, selected?.state]);
  async function buy() {
    if (lock.current || quantity === null || options?.status !== 'available' || !accepted || !policy || policy.version !== SERVICE_POLICY_VERSION) return;
    const owner = orgId;
    lock.current = true; setBusy(true); setError('');
    try {
      const storage = 'stripe-checkout:' + orgId;
      let request: { quantity: number; key: string } | null = null;
      try { request = JSON.parse(sessionStorage.getItem(storage) || 'null'); } catch { /* A fresh request replaces invalid storage. */ }
      if (!request || request.quantity !== quantity || typeof request.key !== 'string') {
        request = { quantity, key: crypto.randomUUID() };
        sessionStorage.setItem(storage, JSON.stringify(request));
      }
      const result = await createCheckoutSession({ product: 'credit', quantity, accepted: true, policy_version: policy.version }, request.key);
      if (scope.current !== owner) return;
      if (result.checkout_url) {
        const url = new URL(result.checkout_url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('invalid checkout');
        window.location.assign(url.href);
      } else { setSelected(await getPaymentOrder(result.order_id)); }
    } catch (err) {
      if (scope.current !== owner) return;
      const code = err instanceof ApiError ? (err.data as {code?: string})?.code : '';
      if (code === 'purchase_policy_outdated') { setAccepted(false); setPolicy(null); setError(c.changed); void getServicePolicy().then(setPolicy).catch(() => undefined); }
      else setError(code && ['payment_readiness_required', 'payment_rate_limited', 'organization_payment_paused', 'too_many_pending_orders', 'payment_amount_limit', 'payment_daily_limit'].includes(code) ? c.limited : t('stripePayments.checkoutFailed'));
    }
    finally { lock.current = false; setBusy(false); }
  }
  function status(state: string) {
    const known = ['creating', 'creation_pending', 'pending', 'processing', 'paid', 'simulated', 'expired', 'failed', 'manual_review', 'partially_refunded', 'refunded', 'disputed'];
    return t('stripePayments.' + (known.includes(state) ? state : 'processing'));
  }
  function statusStyle(state: string) {
    if (['paid', 'simulated'].includes(state)) return 'border-success-muted bg-success-subtle text-success-fg';
    if (['failed', 'disputed', 'manual_review'].includes(state)) return 'border-danger-muted bg-danger-subtle text-danger-fg';
    if (['creating', 'creation_pending', 'pending', 'processing'].includes(state)) return 'border-warning-muted bg-warning-subtle text-warning-fg';
    return 'border-border-default bg-canvas-subtle text-fg-muted';
  }
  const available = options?.status === 'available' && !!options.price;
  const loading = !options && !error;
  const pages = Math.max(1, Math.ceil(total / 20));
  return <div className="space-y-6">
    <div className={selection ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]' : ''}>
      {selection && <div className="min-w-0 space-y-5">{selection}{manualRequest}</div>}
      <aside className="yj-panel min-w-0 overflow-hidden lg:sticky lg:top-5" aria-label={t('stripePayments.title')}>
        <div className="border-b border-border-default px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas-subtle text-fg-muted"><CreditCard className="h-5 w-5" aria-hidden="true" /></span>
              <div><p className="mb-0.5 text-xs font-medium tracking-wide text-fg-muted">{t('stripePayments.payStep')}</p><h3 className="text-base font-semibold text-fg-default">{t('stripePayments.confirmTitle')}</h3></div>
            </div>
            <span className="text-xs font-semibold tracking-wide text-fg-muted">Stripe</span>
          </div>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          {error && <p role="alert" className="rounded-lg border border-danger-muted bg-danger-subtle p-3 text-sm leading-5 text-danger-fg">{error}</p>}
          {options?.simulated && available && <p role="status" className="rounded-lg border border-warning-muted bg-warning-subtle p-3 text-xs leading-5 text-warning-fg">{t('stripePayments.testNotice')}</p>}
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3"><dt className="text-fg-muted">{t('stripePayments.credits')}</dt><dd className="font-medium tabular-nums text-fg-default">{quantity?.toLocaleString() ?? '—'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-fg-muted">{t('stripePayments.unitPrice')}</dt><dd className="font-medium tabular-nums text-fg-default">{available && options?.price ? formatPaymentMoney(options.price.unit_amount, options.price.currency) : '—'}</dd></div>
            <div className="flex items-end justify-between gap-3 border-t border-dashed border-border-default pt-4"><dt className="pb-1 text-fg-muted">{t('stripePayments.total')}</dt><dd className="break-words text-right text-3xl font-semibold tabular-nums tracking-tight text-fg-default">{available && options?.price && quantity !== null ? formatPaymentMoney(options.price.unit_amount * quantity, options.price.currency) : '—'}</dd></div>
          </dl>
          <div className="space-y-3 rounded-lg border border-border-default bg-canvas-subtle p-4">
          <p className="text-sm leading-6 text-fg-muted">{c.purpose}</p>
          <div className="text-sm leading-6 [&>nav]:justify-start [&>nav]:gap-x-4 [&>nav]:gap-y-2"><ServicePolicyLinks /></div>
          <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-accent-emphasis" checked={accepted} disabled={busy || !policy || policy.version !== SERVICE_POLICY_VERSION} onChange={e => setAccepted(e.target.checked)} />{c.accept}</label>
          {policy?.contact && <a className="text-xs underline" href={`mailto:${policy.contact}`}>{policy.contact}</a>}
          </div>
          {loading ? <p className="flex items-center gap-2 text-xs text-fg-muted" role="status"><span className="h-2 w-2 animate-pulse rounded-full bg-fg-muted" />{t('stripePayments.loading')}</p> : available ? <div className="space-y-3">
            <Button type="button" variant="primary" className="w-full justify-center" rightIcon={<ArrowUpRight className="h-4 w-4" />} loading={busy} disabled={quantity === null || !accepted || !policy || policy.version !== SERVICE_POLICY_VERSION} onClick={() => void buy()}>{t(options?.simulated ? 'stripePayments.testPay' : 'stripePayments.pay')}</Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-fg-muted"><ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{t('stripePayments.checkoutHint')}</p>
            <Button type="button" variant="ghost" size="small" className="w-full justify-center text-fg-muted" disabled={busy} onClick={() => { sessionStorage.removeItem('stripe-checkout:' + orgId); setSelected(null); }}>{t('stripePayments.newOrder')}</Button>
          </div> : !error ? <div className="flex items-start gap-2.5 rounded-lg border border-border-default bg-canvas-subtle p-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" /><p className="text-xs leading-5 text-fg-muted">{t('stripePayments.disabled')}</p></div> : null}
          {!selection && manualRequest}
        </div>
      </aside>
    </div>
    {selected && <div role="status" className={`flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border px-5 py-4 ${statusStyle(selected.state)}`}>
      <div className="flex min-w-0 items-start gap-3">{['paid', 'simulated'].includes(selected.state) ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <ReceiptText className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}<div className="min-w-0"><p className="break-all text-sm font-medium">{selected.id}: {status(selected.state)}</p>{selected.simulated && <p className="mt-1 text-xs leading-5">{t('stripePayments.testNotice')}</p>}</div></div>
    </div>}
    <section className="yj-panel min-w-0 overflow-hidden" aria-labelledby="recharge-history-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2.5"><ReceiptText className="h-4 w-4 text-fg-muted" aria-hidden="true" /><h3 id="recharge-history-title" className="text-sm font-semibold text-fg-default">{t('stripePayments.historyTitle')}</h3>{total > 0 && <span className="rounded-full bg-canvas-subtle px-2 py-0.5 text-xs tabular-nums text-fg-muted">{total}</span>}</div>
        <Button type="button" action="refresh" variant="ghost" size="small" disabled={busy} onClick={() => void refresh().catch(() => setError(t('stripePayments.loadFailed')))}>{t('stripePayments.refresh')}</Button>
      </div>
      {!options && !error ? <div className="space-y-4 p-6" aria-label={t('stripePayments.loading')} aria-busy="true">{[0, 1, 2].map(i => <div key={i} className="h-5 animate-pulse rounded bg-canvas-subtle" />)}</div> : orders.length === 0 ? <div className="flex flex-col items-center px-6 py-8 text-center"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-canvas-subtle text-fg-muted"><FileText className="h-5 w-5" aria-hidden="true" /></span><p className="text-sm font-medium text-fg-default">{t('stripePayments.emptyTitle')}</p><p className="mt-1.5 max-w-sm text-xs leading-5 text-fg-muted">{t('stripePayments.emptyHint')}</p></div> : <>
        <div className="divide-y divide-border-default sm:hidden">{orders.map(o => <div key={o.id} className={`px-5 py-4 ${selected?.id === o.id ? 'bg-accent-subtle' : ''}`}>
          <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => setSelected(o)} aria-label={o.id} className="rounded font-mono text-xs font-medium text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emphasis">{o.id.slice(0, 8)}…{o.id.slice(-4)}</button><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyle(o.state)}`}>{status(o.state)}</span></div>
          <div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-sm text-fg-default">{o.quantity.toLocaleString()} <span className="text-xs text-fg-muted">{t('billing.creditse6d317')}</span>{o.simulated && <span className="ml-2 text-xs text-warning-fg">{t('stripePayments.testPay')}</span>}</p><p className="mt-1 text-xs tabular-nums text-fg-muted">{o.created_at && !Number.isNaN(Date.parse(o.created_at)) ? new Date(o.created_at).toLocaleString() : '—'}</p></div><p className="text-base font-semibold tabular-nums text-fg-default">{formatPaymentMoney(o.amount, o.currency)}</p></div>
        </div>)}</div>
        <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-canvas-subtle text-xs font-medium text-fg-muted"><tr><th scope="col" className="px-5 py-3 sm:px-6">{t('stripePayments.order')}</th><th scope="col" className="px-4 py-3">{t('stripePayments.createdAt')}</th><th scope="col" className="px-4 py-3 text-right">{t('stripePayments.credits')}</th><th scope="col" className="px-4 py-3 text-right">{t('stripePayments.total')}</th><th scope="col" className="px-5 py-3 sm:px-6">{t('stripePayments.state')}</th></tr></thead>
          <tbody className="divide-y divide-border-default">{orders.map(o => <tr key={o.id} className={selected?.id === o.id ? 'bg-accent-subtle' : 'transition-colors hover:bg-canvas-subtle'}>
            <td className="px-5 py-4 sm:px-6"><button type="button" onClick={() => setSelected(o)} title={o.id} aria-label={o.id} className="rounded text-left font-mono text-xs font-medium text-accent-fg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emphasis">{o.id.slice(0, 8)}…{o.id.slice(-4)}</button>{o.simulated && <span className="ml-2 rounded bg-warning-subtle px-1.5 py-0.5 text-[11px] text-warning-fg">{t('stripePayments.testPay')}</span>}</td>
            <td className="whitespace-nowrap px-4 py-4 text-xs tabular-nums text-fg-muted">{o.created_at && !Number.isNaN(Date.parse(o.created_at)) ? new Date(o.created_at).toLocaleString() : '—'}</td>
            <td className="px-4 py-4 text-right font-medium tabular-nums text-fg-default">{o.quantity.toLocaleString()}</td><td className="whitespace-nowrap px-4 py-4 text-right tabular-nums text-fg-default">{formatPaymentMoney(o.amount, o.currency)}</td><td className="px-5 py-4 sm:px-6"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(o.state)}`}>{status(o.state)}</span></td>
          </tr>)}</tbody>
        </table>
        </div>
      </>}
      {total > 20 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-default px-5 py-3 sm:px-6"><span className="text-xs tabular-nums text-fg-muted">{t('stripePayments.pageCount', {p0: String(page), p1: String(pages)})}</span><div className="flex gap-1"><Button type="button" action="previous" size="small" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('stripePayments.previous')}</Button><Button type="button" action="next" size="small" variant="ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>{t('stripePayments.next')}</Button></div></div>}
    </section>
  </div>;
}
