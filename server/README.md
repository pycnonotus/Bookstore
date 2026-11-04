# Server

Express, PostgreSQL and Drizzle ORM. `src/index.js` handles startup and shutdown;
`src/app.js` mounts routers from `src/routes/` and shared error middleware.
The schema is in `db/schema.js`; generated SQL and Drizzle snapshots are committed
in `drizzle/`.

## API

- `/api/auth/*` is handled by Better Auth (email/password registration, login,
  logout and session management).
- `GET /api/me` returns the signed-in user, or 401 without a valid session.
- `POST /api/orders` creates an order for the signed-in user.
- `GET /api/orders` lists the current user's orders, newest first.
- `GET /api/orders/:id` returns that user's order and its items; other users' IDs
  return 404.

- `GET /api/books` returns all books, ordered by title then ID. Fields:
  `id`, `title`, `author`, `description`, `categoryId`, `topic`, `priceCents`,
  `currency`, `image`, `searchKeywords`, `subjects`, `aliases`,
  `readingLevel`, `coverDescription`, `coverDescriptionSource`.
- `GET /api/categories` returns all categories, ordered by name then ID. Fields:
  `id`, `name`.

`image` stores the public client path (for example `/images/cover.jpeg`). Image
files live in `client/public/images/` and are served by the frontend.

Both catalog endpoints return a JSON array (`[]` for an empty table). Unknown routes
return 404, unsupported methods return 405, and database failures return 500
without exposing database details.

## Authentication

From `server/`, run `npm run auth:setup` once. It generates a random
`BETTER_AUTH_SECRET` in the root `.env` (Compose) and `server/.env` (local Node).
Existing nonempty settings and database passwords are preserved. Secrets stay
in ignored files and are not printed. No external auth account or API key is needed.

`BETTER_AUTH_URL` is the public frontend URL, default `http://localhost:5173`.
`AUTH_TRUSTED_ORIGINS` is an optional comma-separated list of additional frontend
origins (default `http://127.0.0.1:5173`). Match these to the actual frontend port.
In production use your HTTPS frontend URL and proxy `/api` to Express. The client
uses same-origin requests; no cross-origin cookie or CORS setup is needed.

The client has `/register` and `/login` pages. Registration signs users in;
sessions persist in PostgreSQL and use HttpOnly cookies. Logout revokes the
session. Auth endpoints have rate limiting and Better Auth's origin checks.
Email verification, password-reset emails and social login are not configured.

The auth handler obtains client IPs from Express and overwrites the internal
header used for rate limiting. If deployed behind a reverse proxy, set
`TRUSTED_PROXY_IPS` to its exact IPs/CIDRs (comma separated) and have that proxy
forward `X-Forwarded-For`. By default, forwarded addresses are not trusted.

Migration `0003_better_auth` extends `users` and adds `accounts`, `sessions`, and
`verifications`. User UUIDs and existing order references are preserved. New
password hashes live in `accounts`; legacy `password_hash`/`password_salt` values
are retained but are not used by Better Auth. Any preexisting manually created
users need a separate credential migration before they can log in.

## Orders

The client sends a JSON body with `requestId` (UUID) and `items`, for example:

```json
{
  "requestId": "79e2dfee-0bc8-4d7a-b543-7f61371b3fd0",
  "items": [{ "bookId": "b3aed4d5-d7da-4096-8ece-81ab735eb87a", "quantity": 2 }]
}
```

Requests must include a session cookie and an `Origin` configured for the frontend.
The server accepts 1–100 distinct books, with integer quantities from 1–99.
Prices, titles, currency and the user ID come from the database/session. Client
totals, payment flags and user IDs are never used. Unavailable or unpriced books,
mixed currencies, invalid quantities and oversized totals are rejected.

An order and its items are inserted in one transaction. The response contains
`id`, `createdAt`, `paidAt`, `status`, `currency`, `totalCents` and `items` with
`bookId`, `title`, `quantity`, `unitPriceCents`, and `lineTotalCents`. Titles and
prices are snapshots at creation. No payment is taken; new orders have a null
`paidAt` and status `waiting_for_payment`. Future payment processing can set
`paidAt`, which produces status `paid`.

`requestId` is unique per user. Retrying the same items with the same ID returns
the original order (200 instead of 201), including for concurrent submissions.
Reusing an ID with different items returns 409. Use a new ID when the cart changes.
Migration `0004_order_details` adds the item snapshots, totals, and retry key.

Compose runs the API at `http://localhost:3000` after migrations and seeding succeed. Set
`API_PORT` in the root `.env` to change the host port. For local development,
configure `server/.env`, run `npm run db:setup`, then run `npm run dev` from `server/`
(or `npm start` without automatic reload). `PORT` controls the local server port.

## Run with Docker

From the repository root, copy `.env.example` to `.env` and set
`POSTGRES_PASSWORD` to your password inside single quotes. Compose requires a
nonempty password and passes it separately from the connection URL, so special
characters do not need URL encoding. `.env` files are ignored by Git.

Run `npm run auth:setup` from `server/` to populate the auth secret before starting
Compose.

Then run:

```sh
docker compose up --build -d
docker compose logs migrate
```

Compose starts PostgreSQL, waits for it to be healthy, and runs a one-off migration
and seed container. Successful setup exits with code 0. The database is available at
`localhost:5432` with database/user `bookstore` and the password from `.env`.
Database data persists in a named volume across restarts.
`docker compose down` stops the services and keeps the data.

PostgreSQL uses `POSTGRES_PASSWORD` only when initializing a new data volume.
If your database already exists, changing `.env` alone will not change its
password; update the database role password too before rerunning migrations.

If port 5432 is already in use, set `DB_PORT=5433` in a `.env` file at the
repository root before starting Compose. Update the port in `server/.env` too
when running commands locally. Containers always connect to `db:5432`.

## Run database commands locally

From `server/` (Node.js 22 or newer):

```sh
npm ci
```

Copy `server/.env.example` to `server/.env` and set `PGPASSWORD` to the same
password used in the root `.env`, then start PostgreSQL from the repository root with
`docker compose up -d db`. Back in `server/`:

```sh
npm run db:setup
npm run db:studio
```

Import `db` from `db/index.js` in server code; close `pool` during shutdown.
An existing `DATABASE_URL` environment variable takes precedence over `.env`.

## Catalog data

`db/data/books.json` contains the original 98-book catalog, including the original
UUIDs, integer prices in cents, and metadata for browser search. `npm run db:seed`
imports missing categories and books in one transaction. Reruns preserve existing
book records, including any changes made in the database; editing the seed JSON
does not update existing rows. Events and staff picks remain client content.

The `0002_client_image_paths` migration updates existing image filenames to
`/images/...` paths. Already configured paths and URLs are preserved.

The client fetches `/api/books` and `/api/categories`. Its Vite development and
preview servers proxy `/api` to the backend (see `client/.env.example`). For a
production deployment, route `/api` on the client origin to this Express server.
Catalog routes remain public. Orders use `requireAuth(auth)` from
`src/middleware/require-auth.js`. Stripe checkout and payment webhooks are the
next stage.

## Change the schema

1. Edit `db/schema.js`.
2. Run `npm run db:generate -- --name=describe_change` from `server/`.
3. Review and commit the generated SQL and metadata in `drizzle/`.
4. Run `npm run db:migrate`, or rebuild and run the Compose migration service:
   `docker compose run --build --rm migrate` from the repository root.

`npm run db:check` checks migration history consistency. Generation and history
checks do not need a running database. Migration runs apply only pending
migrations and record their history in PostgreSQL. Use migrations consistently;
do not use schema push alongside this workflow.
