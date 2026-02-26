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
- `DONEGEON_BOARD_CONFIG_PATH` (optional YAML gameplay tuning file; legacy alias `DONEGEON_CONFIG_PATH`)
  - if unset, server auto-loads `donegeon_config.yml` (or `donegeon_config.yaml`) when present in cwd
- `DONEGEON_REQUIRE_AUTH` (default `true`)
- `DONEGEON_API_TOKEN` (default `TOKEN_VALID`)
- `DONEGEON_READONLY_API_TOKEN` (default `TOKEN_READONLY`)

Example gameplay config:

- [`docs/board-gameplay-config.example.yml`](/Users/gm/dev/personal/newtasks/docs/board-gameplay-config.example.yml)

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
go test ./internal/... ./cmd/...
```

Quick-add parser tests are sourced directly from `docs/test-cases.yaml`.

Todoist parity archive/spec references are kept in:

- `docs/test-cases-todoist-parity-archive.yaml`

Implemented parity actions are exercised by Go tests in:

- `internal/httpapi/todoist_parity_spec_test.go`

Todoist compatibility action endpoint:

- `POST /api/todoist/action`
- Request body: `{ "action": "<methodName>", "payload": { ... } }`
- Upload actions remain intentionally unimplemented: `uploadFile`, `uploadWorkspaceLogo`, `deleteUpload`

## Playwright E2E

Playwright tests live in:

- `web/apps/client/tests/e2e/home.spec.ts`
- `web/apps/client/tests/e2e/board.spec.ts`

Run setup and tests:

```bash
cd web
bun install
cd apps/client
bun run test:e2e:install
bun run test:e2e
```

The suite starts both servers automatically:

- Go API on `http://localhost:42169` (default for Playwright runs)
- Vite app on `http://localhost:4173`

Override ports with `PW_API_PORT` and `PW_WEB_PORT` if needed.

To push toward 90% feature coverage, extend the scenarios in the E2E specs for any new user-visible workflow (task flow + board flow).

## RRULE Parsing (RFC 5545)

The backend includes an RFC 5545 RRULE parser (`RECUR` grammar) that supports:

- `FREQ` (`SECONDLY`..`YEARLY`)
- `UNTIL`, `COUNT`, `INTERVAL`
- `BYSECOND`, `BYMINUTE`, `BYHOUR`
- `BYDAY`, `BYMONTHDAY`, `BYYEARDAY`, `BYWEEKNO`, `BYMONTH`, `BYSETPOS`
- `WKST`
- Extension rule parts (`X-*` and other IANA token names)

Parse endpoint:

```bash
curl -X POST http://localhost:42069/api/rrule/parse \
  -H 'Authorization: Bearer TOKEN_VALID' \
  -H 'Content-Type: application/json' \
  -d '{"rrule":"FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"}'
```
