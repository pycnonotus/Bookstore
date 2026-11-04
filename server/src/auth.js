import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { users, sessions, accounts, verifications } from "../db/schema.js";

export function createAuth(db) {
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("Set BETTER_AUTH_SECRET to a random secret of at least 32 characters (npm run auth:setup).");
    }
    const baseURL = process.env.BETTER_AUTH_URL;
    if (!baseURL) throw new Error("BETTER_AUTH_URL must be the public frontend URL, e.g. http://localhost:5173.");

    return betterAuth({
        appName: "Book Library",
        baseURL,
        basePath: "/api/auth",
        secret,
        database: drizzleAdapter(db, {
            provider: "pg",
            schema: { user: users, session: sessions, account: accounts, verification: verifications },
            transaction: true,
        }),
        emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
        trustedOrigins: [new URL(baseURL).origin, ...(process.env.AUTH_TRUSTED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)],
        advanced: {
            database: { generateId: "uuid" },
            ipAddress: { ipAddressHeaders: ["x-bookstore-client-ip"] },
        },
        rateLimit: {
            enabled: true,
            window: 60,
            max: 100,
            customRules: {
                "/sign-in/email": { window: 60, max: 10 },
                "/sign-up/email": { window: 60, max: 5 },
            },
        },
    });
}
