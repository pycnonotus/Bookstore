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
- `POST /api/orders/:id/checkout` creates/reuses a Stripe Checkout session and
  returns `{ "url": "https://checkout.stripe.com/..." }`. If Stripe has already
  completed the checkout, `url` is null and the client reloads payment status.
- `POST /api/orders/:id/payment-status` checks Stripe and returns the updated order.
- `POST /api/stripe/webhook` accepts signed Stripe events, without a user session.

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

Compose uses `BOOKSTORE_URL` from the root `.env` for Better Auth.
It defaults to `https://books.pycnonotus.dev`. When running Express directly, use
`BETTER_AUTH_URL` in `server/.env`, which defaults to `http://localhost:5173`.
Use `AUTH_TRUSTED_ORIGINS` for any additional frontend origins, separated by
commas. The client uses same-origin requests through Caddy or Vite.

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
prices are snapshots at creation. Creating an order does not charge the customer;
new orders have a null `paidAt` and status `waiting_for_payment`. The detail
endpoint also returns `checkoutAvailable`. Payment statuses are
`waiting_for_payment`, `processing`, `payment_failed`, `checkout_expired`, and
`paid`. Only a verified Stripe payment sets `paidAt` and `paid`.

`requestId` is unique per user. Retrying the same items with the same ID returns
the original order (200 instead of 201), including for concurrent submissions.
Reusing an ID with different items returns 409. Use a new ID when the cart changes.
Migration `0004_order_details` adds the item snapshots, totals, and retry key.

## Stripe payments

Use Stripe **test mode** while developing. Add these to the root `.env` for Docker,
or to `server/.env` for local Node, then restart/recreate the server:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

The secret API key comes from Stripe's API keys page. The webhook signing secret
comes from the specific webhook endpoint (or the CLI listener below). Keep both
on the server. Hosted Checkout does not need a publishable key in the frontend.
Missing settings leave browsing, auth and saved orders available, with checkout
temporarily unavailable. The frontend origin from `BOOKSTORE_URL` in Compose
or `BETTER_AUTH_URL` in local Node controls the checkout success and cancel URLs.

For local webhooks, install the [Stripe CLI](https://docs.stripe.com/stripe-cli),
run `stripe login`, then leave this running:

```sh
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://localhost:3012/api/stripe/webhook
```

Use the **`whsec_...` printed by that listener** in `.env`; it differs from a
Dashboard endpoint's signing secret. Adjust port 3012 if `API_PORT`/`PORT` differs.
After editing root `.env`, run `docker compose up --build -d` to apply migration
`0005_stripe_payments` and recreate the API with the new settings.

For the production deployment, create a Stripe webhook endpoint at
`https://books.pycnonotus.dev/api/stripe/webhook`, choose snapshot events for your
account, and subscribe to these four events:

| Event | Result |
| --- | --- |
| `checkout.session.completed` | Paid if payment is confirmed; otherwise processing |
| `checkout.session.async_payment_succeeded` | Confirms a delayed payment |
| `checkout.session.async_payment_failed` | Shows failure and allows another checkout |
| `checkout.session.expired` | Allows a new payment link |

Register → add books to cart → place order → pay on the order page. Use Stripe's
test card `4242 4242 4242 4242`, any future expiry, and any three-digit CVC.
Returning from Stripe checks payment with the server; `/orders/:id` also polls
the saved status for up to two minutes and has a manual refresh button.
`/orders` lists only the signed-in user's orders, including their payment status.
Cancelling checkout keeps the saved order available to pay later.

The server uses the order's saved prices and USD currency, not submitted totals.
It persists each checkout request and its Stripe idempotency key before making
the Stripe call, so retries and concurrent requests reuse the same session.
Open sessions expire after two hours. A failed or expired attempt can be retried.
If a session creation response is lost and recovery is attempted after Stripe
has discarded its idempotency record, the fixed expiry makes that request fail
instead of risking a second payable session; investigate that order manually.

Webhooks verify the signature over the raw body, retrieve the latest session
from Stripe, and match the order, owner, amount, currency, mode, and session.
Payment changes and processed event IDs are committed in one transaction under
an order lock. Duplicate/delayed events cannot undo a confirmed payment. The
authenticated refresh endpoint uses the same verification; a success URL alone
never marks an order paid. Payment status describes payment, not shipping or
refunds; those workflows are not implemented.

### Payment tests

For server integration tests, migrate a **disposable** PostgreSQL database, set
`TEST_DATABASE_URL` to that database (plus `PGPASSWORD` when needed), then run
`npm run test:payments` from `server/`. Tests create their own users, books and
orders; they use a fake Stripe API and real Stripe signature verification.

With the frontend running, run `npm run test:payments` from `client/` to check
checkout and status screens against mocked API responses. Set `PAYMENTS_TEST_URL`
for a non-default frontend URL, and `PLAYWRIGHT_CHANNEL=msedge` to use installed
Edge instead of Playwright Chromium. Existing `test:auth`, `test:orders`, and
`test:catalog` scripts exercise the running API and a disposable seeded database.

Compose runs the API at `http://localhost:3012` after migrations and seeding succeed. Set
`API_PORT` in the root `.env` to change the host port. For local development,
configure `server/.env`, run `npm run db:setup`, then run `npm run dev` from `server/`
(or `npm start` without automatic reload). `PORT` controls the local server port.

## Run with Docker

### Production on Dokploy

Point DNS for `books.pycnonotus.dev` at Dokploy. In the Compose application's
Domains tab, add `books.pycnonotus.dev` with path `/`, service `caddy`, container
port `8080`, HTTPS enabled, and the Let's Encrypt certificate option. Redeploy
after saving the domain. [Dokploy Compose domains](https://docs.dokploy.com/docs/core/docker-compose/domains)

Set `BOOKSTORE_URL=https://books.pycnonotus.dev`, `POSTGRES_PASSWORD`, and
`BETTER_AUTH_SECRET` in the application's environment. If enabling payments,
set the Stripe key and the signing secret for the production webhook there too.

Traefik handles public HTTPS and forwards requests to Caddy over Docker.
Caddy serves the Vite build, images, and search models, supports direct links
such as `/orders/:id`, and forwards `/api/*` to Express with the path intact.
The host bindings for PostgreSQL and Express listen only on loopback.

### Local development

From the repository root, copy `.env.example` to `.env` and set
`POSTGRES_PASSWORD` to your password inside single quotes. Compose requires a
nonempty password and passes it separately from the connection URL, so special
characters do not need URL encoding. `.env` files are ignored by Git.

Run `npm run auth:setup` from `server/` to populate the auth secret before starting
Compose.

To run the backend alongside Vite, set `BOOKSTORE_URL=http://localhost:5173`
in the root `.env` and run:

```sh
docker compose up --build -d server
docker compose logs migrate
```

Compose starts PostgreSQL, waits for it to be healthy, and runs a one-off migration
and seed container. Successful setup exits with code 0. The database is available at
`localhost:5435` with database/user `bookstore` and the password from `.env`.
Database data persists in a named volume across restarts.
`docker compose down` stops the services and keeps the data.

PostgreSQL uses `POSTGRES_PASSWORD` only when initializing a new data volume.
If your database already exists, changing `.env` alone will not change its
password; update the database role password too before rerunning migrations.

For an existing local setup, set `DB_PORT=5435` in the root `.env` and update
the port in `DATABASE_URL` in `server/.env`. To publish a different local port,
set both values to that port. Containers always connect to `db:5435`.

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
Catalog routes remain public. Orders and checkout use `requireAuth(auth)` from
`src/middleware/require-auth.js`. Stripe webhooks authenticate using their
signature and must reach Express with the body unchanged.

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
