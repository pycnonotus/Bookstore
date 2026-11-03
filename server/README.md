# Server database

PostgreSQL and Drizzle ORM. The schema is in `db/schema.js`; generated SQL and
Drizzle snapshots are committed in `drizzle/`. `src/index.js` is still an empty
API entry point.

## Run with Docker

From the repository root:

```sh
docker compose up --build -d
docker compose logs migrate
```

Compose starts PostgreSQL, waits for it to be healthy, and runs a one-off migration
container. Successful migration exits with code 0. The database is available at
`localhost:5432` with database/user/password `bookstore`. These credentials are
for local development. Database data persists in a named volume across restarts.
`docker compose down` stops the services and keeps the data.

If port 5432 is already in use, set `DB_PORT=5433` in a `.env` file at the
repository root before starting Compose. Update the port in `server/.env` too
when running commands locally. Containers always connect to `db:5432`.

## Run database commands locally

From `server/` (Node.js 22 or newer):

```sh
npm ci
```

Copy `.env.example` to `.env`, then start PostgreSQL from the repository root with
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
