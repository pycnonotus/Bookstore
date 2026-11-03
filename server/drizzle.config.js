import { defineConfig } from "drizzle-kit";
import "./db/env.js";

export default defineConfig({
    dialect: "postgresql",
    schema: "./db/schema.js",
    out: "./drizzle",
    ...(process.env.DATABASE_URL && {
        dbCredentials: { url: process.env.DATABASE_URL },
    }),
});
