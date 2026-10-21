import assert from 'node:assert/strict';
import books from '../data/books.json' with { type: 'json' };
import { hybridBookMatches } from '../utils/hybridSearch.js';
import { parsePriceConstraints, matchesPrice } from '../utils/searchConstraints.js';
import { searchBooks } from '../utils/bookSearch.js';
const minimums = ['40$ or more', '$40 or more', '40 dollars or more', '40$ ore more', 'at least 40', 'no less than $40', 'minimum of 40', 'not under 40'];
const strictMin = ['over 40', 'above $40', 'more than 40 dollars'];
const maximums = ['up to $40', 'at most 40', 'no more than $40', 'not over 40', '40$ or less', 'maximum of 40'];
const strictMax = ['under $40', 'below 40$', 'less than 40 dollars', 'cheaper than $40'];
for (const text of minimums) {
  const price = parsePriceConstraints(text);
  assert.equal(price.min, 40, text); assert.equal(price.max, null, text);
  assert.equal(matchesPrice(40, price), true, text); assert.equal(matchesPrice(39.99, price), false, text);
}
for (const text of strictMin) {
  const price = parsePriceConstraints(text);
  assert.equal(price.min, 40, text); assert.equal(matchesPrice(40, price), false, text);
}
for (const text of maximums) {
  const price = parsePriceConstraints(text);
  assert.equal(price.max, 40, text); assert.equal(price.min, null, text);
  assert.equal(matchesPrice(40, price), true, text); assert.equal(matchesPrice(40.01, price), false, text);
}
for (const text of strictMax) {
  const price = parsePriceConstraints(text);
  assert.equal(price.max, 40, text); assert.equal(matchesPrice(40, price), false, text);
}
for (const text of ['between $20 and $40', 'from 20 to 40', '$20–$40', '20-40 dollars']) {
  const price = parsePriceConstraints(text);
  assert.equal(price.min, 20, text); assert.equal(price.max, 40, text);
}
assert.equal(parsePriceConstraints('over 40 under 20').invalid, true);
assert.equal(parsePriceConstraints('under 20 any price').max, null);
for (const text of [...minimums, ...strictMin, ...maximums, ...strictMax]) {
  const result = searchBooks(`math cost ${text}`);
  assert.ok(result.books.length, text);
  for (const book of result.books) {
    assert.equal(book.topic, 'math', text);
    assert.ok(matchesPrice(book.price , result.constraints), `${text}: ${book.name}`);
  }
}
assert.ok(searchBooks('under $0').books.length === 0);
assert.ok(searchBooks('math above 100').books.length === 0);
console.log('Passed: minimum/maximum/range rules, equality boundaries, typo, suffix currencies, contradictory limits, topic and price filters.');

// Budget ranges must return every eligible catalog book, even when dense scores
// strongly prefer books outside the requested topic or price range.
const denseCandidates = books.map(book => ({ id: book.id, score: 0.99 }));
for (const topic of ['math', 'programming', 'cooking', 'art']) {
  for (const [min, max] of [[10, 20], [20, 40], [10.5, 19.09], [0, 0], [100, 200]]) {
    const expected = books.filter(book => book.topic === topic && book.price >= min && book.price <= max).map(book => book.id).sort();
    for (const range of [`${min}$ to ${max}$`, `$${min} to $${max}`, `${min} to ${max} dollars`, `${min}-${max}`, `between $${min} and $${max}`, `from ${min} to ${max}`]) {
      const query = `${topic} ${range}`;
      const parsed = parsePriceConstraints(query);
      assert.equal(parsed.min, min, query);
      assert.equal(parsed.max, max, query);
      assert.equal(parsed.freeText.trim(), topic, query);
      assert.ok(matchesPrice(min, parsed) && matchesPrice(max, parsed), query);
      assert.ok(!matchesPrice(min - 0.01, parsed) && !matchesPrice(max + 0.01, parsed), query);
      for (const candidates of [[], denseCandidates]) {
        assert.deepEqual(hybridBookMatches(query, candidates).map(row => row.book.id).sort(), expected, query);
      }
    }
  }
}
assert.equal(parsePriceConstraints('math 20$ to 10$').invalid, true);
assert.deepEqual(hybridBookMatches('math 20$ to 10$', denseCandidates), []);
console.log('Passed: 120 topic/range combinations with and without semantic candidates, inclusive boundaries, and reversed ranges.');
