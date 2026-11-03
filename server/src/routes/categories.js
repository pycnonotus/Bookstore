import { Router } from "express";
import { categories } from "../../db/schema.js";
import { methodNotAllowed } from "../middleware/errors.js";

export function categoriesRouter(db) {
    const router = Router();
    router.get("/", async (_request, response) => {
        response.json(await db.select().from(categories).orderBy(categories.name, categories.id));
    });
    router.all("/", methodNotAllowed);
    return router;
}
