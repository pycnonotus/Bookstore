import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
  await chat.getByRole('button', {name:'Enable semantic search', exact:true}).waitFor();
  await page.evaluate(() => {
    const status = document.querySelector('#book-chat [role="status"]');
    new MutationObserver(() => console.log(`Embedding status: ${status.textContent}`)).observe(status, {subtree:true, childList:true, characterData:true});
  });
  page.on('console', message => { if (message.text().startsWith('Embedding status:')) console.log(message.text()); });
  await chat.getByRole('button', {name:'Enable semantic search', exact:true}).click();
  await chat.getByRole('button', {name:'Semantic search enabled', exact:true}).waitFor({timeout:240000});
  for (const text of ['book about math', 'JS libs', 'flower', 'stories told through carved stone']) {
    await chat.getByRole('textbox').fill(text);
    await chat.getByRole('button', {name:'Find books', exact:true}).click();
    await page.waitForFunction(() => document.querySelector('#book-chat button[type="submit"]').textContent === 'Find books');
    assert.ok(await chat.locator('article').count() > 0, `Matches for ${text}`);
    console.log(text, await chat.locator('article h3').allTextContents());
    if (text === 'flower') assert.ok((await chat.locator('article h3').allTextContents()).includes('The Fleeting Beauty'));
  }
  await chat.getByRole('textbox').fill('the book with a marble sculpture on its cover');
  await chat.getByRole('button', {name:'Find books', exact:true}).click();
  await page.waitForFunction(() => document.querySelector('#book-chat [role="status"]').textContent.includes('Cover-image matches ready'), {timeout:180000});
  const visualTitles = await chat.locator('article h3').allTextContents();
  console.log('Visual cover matches:', visualTitles);
  assert.ok(visualTitles.includes('Forms of Silence'), 'Visual search should retrieve the marble sculpture cover');
  const cacheSize = await page.evaluate(async () => (await (await caches.open('book-embeddings-v1')).keys()).length);
  assert.ok(cacheSize > 0, 'Book embeddings must be cached');
  await page.reload();
  await chat.getByRole('button', {name:'Enable semantic search', exact:true}).click();
  await chat.getByRole('button', {name:'Semantic search enabled', exact:true}).waitFor({timeout:60000});
  console.log('Passed: real browser model, catalog embeddings, semantic queries, cache reuse.');
} finally { await browser?.close(); server.kill(); }
