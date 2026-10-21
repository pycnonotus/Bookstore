import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import books from '../../mock-data/data.json' with { type: 'json' };
import { readFile, writeFile } from 'node:fs/promises';
import { strictBookMatches } from '../../src/utils/strictBookSearch.js';
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
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', ({data}) => {
          if (data.type === 'results') window.lastRetrievalScores = data.matches;
        });
      }
    };
  });
  page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text()); });
  page.on('requestfailed', request => console.log('Request failed:', request.url(), request.failure()?.errorText));
  await page.goto(serverUrl);
  const searchPanel = page.locator('#book-search');
  const catalog = page.locator('#catalog');
  async function search(text) {
    await searchPanel.getByRole('searchbox').fill(text);
    await searchPanel.getByRole('button',{name:'Search',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#book-search button[type="submit"]').textContent === 'Search',{timeout:180000});
    return catalog.locator('article h4').allTextContents();
  }
  assert.ok((await search('math books')).length > 3);
  assert.ok((await search('JS libs')).includes('Jquery'));
  assert.ok((await search('flower')).includes('The Fleeting Beauty'));
  assert.ok((await search('the book with a marble sculpture on its cover')).includes('Forms of Silence'));
  assert.deepEqual(await search('zzzznonexistent'),[]);
  const cases = JSON.parse(await readFile(new URL('../training/retrieval-eval.json', import.meta.url), 'utf8'));
  const comparisons = [];
  for (const test of cases) {
    const titles = await search(test.query);
    const actualIds = titles.slice(0,3).map(title => books.find(book=>book.name===title).id);
    const raw = await page.evaluate(() => window.lastRetrievalScores || []);
    const before = strictBookMatches(test.query,raw).slice(0,3).map(row=>row.book.id);
    const hit = ids => test.relevantIds.length ? ids.some(id=>test.relevantIds.includes(id)) : ids.length===0;
    comparisons.push({query:test.query, baselineHit:hit(before), hybridHit:hit(actualIds), baselineIds:before, hybridIds:actualIds});
  }
  const comparison = { note:'Reviewed development regressions, not an untouched test set. Baseline applies the prior 0.9 policy to the same enriched catalog/index.', cases:cases.length, baselinePasses:comparisons.filter(row=>row.baselineHit).length, hybridPasses:comparisons.filter(row=>row.hybridHit).length, details:comparisons };
  await writeFile(new URL('../training/browser-retrieval-report.json',import.meta.url),JSON.stringify(comparison,null,2)+'\n');
  console.log('Real-model comparison:',JSON.stringify({cases:comparison.cases,baselinePasses:comparison.baselinePasses,hybridPasses:comparison.hybridPasses}));
  assert.equal(comparison.hybridPasses,comparison.cases,'Real-model retrieval must pass reviewed regressions');
  assert.ok((await page.evaluate(async () => (await (await caches.open('book-cover-embeddings-v1')).keys()).length)) > 0);
  assert.ok((await page.evaluate(async () => (await (await caches.open('book-embeddings-v1')).keys()).length)) > 0);
  await page.reload();
  assert.ok((await search('math books')).length > 3, 'Cached search must filter shelves');
  const fallback = await browser.newPage();
  await fallback.route('**/models/**',route=>route.fulfill({status:404,body:'Model unavailable'}));
  await fallback.goto(serverUrl);
  await fallback.locator('#book-search').getByRole('searchbox').fill('math books');
  await fallback.locator('#book-search').getByRole('button',{name:'Search',exact:true}).click();
  await fallback.locator('#book-search').getByText('Showing catalog matches while semantic search is unavailable.').waitFor();
  assert.equal(await fallback.locator('#catalog article').count(),books.filter(book=>book.topic==='math').length);
  await fallback.close();
  console.log('Passed: real models, all shelf matches, cover descriptions, cache reuse, model-offline fallback.');
} finally { await browser?.close(); server.kill(); }
