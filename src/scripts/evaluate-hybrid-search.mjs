import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { hybridBookMatches } from '../utils/hybridSearch.js';
import { matchesPrice, parsePriceConstraints } from '../utils/searchConstraints.js';
import books from '../data/books.json' with { type: 'json' };

const cases = JSON.parse(await readFile(new URL('../tests/fixtures/retrieval-eval.json', import.meta.url), 'utf8'));
const details = cases.map(test => {
  const rows = hybridBookMatches(test.query, [], { kind: test.kind || 'text', limit: 3 });
  const ids = rows.map(row => row.book.id);
  const hits = ids.filter(id => test.relevantIds.includes(id)).length;
  const relevantFound = test.relevantIds.length === 0 ? ids.length === 0 : hits > 0;
  const price = parsePriceConstraints(test.query);
  const constraintsCorrect = rows.every(({ book }) => matchesPrice(book.price, price) && (!test.topic || book.topic === test.topic));
  return { query: test.query, passed: relevantFound && constraintsCorrect, hitAt3: relevantFound, precisionAt3: ids.length ? hits / ids.length : null, constraintsCorrect, returnedIds: ids, returnedTitles: rows.map(row => row.book.name) };
});
const report = { evaluatedAt: new Date().toISOString(), source: 'Assistant-reviewed catalog query/book labels; independent of Qwen synthetic classifier training examples', mode: 'lexical and structured retrieval; real embedding integration checked separately in browser tests', cases: details.length, passed: details.filter(row => row.passed).length, hitAt3: details.filter(row => row.hitAt3).length / details.length, constraintFailures: details.filter(row => !row.constraintsCorrect).length, details };
await mkdir(new URL('../../artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL('../../artifacts/retrieval-eval-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ cases: report.cases, passed: report.passed, hitAt3: report.hitAt3, constraintFailures: report.constraintFailures }));
for (const row of details.filter(row => !row.passed)) console.log('FAILED:', row.query, row.returnedTitles);
assert.equal(report.passed, report.cases, 'Every reviewed query must retrieve a relevant book and respect constraints');

// Adversarial semantic candidates must not override deterministic filters.
const candidates = books.map(book => ({ id: book.id, score: 0.99 }));
assert.ok(hybridBookMatches('math cost 40$ ore more', candidates).every(row => row.book.topic === 'math' && row.book.price >= 40));
assert.equal(hybridBookMatches('math above 100', candidates).length, 0);
assert.equal(hybridBookMatches('between 40 and 10', candidates).length, 0);
assert.equal(hybridBookMatches('zzzznonexistent', [{id:books[0].id, score:0.49}]).length, 0);
assert.equal(hybridBookMatches('zzzznonexistent', [{id:books[0].id, score:0.51}])[0].book.id, books[0].id);
assert.equal(hybridBookMatches('Forms of Silence', [{id:books[1].id,score:0.99}])[0].book.name, 'Forms of Silence');
assert.ok(hybridBookMatches('math books').length > 3, 'Shelves must include all matching math books');
console.log('Passed: reviewed retrieval set and adversarial semantic/filter tests.');
