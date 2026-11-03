import { db, pool } from "../db/index.js";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
}

const app = createApp(db);
const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Bookstore API listening on port ${port}`);
});

function shutdown() {
    server.close(async () => {
        await pool.end();
    });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
