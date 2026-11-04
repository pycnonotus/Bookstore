import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney, loadOrders, paymentLabels } from '../api/orders';

export default function OrdersPage() {
  const [state, setState] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    loadOrders(undefined, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ status: 'ready', data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ status: 'error', error });
    });
    return () => controller.abort();
  }, [attempt]);

  return <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6" aria-labelledby="orders-title">
    <div className="flex items-center justify-between gap-4">
      <h1 id="orders-title" className="font-serif text-3xl text-spruce-deep">My orders</h1>
      <button disabled={state.status === 'loading'} onClick={() => setAttempt(value => value + 1)} className="text-sm text-spruce underline disabled:opacity-50">Refresh orders</button>
    </div>
    {state.status === 'loading' && <p role="status" className="mt-6">Loading orders…</p>}
    {state.status === 'error' && <div role="alert" className="mt-6"><p>{state.error.message}</p>
      {state.error.status === 401 ? <a href="/login?returnTo=%2Forders" className="mt-3 inline-block text-spruce underline">Log in again</a> :
        <button onClick={() => setAttempt(value => value + 1)} className="mt-3 text-spruce underline">Try again</button>}
    </div>}
    {state.status === 'ready' && (state.data.length ? <ul className="mt-6 space-y-4">
      {state.data.map(order => <li key={order.id}><Link to={`/orders/${order.id}`} className="block rounded-xl border border-spruce/15 bg-white p-5 hover:border-spruce">
        <div className="flex flex-wrap justify-between gap-3"><span className="font-semibold text-spruce">{paymentLabels[order.status] || 'Waiting for payment'}</span><span className="font-semibold">{formatMoney(order.totalCents, order.currency)}</span></div>
        <p className="mt-3 break-all text-sm">Order {order.id}</p><p className="mt-1 text-sm text-ink/65">{new Date(order.createdAt).toLocaleString()}</p>
        <span className="mt-3 inline-block text-sm text-spruce underline">View order</span>
      </Link></li>)}
    </ul> : <p className="mt-6">You haven't placed any orders yet. <Link to="/" className="text-spruce underline">Browse books</Link></p>)}
  </section>;
}
