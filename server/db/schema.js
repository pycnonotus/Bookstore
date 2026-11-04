import { pgTable, uuid, text, integer, timestamp, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("mail").notNull().unique(),
    name: text("name").notNull().default(""),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    // Retain any legacy credentials; Better Auth stores new hashes in accounts.
    passwordHash: text("password_hash"),
    passwordSalt: text("password_salt"),
});

export const sessions = pgTable("sessions", {
    id: uuid("id").defaultRandom().primaryKey(),
    token: text("token").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [index("sessions_user_id_idx").on(table.userId)]);

export const accounts = pgTable("accounts", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    password: text("password"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_unique").on(table.providerId, table.accountId),
]);

export const verifications = pgTable("verifications", {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [index("verifications_identifier_idx").on(table.identifier)]);

export const categories = pgTable("categories", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
});

export const books = pgTable("books", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    categoryId: uuid("category_id")
        .notNull()
        .references(() => categories.id),
    priceCents: integer("price_cents"),
    author: text("author").notNull().default(""),
    // Public client path, e.g. /images/cover.jpeg.
    image: text("image").notNull().default(""),
    currency: text("currency").notNull().default("USD"),
    searchKeywords: jsonb("search_keywords").notNull().default([]),
    subjects: jsonb("subjects").notNull().default([]),
    aliases: jsonb("aliases").notNull().default([]),
    readingLevel: text("reading_level").notNull().default("unspecified"),
    coverDescription: text("cover_description").notNull().default(""),
    coverDescriptionSource: text("cover_description_source").notNull().default(""),
});

export const orders = pgTable("orders", {
    id: uuid("id").defaultRandom().primaryKey(),

    itemsSumHash: text("items_sum_hash").notNull(),
    requestId: uuid("request_id"),
    totalCents: integer("total_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),

    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),

    paidAt: timestamp("paid_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, table => [
    index("orders_user_id_idx").on(table.userId),
    uniqueIndex("orders_user_request_unique").on(table.userId, table.requestId),
]);

export const orderItems = pgTable("order_items", {
    id: uuid("id").defaultRandom().primaryKey(),

    orderId: uuid("order_id")
        .notNull()
        .references(() => orders.id),

    bookId: uuid("book_id")
        .notNull()
        .references(() => books.id),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    title: text("title").notNull().default(""),
}, table => [index("order_items_order_id_idx").on(table.orderId)]);
