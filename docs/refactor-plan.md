# Modular architecture and Solid 2 refactor

## Goals

- Keep SQLite as the only runtime database and preserve existing migrations.
- Make TypeScript the executable owner of board, progression, scheduling, and quick-add rules.
- Keep Go focused on persistence, authentication, integration boundaries, and HTTP transport.
- Keep handwritten production source files at or below 500 lines.
- Make route components composition roots; state and commands live in feature contexts.
- Run the HTTP server with bounded timeouts, readiness checks, and graceful signal shutdown.

## Target boundaries

```text
web/apps/client/src/
  domain/       pure types and deterministic business rules
  data/         API contracts, codecs, and repositories
  context/      application/feature state and commands
  features/     small UI components grouped by capability
  routes/       route-level composition only

internal/
  <domain>/     SQLite repositories and integration services
  httpapi/      route registration, middleware, and small handlers by capability
  config/       typed runtime configuration and validation
  app/          dependency construction and server lifecycle
```

The API boundary uses explicit DTOs. Domain modules do not import Solid, browser APIs,
or the API client. Context modules may import domain and data modules. Components may
import contexts and presentation helpers, but do not implement persistence rules.

## Stages

1. **Safety baseline**
   - Preserve the existing dirty working tree.
   - Record current Go, TypeScript, build, and end-to-end status.
   - Add a source-size check that excludes generated files, lockfiles, and tests.
2. **Domain extraction**
   - Move board geometry, cards, stacks, progression, quests, schedules, recurrence,
     and quick-add behavior into pure TypeScript modules with unit tests.
   - Move API DTO declarations out of the HTTP client.
3. **State ownership**
   - Add session, task, project, and board contexts with narrow command interfaces.
   - Keep optimistic state transitions in contexts and deterministic transitions in
     domain modules.
4. **UI decomposition**
   - Replace `BoardPage.tsx` and `HomePage.tsx` with route shells composed from
     feature components. Split canvas, stack/card rendering, sidebars, composer,
     details, board management, notifications, and modals.
5. **Solid 2 RC migration**
   - Pin matching Solid core, router, and Vite plugin prereleases.
   - Replace lifecycle/effect, control-flow, and store APIs using the upstream
     migration guide. Re-run typechecks and browser tests after each feature.
6. **Go decomposition**
   - Split HTTP registration and handlers by capability.
   - Split board/account/task-manager services by command/query responsibility while
     retaining package-level compatibility.
   - Keep SQLite repositories and migrations unchanged except for required schema
     evolution.
7. **Production lifecycle**
   - Retain signal-aware graceful shutdown, add readiness backed by SQLite ping,
     and use explicit read-header, read, write, idle, and shutdown timeouts.
8. **Verification**
   - Run unit/integration tests, frontend typecheck/build, source-size enforcement,
     and focused then full Playwright suites.

## Acceptance criteria

- No handwritten production `.go`, `.ts`, or `.tsx` file exceeds 500 lines.
- `go test ./...`, frontend unit tests, typecheck, and production build pass.
- Existing SQLite data opens and migrations remain forward-compatible.
- Authentication, tasks, projects, calendars, boards, billing, and team workflows
  retain their HTTP contracts unless a documented DTO migration is required.
- SIGINT/SIGTERM stop accepting traffic and close the HTTP server and SQLite handle
  within the configured shutdown timeout.
