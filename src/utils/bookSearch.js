import books from '../../mock-data/data.json' with { type: 'json' };
import { getBookPrice } from './bookPrice.js';
import { parsePriceConstraints, matchesPrice, explicitTopics } from './searchConstraints.js';
import { predictTopic } from './intentModel.js';
import intentModel from '../../rag/models/search-intent-model.json' with { type: 'json' };

const stopWords = new Set('a an the i me my we you it is are was be have has do does can could would please find show recommend want need looking for some something book books read reading about on of and or to in with that this like enjoy more'.split(' '));
const aliases = { js: 'javascript jquery react vue angular', libs: 'library libraries jquery react vue angular', libraries: 'library jquery react vue angular', maths: 'math mathematics', mathematics: 'math', coding: 'programming code software', developer: 'programming software', painting: 'art color', paintings: 'art color', flowers: 'floral blooms', nature: 'landscapes mountains waters', calm: 'quiet tranquil silence', peaceful: 'quiet tranquil silence', beginner: 'introduction foundations basics', tech: 'technology programming', scifi: 'science fiction', space: 'cosmic universe astronomy' };
export function tokenize(text) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word))
    .map(word => word === 'flowers' ? 'flower' : word === 'blooms' ? 'bloom' : word);
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

export function searchBooks(message, previousQuery = '', semanticMatches = []) {
  const followUp = /\b(more|those|these|similar|cheaper|under|below|less than|over|above|at least|at most|between|up to|any price)\b/i.test(message) && explicitTopics(message).length === 0;
  const query = (followUp ? `${previousQuery} ${message}` : message).slice(-2000);
  const price = parsePriceConstraints(query);
  const selectedTopics = explicitTopics(price.freeText);
  const prediction = predictTopic(price.freeText, intentModel);
  const words = tokenize(price.freeText);
  const expanded = [...new Set(words.flatMap(word => [word, ...tokenize(aliases[word] || '')]))];
  const terms = expanded.filter(word => !/^\d+$/.test(word) && !['under', 'below', 'less', 'than', 'max', 'maximum', 'cheaper', 'those', 'these', 'similar'].includes(word));
  const semanticScores = new Map(semanticMatches.map(match => [match.id, match.score]));
  const results = documents.map(({ book, counts, length }) => {
    let score = 0;
    for (const term of terms) {
      const count = counts.get(term) || 0;
      score += Math.log(1 + documents.length / (1 + (frequency.get(term) || 0))) * count / (count + 0.6 + 0.4 * length / 35);
    }
    if (book.name.toLowerCase().includes(message.toLowerCase().trim())) score += 10;
    // Preserve exact-name/keyword relevance while allowing meaning-only matches.
    score += Math.max(0, (semanticScores.get(book.id) || 0) - 0.25) * 8;
    if (prediction?.confidence > 0.8 && prediction.support >= 2 && prediction.topic === book.topic && score > 0) score += 1.5;
    return { book, score };
  }).filter(({ book, score }) => (score > 0 || (terms.length === 0 && (price.min !== null || price.max !== null))) && matchesPrice(getBookPrice(book), price) && (!selectedTopics.length || selectedTopics.includes(book.topic)))
    .sort((a, b) => /\bcheaper\b/i.test(message) ? getBookPrice(a.book) - getBookPrice(b.book) : b.score - a.score)
    .slice(0, 3).map(({ book }) => book);
  return { books: results, query, constraints: price, answer: results.length
    ? `Top ${results.length} ${results.length === 1 ? 'pick' : 'picks'}${price.description ? ` ${price.description}` : ''}: ${results.map(book => `“${book.name}” ($${getBookPrice(book).toFixed(2)})`).join('; ')}.`
    : price.invalid ? 'That price range conflicts. Try a minimum below your maximum, such as “math from $20 to $40”.'
      : `No matching books${price.description ? ` ${price.description}` : ''}. Try a different topic or price range.` };
}
