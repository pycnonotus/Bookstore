import express from "express";
import { booksRouter } from "./routes/books.js";
import { categoriesRouter } from "./routes/categories.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export function createApp(db) {
    const app = express();
    app.disable("x-powered-by");
    app.use("/api/books", booksRouter(db));
    app.use("/api/categories", categoriesRouter(db));
    app.use(notFound);
    app.use(errorHandler);
    return app;
}
