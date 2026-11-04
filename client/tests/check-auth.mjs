import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

// Use a disposable database: this test registers a unique account.
const base = process.env.AUTH_TEST_URL || 'http://127.0.0.1:5173';
const email = `auth-${randomUUID()}@example.com`;
const password = 'Test reader password 42!';
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  assert.equal((await context.request.get(`${base}/api/me`)).status(), 401);
  await page.goto(`${base}/register`);
  await page.getByLabel('Name', { exact: true }).fill('Test Reader');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill('different password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Your passwords do not match.' }).waitFor();
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).waitFor();
  await page.waitForURL(`${base}/`);
  await page.reload();
  await page.getByText('Hello, Test Reader', { exact: true }).waitFor();
  const me = await context.request.get(`${base}/api/me`);
  assert.equal(me.status(), 200);
  const { user } = await me.json();
  assert.equal(user.email, email);
  assert.equal('passwordHash' in user, false);
  assert.equal('passwordSalt' in user, false);
  const cookie = (await context.cookies()).find(value => value.name.endsWith('session_token'));
  assert.ok(cookie?.httpOnly);
  assert.equal(cookie.sameSite, 'Lax');
  await page.goto(`${base}/login`);
  await page.waitForURL(`${base}/`);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('link', { name: 'Log in', exact: true }).waitFor();
  assert.equal((await context.request.get(`${base}/api/me`)).status(), 401);
  // Reusing a cookie after logout must fail server-side too.
  assert.equal((await context.request.get(`${base}/api/me`, {
    headers: { Cookie: `${cookie.name}=${cookie.value}` },
  })).status(), 401);

  await page.goto(`${base}/login`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('incorrect password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Check your email and password' }).waitFor();
  assert.equal((await context.request.get(`${base}/api/me`)).status(), 401);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('link', { name: 'Log in', exact: true }).waitFor();

  const duplicate = await context.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { Origin: base }, data: { email, password, name: 'Duplicate' },
  });
  assert.ok(duplicate.status() >= 400 && duplicate.status() < 500);
  const shortPassword = await context.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { Origin: base }, data: { email: `short-${email}`, password: 'short', name: 'Short' },
  });
  assert.ok(shortPassword.status() >= 400 && shortPassword.status() < 500);
  const untrusted = await context.request.post(`${base}/api/auth/sign-in/email`, {
    headers: { Origin: 'https://untrusted.example' }, data: { email, password },
  });
  assert.equal(untrusted.status(), 403);
  assert.equal((await context.request.get(`${base}/api/me`)).status(), 401);
  assert.deepEqual(errors, []);
  console.log('Passed: registration, validation, login, persistent HttpOnly session, logout/revocation, duplicates, password policy, origin checks, and protected endpoint.');
} finally {
  await browser.close();
}
