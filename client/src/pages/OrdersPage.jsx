import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatMoney, loadOrders } from '../api/orders';

const statusLabel = order => order.status === 'paid' ? 'Paid' : 'Waiting for payment';

export default function OrdersPage() {
  const { id } = useParams();
  const [result, setState] = useState({ status: 'loading' });
  const state = result.id === id ? result : { status: 'loading' };
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ id, status: 'loading' });
    loadOrders(id, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ id, status: 'ready', data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ id, status: 'error', error });
    });
    return () => controller.abort();
  }, [id, attempt]);

  return <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6" aria-labelledby="orders-title">
    <h1 id="orders-title" className="font-serif text-3xl text-spruce-deep">{id ? 'Your order' : 'My orders'}</h1>
    {state.status === 'loading' && <p role="status" className="mt-6">Loading orders…</p>}
    {state.status === 'error' && <div role="alert" className="mt-6"><p>{state.error.message}</p>
      {state.error.status === 401 ? <a href={`/login?returnTo=${encodeURIComponent(id ? `/orders/${id}` : '/orders')}`} className="mt-3 inline-block text-spruce underline">Log in again</a> :
        <button onClick={() => setAttempt(value => value + 1)} className="mt-3 text-spruce underline">Try again</button>}
    </div>}
    {state.status === 'ready' && (id ? <>
      <div className="mt-6 rounded-xl border border-spruce/15 bg-white p-5 sm:p-7">
        <span className="rounded-full bg-spruce/10 px-3 py-1 text-sm font-semibold text-spruce">{statusLabel(state.data)}</span>
        <p className="mt-4 break-all text-sm text-ink/70">Order {state.data.id}</p>
        <p className="mt-1 text-sm text-ink/70">Placed {new Date(state.data.createdAt).toLocaleString()}</p>
        <ul className="mt-5 divide-y divide-spruce/15">
          {state.data.items.map(item => <li key={item.bookId} className="flex justify-between gap-4 py-4">
            <div><h2 className="font-serif text-xl">{item.title}</h2><p className="text-sm text-ink/70">{item.quantity} × {formatMoney(item.unitPriceCents, state.data.currency)}</p></div>
            <p className="whitespace-nowrap font-semibold">{formatMoney(item.lineTotalCents, state.data.currency)}</p>
          </li>)}
        </ul>
        <p className="mt-4 border-t border-spruce/15 pt-5 text-xl font-semibold">Total: {formatMoney(state.data.totalCents, state.data.currency)}</p>
        {state.data.status === 'waiting_for_payment' && <p className="mt-3 text-sm text-ink/70">Your order is saved. Payment will be available here soon.</p>}
      </div>
      <Link to="/orders" className="mt-6 inline-block text-spruce underline">All my orders</Link>
    </> : state.data.length ? <ul className="mt-6 space-y-4">
      {state.data.map(order => <li key={order.id}><Link to={`/orders/${order.id}`} className="block rounded-xl border border-spruce/15 bg-white p-5 hover:border-spruce">
        <div className="flex flex-wrap justify-between gap-3"><span className="font-semibold text-spruce">{statusLabel(order)}</span><span className="font-semibold">{formatMoney(order.totalCents, order.currency)}</span></div>
        <p className="mt-3 break-all text-sm">Order {order.id}</p><p className="mt-1 text-sm text-ink/65">{new Date(order.createdAt).toLocaleString()}</p>
      </Link></li>)}
    </ul> : <p className="mt-6">You haven't placed any orders yet. <Link to="/" className="text-spruce underline">Browse books</Link></p>)}
  </section>;
}
