import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

export function databaseUrl() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required. Copy server/.env.example to server/.env and configure PostgreSQL.");
    }
    return process.env.DATABASE_URL;
}
