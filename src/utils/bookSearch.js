import books from '../../mock-data/data.json' with { type: 'json' };
import { getBookPrice } from './bookPrice.js';

const stopWords = new Set('a an the i me my we you it is are was be have has do does can could would please find show recommend want need looking for some something book books read reading about on of and or to in with that this like enjoy more'.split(' '));
const aliases = { js: 'javascript jquery react vue angular', libs: 'library libraries jquery react vue angular', libraries: 'library jquery react vue angular', maths: 'math mathematics', mathematics: 'math', coding: 'programming code software', developer: 'programming software', painting: 'art color', paintings: 'art color', flowers: 'floral blooms', nature: 'landscapes mountains waters', calm: 'quiet tranquil silence', peaceful: 'quiet tranquil silence', beginner: 'introduction foundations basics', tech: 'technology programming', scifi: 'science fiction', space: 'cosmic universe astronomy' };
export function tokenize(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word));
}

// Built once at module load; no model, network, or vector database is required.
const documents = books.map(book => {
  const words = tokenize(`${book.name} ${book.name} ${book.auth} ${book.topic} ${book.topic} ${book.description} ${book.searchKeywords?.join(' ') || ''}`);
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return { book, counts, length: words.length };
});
const frequency = new Map();
for (const { counts } of documents) for (const word of counts.keys()) frequency.set(word, (frequency.get(word) || 0) + 1);

export function searchBooks(message, previousQuery = '') {
  const followUp = /\b(more|those|these|similar|cheaper|under|below|less than)\b/i.test(message);
  const query = (followUp ? `${previousQuery} ${message}` : message).slice(-2000);
  const words = tokenize(query);
  const expanded = [...new Set(words.flatMap(word => [word, ...tokenize(aliases[word] || '')]))];
  const budgetMatch = [...query.matchAll(/(?:under|below|less than|max(?:imum)?)\s*\$?\s*(\d+(?:\.\d{1,2})?)/gi)].at(-1);
  const budget = budgetMatch ? Number(budgetMatch[1]) : null;
  const terms = expanded.filter(word => !/^\d+$/.test(word) && !['under', 'below', 'less', 'than', 'max', 'maximum', 'cheaper', 'those', 'these', 'similar'].includes(word));
  const results = documents.map(({ book, counts, length }) => {
    let score = 0;
    for (const term of terms) {
      const count = counts.get(term) || 0;
      score += Math.log(1 + documents.length / (1 + (frequency.get(term) || 0))) * count / (count + 0.6 + 0.4 * length / 35);
    }
    if (book.name.toLowerCase().includes(message.toLowerCase().trim())) score += 10;
    return { book, score };
  }).filter(({ book, score }) => (score > 0 || (terms.length === 0 && budget !== null)) && (budget === null || getBookPrice(book.name) < budget))
    .sort((a, b) => /\bcheaper\b/i.test(message) ? getBookPrice(a.book.name) - getBookPrice(b.book.name) : b.score - a.score)
    .slice(0, 3).map(({ book }) => book);
  return { books: results, query, answer: results.length
    ? `Here ${results.length === 1 ? 'is a catalog match' : `are ${results.length} catalog matches`}${budget !== null ? ` under $${budget.toFixed(2)}` : ''}. ${results.map(book => `“${book.name}” — ${book.description}`).join(' ')}`
    : 'I couldn’t find a catalog match. Try a title, author, topic, or theme such as art, coding, or flowers.' };
}
