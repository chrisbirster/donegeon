# Donegeon

Donegeon is an experimental productivity application that combines a Todoist-style task manager with a Stacklands-inspired card and stacking game.

Tasks are real productivity objects. The board is another way to interact with them: tasks can become cards, villagers can be assigned to work, stacks can be combined, quests can advance, and completed work can drive game progression.

> **Project status: alpha.** Donegeon is under active development and audit. The task model, game model, APIs, and UX may change before the first stable release. The repository intentionally favors explicit tests and documented behavior over backwards compatibility while those models are being finalized.

## What is in the repository

Donegeon is a monorepo with a Go application server and two SolidJS applications.

```text
donegeon/
├── cmd/                     Go application entry points
├── internal/                Go domain, persistence, integrations, and HTTP API
│   ├── task/                canonical task behavior
│   ├── project/             projects and organization
│   ├── board/               board/game command engine
│   ├── quickadd/            server-authoritative quick-add parsing
│   ├── account/             users, sessions, teams, invitations, billing state
│   ├── calendar/            calendar integrations
│   └── httpapi/             HTTP transport and middleware
├── migrations/              database migrations
├── docs/                    architecture, specs, quests, and audit material
├── web/
│   ├── apps/client/         authenticated SolidJS application
│   ├── apps/marketing/      public SolidJS marketing/docs site
│   └── dist/                client build embedded by Go
├── infra/                   SST infrastructure for email and marketing hosting
├── scripts/                 repository and deployment tooling
├── Taskfile.yml             common development/deployment commands
└── Dockerfile               production application image
```

## Architecture

The intended boundary is deliberately simple:

```text
SolidJS client
    │
    │ HTTP API / board commands
    ▼
Go application
    │
    ├── task domain
    ├── project/workspace domain
    ├── board/game command engine
    ├── authentication and integrations
    └── repositories
          │
          ▼
     SQLite / Turso
```

### Go is authoritative for durable state

The Go application owns persisted business rules and state transitions, including:

- task creation, updates, completion, recurrence, projects, labels, and scheduling;
- authentication, workspace permissions, billing boundaries, and integrations;
- board state, command validation, stack legality, task/game synchronization, quests, inventory, and progression;
- persistence, migrations, concurrency/version checks, and API contracts.

A browser preview may duplicate a small deterministic rule for responsiveness, but saving or executing an operation goes through the server-authoritative implementation.

### SolidJS owns interaction and presentation

The client owns browser concerns such as:

- routes and application composition;
- drag/drop and board interaction state;
- dialogs, menus, forms, notifications, and responsive behavior;
- optimistic presentation and local caching;
- PWA/browser integration.

The UI should not become an independent source of truth for durable task or game state.

## Technology

### Server

- Go 1.26
- `net/http`
- SQLite for local/self-hosted use
- Turso/libSQL for the hosted deployment
- SQL migrations in `migrations/`

### Web

- SolidJS 2 release-candidate packages
- Solid Router 2 prerelease
- Vite 7
- TanStack Solid Query
- Linaria / WyW-in-JS
- Playwright
- npm workspaces + Turborepo

### Infrastructure

- Fly.io for the Go application
- SST for infrastructure orchestration
- AWS SES for application email
- Cloudflare for the marketing site

The infrastructure directory is optional for local development. You do not need AWS, Fly, Cloudflare, Stripe, Google Calendar, or Turso to run Donegeon locally with SQLite.

## Requirements

For local application development:

- Go 1.26+
- Node.js 22+
- npm 10+

Optional but recommended:

- [Task](https://taskfile.dev/) for repository commands
- [Air](https://github.com/air-verse/air) for Go hot reload
- Chrome/Chromium for Playwright browser tests

Donegeon uses **npm only**. Bun, pnpm, and Yarn are not part of the supported repository workflow.

## Getting started

Clone the repository and create a local environment file:

```bash
git clone https://github.com/chrisbirster/donegeon.git
cd donegeon
cp .env.example .env
```

Install the exact web dependency graph from the committed lockfile:

```bash
cd web
npm ci
cd ..
```

### Recommended: Task + SQLite

Install Air once:

```bash
go install github.com/air-verse/air@latest
```

Then run:

```bash
task dev:sqlite
```

This starts the Go API and Solid client using a local SQLite database. Local development intentionally permits debug authentication settings that are rejected when `DONEGEON_ENV=production`.

### Without Task

Run the backend in one terminal:

```bash
cp .env.example .env
set -a
. ./.env
set +a
go run .
```

Run the client in another terminal:

```bash
cd web
npm run dev:client
```

The client Vite server proxies `/api` to the Go API at `http://localhost:42069` by default.

## Common commands

From the repository root:

```bash
task test          # Go test suite
task build         # client + Go server
task build:all     # client + marketing + Go server
task dev:sqlite    # local SQLite development
```

From `web/`:

```bash
npm ci
npm run dev:client
npm run dev:marketing
npm run typecheck
npm --workspace @donegeon/client run test:unit
npm run build
npm --workspace @donegeon/client run test:e2e
```

From `infra/`:

```bash
npm ci
npm run check
```

See `infra/README.md` for deployment-specific infrastructure commands.

## Testing philosophy

Donegeon is currently auditing its test suite. Test count by itself is not treated as proof that a feature works.

The target verification model is:

1. **Go unit tests** for deterministic domain rules.
2. **Go integration tests** for persistence and state transitions.
3. **API tests** for request/response semantics and authorization boundaries.
4. **Frontend tests** for browser-only presentation and interaction behavior.
5. **Playwright workflows** for critical user journeys.
6. **Feature audit documentation** mapping a feature to the tests that actually prove it.

A compatibility or generated test that only proves an endpoint returned `2xx` is not considered sufficient evidence for the underlying feature behavior.

## Tasks and the board

Donegeon has two connected domains.

### Task manager

The task system is intended to support a serious day-to-day workflow: inbox/project organization, priorities, labels, sections, due dates/deadlines, recurrence, quick add, comments, collaboration, and calendar integration.

That model is still being audited and should be treated as evolving until its feature inventory is marked verified.

### Board game

The board uses a server-side command engine. Current command families cover capabilities such as:

- spawning and opening decks;
- moving, merging, splitting, unstacking, and removing stacks;
- creating, linking, activating, editing, assigning, and completing task cards;
- villagers and assignment rules;
- resources, gathering, food, loot, and inventory;
- quests and rewards;
- progression and end-of-day behavior;
- optimistic board version/conflict handling.

The game layer should reference the canonical task domain rather than create a second independent task model.

## Data

SQLite is the default local database. Turso is supported for the hosted deployment.

Database changes belong in `migrations/`. Existing data should be evolved through forward migrations instead of editing historical migrations in place.

Do not commit local database files. They are ignored by the repository.

## Configuration and secrets

Use `.env.example` for local development and `.env.production.example` as the production template.

Never commit a real `.env` file or production credential.

Production mode intentionally fails closed. When:

```text
DONEGEON_ENV=production
```

Donegeon refuses to start with known placeholder API tokens/cookie secrets, insecure cookies, debug authentication codes, disabled authentication, or a Turso deployment without an auth token.

The checked-in example credentials are development placeholders only.

## CI and deployment

`.github/workflows/ci.yml` verifies pull requests and `main` with:

- a Gitleaks scan across complete Git history, branches, and tags;
- `go test ./...`;
- frontend/marketing TypeScript checks;
- Node-based frontend unit tests;
- frontend/marketing production builds;
- infrastructure TypeScript checks;
- production-dependency npm audits that fail on high/critical advisories.

The deployment workflow is separate. Automatic deployments from `main` are triggered only after the `CI` workflow succeeds. Both CI and deployment use lockfile-backed `npm ci` installs. Manual targeted deployment remains available through `workflow_dispatch`.

Dependabot is configured for Go modules, the web and infrastructure npm workspaces, and GitHub Actions.

## Contributing

Donegeon is open source and contributions are welcome. Because the data model and behavioral contracts are still being audited, changes to task/game semantics should include tests that prove the intended state transition rather than only HTTP status assertions.

Read `CONTRIBUTING.md` before opening a pull request.

## Security

Do not open a public issue for a suspected vulnerability or exposed credential. See `SECURITY.md` for the reporting process.

CI runs a history-aware Gitleaks scan across fetched branches, tags, and Git history. `.gitleaksignore` contains only two exact historical fingerprints that were manually verified as intentional development placeholders; it does not broadly suppress secret rules or paths.

## License

Donegeon is licensed under the **GNU Affero General Public License v3.0 only (`AGPL-3.0-only`)**.

Unless a file explicitly identifies third-party material under another license, the Donegeon-authored source code, documentation, scripts, configuration, and project-specific artwork in this repository are provided under the AGPLv3. Third-party dependencies retain their respective upstream licenses. See `ASSETS.md` for the project artwork declaration.

The hosted client exposes an `/open-source` notice with the source-code link, license terms, copyright notice, and no-warranty statement for network users.

See `LICENSE` for the complete license text.
