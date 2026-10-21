import SaveToggle from './SaveToggle';

export default function BookCard({ book, saved, onSavedChange }) {
  const image = new URL(`../../mock-data/photos/${book.image}`, import.meta.url).href;
  return <article className="flex min-w-0 flex-col rounded-xl border border-spruce/15 bg-white p-4">
    <img src={image} alt={`Cover of ${book.name}`} loading="lazy" className="aspect-[4/3] w-full rounded-lg bg-paper object-cover" />
    <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-spruce">{book.topic}</p>
    <h3 className="mt-1 break-words font-serif text-xl font-semibold">{book.name}</h3>
    <p className="mt-1 text-sm text-ink/65">{book.auth}</p>
    <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/75">{book.description}</p>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-spruce/10 pt-4">
      <span className="text-xs text-ink/60">Your next chapter</span>
      <SaveToggle title={book.name} value={saved} onChange={onSavedChange} />
    </div>
  </article>;
}
