# Task manager feature / evidence matrix

Status: M1 core lifecycle gate complete

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

## M1 findings

1. `internal/task` now has a semantic integration contract for create → get/list → update → complete → idempotent complete → reopen → delete.
2. The contract asserts durable state after each transition instead of treating a successful call as sufficient evidence.
3. Current task fields round-trip through the canonical service: content, description, project, section, sort order, recurrence, priority, due text, deadline, schedule input, and labels.
4. Direct create/update validation is proven for empty content and out-of-range priorities.
5. Pagination metadata and stable sort-order behavior are proven for the canonical list operation.
6. Cross-user and cross-workspace isolation is proven for canonical Get/List/Update/Close/Reopen/Delete, and the public HTTP task handlers prove Get/List isolation as well.
7. Public task handlers now have a semantic lifecycle contract covering create, get, list, patch, close, reopen, delete, response bodies/statuses, persisted completion state, and deletion visibility.
8. No production task-lifecycle code change was required: the stronger contracts passed against the existing implementation.
9. Project, section, recurrence, and schedule input can currently be set but do not have explicit clear semantics in `UpdateInput`; those field contracts remain `PARTIAL` until intentionally designed.
10. The broad compatibility YAML happy-path suite remains transport-level evidence unless its assertions are strengthened.

## A. Core task lifecycle

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Create task | `VERIFIED` | `internal/task.Service.Create`, HTTP create, quick-add create | `TestServiceTaskLifecycleContract`, `TestServiceTaskFieldRoundTripAndValidation`, `TestTaskHTTPLifecycleContract` assert returned and persisted task state | Field-specific edge cases remain tracked in section B |
| Get one task | `VERIFIED` | `task.Service.Get`, HTTP get | service + HTTP lifecycle contracts assert exact task state, deletion not-found, and tenant isolation | None for core lifecycle |
| List tasks | `PARTIAL` | `task.Service.List` with cursor/limit/user/workspace/project filters | M1 proves stable sort order, cursor pagination, tenant isolation, and deleted-task exclusion | Prove checked-task inclusion policy and project-filter semantics before broad promotion |
| Update task content | `VERIFIED` | `task.Service.Update`, HTTP patch | service + HTTP contracts assert update response and subsequent persisted state; empty content is rejected | None for core content update |
| Update description | `VERIFIED` | `task.UpdateInput.Description`, HTTP patch | service + HTTP contracts assert durable description update | None for core description update |
| Delete task | `VERIFIED` | `task.Service.Delete`, HTTP delete | service + HTTP contracts prove deletion hides task from Get/List; service proves repeat delete/close/reopen return not-found | Soft-vs-hard storage policy is tracked separately |
| Complete non-recurring task | `VERIFIED` | `task.Service.Close`, HTTP close | service + HTTP contracts prove `checked=true`, `processed_count=1`, and idempotent second close | Browser acceptance remains part of M6, not core semantics |
| Reopen task | `VERIFIED` | `task.Service.Reopen`, HTTP reopen | service + HTTP contracts prove `checked=false` while preserving processed count | Browser acceptance remains part of M6 |
| Complete recurring task and spawn next occurrence | `VERIFIED` | `task.Service.Close` recurrence path | `TestServiceCloseRecurringTaskSpawnsNextOccurrence` asserts closed original plus open next task with retained recurrence and next due time | Extend in M3 for DST/month-end/edited-rule/failure cases |
| Reorder tasks | `VERIFIED` | sort order persistence + UI drag/drop | Playwright drag-and-drop test asserts order changes and remains after reload | Add collision/concurrency cases only if product contract requires them |
| Soft-delete versus hard-delete contract | `PARTIAL` | task model/repository uses deletion state and query exclusion | M1 proves deleted tasks disappear from Get/List and later mutations return not-found | Explicitly define whether physical row retention is part of the public contract and prove storage state |
| Task ownership/workspace isolation | `VERIFIED` | `UserID`, `WorkspaceID`, repository predicates and auth context | `TestServiceTaskTenantIsolationContract` proves every core mutation cannot cross user/workspace boundaries; HTTP contract proves Get/List isolation | Extend the same resource-boundary pattern to projects/sections/labels in M2 |

## B. Task fields and metadata

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Content/title | `VERIFIED` | canonical required field | M1 service + HTTP create/update round trips; empty create/update validation asserted | None for core field semantics |
| Description | `VERIFIED` | canonical field | M1 service + HTTP create/update persistence | None for core field semantics |
| Priority 1–4 | `VERIFIED` | canonical field and validation | M1 round trip plus create priority `5` and update priority `0` rejection | UI priority acceptance remains M6 |
| Project assignment | `PARTIAL` | `ProjectID` on task | M1 proves create/update persistence; quick-add alias integration also exists | Prove move rules, nonexistent/archived project behavior, clear semantics, and UI persistence in M2 |
| Section assignment | `PARTIAL` | `SectionID` on task | M1 proves create/update persistence | Prove section ownership, movement, deletion policy, clear semantics, and UI persistence in M2 |
| Labels | `PARTIAL` | task labels repository + `CreateInput/UpdateInput.Labels` | M1 proves normalized create/update/reload; existing parser specs cover label syntax | Prove explicit removal/empty-set behavior, unknown-label policy, CRUD linkage, and UI persistence in M2 |
| Due date/time | `PARTIAL` | `DueText` plus scheduling normalization | M1 proves direct create/update persistence and explicit clear; existing service tests cover relative values | M3: date-only, timezone, DST, editing, view inclusion |
| Deadline | `PARTIAL` | `DueDeadline` | M1 proves direct create/update persistence and explicit clear; existing tests cover relative deadline normalization | M3: timezone/DST/edit/view semantics |
| Recurrence RRULE | `VERIFIED` for parsing/persistence, `PARTIAL` overall | canonical `Recurrence` | parser specs + M1 round trip + recurring-close semantic test | M3: edit/clear, DST/month-end, transaction failure/recovery |
| Schedule input/original text | `PARTIAL` | `ScheduleInput` | M1 proves create/update persistence | Define user-facing meaning and explicit clear semantics |
| Checked/completed state | `VERIFIED` | `Checked`, `ProcessedCount` | M1 service + HTTP contracts prove close, repeated close, reopen, and processed-count behavior | Recurrence-specific broader cases stay in M3 |
| Subtasks / parent-child tasks | `UNIMPLEMENTED` | no parent/subtask field found in canonical task model | canonical model inspection | Decide intended model before implementation |
| Durable task assignee | `UNIMPLEMENTED` | parser recognizes assignee syntax, canonical task model has no assignee field | parser specs demonstrate syntax only | Decide assignment model; do not advertise parser token as persisted assignment |
| Reminders | `UNIMPLEMENTED` | no reminder field/service found in canonical task model | current source/model inspection | Define reminder model/provider before implementation |
| Task attachments/uploads | `UNIMPLEMENTED` | upload compatibility actions are skipped by parity runner | explicit runner skip | Define storage/security model before implementation |

## C. Projects, sections, and labels

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Create project | `PARTIAL` | canonical project service + compatibility path | UI task-detail project creation is exercised in Playwright | Add canonical persistence and duplicate/name validation contract |
| Read/list projects | `PARTIAL` | canonical project service/repository | UI consumes projects; compatibility routes exist | Prove ordering, inbox behavior, tenant filtering, pagination where supported |
| Update/rename project | `PARTIAL` | project service update | compatibility/UI paths exist | Semantic persistence + UI reload assertion |
| Archive project | `PARTIAL` | `project.Service.Archive` | source + compatibility paths | Prove tasks remain valid, archived visibility rules, repeat archive |
| Unarchive project | `PARTIAL` | compatibility surface | weak compatibility happy-path evidence | Add semantic state assertion and UI workflow |
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
| Completion history/search by date | `PARTIAL` | compatibility endpoints | weak compatibility happy-path cases | Add exact returned task/order/pagination assertions |

## E. Quick add, search, and interaction

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Server quick-add parser core | `VERIFIED` for documented parser cases | `internal/quickadd` | executable YAML parser specs + Go parser tests assert parsed fields | Keep matrix synchronized as grammar expands |
| Quick-add create persistence | `PARTIAL` | `task.Service.CreateFromQuickAdd` | Go service tests prove recurrence/project/priority/dates; browser proves created task survives reload | Add labels/description/assignee-contract and complete payload proof |
| Local browser quick-add preview | `PARTIAL` | `localQuickAddParser.ts` | unit tests + Playwright proves preview without parser API | Build explicit server/local parity corpus; eliminate drift |
| Search tasks UI | `PARTIAL` | search overlay/client filtering/API | Playwright opens search and task detail from result | Prove matching rules, completed/deleted visibility, pagination and server/client consistency |
| Filter query API | `PARTIAL` | compatibility filter action | implementation exists; compatibility transport cases | Add semantic result/state contract before claiming rich filtering |
| Inline task edit | `PARTIAL` | client + task update API | Playwright save/cancel; M1 proves backend update semantics | M6: reload persistence and error rollback acceptance |
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
| Pagination correctness | `VERIFIED` for canonical task list | `TestServiceTaskListPaginationContract` asserts total, page size, next cursor, second page, and stable ordering | Compatibility endpoint pagination remains separate evidence work |
| Cross-tenant task isolation | `VERIFIED` for canonical lifecycle | M1 service contract covers Get/List/Update/Close/Reopen/Delete across user/workspace boundaries; HTTP contract proves Get/List boundaries | Apply equivalent resource contracts to M2 organization entities |
| Database migration from existing installs | `PARTIAL` | migration runner and CI/tests exist | Add upgrade-path fixture from representative historical DB |
| SQLite/Turso behavioral parity | `PARTIAL` | same repository/migration abstraction intended | Add shared contract suite against both backends where feasible |

## Prioritized audit queue

The implementation order is evidence-driven, not feature-count-driven.

### M1 — core lifecycle gate — COMPLETE

Completed evidence:

1. Canonical task service/repository lifecycle contract for create → get/list → update → close → reopen → delete.
2. Round-trip assertions for every currently supported canonical task field.
3. Direct validation assertions for required content and priority bounds.
4. Cursor pagination and stable ordering assertions.
5. Cross-user/workspace isolation across all core canonical mutations.
6. Public HTTP-handler lifecycle contract with semantic response and persisted-state assertions.

Known M1 deferrals are explicitly retained as `PARTIAL` rows rather than hidden: broader list inclusion/filter rules, nullable project/section/recurrence/schedule clearing, labels policy, and scheduling/view edge cases.

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
