import { useState } from 'react';
import books from '../../mock-data/data.json';
import BookCard from './BookCard';

const topics = [...new Set(books.map(book => book.topic))].sort();

export default function MainContent({ savedIds, onSavedChange }) {
  const [topic, setTopic] = useState('all');
  const visibleBooks = books.filter(book => topic === 'all' || book.topic === topic);


  return <section id="catalog" aria-labelledby="catalog-title" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 id="catalog-title" className="font-serif text-3xl sm:text-4xl">On our shelves</h2><p className="mt-2 text-ink/70">Find a new perspective. Keep a few favorites.</p></div>
      <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold">Browse by topic
        <select value={topic} onChange={event => setTopic(event.target.value)} className="w-full min-w-0 rounded-lg border border-spruce/30 bg-white px-4 py-3 sm:w-52">
          <option value="all">All topics</option>
          {topics.map(item => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
        </select>
      </label>
    </div>
    <p role="status" className="mb-5 text-sm text-ink/65">{visibleBooks.length} books · {savedIds.size} saved</p>
    <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {visibleBooks.map(book => <BookCard key={book.id} book={book} saved={savedIds.has(book.id)} onSavedChange={saved => onSavedChange(book.id, saved)} />)}
    </div>
  </section>;
}
