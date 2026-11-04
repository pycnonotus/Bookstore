# Bookstore

A small bookstore built with React, Vite and Tailwind. Browse the shelves, save books you like, check staff picks and upcoming events.

I also wanted to try searching in plain words. Things like `math 10$ to 20$`, `JS libs`, or `a book with flowers on the cover`. Search filters the shelves and shows all matching books. You can use the topic filters too.

## Run it

```sh
npm install
npm run dev
```

Start the backend first with `docker compose up --build -d` from the repository
root (configure the root `.env` password first). This applies migrations and seeds
the catalog. The client loads books and categories from `/api`; Vite proxies these
requests to `http://127.0.0.1:3000`. To use a different backend port, copy
`client/.env.example` to `client/.env` and update `API_PROXY_TARGET`.

Books, prices and search metadata live in the backend. Cover images live in
`client/public/images/`; the database stores their public `/images/...` paths.
The client shows a loading message and a retry button if the catalog is unavailable.
Browser search receives the fetched catalog, including both embedding workers.
For production, route `/api` on the frontend origin to the Express server.

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
- `tests/check-catalog.mjs` — the tracked catalog browser check. Other files in `tests/` are local checks and fixtures, ignored by Git; the other npm test commands need those local files.
- `rag/` — local training and experiments, ignored by Git.

To run local training (if you have the local files), use `node rag/scripts/train-search-local.mjs`. Generated checkpoints stay in `rag/`; the search code uses the saved model in `src/data/`.
