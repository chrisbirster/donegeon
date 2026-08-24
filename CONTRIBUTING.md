# Contributing to Donegeon

Thanks for contributing to Donegeon.

Donegeon is currently an alpha project. The task model, board/game model, API contracts, and test strategy are being actively audited, so behavioral changes should be explicit and backed by tests that prove the resulting state—not only that an endpoint returned a successful status code.

## License

By contributing to this repository, you agree that your contribution is licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`), unless a file explicitly identifies third-party material under another license.

## Development requirements

- Go 1.26.7+
- Node.js 22+
- npm 10+

Optional:

- Task
- Air
- Chrome/Chromium for Playwright

Donegeon uses npm only for JavaScript/TypeScript package management. Do not add Bun, pnpm, or Yarn lockfiles or commands.

## Setup

```bash
git clone https://github.com/chrisbirster/donegeon.git
cd donegeon
cp .env.example .env
cd web
npm ci
cd ..
```

For the simplest local stack with SQLite:

```bash
go install github.com/air-verse/air@latest
task dev:sqlite
```

## Architecture boundaries

Keep durable domain behavior on the Go side.

Go owns persisted task/project/workspace rules, authentication/authorization, board command validation, progression, persistence, and integrations. SolidJS owns browser presentation, interaction state, local caching, optimistic presentation, and other client-only concerns.

A browser-side preview may duplicate a small deterministic rule when it improves responsiveness, but persistence and final validation must still go through the server-authoritative implementation.

## Tests

Before opening a pull request, run the checks relevant to your change.

```bash
go vet ./...
go test ./...
go run golang.org/x/vuln/cmd/govulncheck@v1.7.0 ./...

cd web
npm ci
npm run typecheck
npm --workspace @donegeon/client run test:unit
npm run build
npm audit --omit=dev --audit-level=high
```

For infrastructure changes:

```bash
cd infra
npm ci
npx --no-install sst install
npm run check
npm audit --omit=dev --audit-level=high
```

For browser workflow changes:

```bash
cd web
npm --workspace @donegeon/client run test:e2e
```

A good behavioral test asserts the state transition or response contract that matters. Avoid adding tests that only assert a generic `2xx` response when the feature promises labels, idempotency, recurrence, ordering, persistence, permissions, or another observable semantic result.

## Pull requests

Keep pull requests focused when practical. Include:

- what changed;
- why it changed;
- user-visible behavior, if any;
- migrations or API-contract changes;
- tests that prove the intended behavior;
- known limitations or follow-up work.

Do not commit local `.env` files, databases, Playwright output, cloud credentials, or generated secrets.

## Security

Do not file a public issue for a suspected vulnerability or exposed credential. Follow `SECURITY.md` instead.
