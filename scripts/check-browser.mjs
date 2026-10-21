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
const topics = [...new Set(books.map(book => book.topic))].sort();
const topicName = topic => topic.charAt(0).toUpperCase() + topic.slice(1);
const catalog = page.locator('#catalog');
const topicControls = catalog.getByRole('group', {name:'Browse by topic', exact:true});
const topicCheckbox = topic => topicControls.getByRole('checkbox', {name:new RegExp(`^${topicName(topic)}\\b.*\\b${books.filter(book => book.topic === topic).length}\\b`)});
const toggleTopic = topic => topicCheckbox(topic).locator('..').locator('.topic-chip').click();
const allTopicsButton = topicControls.getByRole('button', {name:'All topics', exact:true});
async function assertCatalog(expectedTopics) {
  const expectedCount = books.filter(book => expectedTopics.includes(book.topic)).length;
  await page.waitForFunction(({topics, count}) => {
    const sections = [...document.querySelectorAll('#catalog .topic-section')];
    return document.querySelectorAll('#catalog article').length === count
      && JSON.stringify(sections.map(section => section.dataset.topic)) === JSON.stringify(topics);
  }, {topics:expectedTopics, count:expectedCount});
  assert.equal(await catalog.locator('article').count(), expectedCount);
  assert.deepEqual(await catalog.locator('.topic-section').evaluateAll(sections => sections.map(section => section.dataset.topic)), expectedTopics);
  for (const topic of expectedTopics) {
    const section = catalog.locator(`section.topic-section[data-topic="${topic}"]`);
    const topicBooks = books.filter(book => book.topic === topic);
    assert.equal(await section.getAttribute('aria-labelledby'), `topic-${topic}-title`);
    assert.equal(await section.getByRole('heading', {level:3, name:topicName(topic), exact:true}).getAttribute('id'), `topic-${topic}-title`);
    assert.equal((await section.locator('.topic-section-count').innerText()).trim(), `${topicBooks.length} books`);
    assert.equal(await section.locator('.topic-book').count(), topicBooks.length);
    assert.deepEqual(await section.locator('article h4').allTextContents(), topicBooks.map(book => book.name));
  }
}
async function assertNoOverflow(widths, selection) {
  for (const width of widths) {
    await page.setViewportSize({width, height:900});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, `Horizontal overflow at ${width}px with ${selection}`);
  }
}
assert.equal(new Set(books.map(book => book.id)).size, books.length, 'Book IDs must be unique');
page.on('pageerror', error => errors.push(error.message));
try {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('http://127.0.0.1:5174');
  await catalog.locator('article').first().waitFor();
  await assertCatalog(topics);
  assert.equal(await topicControls.getByRole('checkbox').count(), topics.length);
  assert.equal(await allTopicsButton.getAttribute('aria-pressed'), 'true');
  for (const topic of topics) {
    assert.equal(await topicCheckbox(topic).isChecked(), false);
  }
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
  const other = topics.find(topic => topic !== first.topic);
  await toggleTopic(other);
  await assertCatalog([other]);
  assert.equal(await allTopicsButton.getAttribute('aria-pressed'), 'false');
  assert.equal(await topicCheckbox(first.topic).isChecked(), false);
  await toggleTopic(first.topic);
  const selectedTopics = topics.filter(topic => topic === first.topic || topic === other);
  await assertCatalog(selectedTopics);
  assert.equal(await topicCheckbox(other).isChecked(), true);
  assert.equal(await topicCheckbox(first.topic).isChecked(), true);
  await catalog.getByRole('button', {name:`Unsave ${first.name}`, exact:true}).waitFor();
  assert.equal(await catalog.getByRole('button', {name:`Unsave ${first.name}`, exact:true}).getAttribute('aria-pressed'), 'true');
  await toggleTopic(other);
  await assertCatalog([first.topic]);
  assert.equal(await topicCheckbox(first.topic).isChecked(), true);
  assert.equal(await topicCheckbox(other).isChecked(), false);
  await toggleTopic(first.topic);
  await assertCatalog(topics);
  assert.equal(await allTopicsButton.getAttribute('aria-pressed'), 'true');
  await topicCheckbox(other).focus();
  await page.keyboard.press('Space');
  await assertCatalog([other]);
  assert.equal(await topicCheckbox(other).isChecked(), true);
  await page.keyboard.press('Space');
  await assertCatalog(topics);
  assert.equal(await topicCheckbox(other).isChecked(), false);
  await toggleTopic(first.topic);
  await toggleTopic(other);
  await assertCatalog(selectedTopics);
  await allTopicsButton.click();
  await assertCatalog(topics);
  assert.equal(await allTopicsButton.getAttribute('aria-pressed'), 'true');
  for (const topic of topics) assert.equal(await topicCheckbox(topic).isChecked(), false);
  assert.equal(await catalog.getByRole('button', {name:`Unsave ${first.name}`, exact:true}).getAttribute('aria-pressed'), 'true');
  await catalog.getByRole('button', {name:`Unsave ${first.name}`, exact:true}).click();
  await page.locator('#staff-picks').getByRole('button', {name:`Save ${first.name}`, exact:true}).waitFor();
  for (const selector of ['.topic-section', '.topic-book']) {
    const animated = await catalog.locator(selector).first().evaluate(element => {
      const style = getComputedStyle(element);
      return style.animationName !== 'none' && style.animationDuration.split(',').some(duration => parseFloat(duration) > 0);
    });
    assert.equal(animated, true, `${selector} should animate when motion is enabled`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  const motionEnabled = await catalog.locator('.topic-section, .topic-book').evaluateAll(elements => elements.some(element => {
    const style = getComputedStyle(element);
    return style.animationName !== 'none' && style.animationDuration.split(',').some(duration => parseFloat(duration) > 0);
  }));
  assert.equal(motionEnabled, false, 'Topic and book animations must respect reduced motion');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await assertNoOverflow([240, 320, 375, 639, 640, 767, 768, 1024, 1280, 1920], 'all topics');
  await page.setViewportSize({width:1280,height:900});
  await catalog.evaluate(element => element.scrollIntoView({block:'start', behavior:'instant'}));
  await page.screenshot({path:'artifacts/catalog-desktop.png', animations:'disabled'});
  await toggleTopic(first.topic);
  await toggleTopic(other);
  await assertCatalog(selectedTopics);
  await assertNoOverflow([240, 375, 768, 1280], 'two selected topics');
  await page.setViewportSize({width:375,height:900});
  await catalog.evaluate(element => element.scrollIntoView({block:'start', behavior:'instant'}));
  await page.screenshot({path:'artifacts/catalog-mobile.png', animations:'disabled'});
  assert.deepEqual(errors, []);
  console.log(`Passed: ${books.length} cards in ${topics.length} topic groups, multi-select/reset/keyboard filtering, synchronized saves retained across filters, reduced-motion support, no overflow at 10 all-topic and 4 filtered widths, no runtime errors.`);
} finally { await browser.close(); server.kill(); }
