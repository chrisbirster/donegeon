# Task manager feature / evidence matrix

Status: M0 baseline inventory

This document is the working source of truth for the task-manager audit defined in `docs/task-manager-audit-plan.md`. It intentionally distinguishes code that exists from behavior that has been proven.

## Status meanings

- `VERIFIED` — executable evidence proves the supported behavior and meaningful state/result semantics.
- `PARTIAL` — implementation exists, but evidence is incomplete, one layer is missing, or important edge cases remain unproved.
- `BROKEN` — implementation/evidence demonstrates behavior that conflicts with the intended contract.
- `UNIMPLEMENTED` — the capability is absent from the maintained product model or current implementation.
- `OUT_OF_SCOPE` — intentionally excluded from the current task-manager product contract.

A successful HTTP status by itself is not semantic verification. In particular, the compatibility YAML runner currently accepts any `2xx` for successful cases without asserting response data or persisted state. Those cases count as route/auth/dispatch evidence only until strengthened.

## Evidence classes

| Evidence | What it can prove |
| --- | --- |
| Canonical Go domain/service test | Domain behavior and durable state transition |
| Repository integration test | Database persistence, retrieval, ordering, and migration behavior |
| HTTP/API semantic test | Request contract, authorization, response shape, and persisted side effects |
| Compatibility YAML case | Currently transport/auth/dispatch unless the runner gains semantic assertions |
| Browser/Playwright test | User-visible workflow and, when reloaded/refetched, end-to-end persistence |
| Source inspection only | Implementation exists; never enough by itself for `VERIFIED` |

## M0 findings that affect the whole audit

1. `internal/task` is the canonical durable task model. The board must consume it rather than define a competing task system.
2. The compatibility API is broad, but several actions are implemented directly with SQL rather than through canonical domain services. These need semantic verification and, where appropriate, consolidation.
3. The compatibility success harness currently treats any HTTP `2xx` as a passing happy path. Its large case count must not be interpreted as feature completeness.
4. Upload actions are explicitly skipped by the compatibility runner.
5. Quick-add parsing supports an assignee token, but the canonical `task.Task` / `task.CreateInput` model does not currently contain an assignee field. Assignment is therefore not a verified durable task capability.
6. The canonical task model has no parent-task/subtask field and no reminder field.
7. Two migration filenames that exposed an internal comparison name were renamed during M0 to `000007_workspace_entities.{up,down}.sql` without changing migration version or SQL.

## A. Core task lifecycle

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Create task | `PARTIAL` | `internal/task.Service.Create`, quick-add create path, HTTP/UI paths | Playwright proves quick-add creation and persistence after reload; service integration proves selected quick-add fields persist | Add canonical direct-create + API semantic cases covering all supported fields |
| Get one task | `PARTIAL` | `task.Service.Get` / repository | Repository/service usage and compatibility route exist | Add not-found, ownership/workspace, deleted-state and exact response assertions |
| List tasks | `PARTIAL` | `task.Service.List` with cursor/limit/user/workspace filters | Existing integration/browser flows consume lists | Prove pagination, tenant filtering, checked/deleted inclusion rules and stable ordering |
| Update task content | `PARTIAL` | `task.Service.Update` | Playwright inline edit save/cancel behavior | Add API + reload/state assertion and invalid-empty-content case |
| Update description | `PARTIAL` | `task.UpdateInput.Description` | Implementation and compatibility surface | Add semantic persistence/browser coverage |
| Delete task | `PARTIAL` | `task.Service.Delete` | Playwright delete action removes task from UI | Prove persisted deletion semantics, repeat delete behavior, tenant isolation |
| Complete non-recurring task | `PARTIAL` | `task.Service.Close` | Browser completion removes task from open view | Prove exact durable checked/completion semantics and idempotency |
| Reopen task | `PARTIAL` | `task.Service.Reopen` | Compatibility route/cases | Add semantic state transition and browser acceptance |
| Complete recurring task and spawn next occurrence | `VERIFIED` | `task.Service.Close` recurrence path | `TestServiceCloseRecurringTaskSpawnsNextOccurrence` asserts closed original plus open next task with retained recurrence and next due time | Extend later for labels/project/section retention and DST edge cases, but core behavior is proven |
| Reorder tasks | `VERIFIED` | sort order persistence + UI drag/drop | Playwright drag-and-drop test asserts order changes and remains after reload | Add repository collision/concurrency edge cases later |
| Soft-delete versus hard-delete contract | `PARTIAL` | Task model has `Deleted`; repository/API behavior exists | Source + compatibility fixtures exercise deleted records | Define public contract and add state-level assertions |
| Task ownership/workspace isolation | `PARTIAL` | `UserID`, `WorkspaceID`, list params and auth layers exist | Session role tests plus multi-tenant schema | Add cross-user/cross-workspace CRUD denial tests for every mutation |

## B. Task fields and metadata

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Content/title | `PARTIAL` | canonical field, required on create | Service validation and browser edit/create flows | Consolidate direct-create/update semantic tests |
| Description | `PARTIAL` | canonical field | Quick-add description parsing cases and model support | Prove persistence through API/UI |
| Priority 1–4 | `PARTIAL` | canonical field and validation | `TestServiceCreateFromQuickAddPersistsProjectAndPriority` proves quick-add persistence | Add direct create/update boundary tests for 0/5 and UI behavior |
| Project assignment | `PARTIAL` | `ProjectID` on task | Quick-add project persistence and alias-resolution integration tests | Prove move/update semantics, nonexistent/archived project behavior and UI persistence |
| Section assignment | `PARTIAL` | `SectionID` on task | Model/compat implementation | Add section/task semantic integration and browser movement tests |
| Labels | `PARTIAL` | task labels repository + `CreateInput/UpdateInput.Labels` | Parser specs cover labels; existing UI/model uses them | Prove create/update/remove/reload and unknown-label policy |
| Due date/time | `PARTIAL` | `DueText` / scheduling normalization | Service integration tests prove several timezone-relative values | Audit direct editing, date-only behavior, DST, clearing and view inclusion |
| Deadline | `PARTIAL` | `DueDeadline` | Service tests prove relative deadline normalization and deadline-before-due scenario | Audit UI editing/clearing, timezone and view semantics |
| Recurrence RRULE | `VERIFIED` for parsing/persistence, `PARTIAL` overall | canonical `Recurrence` | parser specs + Go service tests prove RRULE extraction/persistence; recurring close core is verified | Cover editing existing recurrence, clearing it, DST/month-end and failure recovery |
| Schedule input/original text | `PARTIAL` | `ScheduleInput` + migration | canonical model/source | Define user-facing contract and add persistence tests |
| Checked/completed state | `PARTIAL` | `Checked` | recurring completion semantic test; browser non-recurring behavior | Add complete/reopen direct semantic matrix |
| Subtasks / parent-child tasks | `UNIMPLEMENTED` | no parent/subtask field found in canonical task model | current model inspection | Decide intended model before implementation |
| Durable task assignee | `UNIMPLEMENTED` | quick-add parser can recognize assignee syntax, but canonical task model has no assignee field | parser specs demonstrate syntax only | Decide assignment model; do not advertise parser token as persisted assignment |
| Reminders | `UNIMPLEMENTED` | no reminder field/service found in canonical task model | current source search/model inspection | Define reminder model/provider before implementation |
| Task attachments/uploads | `UNIMPLEMENTED` | upload compatibility actions are skipped by parity runner | explicit runner skip | Define storage/security model before implementation |

## C. Projects, sections, and labels

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Create project | `PARTIAL` | canonical project service + compatibility path | UI task-detail project creation is exercised in Playwright | Add canonical persistence and duplicate/name validation contract |
| Read/list projects | `PARTIAL` | canonical project service/repository | UI consumes projects; compatibility routes exist | Prove ordering, inbox behavior, tenant filtering, pagination where supported |
| Update/rename project | `PARTIAL` | project service update | compatibility/UI paths exist | Semantic persistence + UI reload assertion |
| Archive project | `PARTIAL` | `project.Service.Archive` | source + compatibility paths | Prove tasks remain valid, archived visibility rules, repeat archive |
| Unarchive project | `PARTIAL` | compatibility surface | weak parity happy-path evidence | Add semantic state assertion and UI workflow |
| Delete project | `PARTIAL` | compatibility layer performs project operations outside canonical service | weak compatibility evidence | Define deletion/cascade/orphan policy and prove it |
| Favorite project | `PARTIAL` | `IsFavorite` field and migration/UI | UI sidebar/favorites behaviors exist | Add persistence and ordering proof |
| Inbox/default project behavior | `PARTIAL` | `IsInboxProject`, default-project migration | UI Inbox and project code | Prove uniqueness/default routing and per-user/workspace behavior |
| Sections CRUD | `PARTIAL` | compatibility SQL + schema | compatibility routes/cases | Add canonical service or explicit ownership boundary; prove task movement and delete policy |
| Labels CRUD | `PARTIAL` | compatibility SQL + schema | compatibility routes/cases | Add semantic CRUD, uniqueness/case policy and task association tests |
| Shared labels | `PARTIAL` | compatibility surface | compatibility route/cases | Prove ownership/workspace semantics and rename/remove effects on tasks |

## D. Scheduling, recurrence, and views

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Relative due parsing | `VERIFIED` for parser | quick-add parser/service | executable parser specs + service normalization tests | Browser/server parity and DST matrix |
| Calendar-style due parsing | `VERIFIED` for parser | quick-add parser | executable quick-add YAML specs | Persistence/view semantics remain `PARTIAL` |
| Deadline parsing | `VERIFIED` for covered parser forms | quick-add parser/service | executable specs + service tests | Boundary/DST/clear/edit cases |
| Daily/weekly/monthly interval recurrence | `VERIFIED` for covered parser forms | parser + RRULE | parser recurrence Go/spec tests | recurrence execution matrix remains broader than parser proof |
| Recurring next occurrence | `VERIFIED` core | service close recurrence | semantic service integration test | DST, month-end, edited rules, transaction failure |
| Inbox view | `PARTIAL` | client task view/model + backend filtering | Playwright navigation/tasks | Define exact inclusion/exclusion and prove against persisted data |
| Today view | `PARTIAL` | client task view/model | Playwright navigation | Prove timezone/date-only/overdue/recurring semantics |
| Upcoming view | `PARTIAL` | client task view/model | Playwright navigation | Prove date window/order/timezone semantics |
| Overdue behavior | `PARTIAL` | scheduling/view rules present | UI/source coverage | Add explicit acceptance cases |
| Completion history/search by date | `PARTIAL` | compatibility endpoints | weak parity happy-path cases | Add exact returned task/order/pagination assertions |

## E. Quick add, search, and interaction

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Server quick-add parser core | `VERIFIED` for documented parser cases | `internal/quickadd` | executable YAML parser specs + Go parser tests assert parsed fields | Keep matrix synchronized as grammar expands |
| Quick-add create persistence | `PARTIAL` | `task.Service.CreateFromQuickAdd` | Go service tests prove recurrence/project/priority/dates; browser proves created task survives reload | Add labels/description/assignee-contract and complete payload proof |
| Local browser quick-add preview | `PARTIAL` | `localQuickAddParser.ts` | unit tests + Playwright proves preview without parser API | Build explicit server/local parity corpus; eliminate drift |
| Search tasks UI | `PARTIAL` | search overlay/client filtering/API | Playwright opens search and task detail from result | Prove matching rules, completed/deleted visibility, pagination and server/client consistency |
| Filter query API | `PARTIAL` | compatibility filter action | implementation exists; parity transport cases | Current behavior requires semantic contract tests before claiming rich filtering |
| Inline task edit | `PARTIAL` | client + task update API | Playwright save/cancel | Add reload persistence and error rollback cases |
| Detail modal edit flows | `PARTIAL` | client detail modal | Playwright covers multiple controls | Complete field-by-field persistence/error matrix |
| Mobile task workflow | `PARTIAL` | responsive client | Playwright covers quick add/navigation portions | Complete lifecycle acceptance at mobile viewport |

## F. Collaboration, accounts, and integrations

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Session read/write roles | `VERIFIED` for tested API scope behavior | HTTP auth/role middleware | explicit reader-readonly/editor-write Go tests | Expand tenant resource tests, but core role write gate is proven |
| Workspaces | `PARTIAL` | account/compat schema/services | compatibility routes + account tests | Prove membership isolation across task/project CRUD |
| Workspace invitations | `PARTIAL` | schema/compat/account paths | compatibility auth/error coverage | Add semantic accept/reject/idempotency state assertions |
| Project sharing/collaborators | `PARTIAL` | compatibility layer | routes and SQL implementation | Add permission/state/UI acceptance tests |
| Task comments | `PARTIAL` | compatibility comments implementation | routes/cases | Add create/update/delete/list exact-state and tenant tests |
| Durable task assignment | `UNIMPLEMENTED` | absent from canonical task model | M0 model inspection | Model before UI/API claims |
| Activity log | `UNIMPLEMENTED` / placeholder | compatibility action currently returns no meaningful activity data | source inspection | Define event model and persistence before advertising |
| Productivity statistics | `PARTIAL` | compatibility endpoint exists | transport coverage | Verify formulas and returned values against seeded data |
| Calendar account connection | `PARTIAL` | `internal/calendar`, connection migration | implementation exists | Audit OAuth lifecycle, token storage, disconnect/reconnect and tenant isolation |
| Task/calendar synchronization | `PARTIAL` | calendar integration code exists | implementation-level evidence | Add deterministic provider-boundary tests and end-to-end sync semantics |

## G. Reliability and security properties

| Capability | Status | Evidence / gap |
| --- | --- | --- |
| Production auth cannot be disabled | `VERIFIED` | production config validation tests added during open-source hardening |
| Reader role cannot mutate | `VERIFIED` | explicit session role scope test |
| Task API rate limiting where configured | `PARTIAL` | limiter tests exist; audit endpoint coverage and retry semantics |
| Idempotent compatibility mutations | `PARTIAL` | YAML cases claim idempotency but success harness does not prove repeated state | 
| Pagination correctness | `PARTIAL` | many compatibility cases request limit/cursor but happy-path assertions do not inspect result contents |
| Cross-tenant task isolation | `PARTIAL` | schema/auth supports tenancy, but needs explicit per-operation denial matrix |
| Database migration from existing installs | `PARTIAL` | migration runner and CI/tests exist; add upgrade-path fixture from representative historical DB |
| SQLite/Turso behavioral parity | `PARTIAL` | same repository/migration abstraction intended | add shared contract suite against both backends where feasible |

## Prioritized audit queue

The implementation order is evidence-driven, not feature-count-driven.

### M1 — core lifecycle gate

1. Add a semantic task service/repository contract covering create → get/list → update → close → reopen → delete.
2. Assert every supported field on create/update, including labels, project, section, priority, due/deadline, recurrence and ordering.
3. Add cross-user/workspace denial tests.
4. Add API semantic assertions for the same lifecycle.
5. Only after these pass, promote the relevant M1 rows from `PARTIAL` to `VERIFIED`.

### M2 — organization gate

Projects, sections, labels, archive/unarchive/favorites, task movement and deletion/orphan policies.

### M3 — scheduling gate

Dates, deadlines, timezone handling, recurrence execution, DST/month-end cases, Today/Upcoming/overdue inclusion rules.

### M4 — quick add/search gate

Server parser vs local parser parity, persistence of parsed metadata, search/filter semantics, desktop/mobile interaction acceptance.

### M5 — collaboration/integration gate

Workspaces, invitations, comments, project sharing, permissions, calendar connection/sync. Decide whether assignees, reminders and attachments are required for the first task-manager-complete milestone before implementing them.

### M6 — browser acceptance gate

Run one coherent user journey from an empty account through project/task creation, scheduling, editing, reordering, completion, recurrence, search and reload on desktop and mobile.

### M7 — closeout

1. Replace weak compatibility happy-path assertions with semantic response/state assertions or stop counting them as product verification.
2. Regenerate `docs/test-catalog.md` after the semantic suite is authoritative.
3. Update this matrix so every supported task-manager capability is `VERIFIED` or explicitly deferred/out of scope.
4. Only then begin the game-readiness audit.

## Definition of task-manager audit complete

The task-manager audit is complete when:

- every supported capability in this matrix is `VERIFIED`;
- every intentionally deferred capability is clearly `OUT_OF_SCOPE` rather than silently missing;
- no feature is considered complete solely because an endpoint returns `2xx`;
- canonical Go domain behavior, API semantics, persistence and critical browser workflows agree;
- the game layer can depend on the task model without introducing a second source of truth.
