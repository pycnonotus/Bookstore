import assert from 'node:assert/strict';
import { searchBooks } from '../src/utils/bookSearch.js';
import { getBookPrice } from '../src/utils/bookPrice.js';

const math = searchBooks('book about math');
assert.equal(math.books.length, 3);
assert.ok(math.books.every(book => book.topic === 'math'));
const js = searchBooks('js libs');
assert.ok(js.books.some(book => /jquery/i.test(book.name)));
assert.ok(js.books.some(book => /react/i.test(book.name)));
assert.ok(js.books.every(book => book.topic === 'programming'));
const budget = searchBooks('under $30', js.query);
assert.ok(budget.books.length > 0);
assert.ok(budget.books.every(book => getBookPrice(book.name) < 30));
assert.equal(searchBooks('zzzznonexistent').books.length, 0);
assert.equal(searchBooks('Forms of Silence').books[0].name, 'Forms of Silence');
console.log('Passed: math, JS libraries, budget follow-ups, unknown queries, exact title.');
