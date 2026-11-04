import express from "express";
import { authHandler } from "./routes/auth.js";
import { accountRouter } from "./routes/account.js";
import { booksRouter } from "./routes/books.js";
import { categoriesRouter } from "./routes/categories.js";
import { ordersRouter } from "./routes/orders.js";
import { stripeWebhookRouter } from "./routes/stripe-webhook.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export function createApp(db, auth, payments = null) {
    const app = express();
    app.disable("x-powered-by");
    const proxies = (process.env.TRUSTED_PROXY_IPS || "").split(",").map(value => value.trim()).filter(Boolean);
    if (proxies.length) app.set("trust proxy", proxies);
    // Stripe signatures require the raw body; this route has no session middleware.
    app.use("/api/stripe/webhook", stripeWebhookRouter(payments));
    app.all("/api/auth/*splat", authHandler(auth));
    app.use("/api/me", accountRouter(auth));
    app.use("/api/books", booksRouter(db));
    app.use("/api/categories", categoriesRouter(db));
    app.use("/api/orders", ordersRouter(db, auth, payments));
    app.use(notFound);
    app.use(errorHandler);
    return app;
}
