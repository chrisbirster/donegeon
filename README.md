# donegeon

Donegeon is a Go-first Todoist-like backend with an embedded SolidJS SPA frontend.

## Stack

- Backend: Go `net/http` + `log/slog`
- DB: SQLite via `sqlx` + `modernc.org/sqlite`
- Migrations: `go-migrate` using embedded SQL migrations
- Query templates: embedded from `internal/datbase/queries/*.sql`
- Frontend: Bun + Turborepo + Vite + TypeScript + SolidJS + Solid Router + TailwindCSS v4
- Frontend assets are built to `web/dist` and embedded via `web/dist/embed.go`

## Run backend

```bash
go run .
```

Server defaults to `http://localhost:42069`.

## Run both (recommended)

```bash
task dev
```

`task dev` starts:

- backend with hot reload via `air` + `.air.toml`
- frontend via `bun run dev` in `/web`

If needed:

```bash
task install
```

Environment variables:

- `DONEGEON_HTTP_PORT` (default `42069`)
- `DONEGEON_DB_PATH` (default `donegeon.db`)
- `DONEGEON_REQUIRE_AUTH` (default `true`)
- `DONEGEON_API_TOKEN` (default `TOKEN_VALID`)
- `DONEGEON_READONLY_API_TOKEN` (default `TOKEN_READONLY`)

## Run frontend (dev)

```bash
cd web
bun install
bun run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` to `http://localhost:42069`.

## Build frontend into embedded dist

```bash
cd web
bun run build
```

## Tests

```bash
go test ./...
```

Quick-add parser tests are sourced directly from `docs/test-cases.yaml`.
