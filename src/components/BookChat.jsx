import { useEffect, useRef, useState } from 'react';
import BookCard from './BookCard';
import { strictBookMatches } from '../utils/strictBookSearch';
import { parsePriceConstraints } from '../utils/searchConstraints';

export default function BookChat({ savedIds, onSavedChange }) {
  const [input, setInput] = useState('');
  const [matches, setMatches] = useState([]);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const workers = useRef({});
  const pending = useRef(null);
  const requestId = useRef(0);

  useEffect(() => () => {
    Object.values(workers.current).forEach(worker => worker.terminate());
    pending.current?.reject(new Error('Search closed'));
  }, []);

  function retrieve(query, kind) {
    if (!workers.current[kind]) {
      const worker = kind === 'cover'
        ? new Worker(new URL('../workers/coverEmbeddings.js', import.meta.url), { type: 'module' })
        : new Worker(new URL('../workers/bookEmbeddings.js', import.meta.url), { type: 'module' });
      workers.current[kind] = worker;
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') setProgress(data.message);
        if (data.type === 'results' && pending.current?.id === data.id) pending.current.resolve(data.matches);
        if (data.type === 'error' && pending.current?.id === data.id) pending.current.reject(new Error(data.message));
      };
      worker.onerror = () => pending.current?.reject(new Error('The browser search model could not load. Please try again.'));
    }
    return new Promise((resolve, reject) => {
      const id = ++requestId.current;
      const finish = callback => value => { clearTimeout(timer); pending.current = null; callback(value); };
      const timer = setTimeout(() => {
        workers.current[kind]?.terminate();
        delete workers.current[kind];
        pending.current?.reject(new Error('Search took too long. Please try again.'));
      }, 180000);
      pending.current = { id, resolve: finish(resolve), reject: finish(reject) };
      workers.current[kind].postMessage({ type: 'search', id, query });
    });
  }

  async function search(event) {
    event.preventDefault();
    const query = input.trim();
    if (!query || busy) return;
    setBusy(true);
    setError('');
    setSearched(false);
    setMatches([]);
    setProgress('Preparing on-device search…');
    try {
      const constraints = parsePriceConstraints(query);
      if (constraints.invalid) throw new Error('The minimum price must not exceed the maximum price.');
      const kind = /\b(cover|picture|image|looks like|photo|front)\b/i.test(query) ? 'cover' : 'text';
      const results = await retrieve(constraints.freeText.trim() || query, kind);
      setMatches(strictBookMatches(query, results));
      setSearched(true);
      setProgress('');
    } catch (reason) { setError(reason.message); setProgress(''); }
    finally { setBusy(false); }
  }

  return <section id="book-chat" aria-labelledby="book-chat-title" className="border-b border-spruce/15 bg-white">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h2 id="book-chat-title" className="font-serif text-3xl sm:text-4xl">Find your next book</h2>
      <p className="mt-3 text-sm text-ink/70">Describe a book, topic, or cover. Only results with similarity ≥ 0.9 are shown.</p>
      <form role="search" aria-label="Book search" onSubmit={search} className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row">
        <label htmlFor="book-question" className="sr-only">Search books</label>
        <input id="book-question" type="search" value={input} onChange={event => setInput(event.target.value)} maxLength={1000} placeholder="Title, topic, cover description, or price…" className="min-w-0 flex-1 rounded-lg border border-spruce/30 px-4 py-3" />
        <button type="submit" disabled={!input.trim() || busy} className="rounded-lg bg-spruce px-6 py-3 font-semibold text-white disabled:cursor-default disabled:opacity-50">{busy ? 'Searching…' : 'Search'}</button>
      </form>
      <p className="mt-3 text-xs text-ink/60">Runs in your browser. Search models load on first use and are cached on this device.</p>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-ink/70">{busy ? progress : error || (searched ? matches.length ? `${matches.length} matching ${matches.length === 1 ? 'book' : 'books'}` : 'No results with similarity ≥ 0.9. Try a more specific description.' : '')}</p>
      <div aria-label="Book search results" aria-busy={busy} className="mt-6 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-3">
        {matches.map(({ book, score }) => <div key={book.id} data-similarity={score} className="min-w-0">
          <p className="mb-2 text-sm text-spruce">Similarity: {score.toFixed(3)}</p>
          <BookCard book={book} saved={savedIds.has(book.id)} onSavedChange={saved => onSavedChange(book.id, saved)} />
        </div>)}
      </div>
    </div>
  </section>;
}
