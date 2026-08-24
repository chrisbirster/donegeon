# Task Manager Audit Plan

## Goal

Establish, with evidence, which Donegeon task-management features actually work before treating the game layer as release-ready.

The audit is not a test-count exercise. A feature is only considered verified when its user-visible contract, server-side state transition, persistence behavior, API behavior, and relevant browser workflow are proven at the appropriate layers.

## Scope boundary

During this audit, task management is the priority. Game work is frozen except when a game integration exposes a defect in the canonical task model or when a small compatibility fix is required to keep task behavior testable.

The Go task/project/workspace domains remain authoritative for durable state. The SolidJS client is presentation and interaction. The board/game layer must consume the canonical task model rather than define a second task model.

## Current evidence and known risk

The repository currently has a large generated test catalog: 840 entries composed of executable YAML specifications, Go tests, and Playwright tests.

That number must not be treated as feature coverage by itself. In particular, the compatibility YAML runner currently treats a successful case as passing when the response is any HTTP `2xx`; it does not generally assert the successful response fields or resulting persisted state. Those cases are useful transport/auth/dispatch checks, but they are not sufficient proof that a task-management feature behaves correctly.

The audit will reclassify tests by what they actually prove.

## Verification statuses

Every feature in the audit matrix must end in exactly one state:

- `VERIFIED` — behavior and important edge cases are proven at the required layers.
- `PARTIAL` — meaningful behavior exists, but required semantics or test evidence is missing.
- `BROKEN` — implemented behavior conflicts with the intended contract.
- `UNIMPLEMENTED` — no maintained implementation exists.
- `OUT_OF_SCOPE` — intentionally excluded from the current product contract.

No feature is `VERIFIED` because an endpoint merely returned `2xx`.

## Evidence levels

Use the smallest meaningful test layer, but require end-to-end evidence for important user workflows.

1. **Domain/service tests** — prove validation and state-transition rules.
2. **Repository/integration tests** — prove durable state, ordering, relationships, deletion/archive behavior, and migrations.
3. **API contract tests** — prove request validation, authorization, response shape, error semantics, idempotency where promised, and observable state changes.
4. **Browser tests** — prove critical user workflows and persistence after reload.
5. **Compatibility tests** — prove adapter/dispatch compatibility only; they do not replace canonical Donegeon semantic tests.

## Feature inventory

### A. Core task lifecycle

Audit first because every other task feature depends on it.

- create task
- read/list task
- edit content and description
- complete task
- reopen task
- delete task
- persistence after reload/restart
- ordering/reordering
- validation and missing-resource behavior
- concurrent/stale updates where applicable

### B. Organization

- inbox behavior
- projects: create, read, update, archive, unarchive, delete
- sections: create, read, update, move/order, delete
- labels: create, read, update, delete, assignment/removal
- favorites
- task moves between project/section locations
- project aliases/references

### C. Scheduling and recurrence

- due date
- due time and timezone normalization
- deadlines
- priority
- recurrence parsing
- recurrence persistence
- completing a recurring task creates the correct next occurrence
- DST/timezone edge cases
- completed-task queries by completion and due date
- upcoming/today view membership

### D. Quick add

- plain task capture
- project tokens
- labels
- assignee syntax if maintained
- priorities
- descriptions
- due expressions
- deadlines
- recurrence expressions
- local preview vs server-authoritative save
- invalid/ambiguous syntax behavior

### E. Search, filters, and views

- inbox
- today
- upcoming
- text search
- project filtering
- section filtering
- label filtering
- completed-task search
- pagination/cursors
- deterministic ordering

### F. Comments and activity

- add/read/update/delete comments
- comment ownership/authorization
- task/project association
- activity log semantics if maintained

### G. Collaboration and workspaces

Audit after single-user task semantics are stable.

- workspace membership and roles
- invitations
- project collaborators
- moving projects between personal/workspace scopes
- read-only/editor/owner authorization boundaries
- workspace plan/feature boundaries where maintained

### H. Calendar integration

Audit only against the canonical task contract.

- connection/configuration state
- task-to-calendar mapping
- update/delete behavior
- recurrence/timezone behavior
- failure and retry behavior

### I. Browser UX

For each verified backend feature that is exposed in the client, verify the corresponding user workflow.

At minimum:

- quick create
- edit and cancel
- complete/reopen
- delete
- task detail
- drag reorder and persistence
- projects and navigation
- due/deadline/priority controls
- recurrence
- labels/sections where exposed
- search
- responsive/mobile behavior
- reload persistence
- useful error feedback

## Milestones

### M0 — Build the feature/evidence matrix

Create `docs/audits/task-manager-feature-matrix.md`.

For every feature record:

- intended user behavior
- authoritative Go implementation
- persistence tables/queries
- API endpoint/action
- SolidJS UI surface
- existing tests
- what those tests actually assert
- verification status
- defect/gap links

Exit criterion: every maintained task-management feature is represented exactly once in the matrix.

### M1 — Core lifecycle confidence

Verify create/read/update/complete/reopen/delete, ordering, and persistence.

Replace or add tests that assert exact resulting task state rather than generic success.

Exit criterion: core lifecycle is `VERIFIED` with domain/repository/API evidence and critical browser workflows.

### M2 — Projects, sections, labels, and moves

Verify organization semantics and relationships, including destructive and archive operations.

Exit criterion: organization features used by the UI are `VERIFIED` or explicitly marked `PARTIAL`/`UNIMPLEMENTED` with tracked gaps.

### M3 — Dates, deadlines, priority, recurrence

Verify scheduling semantics independently of quick-add parsing, then verify parsing feeds the same canonical fields.

Exit criterion: recurrence and timezone behavior have deterministic tests, including next-occurrence persistence.

### M4 — Quick add, search, filters, and views

Verify parsing separately from save behavior. Verify local preview cannot silently disagree with server-authoritative state.

Exit criterion: critical parsing and view-membership cases have semantic assertions and browser coverage.

### M5 — Comments, collaboration, workspaces, calendar

Only begin after M1-M4 are stable.

Exit criterion: maintained multi-user/integration features have explicit authorization, persistence, and failure-mode evidence.

### M6 — Browser acceptance audit

Run the product as a user and prove the critical journeys with Playwright. Remove or rewrite tests that only duplicate lower-level checks without proving useful browser behavior.

Exit criterion: the browser suite maps directly to the feature matrix and contains no knowingly misleading coverage claims.

### M7 — Test-suite cleanup and task-manager release gate

- regenerate the test catalog
- remove obsolete compatibility/spec cases
- separate transport compatibility checks from product semantic tests
- eliminate duplicate/no-value tests
- document intentional omissions
- run full CI and vulnerability/dependency checks

Exit criterion: every task-manager matrix row has a truthful status and evidence. The game audit may then start against the verified canonical task model.

## Test-quality rules

A test should answer a concrete question about product behavior.

For a successful mutation, assert the important resulting state. Examples:

- creating a task stores the requested project, section, labels, priority, due/deadline, and recurrence fields;
- completing a recurring task closes the original and creates exactly the expected next task;
- moving a task changes its project/section and preserves unrelated fields;
- deleting a project has the intended effect on contained tasks;
- a read-only user cannot mutate state;
- a browser edit remains correct after reload.

Avoid counting the following as semantic feature proof:

- only checking `2xx`;
- only checking that a handler was dispatched;
- generated cases whose `then` fields are never asserted;
- frontend tests that mock away the server behavior they claim to verify;
- duplicate tests that prove the same shallow condition.

## Branch/PR execution

Use small milestone branches and PRs. Suggested sequence after this plan:

- `DGN-0006-task-audit-matrix`
- `DGN-0007-task-lifecycle`
- `DGN-0008-task-organization`
- `DGN-0009-task-scheduling`
- `DGN-0010-task-quickadd-search`
- `DGN-0011-task-collaboration-integrations`
- `DGN-0012-task-browser-acceptance`
- `DGN-0013-task-audit-closeout`

Each PR should update the matrix with evidence and must leave CI green. A milestone is not complete merely because tests were added; the matrix must state what was proven and what remains uncertain.

## First action after this plan

Do **M0 only**: build the task-manager feature/evidence matrix from the current code and tests. Do not start repairing game mechanics and do not add speculative task features during M0.

The first implementation work after M0 should target the highest-risk `PARTIAL` or `BROKEN` core lifecycle rows, with special attention to replacing successful compatibility cases that currently prove only HTTP success with tests that assert canonical response and persisted state.
