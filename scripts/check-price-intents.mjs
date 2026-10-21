import assert from 'node:assert/strict';
import { parsePriceConstraints, matchesPrice } from '../src/utils/searchConstraints.js';
import { searchBooks } from '../src/utils/bookSearch.js';
import { getBookPrice } from '../src/utils/bookPrice.js';
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
    assert.ok(matchesPrice(getBookPrice(book.name), result.constraints), `${text}: ${book.name}`);
  }
}
const followUp = searchBooks('at least $40', searchBooks('math books').query);
assert.ok(followUp.books.every(book => book.topic === 'math' && getBookPrice(book.name) >= 40));
assert.ok(searchBooks('under $0').books.length === 0);
assert.ok(searchBooks('math above 100').books.length === 0);
console.log('Passed: minimum/maximum/range rules, equality boundaries, typo, suffix currencies, contradictory limits, topic and budget follow-ups.');
