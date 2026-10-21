import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import books from '../mock-data/data.json' with { type: 'json' };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
await new Promise((resolve, reject) => {
  server.stdout.on('data', chunk => { if (chunk.toString().includes('Local:')) resolve(); });
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Vite exited: ${code}`)));
});
const browser = await chromium.launch({headless:true, channel:'msedge'});
const page = await browser.newPage();
const errors = [];
assert.equal(new Set(books.map(book => book.id)).size, books.length, 'Book IDs must be unique');
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:5174');
  await page.locator('#catalog article').first().waitFor();
  assert.equal(await page.locator('#catalog article').count(), books.length);
  assert.equal(await page.locator('#events article').count(), 3);
  assert.equal(await page.locator('#staff-picks article').count(), 3);
  assert.equal(await page.locator('#staff-picks blockquote').count(), 3);
  await page.getByRole('link', {name:'Staff picks', exact:true}).click();
  assert.equal(new URL(page.url()).hash, '#staff-picks');
  await page.getByRole('link', {name:'Events', exact:true}).click();
  assert.equal(new URL(page.url()).hash, '#events');
  assert.match(await page.getByRole('link', {name:'Ask about a seat →'}).first().getAttribute('href'), /^mailto:.*subject=Seat%20inquiry/);
  const first = books[0];
  await page.locator('#catalog').getByRole('button', {name:`Save ${first.name}`, exact:true}).click();
  await page.locator('#catalog').getByRole('button', {name:`Unsave ${first.name}`, exact:true}).waitFor();
  await page.locator('#staff-picks').getByRole('button', {name:`Unsave ${first.name}`, exact:true}).click();
  await page.locator('#catalog').getByRole('button', {name:`Save ${first.name}`, exact:true}).waitFor();
  await page.locator('#staff-picks').getByRole('button', {name:`Save ${first.name}`, exact:true}).click();
  await page.locator('#catalog').getByRole('button', {name:`Unsave ${first.name}`, exact:true}).waitFor();
  const other = books.find(book => book.topic !== first.topic).topic;
  await page.getByRole('combobox').selectOption(other);
  await page.waitForFunction(count => document.querySelectorAll('#catalog article').length === count, books.filter(book => book.topic === other).length);
  assert.equal(await page.locator('#catalog article').count(), books.filter(book => book.topic === other).length);
  await page.getByRole('combobox').selectOption(first.topic);
  await page.locator('#catalog').getByRole('button', {name:`Unsave ${first.name}`, exact:true}).waitFor();
  assert.equal(await page.locator('#catalog').getByRole('button', {name:`Unsave ${first.name}`, exact:true}).getAttribute('aria-pressed'), 'true');
  await page.locator('#catalog').getByRole('button', {name:`Unsave ${first.name}`, exact:true}).click();
  await page.getByRole('combobox').selectOption('all');
  await page.waitForFunction(count => document.querySelectorAll('#catalog article').length === count, books.length);
  for (const width of [240, 320, 375, 639, 640, 767, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({width, height:900});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `Horizontal overflow at ${width}px`);
  }
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path:'artifacts/catalog-desktop.png'});
  await page.setViewportSize({width:375,height:900});
  await page.screenshot({path:'artifacts/catalog-mobile.png'});
  assert.deepEqual(errors, []);
  console.log(`Passed: ${books.length} data-driven cards, topic filtering, controlled save/unsave, state retained across filters, no overflow at 10 widths, no runtime errors.`);
} finally { await browser.close(); server.kill(); }
