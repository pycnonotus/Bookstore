import SaveToggle from './SaveToggle';
import { useCart } from '../context/CartContext';

export default function BookCard({book, saved, onSavedChange, headingAs: Heading = 'h3'}) {
    const cart = useCart();
    const quantity = cart.items.find(item => item.bookId === book.id)?.quantity || 0;
    const image = book.image || null;
    const price = book.price == null ? 'Price unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: book.currency || 'USD' }).format(book.price);
    return (
        <article
            className="mx-auto flex h-128 max-h-128 w-full max-w-112.5 min-w-0 flex-col rounded-xl border border-spruce/15 bg-white p-4">
            {image ? <img src={image} alt={`Cover of ${book.name}`} loading="lazy"
                 className="h-40 w-full shrink-0 rounded-lg bg-paper object-cover"/> : <div className="h-40 shrink-0 rounded-lg bg-paper" aria-label="Cover unavailable" />}
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-spruce">{book.topic}</p>
            <Heading title={book.name}
                     className="book-title mt-1 line-clamp-2 wrap-break-word font-serif text-xl font-semibold">{book.name}</Heading>
            <p title={book.auth} className="mt-1 truncate text-sm text-ink/65">{book.auth}</p>
            <p title={book.description}
               className="book-description mt-2 line-clamp-3 text-sm leading-5 text-ink/75">{book.description}</p>
            <div className="mt-auto shrink-0 border-t border-spruce/10 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-spruce-deep"><span className="sr-only">Price: </span><span
                        data-book-price className="text-xl tabular-nums">{price}</span></p>
                    <SaveToggle title={book.name} value={saved} onChange={onSavedChange}/>
                </div>
                <button type="button" disabled={book.price == null || quantity >= 99} onClick={() => cart.add(book.id)} aria-label={`Add ${book.name} to cart`} className="mt-3 w-full rounded-lg bg-spruce px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{quantity ? `Add another · ${quantity} in cart` : 'Add to cart'}</button>
            </div>
        </article>
    );
}
