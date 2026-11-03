import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against the Vite server with the backend running and the catalog seeded.
const base = process.env.CATALOG_TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Keep this check independent of model downloads; verify the catalog sent to workers.
  await page.addInitScript(() => {
    window.workerCatalogs = [];
    window.Worker = class {
      postMessage(data) {
        if (data.type === 'catalog') window.workerCatalogs.push(data.books);
        if (data.type === 'search') queueMicrotask(() => this.onmessage({
          data: { type: 'error', id: data.id, message: 'Model unavailable for this test' },
        }));
      }
      terminate() {}
    };
  });
  const booksResponse = await page.request.get(`${base}/api/books`);
  assert.equal(booksResponse.status(), 200);
  const books = await booksResponse.json();
  assert.ok(books.length > 0, 'Seed the database before running this check');
  const categories = await (await page.request.get(`${base}/api/categories`)).json();
  await page.goto(base);
  await page.waitForFunction(count => document.querySelectorAll('#catalog article').length === count, books.length);
  assert.equal(await page.locator('#catalog input[name="topics"]').count(), categories.length);
  assert.equal(await page.locator('#staff-picks article').count(), 3);
  assert.equal(await page.locator('#events article').count(), 3);
  const first = books[0];
  const firstCard = page.locator('#catalog article').filter({ has: page.getByRole('heading', { name: first.title, exact: true }) });
  await firstCard.scrollIntoViewIfNeeded();
  await firstCard.locator('img').evaluate(image => image.decode());
  assert.match(await firstCard.locator('img').getAttribute('src'), /^\/api\/covers\//);
  assert.ok((await firstCard.locator('[data-book-price]').textContent()).includes((first.priceCents / 100).toFixed(2)));

  const topic = categories[0];
  await page.locator(`input[name="topics"][value="${topic.name}"]`).check({ force: true });
  assert.equal(await page.locator('#catalog article').count(), books.filter(book => book.categoryId === topic.id).length);
  await page.getByRole('button', { name: 'All topics', exact: true }).click();
  await page.getByRole('searchbox').fill(first.title);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByText('Showing catalog matches while semantic search is unavailable.').waitFor();
  assert.equal(await firstCard.count(), 1);
  assert.equal(await page.evaluate(() => window.workerCatalogs[0].length), books.length);
  assert.equal(await page.evaluate(() => window.workerCatalogs[0][0].name), first.title);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await page.getByRole('searchbox').fill('cover flowers');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByText('Showing catalog matches while semantic search is unavailable.').waitFor();
  assert.equal(await page.evaluate(() => window.workerCatalogs[1].length), books.length);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();

  await page.route('**/api/books', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
  await page.reload();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('#catalog article').count(), 0);
  assert.equal(await page.locator('#staff-picks article').count(), 3);
  await page.unroute('**/api/books');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.waitForFunction(count => document.querySelectorAll('#catalog article').length === count, books.length);

  await page.route('**/api/books', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.reload();
  await page.getByText('No books are available yet.', { exact: true }).waitFor();
  assert.equal(await page.locator('#catalog article').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Passed: API catalog, covers, prices, categories, text/cover search inputs, retry, empty catalog, staff picks and events.');
} finally {
  await browser.close();
}
