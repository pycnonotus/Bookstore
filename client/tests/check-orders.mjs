import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

// Requires a running app and disposable, seeded database; creates users and orders.
const base = process.env.ORDERS_TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const books = await (await context.request.get(`${base}/api/books`)).json();
  const book = books[0];
  const post = (data, ctx = context, headers = {}) => ctx.request.post(`${base}/api/orders`, { data, headers: { Origin: base, ...headers } });
  assert.equal((await post({ requestId: randomUUID(), items: [{ bookId: book.id, quantity: 1 }] })).status(), 401);
  assert.equal((await context.request.get(`${base}/api/orders`)).status(), 401);

  await page.goto(base);
  const card = page.locator('#catalog article').filter({ has: page.getByRole('heading', { name: book.title, exact: true }) });
  await card.getByRole('button', { name: `Add ${book.title} to cart`, exact: true }).click();
  await page.getByRole('link', { name: 'Cart (1)', exact: true }).click();
  await page.getByRole('spinbutton').fill('2');
  await page.getByRole('link', { name: 'Log in to place order', exact: true }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Order Reader');
  await page.getByLabel('Email', { exact: true }).fill(`orders-${randomUUID()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('Order test password 42!');
  await page.getByLabel('Confirm password', { exact: true }).fill('Order test password 42!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL(`${base}/cart`);
  await page.getByRole('button', { name: 'Place order', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Place order', exact: true }).waitFor();
  assert.equal(await page.getByRole('spinbutton').inputValue(), '2');
  // Simulate a failed submission: cart and request ID must be retained for retry.
  const draftBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('book-library-cart-v1')));
  await page.route('**/api/orders', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Please retry your order.' }) }));
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Please retry your order.' }).waitFor();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('book-library-cart-v1'))), draftBefore);
  await page.unroute('**/api/orders');
  const createdResponse = page.waitForResponse(response => response.url() === `${base}/api/orders` && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  const response = await createdResponse;
  assert.equal(response.status(), 201);
  const order = await response.json();
  assert.equal(order.totalCents, book.priceCents * 2);
  assert.equal(order.status, 'waiting_for_payment');
  assert.equal(order.paidAt, null);
  assert.equal(order.items[0].quantity, 2);
  await page.waitForURL(`${base}/orders/${order.id}`);
  await page.getByText('Waiting for payment', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Waiting for payment', { exact: true }).waitFor();
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('book-library-cart-v1')))).items.length, 0);
  await page.getByRole('link', { name: 'All my orders', exact: true }).click();
  await page.getByRole('link').filter({ hasText: `Order ${order.id}` }).click();
  await page.getByText('Waiting for payment', { exact: true }).waitFor();

  const retry = await post(draftBefore);
  assert.equal(retry.status(), 200);
  assert.equal((await retry.json()).id, order.id);
  assert.equal((await post({ ...draftBefore, items: [{ bookId: book.id, quantity: 3 }] })).status(), 409);
  for (const items of [[], [{ bookId: book.id, quantity: 0 }], [{ bookId: book.id, quantity: -1 }], [{ bookId: book.id, quantity: 1.5 }], [{ bookId: book.id, quantity: 100 }], [{ bookId: randomUUID(), quantity: 1 }], [{ bookId: book.id, quantity: 1 }, { bookId: book.id, quantity: 1 }]]) {
    assert.equal((await post({ requestId: randomUUID(), items })).status(), 400);
  }
  assert.equal((await context.request.get(`${base}/api/orders/not-an-id`)).status(), 400);
  assert.equal((await post(draftBefore, context, { Origin: 'https://untrusted.example' })).status(), 403);
  assert.equal((await context.request.post(`${base}/api/orders`, { headers: { Origin: base, 'Content-Type': 'application/json' }, data: '{invalid' })).status(), 400);
  assert.equal((await context.request.get(`${base}/api/orders`)).ok(), true);
  assert.equal((await (await context.request.get(`${base}/api/orders`)).json()).length, 1);

  const concurrent = { requestId: randomUUID(), userId: randomUUID(), status: 'paid', paidAt: new Date().toISOString(), totalCents: 1, items: [{ bookId: book.id, quantity: 1, unitPriceCents: 1 }] };
  const responses = await Promise.all([post(concurrent), post(concurrent), post(concurrent)]);
  assert.deepEqual(responses.map(result => result.status()).sort(), [200, 200, 201]);
  const results = await Promise.all(responses.map(result => result.json()));
  assert.equal(new Set(results.map(result => result.id)).size, 1);
  assert.ok(results.every(result => result.totalCents === book.priceCents && result.status === 'waiting_for_payment' && result.paidAt === null));

  const other = await browser.newContext();
  const register = await other.request.post(`${base}/api/auth/sign-up/email`, { headers: { Origin: base }, data: { name: 'Other Reader', email: `other-${randomUUID()}@example.com`, password: 'Other password 42!' } });
  assert.equal(register.status(), 200);
  assert.deepEqual(await (await other.request.get(`${base}/api/orders`)).json(), []);
  assert.equal((await other.request.get(`${base}/api/orders/${order.id}`)).status(), 404);
  assert.equal((await context.request.get(`${base}/api/orders`)).status(), 200);
  assert.equal((await (await context.request.get(`${base}/api/orders`)).json()).length, 2);
  assert.deepEqual(errors, []);
  console.log('Passed: guest cart/login return, order creation/reopening, failed submission retry, owner isolation, validation, authoritative prices, and concurrent duplicate protection.');
} finally { await browser.close(); }
