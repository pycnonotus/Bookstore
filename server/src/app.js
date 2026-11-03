import { createServer } from "node:http";
import { books, categories } from "../db/schema.js";

export function createApp(db) {
    return createServer(async (request, response) => {
        function json(status, body) {
            response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify(body));
        }

        let pathname;
        try {
            pathname = new URL(request.url, "http://localhost").pathname;
        } catch {
            return json(400, { error: "Invalid request URL" });
        }

        if (pathname !== "/api/books" && pathname !== "/api/categories") {
            return json(404, { error: "Not found" });
        }
        if (request.method !== "GET") {
            response.setHeader("Allow", "GET");
            return json(405, { error: "Method not allowed" });
        }

        const table = pathname === "/api/books" ? books : categories;
        try {
            const sortColumn = table === books ? books.title : categories.name;
            const rows = await db.select().from(table).orderBy(sortColumn, table.id);
            json(200, rows);
        } catch (error) {
            console.error(`Failed to list ${pathname}:`, error);
            json(500, { error: "Unable to load data" });
        }
    });
}
