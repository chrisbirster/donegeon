# donegeon

Donegeon is a Go-first task-manager backend with an embedded SolidJS SPA frontend.

## Stack

- Backend: Go `net/http` + `log/slog`
- DB: SQLite via `sqlx` + `modernc.org/sqlite`
- Migrations: `go-migrate` using embedded SQL migrations
- Query templates: embedded from `internal/database/queries/*.sql`
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
- loads root `.env` for backend env vars
- defaults `DONEGEON_OPEN_BETA=true` in local dev so auth stays available while you build
- defaults `DONEGEON_AUTH_DEBUG_CODE=true` in local dev so OTP is visible in Login UI

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
- `DONEGEON_OPEN_BETA` (default `false`; local dev tasks export `true`)
- `DONEGEON_API_TOKEN` (default `TOKEN_VALID`)
- `DONEGEON_READONLY_API_TOKEN` (default `TOKEN_READONLY`)
- Production template: `.env.production.example` (includes Turso + Google Calendar OAuth settings)

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

## Taskfile quick commands

```bash
# Full local dev (API + app)
task dev

# Full local dev forced to SQLite (uses .env.local.sqlite overrides)
task dev:sqlite

# Marketing site only
task dev:marketing

# Build marketing app
task build:marketing

# Deploy app backend (Fly)
task deploy:app

# Generate/refresh root .env from Turso + infra outputs
task deploy:env

# Deploy SST infra (email API + marketing on Cloudflare)
task deploy:infra
task deploy:infra:dev

# Marketing deploy aliases
task deploy:marketing
task deploy:marketing:dev

# Full deploy flow (build + infra + env + Fly secrets + app)
task deploy:all

# Full deploy + wipe Turso first
task deploy:all:wipe-db
```

## GitHub Actions Deploys

`main` branch pushes now support selective deploys through [deploy.yml](/Users/gm/dev/personal/newtasks/.github/workflows/deploy.yml):

- App changes deploy only the Fly app.
  Includes Go backend, embedded client app, Fly config, and gameplay/runtime files.
- Marketing or infra changes deploy only the SST production stack.
  That updates the Cloudflare-hosted marketing site and any SST-managed infra changes without redeploying the Fly app.
- Shared web workspace changes trigger both deploy jobs.

You can also run the workflow manually from GitHub Actions with `target=changed`, `app`, `marketing`, or `all`.

Required GitHub secrets/vars:

- `FLY_API_TOKEN`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_DEFAULT_ACCOUNT_ID`
- Optional repo variable: `AWS_REGION` (defaults to `us-east-1`)
- Optional repo variables: `DONEGEON_MARKETING_DOMAIN`, `DONEGEON_EMAIL_SENDER`, `DONEGEON_EMAIL_FROM`, `DONEGEON_EMAIL_API_AUTH_HEADER`

SST still requires the production `EmailApiKey` secret to already exist for the `production` stage, for example:

```bash
cd infra
bun install
bunx sst secret set EmailApiKey "<strong-random-token>" --stage production
```

The Fly deploy job assumes your production Fly secrets are already configured. This workflow deploys code/config to Fly; it does not rotate or repopulate Fly secrets on each push.

## Tests

```bash
go test ./internal/... ./cmd/...
```

Quick-add parser tests are sourced from the split specs under `docs/specs/quickadd/`.

Manifest and coverage index:

- `docs/test-cases.yaml`
- `docs/test-index.md`

TaskManager parity archive/spec references are kept in:

- `docs/test-cases-taskmanager-parity.yaml`
- `docs/specs/taskmanager/`

Implemented parity actions are exercised by Go tests in:

- `internal/httpapi/taskmanager_parity_spec_test.go`

TaskManager compatibility action endpoint:

- `POST /api/taskmanager/action`
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
