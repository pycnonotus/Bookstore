import SaveToggle from './SaveToggle';

export default function BookCard({book, saved, onSavedChange, headingAs: Heading = 'h3'}) {
    const image = `${import.meta.env.BASE_URL}images/${encodeURIComponent(book.image)}`;
    const price = `$${book.price.toFixed(2)}`;
    const purchaseSubject = encodeURIComponent(`Book order: ${book.name}`);
    const purchaseBody = encodeURIComponent(`Hi, I'd like to buy a copy of "${book.name}" by ${book.auth}, listed at ${price}.\n\nPlease let me know about availability and how to place my order.\n\nThank you!`);
    return <article className="mx-auto flex h-[450px] max-h-[450px] w-full max-w-[450px] min-w-0 flex-col rounded-xl border border-spruce/15 bg-white p-4">
        <img src={image} alt={`Cover of ${book.name}`} loading="lazy"
             className="h-40 w-full shrink-0 rounded-lg bg-paper object-cover"/>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-spruce">{book.topic}</p>
        <Heading title={book.name} className="book-title mt-1 line-clamp-2 break-words font-serif text-xl font-semibold">{book.name}</Heading>
        <p title={book.auth} className="mt-1 truncate text-sm text-ink/65">{book.auth}</p>
        <p title={book.description} className="book-description mt-2 line-clamp-3 text-sm leading-5 text-ink/75">{book.description}</p>
        <div className="mt-auto shrink-0 border-t border-spruce/10 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-spruce-deep"><span className="sr-only">Price: </span><span
                    data-book-price className="text-xl tabular-nums">{price}</span></p>
                <SaveToggle title={book.name} value={saved} onChange={onSavedChange}/>
            </div>

        </div>
    </article>;
}
