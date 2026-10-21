import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', chunk => { if (chunk.toString().includes('Local:')) resolve(); });
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text()); });
  await page.goto('http://127.0.0.1:5175');
  const chat = page.locator('#book-chat');
  await chat.getByRole('button', {name:'Enable semantic search', exact:true}).click();
  await chat.getByRole('button', {name:'Semantic search enabled', exact:true}).waitFor({timeout:240000});
  for (const text of ['book about math', 'JS libs', 'stories told through carved stone']) {
    await chat.getByRole('textbox').fill(text);
    await chat.getByRole('button', {name:'Find books', exact:true}).click();
    await page.waitForFunction(() => !document.querySelector('#book-chat button[type="submit"]').disabled);
    assert.ok(await chat.locator('article').count() > 0, `Matches for ${text}`);
    console.log(text, await chat.locator('article h3').allTextContents());
  }
  const cacheSize = await page.evaluate(async () => (await (await caches.open('book-embeddings-v1')).keys()).length);
  assert.ok(cacheSize > 0, 'Book embeddings must be cached');
  await page.reload();
  await chat.getByRole('button', {name:'Enable semantic search', exact:true}).click();
  await chat.getByRole('button', {name:'Semantic search enabled', exact:true}).waitFor({timeout:60000});
  console.log('Passed: real browser model, catalog embeddings, semantic queries, cache reuse.');
} finally { await browser?.close(); server.kill(); }
