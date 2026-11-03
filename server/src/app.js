import express from "express";
import { fileURLToPath } from "node:url";
import { booksRouter } from "./routes/books.js";
import { categoriesRouter } from "./routes/categories.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export function createApp(db) {
    const app = express();
    app.disable("x-powered-by");
    app.use("/api/books", booksRouter(db));
    app.use("/api/categories", categoriesRouter(db));
    app.use("/api/covers", express.static(fileURLToPath(new URL("../public/images", import.meta.url))));
    app.use(notFound);
    app.use(errorHandler);
    return app;
}
