import assert from 'node:assert/strict';
import { searchBooks } from '../../src/utils/bookSearch.js';
import { getBookPrice } from '../../src/utils/bookPrice.js';
import books from '../../src/data/books.json' with { type: 'json' };
for (const book of books) {
  assert.ok(Number.isFinite(book.price) && book.price >= 0, `${book.name} needs a valid catalog price`);
  assert.equal(book.currency, 'USD');
  assert.equal(getBookPrice(book), book.price);
}
assert.equal(getBookPrice({ ...books[0], price: 12.34 }), 12.34, 'Stored price must win over the book title');
assert.throws(() => getBookPrice({ ...books[0], price: undefined }), /Invalid catalog price/);
assert.throws(() => getBookPrice({ ...books[0], price: -1 }), /Invalid catalog price/);

const math = searchBooks('book about math');
assert.equal(math.books.length, 3);
assert.ok(math.books.every(book => book.topic === 'math'));
const js = searchBooks('js libs');
assert.ok(js.books.some(book => /jquery/i.test(book.name)));
assert.ok(js.books.some(book => /react/i.test(book.name)));
assert.ok(js.books.every(book => book.topic === 'programming'));
const budget = searchBooks('under $30', js.query);
assert.ok(budget.books.length > 0);
assert.ok(budget.books.every(book => getBookPrice(book) < 30));
assert.equal(searchBooks('zzzznonexistent').books.length, 0);
assert.equal(searchBooks('Forms of Silence').books[0].name, 'Forms of Silence');
assert.ok(searchBooks('flower').books.some(book => book.name === 'The Fleeting Beauty'), 'Singular flower should find The Fleeting Beauty');
assert.ok(searchBooks('flowers').books.some(book => book.name === 'The Fleeting Beauty'), 'Plural flowers should find The Fleeting Beauty');
console.log('Passed: math, JS libraries, budget follow-ups, unknown queries, exact title.');
