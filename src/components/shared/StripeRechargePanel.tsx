'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useText } from '@/i18n/useText';
import { ActionButton as Button } from '@/components/shared/ActionButton';
import { createCheckoutSession, formatPaymentMoney, getPaymentOptions, getPaymentOrder, getPaymentOrders, type PaymentOptions, type PaymentOrder } from '@/lib/payments';

export function StripeRechargePanel({ quantity, orgId }: { quantity: number | null; orgId: string }) {
  const t = useText();
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
    if (lock.current || quantity === null || options?.status !== 'available') return;
    lock.current = true; setBusy(true); setError('');
    try {
      const storage = 'stripe-checkout:' + orgId;
      let request: { quantity: number; key: string } | null = null;
      try { request = JSON.parse(sessionStorage.getItem(storage) || 'null'); } catch { /* A fresh request replaces invalid storage. */ }
      if (!request || request.quantity !== quantity || typeof request.key !== 'string') {
        request = { quantity, key: crypto.randomUUID() };
        sessionStorage.setItem(storage, JSON.stringify(request));
      }
      const result = await createCheckoutSession({ product: 'credit', quantity }, request.key);
      if (result.checkout_url) {
        const url = new URL(result.checkout_url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('invalid checkout');
        window.location.assign(url.href);
      } else { setSelected(await getPaymentOrder(result.order_id)); }
    } catch { setError(t('stripePayments.checkoutFailed')); }
    finally { lock.current = false; setBusy(false); }
  }
  function status(state: string) {
    const known = ['creating', 'creation_pending', 'pending', 'processing', 'paid', 'simulated', 'expired', 'failed', 'manual_review', 'partially_refunded', 'refunded', 'disputed'];
    return t('stripePayments.' + (known.includes(state) ? state : 'processing'));
  }
  return <section className="yj-panel mb-5 p-5" aria-label={t('stripePayments.title')}>
    <h3 className="font-medium">{t('stripePayments.title')}</h3>
    {error && <p role="alert" className="text-danger-fg">{error}</p>}
    {options?.status === 'available' && options.price ? <>
      {options.simulated && <p role="status">{t('stripePayments.testNotice')}</p>}
      <p>{t('stripePayments.unitPrice')}: {formatPaymentMoney(options.price.unit_amount, options.price.currency)}</p>
      <p>{t('stripePayments.total')}: {quantity === null ? '—' : formatPaymentMoney(options.price.unit_amount * quantity, options.price.currency)}</p>
      <Button type="button" disabled={busy || quantity === null} onClick={() => void buy()}>{t(options.simulated ? 'stripePayments.testPay' : 'stripePayments.pay')}</Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => { sessionStorage.removeItem('stripe-checkout:' + orgId); setSelected(null); }}>{t('stripePayments.newOrder')}</Button>
    </> : <p>{t('stripePayments.disabled')}</p>}
    {selected && <p role="status">{selected.id}: {status(selected.state)}{selected.simulated ? ' · ' + t('stripePayments.testNotice') : ''}</p>}
    <Button type="button" variant="ghost" disabled={busy} onClick={() => void refresh().catch(() => setError(t('stripePayments.loadFailed')))}>{t('stripePayments.refresh')}</Button>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th>{t('stripePayments.order')}</th><th>{t('stripePayments.credits')}</th><th>{t('stripePayments.total')}</th><th>{t('stripePayments.state')}</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td><button type="button" onClick={() => setSelected(o)}>{o.id}</button></td><td>{o.quantity}</td><td>{formatPaymentMoney(o.amount, o.currency)}</td><td>{status(o.state)}{o.simulated ? ' · ' + t('stripePayments.testPay') : ''}</td></tr>)}</tbody></table></div>
    <Button type="button" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t('stripePayments.previous')}</Button>
    <Button type="button" variant="ghost" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>{t('stripePayments.next')}</Button>
  </section>;
}
