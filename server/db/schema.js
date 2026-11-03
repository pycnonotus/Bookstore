import { pgTable, uuid, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    mail: text("mail").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
});

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

    userId: uuid("user_id")
        .notNull()
        .references(() => users.id),

    paidAt: timestamp("paid_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});

export const orderItems = pgTable("order_items", {
    id: uuid("id").defaultRandom().primaryKey(),

    orderId: uuid("order_id")
        .notNull()
        .references(() => orders.id),

    bookId: uuid("book_id")
        .notNull()
        .references(() => books.id),
});
