# Server

PostgreSQL and Drizzle ORM. The schema is in `db/schema.js`; generated SQL and
Drizzle snapshots are committed in `drizzle/`.

## API

- `GET /api/books` returns all books, ordered by title then ID. Fields:
  `id`, `title`, `description`, `categoryId`, `priceCents`.
- `GET /api/categories` returns all categories, ordered by name then ID. Fields:
  `id`, `name`.

Both endpoints return a JSON array (`[]` for an empty table). Unknown routes
return 404, unsupported methods return 405, and database failures return 500
without exposing database details.

Compose runs the API at `http://localhost:3000` after migrations succeed. Set
`API_PORT` in the root `.env` to change the host port. For local development,
configure `server/.env`, apply migrations, then run `npm run dev` from `server/`
(or `npm start` without automatic reload). `PORT` controls the local server port.

## Run with Docker

From the repository root, copy `.env.example` to `.env` and set
`POSTGRES_PASSWORD` to your password inside single quotes. Compose requires a
nonempty password and passes it separately from the connection URL, so special
characters do not need URL encoding. `.env` files are ignored by Git.

Then run:

```sh
docker compose up --build -d
docker compose logs migrate
```

Compose starts PostgreSQL, waits for it to be healthy, and runs a one-off migration
container. Successful migration exits with code 0. The database is available at
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
npm run db:migrate
npm run db:studio
```

Import `db` from `db/index.js` in server code; close `pool` during shutdown.
An existing `DATABASE_URL` environment variable takes precedence over `.env`.

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
