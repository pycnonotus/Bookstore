import { useState } from 'react';
import { searchBooks } from '../utils/bookSearch';
import BookCard from './BookCard';

export default function BookChat({ savedIds, onSavedChange }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);

  function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    const result = searchBooks(text, query);
    setMessages(previous => [...previous.slice(-10), { role: 'user', text }, { role: 'assistant', text: result.answer }]);
    setMatches(result.books);
    setQuery(result.query);
    setInput('');
  }

  return <section id="book-chat" aria-labelledby="book-chat-title" className="border-b border-spruce/15 bg-white">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="book-chat-title" className="font-serif text-3xl sm:text-4xl">Find your next book</h2><p className="mt-3 text-sm text-ink/70">Search by title, author, topic, or budget. Runs entirely in your browser.</p></div>
        {messages.length > 0 && <button type="button" className="rounded border border-spruce/30 px-4 py-2 text-sm" onClick={() => { setMessages([]); setMatches([]); setQuery(''); setInput(''); }}>Clear chat</button>}
      </div>
      <p className="mt-4 text-xs text-ink/60">Catalog search with template replies, no live AI model. Prices are demo prices.</p>
      <div role="log" aria-label="Book search conversation" aria-live="polite" className="mt-6 max-h-80 space-y-3 overflow-y-auto rounded-xl bg-paper p-4">
        {!messages.length && <p className="text-sm">Try “books about math”, “JS libs”, or “flowers under $30”. Follow up with “something cheaper”.</p>}
        {messages.map((message, index) => <p key={index} className={`break-words rounded-lg p-3 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto max-w-xl bg-spruce text-white' : 'bg-white'}`}><span className="font-semibold">{message.role === 'user' ? 'You' : 'Bookshelf'}: </span>{message.text}</p>)}
      </div>
      <form onSubmit={send} className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row">
        <label htmlFor="book-question" className="sr-only">Ask about books</label>
        <input id="book-question" value={input} onChange={event => setInput(event.target.value)} maxLength={500} placeholder="What would you like to read?" className="min-w-0 flex-1 rounded-lg border border-spruce/30 px-4 py-3" />
        <button type="submit" disabled={!input.trim()} className="rounded-lg bg-spruce px-6 py-3 font-semibold text-white disabled:cursor-default disabled:opacity-50">Find books</button>
      </form>
      {matches.length > 0 && <div aria-label="Book search matches" className="mt-6 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-3">{matches.map(book => <BookCard key={book.id} book={book} saved={savedIds.has(book.id)} onSavedChange={saved => onSavedChange(book.id, saved)} />)}</div>}
    </div>
  </section>;
}
