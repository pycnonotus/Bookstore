import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { databaseUrl } from "./env.js";
import * as schema from "./schema.js";

export const pool = new pg.Pool({
    connectionString: databaseUrl(),
    connectionTimeoutMillis: 10000,
});
export const db = drizzle(pool, { schema });
