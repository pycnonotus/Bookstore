import { readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./index.js";
import { books, categories } from "./schema.js";

try {
    const catalog = JSON.parse(await readFile(new URL("./data/books.json", import.meta.url), "utf8"));
    await db.transaction(async tx => {
        // Serialize seed runs so concurrent starts cannot create duplicate categories.
        await tx.execute(sql`select pg_advisory_xact_lock(7864321)`);
        const categoryIds = new Map();
        for (const name of [...new Set(catalog.map(book => book.topic))]) {
            let [category] = await tx.select().from(categories).where(eq(categories.name, name)).orderBy(categories.id).limit(1);
            if (!category) [category] = await tx.insert(categories).values({ name }).returning();
            categoryIds.set(name, category.id);
        }
        await tx.insert(books).values(catalog.map(({ topic, ...book }) => ({
            ...book,
            categoryId: categoryIds.get(topic),
        }))).onConflictDoNothing({ target: books.id });
    });
    console.log(`Catalog seed complete (${catalog.length} books; existing records preserved).`);
} catch (error) {
    console.error("Catalog seed failed:", error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
