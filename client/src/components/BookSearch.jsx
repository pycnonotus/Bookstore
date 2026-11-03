import { useEffect, useRef, useState } from 'react';
import { hybridBookMatches } from '../utils/hybridSearch';
import { parsePriceConstraints } from '../utils/searchConstraints';

export default function BookSearch({ onResultsChange }) {
  const [input, setInput] = useState('');
  const [matches, setMatches] = useState([]);
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const workers = useRef({});
  const pending = useRef(null);
  const requestId = useRef(0);
  const generation = useRef(0);

  function clear() {
    generation.current++;
    pending.current?.reject(new Error('Search cleared'));
    setInput(''); setMatches([]); setError(''); setNotice(''); setSearched(false); setBusy(false);
    onResultsChange(null);
  }

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
    const current = ++generation.current;
    setBusy(true);
    setError('');
    setNotice('');
    setSearched(false);
    setMatches([]);
    setProgress('Preparing on-device search…');
    try {
      const constraints = parsePriceConstraints(query);
      if (constraints.invalid) throw new Error('The minimum price must not exceed the maximum price.');
      const kind = /\b(cover|picture|image|looks like|photo|front)\b/i.test(query) ? 'cover' : 'text';
      const quick = hybridBookMatches(query, [], { kind });
      setMatches(quick);
      onResultsChange(quick);
      try {
        const results = await retrieve(constraints.freeText.trim() || query, kind);
        if (current !== generation.current) return;
        const refined = hybridBookMatches(query, results, { kind });
        setMatches(refined);
        onResultsChange(refined);
      } catch {
        if (current !== generation.current) return;
        setNotice('Showing catalog matches while semantic search is unavailable.');
        setMatches(quick);
      }
      setSearched(true);
      setProgress('');
    } catch (reason) { if (current === generation.current) { setError(reason.message); setProgress(''); onResultsChange([]); } }
    finally { if (current === generation.current) setBusy(false); }
  }

  return <div id="book-search" className="mb-5 border-b border-spruce/15 pb-5">
      <label htmlFor="book-question" className="text-sm font-semibold text-spruce-deep">Search our shelves</label>
      <p className="mt-1 text-sm text-ink/65">Try “math books”, “JS libs”, or describe a cover. Combine your search with topics below.</p>
      <form role="search" aria-label="Book search" onSubmit={search} className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row">
        <input id="book-question" type="search" value={input} onChange={event => event.target.value ? setInput(event.target.value) : clear()} maxLength={1000} placeholder="Title, topic, cover description, or price…" className="min-w-0 flex-1 rounded-lg border border-spruce/30 px-4 py-3" />
        <button type="submit" disabled={!input.trim() || busy} className="rounded-lg bg-spruce px-6 py-3 font-semibold text-white disabled:cursor-default disabled:opacity-50">{busy ? 'Searching…' : 'Search'}</button>
        {(input || searched) && <button type="button" onClick={clear} className="rounded-lg border border-spruce/30 px-4 py-3 text-sm text-spruce">Clear search</button>}
      </form>
      {notice && <p className="mt-2 text-xs text-ink/70">{notice}</p>}
      <p role="status" aria-live="polite" className="mt-3 text-sm text-ink/70">{busy ? progress : error || (searched ? matches.length ? `${matches.length} matching ${matches.length === 1 ? 'book' : 'books'}` : 'No matching books. Try a different topic or price range.' : '')}</p>
  </div>;
}
