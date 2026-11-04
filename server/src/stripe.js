import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import { checkoutAttempts, orderItems, orders, stripeEvents } from "../db/schema.js";
import { isUuid, OrderError } from "./services/orders.js";

const checkoutEvents = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
]);

export function configurePayments(db) {
    const { STRIPE_SECRET_KEY: key, STRIPE_WEBHOOK_SECRET: webhookSecret, BETTER_AUTH_URL: frontendUrl } = process.env;
    if (!key || !webhookSecret) return null;
    return createPayments(db, new Stripe(key, { maxNetworkRetries: 2, timeout: 10000 }), {
        webhookSecret, frontendUrl, liveMode: /^(sk|rk)_live_/.test(key),
    });
}

export function createPayments(db, stripe, { webhookSecret, frontendUrl, liveMode }) {
    const frontendOrigin = new URL(frontendUrl).origin;
    const sessions = stripe.checkout.sessions;

    async function prepareCheckout(userId, orderId) {
        return db.transaction(async tx => {
            const [order] = await tx.select().from(orders)
                .where(and(eq(orders.id, orderId), eq(orders.userId, userId))).for("update");
            if (!order) throw new OrderError(404, "Order not found.");
            if (order.paidAt || order.paymentStatus === "processing") return null;

            if (order.checkoutAttemptId) {
                const [attempt] = await tx.select().from(checkoutAttempts)
                    .where(eq(checkoutAttempts.id, order.checkoutAttemptId));
                if (!attempt) throw new Error("Order references a missing checkout attempt.");
                if (!["payment_failed", "checkout_expired"].includes(attempt.status)) return attempt;
            }

            const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
            const total = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
            if (order.currency !== "USD" || total !== order.totalCents || total < 50 || total > 99999999) {
                throw new OrderError(400, "This order cannot be paid through Stripe Checkout.");
            }
            const id = randomUUID();
            const orderUrl = new URL(`/orders/${order.id}`, frontendOrigin);
            const [attempt] = await tx.insert(checkoutAttempts).values({
                id,
                orderId: order.id,
                parameters: {
                    mode: "payment",
                    client_reference_id: order.id,
                    metadata: { orderId: order.id, userId: order.userId, attemptId: id },
                    expires_at: Math.floor(Date.now() / 1000) + 7200,
                    success_url: `${orderUrl}?checkout=success`,
                    cancel_url: `${orderUrl}?checkout=cancelled`,
                    line_items: items.map(item => ({
                        quantity: item.quantity,
                        price_data: {
                            currency: "usd",
                            unit_amount: item.unitPriceCents,
                            product_data: { name: item.title },
                        },
                    })),
                },
            }).returning();
            await tx.update(orders).set({ checkoutAttemptId: id, paymentStatus: "waiting_for_payment" })
                .where(eq(orders.id, order.id));
            return attempt;
        });
    }

    async function saveSession(attemptId, session, event) {
        return db.transaction(async tx => {
            const [attempt] = await tx.select().from(checkoutAttempts).where(eq(checkoutAttempts.id, attemptId));
            if (!attempt) return false;
            const [order] = await tx.select().from(orders).where(eq(orders.id, attempt.orderId)).for("update");
            const [currentAttempt] = await tx.select().from(checkoutAttempts).where(eq(checkoutAttempts.id, attemptId));
            if (session.metadata?.attemptId !== attemptId || session.metadata.orderId !== order.id
                || session.metadata.userId !== order.userId || session.client_reference_id !== order.id
                || session.mode !== "payment" || session.livemode !== liveMode
                || session.amount_total !== order.totalCents || session.currency !== order.currency.toLowerCase()
                || (currentAttempt.stripeSessionId && currentAttempt.stripeSessionId !== session.id)) {
                throw new Error("Stripe Checkout Session does not match its saved order.");
            }
            if (event) {
                const [inserted] = await tx.insert(stripeEvents).values({ id: event.id, type: event.type })
                    .onConflictDoNothing().returning({ id: stripeEvents.id });
                if (!inserted) return false;
            }

            if (order.paidAt || order.checkoutAttemptId !== attemptId) return false;
            const update = {};
            let status = currentAttempt.status;
            if (session.status === "complete" && session.payment_status === "paid") {
                if (typeof session.payment_intent !== "string") throw new Error("Paid session is missing its PaymentIntent ID.");
                status = "paid";
                update.paidAt = new Date();
                update.stripePaymentIntentId = session.payment_intent;
            } else if (!["payment_failed", "checkout_expired"].includes(status)) {
                if (session.status === "expired") status = "checkout_expired";
                else if (session.status === "complete") {
                    status = event?.type === "checkout.session.async_payment_failed" ? "payment_failed" : "processing";
                } else if (session.status === "open" && status === "creating") status = "waiting_for_payment";
            }
            await tx.update(checkoutAttempts).set({ stripeSessionId: session.id, status })
                .where(eq(checkoutAttempts.id, attemptId));
            if (status !== "creating") {
                await tx.update(orders).set({ ...update, paymentStatus: status }).where(eq(orders.id, order.id));
            }
            return status === "waiting_for_payment" && session.status === "open";
        });
    }

    return {
        async checkout(userId, orderId) {
            const attempt = await prepareCheckout(userId, orderId);
            if (!attempt) return { url: null };
            const session = attempt.stripeSessionId
                ? await sessions.retrieve(attempt.stripeSessionId)
                : await sessions.create(attempt.parameters, { idempotencyKey: attempt.id });
            const payable = await saveSession(attempt.id, session);
            return { url: payable ? session.url : null };
        },
        async refresh(userId, orderId) {
            const [attempt] = await db.select({ id: checkoutAttempts.id, stripeSessionId: checkoutAttempts.stripeSessionId })
                .from(orders).innerJoin(checkoutAttempts, eq(checkoutAttempts.id, orders.checkoutAttemptId))
                .where(and(eq(orders.id, orderId), eq(orders.userId, userId)));
            if (attempt?.stripeSessionId) await saveSession(attempt.id, await sessions.retrieve(attempt.stripeSessionId));
        },
        verifyWebhook(body, signature) {
            return stripe.webhooks.constructEvent(body, signature, webhookSecret);
        },
        async handleWebhook(event) {
            if (!checkoutEvents.has(event.type)) return;
            const snapshot = event.data.object;
            const attemptId = snapshot.metadata?.attemptId;
            if (!isUuid(attemptId)) return;
            const [attempt] = await db.select({ id: checkoutAttempts.id }).from(checkoutAttempts)
                .where(eq(checkoutAttempts.id, attemptId));
            if (!attempt) return;
            await saveSession(attempt.id, await sessions.retrieve(snapshot.id), event);
        },
    };
}
