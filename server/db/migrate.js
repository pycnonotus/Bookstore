import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index.js";

try {
    await migrate(db, {
        migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
    console.log("Database migrations applied.");
} catch (error) {
    console.error("Database migration failed:", error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
