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
async function assertBookPrices(scope, expectedPrices) {
  const cards = scope.locator('article');
  assert.equal(await cards.locator('[data-book-price]:visible').count(), await cards.count(), 'Every book card must show a price');
  const rows = await cards.evaluateAll(elements => elements.map(card => ({
    title: card.querySelector('h3, h4').textContent,
    prices: [...card.querySelectorAll('[data-book-price]')].map(price => price.textContent.trim()),
  })));
  const pricesByTitle = new Map();
  for (const {title, prices} of rows) {
    assert.equal(prices.length, 1, `${title} must have one price`);
    const [price] = prices;
    assert.match(price, /^\$(?:0|[1-9]\d*)\.\d{2}$/, `${title} must show a dollar price with two decimals`);
    const amount = Number(price.slice(1));
    assert.ok(amount >= 4.99 && amount <= 49.99, `${title} price must be between $4.99 and $49.99`);
    if (expectedPrices) assert.equal(price, expectedPrices.get(title), `${title} price must remain consistent`);
    pricesByTitle.set(title, price);
  }
  return pricesByTitle;
}
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
    const cards = await page.locator('#catalog article, #staff-picks article').evaluateAll(elements => elements.map(card => {
      const bounds = card.getBoundingClientRect();
      const inside = element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0
          && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
          && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
      };
      const description = card.querySelector('.book-description');
      const descriptionStyle = getComputedStyle(description);
      return {
        title: card.querySelector('h3, h4').textContent,
        width: bounds.width,
        height: bounds.height,
        priceInside: inside(card.querySelector('[data-book-price]')),
        saveInside: inside(card.querySelector('button[aria-pressed]')),
        descriptionInside: inside(description),
        descriptionTruncated: description.scrollHeight > description.clientHeight + 1,
        descriptionClipped: ['hidden', 'clip'].includes(descriptionStyle.overflowY),
        descriptionEllipsis: descriptionStyle.textOverflow === 'ellipsis'
          || Number.parseInt(descriptionStyle.webkitLineClamp, 10) > 0,
      };
    }));
    for (const card of cards) {
      const context = `${card.title} at ${width}px with ${selection}`;
      assert.ok(card.width <= 451 && card.height <= 451, `${context} must fit within 450px in both dimensions (${card.width} × ${card.height})`);
      assert.ok(card.priceInside, `${context} must keep its price inside the card`);
      assert.ok(card.saveInside, `${context} must keep its Save button inside the card`);
      assert.ok(card.descriptionInside, `${context} must keep its description inside the card`);
      if (card.descriptionTruncated) {
        assert.ok(card.descriptionClipped && card.descriptionEllipsis, `${context} must truncate overflowing description text with ellipsis`);
      }
    }
    if (width <= 375) {
      assert.ok(cards.some(card => card.descriptionTruncated), `Long descriptions must truncate at ${width}px with ${selection}`);
    }
  }
}
async function settleLayout() {
  await catalog.evaluate(async element => {
    await Promise.all(element.getAnimations({subtree:true})
      .filter(animation => animation.playState !== 'finished')
      .map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  });
}
async function scrollToY(top) {
  await page.evaluate(top => window.scrollTo({top, behavior:'instant'}), top);
  await settleLayout();
}
async function naturalTopicLayout() {
  await page.mouse.move(0, 0);
  await scrollToY(0);
  return catalog.locator('.topic-section').evaluateAll(sections => sections.map(section => {
    const bounds = section.getBoundingClientRect();
    const cards = section.querySelectorAll('article');
    const lastBounds = cards[cards.length - 1].getBoundingClientRect();
    return {topic:section.dataset.topic, top:bounds.top + scrollY, height:bounds.height,
      lastCardBottom:lastBounds.bottom + scrollY};
  }));
}
async function assertLastCardReachable(topic, natural, context) {
  const viewport = page.viewportSize();
  await scrollToY(natural.lastCardBottom - (viewport.height - 48));
  const result = await catalog.locator(`.topic-section[data-topic="${topic}"]`).evaluate(section => {
    const cards = section.querySelectorAll('article');
    const lastCard = cards[cards.length - 1];
    const bounds = lastCard.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    const nextSection = section.nextElementSibling;
    return {top:bounds.top, bottom:bounds.bottom, reachable:lastCard.contains(hit),
      nextTop:nextSection?.getBoundingClientRect().top ?? null};
  });
  assert.ok(result.top >= 8 && result.bottom <= viewport.height - 8,
    `${context}: ${topic}'s final card must fit fully in the viewport before it is covered (${result.top}–${result.bottom})`);
  assert.ok(result.reachable, `${context}: ${topic}'s final card must receive pointer input`);
  if (result.nextTop !== null) {
    assert.ok(result.nextTop >= result.bottom - 1,
      `${context}: the following topic must not cover the final card before readers reach it`);
  }
}
async function assertOnlyTopicAccessible(topic) {
  const natural = await naturalTopicLayout();
  assert.equal(natural.length, 1, 'Filtering to one topic must remove previous stack layers');
  assert.equal(await catalog.locator('.topic-panel').count(), 1, 'One topic must have exactly one visual layer');
  await assertLastCardReachable(topic, natural[0], 'one selected topic');
  await assertStickyTopicHeading({width:1280, context:'single selected topic on desktop'});
  await assertStickyTopicHeading({width:375, context:'single selected topic on mobile'});
}
async function readTopicHeading(topic) {
  return catalog.locator(`.topic-section[data-topic="${topic}"] .topic-heading h3`).evaluate(heading => {
    const bounds = heading.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return {title:heading.textContent.trim(), top:bounds.top, bottom:bounds.bottom,
      readable:heading.contains(hit), scrollY};
  });
}
async function assertStickyTopicHeading({width, context, screenshotPath}) {
  await page.setViewportSize({width, height:900});
  const natural = await naturalTopicLayout();
  const candidates = natural.length > 1 ? natural.slice(0, -1) : natural;
  const current = candidates.reduce((longest, section) => section.height > longest.height ? section : longest);
  const assertReadable = (heading, topic) => {
    assert.equal(heading.title, topicName(topic), `${context}: the current title must match its topic`);
    assert.ok(heading.readable && heading.top >= 0 && heading.top <= 64 && heading.bottom < 140,
      `${context}: ${topic}'s title must remain readable near the viewport top (${JSON.stringify(heading)})`);
  };
  await scrollToY(current.top + current.height * 0.35);
  const before = await readTopicHeading(current.topic);
  assertReadable(before, current.topic);
  await scrollToY(before.scrollY + 96);
  const after = await readTopicHeading(current.topic);
  assertReadable(after, current.topic);
  assert.ok(Math.abs(after.top - before.top) <= 1,
    `${context}: the title must stay pinned as its books continue scrolling`);
  if (screenshotPath) await page.screenshot({path:screenshotPath, animations:'disabled'});
  const next = natural[natural.indexOf(current) + 1];
  if (next) {
    await scrollToY(next.top + 300);
    assertReadable(await readTopicHeading(next.topic), next.topic);
    assert.equal((await readTopicHeading(current.topic)).readable, false,
      `${context}: the next topic title must replace the previous title`);
  }
}
async function assertTopicStack({width, context, screenshotPath}) {
  await page.setViewportSize({width, height:900});
  await allTopicsButton.focus();
  await page.keyboard.press('Tab');
  await settleLayout();
  const natural = await naturalTopicLayout();
  assert.ok(natural.length >= 2, `${context}: stacking needs at least two topics`);
  assert.equal(await catalog.locator('.topic-panel').count(), natural.length,
    `${context}: every visible topic must have exactly one layer`);
  const tallest = natural.slice(0, -1).reduce((largest, section) => section.height > largest.height ? section : largest);
  await assertLastCardReachable(tallest.topic, tallest, context);

  const [first, second] = natural;
  const gap = width < 640 ? 16 : 24;
  const firstPinnedTop = Math.min(gap, 900 - first.height - gap);
  const secondTargetTop = Math.min(900 * 0.6, firstPinnedTop + first.height - 120);
  await scrollToY(second.top - secondTargetTop);
  const readOverlap = () => catalog.locator('.topic-section').evaluateAll(sections => {
    const [first, second] = sections;
    const firstBounds = first.getBoundingClientRect();
    const secondBounds = second.getBoundingClientRect();
    const firstPanel = first.querySelector('.topic-panel').getBoundingClientRect();
    const secondPanel = second.querySelector('.topic-panel').getBoundingClientRect();
    const left = Math.max(firstPanel.left, secondPanel.left, 0);
    const right = Math.min(firstPanel.right, secondPanel.right, innerWidth);
    const top = Math.max(firstPanel.top, secondPanel.top, 8);
    const bottom = Math.min(firstPanel.bottom, secondPanel.bottom, innerHeight - 8);
    const hit = right > left && bottom > top
      ? document.elementFromPoint((left + right) / 2, (top + bottom) / 2)?.closest('.topic-section')
      : null;
    return {scrollY, firstTop:firstBounds.top, secondTop:secondBounds.top,
      overlapWidth:right - left, overlapHeight:bottom - top, topTopic:hit?.dataset.topic,
      position:getComputedStyle(first).position};
  });
  const before = await readOverlap();
  assert.equal(before.position, 'sticky', `${context}: previous topics must pin during the stack`);
  assert.ok(before.overlapWidth > 100 && before.overlapHeight > 40,
    `${context}: the next topic must visibly overlap the previous one (${before.overlapWidth} × ${before.overlapHeight})`);
  assert.equal(before.topTopic, second.topic, `${context}: the later topic must receive input above the previous topic`);
  await scrollToY(before.scrollY + 48);
  const after = await readOverlap();
  assert.ok(Math.abs(after.firstTop - before.firstTop) <= 1,
    `${context}: the previous topic must remain pinned while the next topic scrolls over it`);
  assert.ok(Math.abs(after.secondTop - before.secondTop + 48) <= 1,
    `${context}: the next topic must continue moving with page scroll`);
  assert.equal(after.topTopic, second.topic, `${context}: the next layer must remain usable while scrolling`);
  if (screenshotPath) await page.screenshot({path:screenshotPath, animations:'disabled'});

  const coveredSave = catalog.locator(`.topic-section[data-topic="${first.topic}"] article`).last().locator('button[aria-pressed]');
  const covered = await coveredSave.evaluate(button => {
    const bounds = button.getBoundingClientRect();
    return !button.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2));
  });
  assert.ok(covered, `${context}: the previous topic's final Save button must actually be behind the next layer for this focus check`);
  await coveredSave.focus();
  await settleLayout();
  const focused = await coveredSave.evaluate(button => {
    const bounds = button.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return {active:document.activeElement === button, keyboard:button.matches(':focus-visible'),
      top:bounds.top, bottom:bounds.bottom, reachable:button.contains(hit)};
  });
  assert.ok(focused.active && focused.keyboard && focused.reachable && focused.top >= 0 && focused.bottom <= 900,
    `${context}: keyboard focus must reveal and allow input to a covered Save button (${JSON.stringify(focused)})`);
  await coveredSave.evaluate(button => button.blur());
  await settleLayout();
}
async function assertReducedMotionFlow(width) {
  await page.setViewportSize({width, height:900});
  const natural = await naturalTopicLayout();
  await scrollToY(natural[1].top - 450);
  const readFlow = () => catalog.locator('.topic-section').evaluateAll(sections => sections.map(section => {
    const bounds = section.getBoundingClientRect();
    return {top:bounds.top, bottom:bounds.bottom, position:getComputedStyle(section).position,
      panelTransform:getComputedStyle(section.querySelector('.topic-panel')).transform};
  }));
  const before = await readFlow();
  for (const [index, section] of before.entries()) {
    assert.ok(['static', 'relative'].includes(section.position), `Reduced motion at ${width}px must use normal section flow`);
    assert.equal(section.panelTransform, 'none', `Reduced motion at ${width}px must disable depth transforms`);
    if (index > 0) assert.ok(section.top >= before[index - 1].bottom - 1,
      `Reduced motion at ${width}px must not overlap topic sections`);
  }
  const oldScroll = await page.evaluate(() => scrollY);
  await scrollToY(oldScroll + 48);
  const after = await readFlow();
  assert.ok(Math.abs(after[0].top - before[0].top + 48) <= 1,
    `Reduced motion at ${width}px must let the first section scroll normally`);
  assert.ok(Math.abs(after[1].top - before[1].top + 48) <= 1,
    `Reduced motion at ${width}px must let the next section scroll normally`);
  await assertStickyTopicHeading({width, context:`reduced motion at ${width}px`});
}
assert.equal(new Set(books.map(book => book.id)).size, books.length, 'Book IDs must be unique');
page.on('pageerror', error => errors.push(error.message));
try {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('http://127.0.0.1:5174');
  await catalog.locator('article').first().waitFor();
  await assertCatalog(topics);
  const catalogPrices = await assertBookPrices(catalog);
  assert.ok(new Set(catalogPrices.values()).size > 1, 'Different book titles should have varied prices');
  await assertBookPrices(page.locator('#staff-picks'), catalogPrices);
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
  await assertBookPrices(catalog, catalogPrices);
  const other = topics.find(topic => topic !== first.topic);
  await toggleTopic(other);
  await assertCatalog([other]);
  await assertOnlyTopicAccessible(other);
  assert.equal(await allTopicsButton.getAttribute('aria-pressed'), 'false');
  assert.equal(await topicCheckbox(first.topic).isChecked(), false);
  await toggleTopic(first.topic);
  const selectedTopics = topics.filter(topic => topic === first.topic || topic === other);
  await assertCatalog(selectedTopics);
  await assertTopicStack({width:1280, context:'two selected topics after filtering to one'});
  await assertStickyTopicHeading({width:1280, context:'two selected topics on desktop'});
  assert.equal(await topicCheckbox(other).isChecked(), true);
  assert.equal(await topicCheckbox(first.topic).isChecked(), true);
  await catalog.getByRole('button', {name:`Unsave ${first.name}`, exact:true}).waitFor();
  assert.equal(await catalog.getByRole('button', {name:`Unsave ${first.name}`, exact:true}).getAttribute('aria-pressed'), 'true');
  await assertBookPrices(catalog, catalogPrices);
  await assertBookPrices(page.locator('#staff-picks'), catalogPrices);
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
  for (const selector of ['.topic-section-content', '.topic-book']) {
    const animated = await catalog.locator(selector).first().evaluate(element => {
      const style = getComputedStyle(element);
      return style.animationName !== 'none' && style.animationDuration.split(',').some(duration => parseFloat(duration) > 0);
    });
    assert.equal(animated, true, `${selector} should animate when motion is enabled`);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  const motionEnabled = await catalog.locator('.topic-section-content, .topic-book').evaluateAll(elements => elements.some(element => {
    const style = getComputedStyle(element);
    return style.animationName !== 'none' && style.animationDuration.split(',').some(duration => parseFloat(duration) > 0);
  }));
  assert.equal(motionEnabled, false, 'Topic and book animations must respect reduced motion');
  await assertReducedMotionFlow(1280);
  await assertReducedMotionFlow(375);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await assertNoOverflow([240, 320, 375, 639, 640, 767, 768, 1024, 1280, 1920], 'all topics');
  await assertStickyTopicHeading({width:1280, context:'all topics on desktop', screenshotPath:'artifacts/catalog-topic-title-desktop.png'});
  await assertTopicStack({width:1280, context:'all topics on desktop after resetting filters', screenshotPath:'artifacts/catalog-stack-desktop.png'});
  await assertStickyTopicHeading({width:375, context:'all topics on mobile', screenshotPath:'artifacts/catalog-topic-title-mobile.png'});
  await assertTopicStack({width:375, context:'all topics on mobile after resetting filters', screenshotPath:'artifacts/catalog-stack-mobile.png'});
  await page.setViewportSize({width:1280,height:900});
  await catalog.evaluate(element => element.scrollIntoView({block:'start', behavior:'instant'}));
  await page.screenshot({path:'artifacts/catalog-desktop.png', animations:'disabled'});
  await catalog.locator('article').first().screenshot({path:'artifacts/book-card.png', animations:'disabled'});
  await toggleTopic(first.topic);
  await toggleTopic(other);
  await assertCatalog(selectedTopics);
  await assertNoOverflow([240, 375, 768, 1280], 'two selected topics');
  await assertTopicStack({width:375, context:'two selected topics on mobile'});
  await assertStickyTopicHeading({width:375, context:'two selected topics on mobile'});
  await page.setViewportSize({width:375,height:900});
  await catalog.evaluate(element => element.scrollIntoView({block:'start', behavior:'instant'}));
  await page.screenshot({path:'artifacts/catalog-mobile.png', animations:'disabled'});
  await page.reload();
  await catalog.locator('article').first().waitFor();
  await assertCatalog(topics);
  await assertBookPrices(catalog, catalogPrices);
  await assertBookPrices(page.locator('#staff-picks'), catalogPrices);
  assert.deepEqual(errors, []);
  console.log(`Passed: ${books.length} cards in ${topics.length} topic groups, visible dollar prices within $4.99–$49.99 consistent across staff picks/saves/filters/reload, multi-select/reset/keyboard filtering, synchronized saves retained across filters, desktop/mobile stacking geometry and hit-testing, sticky current-topic titles and next-topic replacement across filters and reduced motion, tall-section reachability, keyboard access to covered Save buttons, reduced-motion normal flow, cards within 450px with contained prices/Save buttons and ellipsized descriptions, no overflow at 10 all-topic and 4 filtered widths, no runtime errors.`);
} finally { await browser.close(); server.kill(); }
