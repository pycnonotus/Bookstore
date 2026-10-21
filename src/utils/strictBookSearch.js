import books from '../../mock-data/data.json' with { type: 'json' };
import { MIN_SIMILARITY } from './embeddingSearch.js';
import { parsePriceConstraints, matchesPrice, explicitTopics } from './searchConstraints.js';
import { getBookPrice } from './bookPrice.js';

export function strictBookMatches(query, matches) {
  const constraints = parsePriceConstraints(query);
  const topics = explicitTopics(constraints.freeText);
  const byId = new Map(books.map(book => [book.id, book]));
  const seen = new Set();
  return matches.filter(match => Number.isFinite(match.score) && match.score >= MIN_SIMILARITY && match.score <= 1.000001)
    .map(match => ({ book: byId.get(match.id), score: Math.min(1, match.score) }))
    .filter(({ book }) => {
      if (!book || seen.has(book.id) || !matchesPrice(getBookPrice(book), constraints) || (topics.length && !topics.includes(book.topic))) return false;
      seen.add(book.id);
      return true;
    }).sort((a, b) => b.score - a.score);
}
