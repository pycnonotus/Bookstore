import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";

const files = [new URL("../../.env", import.meta.url), new URL("../.env", import.meta.url)];
const contents = await Promise.all(files.map(async file => {
    try { return await readFile(file, "utf8"); }
    catch (error) {
        if (error.code !== "ENOENT") throw error;
        return readFile(new URL(`${file.href}.example`), "utf8");
    }
}));
const existing = contents.map(content => parse(content).BETTER_AUTH_SECRET).filter(Boolean);
if (existing.some(secret => secret.length < 32)) throw new Error("An existing BETTER_AUTH_SECRET is too short; update it before continuing.");
const secret = existing[0] || randomBytes(48).toString("base64url");
for (const [i, file] of files.entries()) {
    let content = contents[i];
    const values = parse(content);
    const localDefaults = i === 0 ? {
        BOOKSTORE_URL: "https://books.pycnonotus.dev",
    } : {
        BETTER_AUTH_URL: "http://localhost:5173",
        AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:5173",
    };
    for (const [key, value] of Object.entries({
        BETTER_AUTH_SECRET: secret,
        ...localDefaults,
    })) {
        if (values[key]) continue;
        const line = `${key}='${value}'`;
        const pattern = new RegExp(`^${key}=.*$`, "m");
        content = pattern.test(content) ? content.replace(pattern, line) : `${content.trimEnd()}\n${line}\n`;
    }
    await writeFile(file, content);
}
console.log("Auth settings added to root .env and server/.env. Existing values preserved; secrets were not printed.");
