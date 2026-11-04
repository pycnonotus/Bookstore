import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import Stripe from "stripe";
import { books, categories } from "../db/schema.js";
import { createApp } from "../src/app.js";
import { createAuth } from "../src/auth.js";
import { getOrder } from "../src/services/orders.js";
import { createPayments } from "../src/stripe.js";

test("Checkout retries reuse a session and signed Stripe updates confirm the saved order", async t => {
    assert.ok(process.env.TEST_DATABASE_URL, "Set TEST_DATABASE_URL to a disposable migrated database.");
    const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    t.after(() => pool.end());
    const db = drizzle(pool);
    const [category] = await db.insert(categories).values({ name: "Payment test" }).returning();
    const [book] = await db.insert(books).values({
        categoryId: category.id, title: "Payment test book", priceCents: 1299,
    }).returning();
    const frontendUrl = "https://books.example.test";
    process.env.BETTER_AUTH_URL = frontendUrl;
    process.env.BETTER_AUTH_SECRET = randomUUID() + randomUUID();

    const stripe = new Stripe("sk_test_fake");
    const savedSessions = new Map();
    const fake = {
        webhooks: stripe.webhooks,
        checkout: { sessions: {
            async create(parameters, { idempotencyKey }) {
                if (savedSessions.has(idempotencyKey)) return savedSessions.get(idempotencyKey);
                assert.equal(parameters.success_url, `https://books.example.test/orders/${order.id}?checkout=success`);
                assert.equal(parameters.line_items[0].price_data.unit_amount, 1299);
                const session = {
                    id: `cs_test_${idempotencyKey}`, url: `https://checkout.stripe.com/c/pay/${idempotencyKey}`,
                    metadata: parameters.metadata, client_reference_id: parameters.client_reference_id,
                    mode: "payment", livemode: false, amount_total: 2598, currency: "usd",
                    status: "open", payment_status: "unpaid",
                };
                savedSessions.set(idempotencyKey, session);
                return session;
            },
            async retrieve(id) {
                return [...savedSessions.values()].find(session => session.id === id);
            },
        } },
    };
    const webhookSecret = "whsec_fake";
    const payments = createPayments(db, fake, { webhookSecret, frontendUrl, liveMode: false });
    const app = createApp(db, createAuth(db), payments);
    const server = app.listen(0, "127.0.0.1");
    t.after(() => new Promise(resolve => server.close(resolve)));
    await once(server, "listening");

    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (path, body, cookie = "") => fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: frontendUrl, Cookie: cookie },
        body: JSON.stringify(body),
    });
    const signup = await post("/api/auth/sign-up/email", {
        name: "Payment test", email: `${randomUUID()}@example.test`, password: randomUUID(),
    });
    assert.equal(signup.status, 200);
    const { user } = await signup.json();
    const cookie = signup.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    const placed = await post("/api/orders", {
        requestId: randomUUID(), items: [{ bookId: book.id, quantity: 2 }],
    }, cookie);
    assert.equal(placed.status, 201);
    const order = await placed.json();

    const [first, concurrent] = await Promise.all([
        payments.checkout(user.id, order.id.toUpperCase()),
        post(`/api/orders/${order.id}/checkout`, {}, cookie).then(async response => {
            assert.equal(response.status, 200);
            return response.json();
        }),
    ]);
    assert.ok(first.url);
    assert.deepEqual(first, concurrent);
    assert.equal(savedSessions.size, 1);
    const [session] = savedSessions.values();
    const orderStatus = async () => (await getOrder(db, user.id, order.id)).status;
    const send = async (event, signature) => {
        const payload = JSON.stringify(event);
        const response = await fetch(base + "/api/stripe/webhook", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Stripe-Signature": signature ?? stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret }),
            },
            body: payload,
        });
        await response.text();
        return response.status;
    };
    const event = (type, session) => ({ id: `evt_${randomUUID()}`, type, data: { object: { ...session } } });
    assert.equal(await send(event("checkout.session.completed", session), "invalid"), 400);
    await payments.refresh(user.id, order.id);
    assert.equal(await orderStatus(), "waiting_for_payment");

    session.status = "complete";
    assert.equal(await send(event("checkout.session.completed", session)), 200);
    assert.equal(await orderStatus(), "processing");
    assert.deepEqual(await payments.checkout(user.id, order.id), { url: null });
    const failed = event("checkout.session.async_payment_failed", session);
    assert.equal(await send(failed), 200);
    assert.equal(await orderStatus(), "payment_failed");
    const retry = await payments.checkout(user.id, order.id);
    assert.ok(retry.url);
    assert.notEqual(retry.url, first.url);
    const [, paidSession] = savedSessions.values();
    Object.assign(paidSession, { status: "complete", payment_status: "paid", payment_intent: `pi_${randomUUID()}` });
    const paid = event("checkout.session.async_payment_succeeded", paidSession);
    assert.equal(await send(paid), 200);
    assert.equal(await send(paid), 200);
    assert.equal(await send(failed), 200);
    assert.equal(await orderStatus(), "paid");
    assert.deepEqual(await payments.checkout(user.id, order.id), { url: null });
});
