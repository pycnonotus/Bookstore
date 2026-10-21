import SaveToggle from './SaveToggle';
import {getBookPrice} from '../utils/bookPrice';

export default function BookCard({book, saved, onSavedChange, headingAs: Heading = 'h3'}) {
    const image = new URL(`../../mock-data/photos/${book.image}`, import.meta.url).href;
    const price = `$${getBookPrice(book.name).toFixed(2)}`;
    const purchaseSubject = encodeURIComponent(`Book order: ${book.name}`);
    const purchaseBody = encodeURIComponent(`Hi, I'd like to buy a copy of "${book.name}" by ${book.auth}, listed at ${price}.\n\nPlease let me know about availability and how to place my order.\n\nThank you!`);
    return <article className="flex min-w-0 flex-col rounded-xl border border-spruce/15 bg-white p-4">
        <img src={image} alt={`Cover of ${book.name}`} loading="lazy"
             className="aspect-[4/3] w-full rounded-lg bg-paper object-cover"/>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-spruce">{book.topic}</p>
        <Heading className="mt-1 break-words font-serif text-xl font-semibold">{book.name}</Heading>
        <p className="mt-1 text-sm text-ink/65">{book.auth}</p>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/75">{book.description}</p>
        <div className="mt-5 border-t border-spruce/10 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-spruce-deep"><span className="sr-only">Price: </span><span
                    data-book-price className="text-xl tabular-nums">{price}</span></p>
                <SaveToggle title={book.name} value={saved} onChange={onSavedChange}/>
            </div>

        </div>
    </article>;
}
