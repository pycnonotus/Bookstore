# Bookstore

A small bookstore built with React, Vite and Tailwind. Browse the shelves, save books you like, check staff picks and upcoming events.

I also wanted to try searching in plain words. Things like `math 10$ to 20$`, `JS libs`, or `a book with flowers on the cover`. Search filters the shelves and shows all matching books. You can use the topic filters too.

## Run it

```sh
npm install
npm run dev
```

Start the backend first with `docker compose up --build -d` from the repository
root (configure the root `.env` password and run `npm run auth:setup` in `server/`
first). This applies migrations and seeds
the catalog. The client loads books and categories from `/api`; Vite proxies these
requests to `http://127.0.0.1:3001`. To use a different backend port, copy
`client/.env.example` to `client/.env` and update `API_PROXY_TARGET`.

Books, prices and search metadata live in the backend. Cover images live in
`client/public/images/`; the database stores their public `/images/...` paths.
The client shows a loading message and a retry button if the catalog is unavailable.
Browser search receives the fetched catalog, including both embedding workers.
For production, route `/api` on the frontend origin to the Express server.

## Accounts

Open `/register` to create an email/password account or `/login` to sign in.
The header shows the current user and a logout button. Sessions use HttpOnly
cookies and survive reloads. Set the server's `BETTER_AUTH_URL` to the frontend
URL; add alternate origins to `AUTH_TRUSTED_ORIGINS`. Production hosting must
serve `index.html` for client routes such as `/login` and `/register`.

`npm run test:auth` exercises registration, login, session persistence, logout,
invalid credentials, password validation, origin checks and `/api/me`. Run it
against a disposable database because it creates a test account. Set
`AUTH_TEST_URL` to override `http://127.0.0.1:5173` and `PLAYWRIGHT_CHANNEL=msedge`
to use installed Edge instead of Playwright Chromium.

## Orders

Use **Add to cart** on a book, then open `/cart` to adjust quantities or remove
items. The cart stores book IDs and quantities in local storage and survives
reloads and login. Login and registration return to the cart when started there.
**Place order** requires login and opens `/orders/:id` after the backend saves it.
`/orders` lists the signed-in user's orders. New orders show **Waiting for payment**;
payments are not connected yet. A failed submission keeps the cart for retry.

`npm run test:orders` checks the browser flow plus API ownership, validation,
server-calculated totals and duplicate prevention. Use a disposable database:
the check creates two accounts and several orders. Set `ORDERS_TEST_URL` to
override the default frontend URL. It supports `PLAYWRIGHT_CHANNEL` too.

With both servers running, `npm run test:catalog` checks the API-connected UI,
filters, search fallback, error recovery, and the local staff picks and events.
It uses Playwright Chromium (`npx playwright install chromium`), or an installed
browser selected with `PLAYWRIGHT_CHANNEL=msedge`. Set `CATALOG_TEST_URL` if Vite
is not running at `http://127.0.0.1:5173`. Semantic workers are stubbed for this
check so model availability does not affect the result.

For the creating the search embeddings use

```sh
npm run models:prepare
```



## AI generated data in this project,

- `../server/db/data/books.json` — the initial database catalog.
- `public/images/` — all book covers, served by the frontend.
- `src/data/staffPicks.json` — the client-only staff picks.
- `src/workers/` — search embeddings run in the browser over books fetched from the API.
- `src/scripts/` — model setup.
- `tests/check-catalog.mjs`, `tests/check-auth.mjs` and `tests/check-orders.mjs` — the tracked browser checks. Other files in `tests/` are local checks and fixtures, ignored by Git; the other npm test commands need those local files.
- `rag/` — local training and experiments, ignored by Git.

To run local training (if you have the local files), use `node rag/scripts/train-search-local.mjs`. Generated checkpoints stay in `rag/`; the search code uses the saved model in `src/data/`.
