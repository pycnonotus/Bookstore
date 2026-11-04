import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { formatMoney, loadOrders, paymentLabels, refreshPayment, startCheckout } from '../api/orders';

const descriptions = {
  waiting_for_payment: 'Your order is saved. Complete payment to confirm it.',
  processing: 'Your payment is being processed. We will update this page when it is confirmed.',
  payment_failed: 'Your payment did not go through. You can try again below.',
  checkout_expired: 'Your payment link expired. You can start a new checkout below.',
  paid: 'Thank you! Your payment has been confirmed.',
};

export default function OrderStatusPage() {
  const { id } = useParams();
  return <OrderDetails key={id} id={id} />;
}

function OrderDetails({ id }) {
  const [query] = useSearchParams();
  const returned = query.get('checkout');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState('');
  const [attempt, setAttempt] = useState(0);
  const action = useRef(null);
  // A slower poll must never replace a confirmed payment with an older response.
  const acceptOrder = data => setOrder(previous => previous?.status === 'paid' ? previous : data);

  useEffect(() => () => action.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    async function load() {
      try {
        const data = await loadOrders(id, controller.signal);
        if (controller.signal.aborted) return;
        acceptOrder(data);
        // The return URL is only a hint to check Stripe. It is never proof of payment.
        if (data.checkoutAvailable && data.status !== 'paid' && (returned === 'success' || data.status === 'processing')) {
          const refreshed = await refreshPayment(id, controller.signal);
          if (!controller.signal.aborted) acceptOrder(refreshed);
        }
      } catch (reason) { if (!controller.signal.aborted) setError(reason); }
    }
    load();
    return () => controller.abort();
  }, [id, returned, attempt]);

  const status = order?.status;
  useEffect(() => {
    if (!['waiting_for_payment', 'processing'].includes(status)) return;
    const controller = new AbortController();
    const deadline = Date.now() + 120000;
    let timer;
    async function poll() {
      try {
        const data = await loadOrders(id, controller.signal);
        if (!controller.signal.aborted) acceptOrder(data);
      } catch (reason) { if (!controller.signal.aborted) setError(reason); }
      if (!controller.signal.aborted && Date.now() < deadline) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, status]);

  async function payOrRefresh(kind) {
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'pay') {
        const checkout = await startCheckout(id, controller.signal);
        if (controller.signal.aborted) return;
        if (checkout.url) { window.location.assign(checkout.url); return; }
      }
      const data = await refreshPayment(id, controller.signal);
      if (!controller.signal.aborted) acceptOrder(data);
    } catch (reason) { if (!controller.signal.aborted) setError(reason); }
    finally {
      action.current = null;
      if (!controller.signal.aborted) setBusy('');
    }
  }

  return <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6" aria-labelledby="order-title">
    <h1 id="order-title" className="font-serif text-3xl text-spruce-deep">Your order</h1>
    {!order && !error && <p role="status" className="mt-6">Loading order…</p>}
    {error && <div role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
      <p>{error.message || 'Could not load your order. Please try again.'}</p>
      {error.status === 401 ? <a href={`/login?returnTo=${encodeURIComponent(`/orders/${id}`)}`} className="mt-2 inline-block underline">Log in again</a> :
        <button onClick={() => setAttempt(value => value + 1)} className="mt-2 underline">Try again</button>}
    </div>}
    {order && <div className="mt-6 rounded-xl border border-spruce/15 bg-white p-5 sm:p-7">
      <div aria-live="polite">
        <span className="inline-block rounded-full bg-spruce/10 px-3 py-1 text-sm font-semibold text-spruce">{paymentLabels[status] || 'Waiting for payment'}</span>
        <p className="mt-3 text-sm text-ink/70">{descriptions[status]}</p>
        {order.paidAt && <p className="mt-1 text-sm text-ink/70">Paid {new Date(order.paidAt).toLocaleString()}</p>}
        {returned === 'cancelled' && status === 'waiting_for_payment' && <p className="mt-3 text-sm text-ink/70">Checkout was cancelled. Your order is still saved, and you can pay whenever you are ready.</p>}
      </div>
      <p className="mt-6 break-all text-sm text-ink/70">Order {order.id}</p>
      <p className="mt-1 text-sm text-ink/70">Placed {new Date(order.createdAt).toLocaleString()}</p>
      <ul className="mt-5 divide-y divide-spruce/15">
        {order.items.map(item => <li key={item.bookId} className="flex justify-between gap-4 py-4">
          <div><h2 className="font-serif text-xl">{item.title}</h2><p className="text-sm text-ink/70">{item.quantity} × {formatMoney(item.unitPriceCents, order.currency)}</p></div>
          <p className="whitespace-nowrap font-semibold">{formatMoney(item.lineTotalCents, order.currency)}</p>
        </li>)}
      </ul>
      <p className="mt-4 border-t border-spruce/15 pt-5 text-xl font-semibold">Total: {formatMoney(order.totalCents, order.currency)}</p>
      {status !== 'paid' && (order.checkoutAvailable ? <div className="mt-5 flex flex-wrap items-center gap-4">
        {status !== 'processing' && <button disabled={Boolean(busy)} onClick={() => payOrRefresh('pay')} className="rounded-lg bg-spruce px-6 py-3 font-semibold text-white disabled:opacity-50">{busy === 'pay' ? 'Opening checkout…' : `Pay ${formatMoney(order.totalCents, order.currency)}`}</button>}
        <button disabled={Boolean(busy)} onClick={() => payOrRefresh('refresh')} className="py-2 text-sm text-spruce underline disabled:opacity-50">{busy === 'refresh' ? 'Checking payment…' : 'Refresh payment status'}</button>
        {status !== 'processing' && <p className="w-full text-sm text-ink/60">Secure payment with Stripe.</p>}
      </div> : <p className="mt-5 text-sm text-ink/70">Payments are temporarily unavailable. Your order is saved; please check back later.</p>)}
    </div>}
    <Link to="/orders" className="mt-6 inline-block text-spruce underline">All my orders</Link>
  </section>;
}
