import books from '../../mock-data/data.json';
import BookCard from './BookCard';

const picks = books.filter(book => book.staffPick);

export default function StaffPicks({ savedIds, onSavedChange }) {
  return <section id="staff-picks" aria-labelledby="staff-picks-title" className="border-y border-spruce/15 bg-amber-50">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-spruce">From our booksellers</p>
      <h2 id="staff-picks-title" className="mt-2 font-serif text-3xl sm:text-4xl">Staff picks</h2>
      <p className="mt-3 text-ink/70">A few favorites, with a personal note from the people behind the shelves.</p>
      <div className="mt-8 grid min-w-0 grid-cols-1 gap-6 md:grid-cols-3">
        {picks.map(book => <div key={book.id} className="flex min-w-0 flex-col gap-4">
          <BookCard book={book} saved={savedIds.has(book.id)} onSavedChange={saved => onSavedChange(book.id, saved)} />
          <blockquote className="border-l-2 border-spruce pl-4 text-sm leading-relaxed">
            <p>“{book.staffPick.quote}”</p>
            <footer className="mt-2 font-semibold text-spruce">— {book.staffPick.staff}</footer>
          </blockquote>
        </div>)}
      </div>
    </div>
  </section>;
}
