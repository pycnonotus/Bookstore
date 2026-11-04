import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { books, orders, orderItems } from "../../db/schema.js";

export const isUuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export class OrderError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

export function validateOrder(body) {
    if (!body || !isUuid(body.requestId) || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) {
        throw new OrderError(400, "Provide a requestId and between 1 and 100 order items.");
    }
    const seen = new Set();
    const items = body.items.map(item => {
        if (!item || !isUuid(item.bookId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
            throw new OrderError(400, "Each item needs a valid bookId and a quantity from 1 to 99.");
        }
        const bookId = item.bookId.toLowerCase();
        if (seen.has(bookId)) throw new OrderError(400, "Each book must appear only once in the order.");
        seen.add(bookId);
        return { bookId, quantity: item.quantity };
    }).sort((a, b) => a.bookId.localeCompare(b.bookId));
    return { requestId: body.requestId.toLowerCase(), items };
}

function summary(order) {
    return {
        id: order.id,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        status: order.paidAt ? "paid" : "waiting_for_payment",
        totalCents: order.totalCents,
        currency: order.currency,
    };
}

async function detail(db, order) {
    const items = await db.select({
        bookId: orderItems.bookId, title: orderItems.title,
        quantity: orderItems.quantity, unitPriceCents: orderItems.unitPriceCents,
    }).from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(orderItems.title, orderItems.bookId);
    return { ...summary(order), items: items.map(item => ({ ...item, lineTotalCents: item.quantity * item.unitPriceCents })) };
}

async function replay(db, order, requestedItems) {
    const result = await detail(db, order);
    const previous = result.items.map(({ bookId, quantity }) => ({ bookId, quantity })).sort((a, b) => a.bookId.localeCompare(b.bookId));
    if (JSON.stringify(previous) !== JSON.stringify(requestedItems)) {
        throw new OrderError(409, "This request was already used for a different order. Please refresh your cart.");
    }
    return { order: result, created: false };
}

export async function createOrder(db, userId, input) {
    return db.transaction(async tx => {
        const requestFilter = and(eq(orders.userId, userId), eq(orders.requestId, input.requestId));
        const [existing] = await tx.select().from(orders).where(requestFilter);
        if (existing) return replay(tx, existing, input.items);

        const catalog = await tx.select().from(books).where(inArray(books.id, input.items.map(item => item.bookId)));
        if (catalog.length !== input.items.length) throw new OrderError(400, "One or more books are no longer available.");
        const byId = new Map(catalog.map(book => [book.id, book]));
        const currency = catalog[0].currency;
        if (!/^[A-Z]{3}$/.test(currency) || catalog.some(book => book.currency !== currency)) {
            throw new OrderError(400, "All books in an order must use the same currency.");
        }
        const items = input.items.map(item => {
            const book = byId.get(item.bookId);
            if (!Number.isInteger(book.priceCents) || book.priceCents < 0) throw new OrderError(400, "A selected book does not have a valid price.");
            return { ...item, title: book.title, unitPriceCents: book.priceCents };
        });
        const totalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
        if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647) throw new OrderError(400, "The order total is too large.");
        const itemsSumHash = createHash("sha256").update(JSON.stringify({ currency, items })).digest("hex");
        const [order] = await tx.insert(orders).values({
            userId, requestId: input.requestId, itemsSumHash, totalCents, currency,
        }).onConflictDoNothing({ target: [orders.userId, orders.requestId] }).returning();
        if (!order) {
            const [concurrent] = await tx.select().from(orders).where(requestFilter);
            return replay(tx, concurrent, input.items);
        }
        await tx.insert(orderItems).values(items.map(item => ({ ...item, orderId: order.id })));
        return { order: await detail(tx, order), created: true };
    });
}

export async function listOrders(db, userId) {
    return (await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt), desc(orders.id))).map(summary);
}

export async function getOrder(db, userId, id) {
    if (!isUuid(id)) throw new OrderError(400, "Invalid order ID.");
    const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
    if (!order) throw new OrderError(404, "Order not found.");
    return detail(db, order);
}
