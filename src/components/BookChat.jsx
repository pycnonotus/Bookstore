import { useEffect, useRef, useState } from 'react';
import { searchBooks } from '../utils/bookSearch';
import BookCard from './BookCard';
import books from '../../mock-data/data.json' with { type: 'json' };
import { matchesPrice, explicitTopics } from '../utils/searchConstraints';
import { getBookPrice } from '../utils/bookPrice';

export default function BookChat({ savedIds, onSavedChange }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [semanticStatus, setSemanticStatus] = useState('off');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const workerRef = useRef(null);
  const pendingRef = useRef(null);
  const coverWorkerRef = useRef(null);
  useEffect(() => () => {
    workerRef.current?.terminate();
    coverWorkerRef.current?.terminate();
    pendingRef.current?.reject(new Error('Search closed'));
  }, []);

  async function searchCovers(text) {
    if (!coverWorkerRef.current) coverWorkerRef.current = new Worker(new URL('../workers/coverEmbeddings.js', import.meta.url), { type: 'module' });
    return new Promise((resolve, reject) => {
      const worker = coverWorkerRef.current;
      const timer = setTimeout(() => { worker.terminate(); coverWorkerRef.current = null; reject(new Error('Cover search timed out')); }, 180000);
      worker.onerror = () => { clearTimeout(timer); reject(new Error('Cover search unavailable')); };
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') setProgress(data.message);
        if (data.type === 'error') { clearTimeout(timer); reject(new Error(data.message)); }
        if (data.type === 'results') { clearTimeout(timer); resolve(data.matches); }
      };
      worker.postMessage({ query: text });
    });
  }

  function enableSemantic() {
    workerRef.current?.terminate();
    setSemanticStatus('loading');
    setProgress('Starting on-device search…');
    const worker = new Worker(new URL('../workers/bookEmbeddings.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    function failed() {
      setSemanticStatus('error');
      setProgress('Semantic search could not load. Text search is still available.');
      pendingRef.current?.reject(new Error('Semantic search unavailable'));
      pendingRef.current = null;
    }
    worker.onerror = failed;
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') setProgress(data.message);
      if (data.type === 'ready') { setSemanticStatus('ready'); setProgress('Semantic search ready. All processing stays on this device.'); }
      if (data.type === 'error') failed();
      if (data.type === 'results' && pendingRef.current?.id === data.id) {
        pendingRef.current.resolve(data.matches);
        pendingRef.current = null;
      }
    };
    worker.postMessage({ type: 'init' });
  }

  async function semanticSearch(query) {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      const timer = setTimeout(() => { pendingRef.current = null; reject(new Error('Search timed out')); }, 30000);
      pendingRef.current = { id, resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } };
      workerRef.current.postMessage({ type: 'search', id, query });
    });
  }

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    let result = searchBooks(text, query);
    if (/\b(cover|picture|image|looks like|photo|front)\b/i.test(result.query)) {
      setProgress('Searching cover images locally. First use loads the vision model and indexes our covers.');
      try {
        const visual = await searchCovers(result.constraints.freeText);
        const topics = explicitTopics(result.constraints.freeText);
        const matched = visual.map(match => books.find(book => book.id === match.id)).filter(book => book && matchesPrice(getBookPrice(book.name), result.constraints) && (!topics.length || topics.includes(book.topic))).slice(0, 3);
        result = { ...result, books: matched, answer: matched.length ? `Top ${matched.length} picks by cover image${result.constraints.description ? ` ${result.constraints.description}` : ''}: ` + matched.map(book => `"${book.name}"`).join('; ') + '. Visual matches are approximate.' : 'No cover matches within those filters. Try a different price range.' };
        setProgress('Cover-image matches ready. All processing stayed in your browser.');
      } catch { setProgress('Cover-image search unavailable. Showing catalog text matches.'); }
    } else if (semanticStatus === 'ready') {
      try { result = searchBooks(text, query, await semanticSearch(result.query)); }
      catch { setProgress('Semantic search failed. Showing text matches.'); }
    }
    setMessages(previous => [...previous.slice(-10), { role: 'user', text }, { role: 'assistant', text: result.answer }]);
    setMatches(result.books);
    setQuery(result.query);
    setInput('');
    setBusy(false);
  }

  return <section id="book-chat" aria-labelledby="book-chat-title" className="border-b border-spruce/15 bg-white">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="book-chat-title" className="font-serif text-3xl sm:text-4xl">Find your next book</h2><p className="mt-3 text-sm text-ink/70">Search by title, author, topic, or budget. Runs entirely in your browser.</p></div>
        {messages.length > 0 && <button type="button" disabled={busy} className="rounded border border-spruce/30 px-4 py-2 text-sm" onClick={() => { setMessages([]); setMatches([]); setQuery(''); setInput(''); }}>Clear chat</button>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={semanticStatus === 'loading' || semanticStatus === 'ready'} onClick={enableSemantic} className="rounded border border-spruce/30 px-4 py-2 text-sm disabled:opacity-60">{semanticStatus === 'ready' ? 'Semantic search enabled' : semanticStatus === 'loading' ? 'Preparing semantic search…' : 'Enable semantic search'}</button>
        <p className="text-xs text-ink/60">Optional browser model download (about 23 MB plus runtime), cached for later visits. No local server needed.</p>
      </div>
      <p role="status" className="mt-3 text-xs text-ink/70">{progress || 'Text search ready. Replies use catalog descriptions. Prices are demo prices.'}</p>
      <div role="log" aria-label="Book search conversation" aria-live="polite" className="mt-6 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-paper p-4">
        {!messages.length && <p className="text-sm">Try “books about math”, “JS libs”, or “the book with flowers on the cover”. Follow up with “something cheaper”.</p>}
        {messages.map((message, index) => <p key={index} className={`break-words rounded-lg p-3 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto max-w-xl bg-spruce text-white' : 'bg-white'}`}><span className="font-semibold">{message.role === 'user' ? 'You' : 'Bookshelf'}: </span>{message.text}</p>)}
      </div>
      <form onSubmit={send} className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row">
        <label htmlFor="book-question" className="sr-only">Ask about books</label>
        <input id="book-question" value={input} onChange={event => setInput(event.target.value)} maxLength={500} placeholder="What would you like to read?" className="min-w-0 flex-1 rounded-lg border border-spruce/30 px-4 py-3" />
        <button type="submit" disabled={!input.trim() || busy} className="rounded-lg bg-spruce px-6 py-3 font-semibold text-white disabled:cursor-default disabled:opacity-50">{busy ? 'Searching…' : 'Find books'}</button>
      </form>
      {matches.length > 0 && <div aria-label="Book search matches" className="mt-6 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-3">{matches.map(book => <BookCard key={book.id} book={book} saved={savedIds.has(book.id)} onSavedChange={saved => onSavedChange(book.id, saved)} />)}</div>}
    </div>
  </section>;
}
