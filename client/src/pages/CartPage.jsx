import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import useCatalog from '../hooks/useCatalog';
import { authClient } from '../api/auth';
import { formatMoney, placeOrder } from '../api/orders';

export default function CartPage() {
  const cart = useCart();
  const { books, status, retry } = useCatalog();
  const { data: session, isPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const navigate = useNavigate();
  const lines = cart.items.map(item => ({ ...item, book: books.find(book => book.id === item.bookId) }));
  const unavailable = lines.some(line => !line.book || !Number.isInteger(line.book.priceCents) || line.book.priceCents < 0);
  const currencies = new Set(lines.map(line => line.book?.currency));
  const total = lines.reduce((sum, line) => sum + (line.book?.priceCents || 0) * line.quantity, 0);
  const currency = lines[0]?.book?.currency || 'USD';

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const order = await placeOrder(cart);
      cart.clear(cart.requestId);
      navigate(`/orders/${order.id}`);
    } catch (reason) {
      if (reason.status === 401) {
        window.location.assign('/login?returnTo=%2Fcart');
        return;
      }
      setError(reason.message || 'Could not place your order. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6" aria-labelledby="cart-title">
    <h1 id="cart-title" className="font-serif text-3xl text-spruce-deep">Your cart</h1>
    {!cart.items.length ? <div className="mt-6"><p>Your cart is empty.</p><Link to="/" className="mt-4 inline-block text-spruce underline">Browse books</Link></div> : <>
      {status === 'loading' && <p role="status" className="mt-6">Loading your books…</p>}
      {status === 'error' && <p role="alert" className="mt-6">Could not load your books. <button onClick={retry} className="underline">Try again</button></p>}
      {status === 'ready' && <>
        <ul className="mt-6 divide-y divide-spruce/15 rounded-xl border border-spruce/15 bg-white px-5">
          {lines.map(({ bookId, book, quantity }) => <li key={bookId} className="flex flex-wrap items-center gap-4 py-5">
            {book?.image && <img src={book.image} alt="" className="h-24 w-16 rounded object-cover" />}
            <div className="min-w-0 flex-1"><h2 className="font-serif text-xl">{book?.name || 'Unavailable book'}</h2>
              <p className="mt-1 text-sm text-ink/70">{book && book.priceCents !== null ? formatMoney(book.priceCents, book.currency) : 'Price unavailable'}</p>
            </div>
            <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
            <label className="text-sm">Quantity<span className="sr-only"> for {book?.name || 'unavailable book'}</span>
              <input type="number" min="1" max="99" value={quantity} disabled={busy} onChange={event => { const next = Number(event.target.value); if (next >= 1 && next <= 99) cart.setQuantity(bookId, next); setError(''); }} className="ml-2 w-16 rounded border border-spruce/30 p-2" />
            </label>
            <button disabled={busy} onClick={() => { cart.setQuantity(bookId, 0); setError(''); }} className="text-sm text-spruce underline" aria-label={`Remove ${book?.name || 'unavailable book'}`}>Remove</button>
            </div>
          </li>)}
        </ul>
        <div className="mt-6 rounded-xl border border-spruce/15 bg-white p-5">
          {!unavailable && currencies.size === 1 && <p className="text-xl font-semibold">Total: {formatMoney(total, currency)}</p>}
          {unavailable && <p role="alert">Remove unavailable books before placing your order.</p>}
          {currencies.size > 1 && <p role="alert">Please order books in one currency at a time.</p>}
          <p className="mt-2 text-sm text-ink/70">Your order will be saved as waiting for payment. No payment is taken yet.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
          {isPending ? <p role="status" className="mt-4">Checking your session…</p> : session ?
            <button disabled={busy || unavailable || currencies.size !== 1} onClick={submit} className="mt-5 rounded-lg bg-spruce px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Placing order…' : 'Place order'}</button> :
            <Link to="/login?returnTo=%2Fcart" className="mt-5 inline-block rounded-lg bg-spruce px-6 py-3 font-semibold text-white">Log in to place order</Link>}
        </div>
      </>}
    </>}
  </section>;
}
