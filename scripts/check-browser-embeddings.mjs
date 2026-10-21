import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import books from '../mock-data/data.json' with { type: 'json' };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let browser;
let serverUrl;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', chunk => { const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { serverUrl = match[0]; resolve(); } });
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text()); });
  page.on('requestfailed', request => console.log('Request failed:', request.url(), request.failure()?.errorText));
  await page.goto(serverUrl);
  const chat = page.locator('#book-chat');
  const book = books[0];
  const exactDocument = `${book.name}. Topic: ${book.topic}. ${book.description}`;
  async function search(text) {
    await chat.getByRole('searchbox').fill(text);
    await chat.getByRole('button', {name:'Search', exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#book-chat button[type="submit"]').textContent === 'Search', {timeout:180000});
    const scores = await chat.locator('[data-similarity]').evaluateAll(rows => rows.map(row => Number(row.dataset.similarity)));
    assert.ok(scores.every(score => score >= 0.9), 'Only raw similarity >= 0.9 may appear');
    return chat.locator('article h3').allTextContents();
  }
  assert.ok((await search(exactDocument)).includes(book.name), 'Exact indexed document should score near one');
  assert.deepEqual(await search('zzzznonexistent'), [], 'Unrelated query should return no results');
  await search('the book with a marble sculpture on its cover');
  assert.ok((await page.evaluate(async () => (await (await caches.open('book-cover-embeddings-v1')).keys()).length)) > 0, 'Cover index must be cached');
  const cacheSize = await page.evaluate(async () => (await (await caches.open('book-embeddings-v1')).keys()).length);
  assert.ok(cacheSize > 0, 'Book embeddings must be cached');
  await page.reload();
  assert.ok((await search(exactDocument)).includes(book.name), 'Cached index must support the strict cutoff');
  console.log('Passed: real text and cover models, strict 0.9 cutoff, empty states, independent queries, cache reuse.');
} finally { await browser?.close(); server.kill(); }
