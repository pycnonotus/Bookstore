import { Router } from "express";
import { eq, getTableColumns } from "drizzle-orm";
import { books, categories } from "../../db/schema.js";
import { methodNotAllowed } from "../middleware/errors.js";

export function booksRouter(db) {
    const router = Router();
    router.get("/", async (_request, response) => {
        const rows = await db.select({ ...getTableColumns(books), topic: categories.name })
            .from(books)
            .innerJoin(categories, eq(books.categoryId, categories.id))
            .orderBy(books.title, books.id);
        response.json(rows);
    });
    router.all("/", methodNotAllowed);
    return router;
}
