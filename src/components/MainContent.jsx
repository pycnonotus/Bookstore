import { useState } from 'react';
import books from '../../mock-data/data.json';
import BookCard from './BookCard';

const topicGroups = [...new Set(books.map(book => book.topic))].sort().map(topic => ({
  topic,
  title: topic[0].toUpperCase() + topic.slice(1),
  books: books.filter(book => book.topic === topic),
}));

export default function MainContent({ savedIds, onSavedChange }) {
  const [selectedTopics, setSelectedTopics] = useState([]);
  const visibleGroups = topicGroups.filter(group => selectedTopics.length === 0 || selectedTopics.includes(group.topic));
  const visibleBookCount = visibleGroups.reduce((count, group) => count + group.books.length, 0);

  function toggleTopic(topic) {
    setSelectedTopics(previous => previous.includes(topic)
      ? previous.filter(item => item !== topic)
      : [...previous, topic]);
  }

  return <section id="catalog" aria-labelledby="catalog-title" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <div className="mb-8">
      <h2 id="catalog-title" className="font-serif text-3xl sm:text-4xl">On our shelves</h2>
      <p className="mt-2 text-ink/70">Find a new perspective. Keep a few favorites.</p>
    </div>
    <div className="rounded-2xl border border-spruce/15 bg-white/70 p-4 sm:p-5">
      <fieldset aria-describedby="topic-filter-hint" className="min-w-0">
        <legend className="text-sm font-semibold text-spruce-deep">Browse by topic</legend>
        <p id="topic-filter-hint" className="mt-1 text-sm text-ink/65">Choose one or more topics. With none selected, explore every shelf.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="topic-reset" aria-pressed={selectedTopics.length === 0} aria-controls="topic-results" onClick={() => setSelectedTopics([])}>All topics</button>
          {topicGroups.map(group => <label key={group.topic} className="topic-option">
            <input type="checkbox" className="topic-input sr-only" name="topics" value={group.topic} checked={selectedTopics.includes(group.topic)} onChange={() => toggleTopic(group.topic)} aria-controls="topic-results" />
            <span className="topic-chip">
              <span className="topic-check" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span>{group.title}</span>
              <span className="topic-chip-count">{group.books.length}</span>
            </span>
          </label>)}
        </div>
      </fieldset>
    </div>
    <p role="status" className="mb-8 mt-5 text-sm text-ink/65">
      {visibleBookCount} books · {savedIds.size} saved · {selectedTopics.length === 0 ? 'All topics' : `${selectedTopics.length} ${selectedTopics.length === 1 ? 'topic' : 'topics'} selected`}
    </p>
    <div id="topic-results" className="space-y-12">
      {visibleGroups.map((group, groupIndex) => <section key={group.topic} data-topic={group.topic} aria-labelledby={`topic-${group.topic}-title`} className="topic-section min-w-0" style={{ '--reveal-delay': `${groupIndex * 45}ms` }}>
        <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 id={`topic-${group.topic}-title`} className="font-serif text-2xl font-semibold text-spruce-deep sm:text-3xl">{group.title}</h3>
          <span className="topic-section-count rounded-full bg-spruce/10 px-3 py-1 text-xs font-semibold text-spruce">{group.books.length} books</span>
          <span aria-hidden="true" className="h-px min-w-8 flex-1 bg-spruce/20" />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {group.books.map((book, bookIndex) => <div key={book.id} className="topic-book flex min-w-0 flex-col" style={{ '--card-delay': `${Math.min(bookIndex, 5) * 35}ms` }}>
            <BookCard book={book} headingAs="h4" saved={savedIds.has(book.id)} onSavedChange={saved => onSavedChange(book.id, saved)} />
          </div>)}
        </div>
      </section>)}
    </div>
  </section>;
}
