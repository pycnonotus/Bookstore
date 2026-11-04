import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

// UI tests use mocked API responses; signed-webhook/database tests live in server/tests.
const base = process.env.PAYMENTS_TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const id = randomUUID(), userId = randomUUID();
  const order = {
    id, createdAt: new Date().toISOString(), paidAt: null, status: 'waiting_for_payment',
    currency: 'USD', totalCents: 2598, checkoutAvailable: true,
    items: [{ bookId: randomUUID(), title: 'A Book for Every Reader', quantity: 2, unitPriceCents: 1299, lineTotalCents: 2598 }],
  };
  let checkoutRequests = 0, refreshRequests = 0, failCheckout = false, failRefresh = false;
  await context.route('**/api/auth/get-session**', route => route.fulfill({ json: {
    session: { id: randomUUID(), expiresAt: new Date(Date.now() + 86400000).toISOString() },
    user: { id: userId, name: 'Payment Reader', email: 'reader@example.com' },
  } }));
  await context.route(url => url.pathname === '/api/orders' || url.pathname.startsWith('/api/orders/'), async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/checkout')) {
      checkoutRequests++;
      await new Promise(resolve => setTimeout(resolve, 250));
      return route.fulfill(failCheckout ? { status: 502, json: { error: 'Could not open checkout. Please try again.' } } : { json: { url: 'https://checkout.stripe.com/c/pay/cs_test_ui' } });
    }
    if (path.endsWith('/payment-status')) {
      refreshRequests++;
      return route.fulfill(failRefresh ? { status: 502, json: { error: 'Could not confirm payment yet.' } } : { json: order });
    }
    return route.fulfill({ json: path === '/api/orders' ? [order] : order });
  });
  await context.route('https://checkout.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Hosted checkout test</h1>' }));

  await page.goto(`${base}/orders/${id}`);
  await page.getByRole('button', { name: 'Pay $25.98', exact: true }).waitFor();
  failCheckout = true;
  await page.getByRole('button', { name: 'Pay $25.98', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Could not open checkout.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Pay $25.98', exact: true }).isEnabled(), true);
  failCheckout = false;
  await page.getByRole('button', { name: 'Pay $25.98', exact: true }).dblclick();
  await page.waitForURL('https://checkout.stripe.com/c/pay/cs_test_ui');
  assert.equal(checkoutRequests, 2, 'double-click must send one checkout request');

  await page.goto(`${base}/orders/${id}?checkout=cancelled`);
  await page.getByText('Checkout was cancelled.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Pay $25.98', exact: true }).waitFor();

  // A forged success URL must not mark an unpaid order paid.
  const confirmation = page.waitForResponse(response => response.url().endsWith('/payment-status'));
  await page.goto(`${base}/orders/${id}?checkout=success`);
  await page.getByText('Waiting for payment', { exact: true }).waitFor();
  await confirmation;
  assert.equal(await page.getByText('Paid', { exact: true }).count(), 0);
  assert.ok(refreshRequests >= 1);
  // A webhook update appears automatically while the page remains open.
  order.status = 'paid'; order.paidAt = new Date().toISOString();
  await page.getByText('Paid', { exact: true }).waitFor({ timeout: 10000 });
  assert.equal(await page.getByRole('button', { name: /^Pay \$/ }).count(), 0);
  await page.getByRole('link', { name: 'All my orders', exact: true }).click();
  await page.getByRole('heading', { name: 'My orders', exact: true }).waitFor();
  await page.getByRole('link').filter({ hasText: `Order ${id}` }).click();
  await page.getByText('Paid', { exact: true }).waitFor();

  order.status = 'processing'; order.paidAt = null;
  await page.reload();
  await page.getByText('Payment processing', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Pay \$/ }).count(), 0);
  failRefresh = true;
  await page.getByRole('button', { name: 'Refresh payment status', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Could not confirm payment yet.' }).waitFor();
  failRefresh = false;
  order.status = 'paid'; order.paidAt = new Date().toISOString();
  await page.getByRole('button', { name: 'Refresh payment status', exact: true }).click();
  await page.getByText('Paid', { exact: true }).waitFor();

  for (const [status, label] of [['payment_failed', 'Payment failed'], ['checkout_expired', 'Payment link expired']]) {
    order.status = status; order.paidAt = null;
    await page.reload();
    await page.getByText(label, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Pay $25.98', exact: true }).waitFor();
  }
  order.status = 'waiting_for_payment';
  await page.reload();
  await page.getByRole('button', { name: 'Pay $25.98', exact: true }).waitFor();
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/order-payment-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: 'artifacts/order-payment-mobile.png', fullPage: true });
  order.checkoutAvailable = false;
  await page.reload();
  await page.getByText('Payments are temporarily unavailable.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Pay \$/ }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('Passed: Stripe redirect, failed checkout retry, double-click protection, cancelled/forged returns, automatic paid update, order history, delayed/failed/expired payments, refresh recovery, unavailable checkout, and mobile layout.');
} finally { await browser.close(); }
