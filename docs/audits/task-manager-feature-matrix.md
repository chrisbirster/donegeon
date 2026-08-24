# Task manager feature / evidence matrix

Status: M3 scheduling gate complete

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
9. Project, section, recurrence, and schedule input were identified as fields needing explicit clear semantics or stronger organization/scheduling contracts; M2 and M3 close those backend gaps.
10. The broad compatibility YAML happy-path suite remains transport-level evidence unless its assertions are strengthened.

## M2 findings

1. `TestOrganizationCRUDAndOrphanPolicies`, `TestOrganizationTenantIsolationAndForeignMoves`, and `TestOrganizationLabelRenameRemoveAndDeleteAffectTaskLinks` passed on protected CI together with the full Go suite.
2. Compatibility organization lookups no longer trust a globally known resource ID. Project/section access is workspace-bounded, personal projects remain owner-bounded, and labels remain user+workspace bounded.
3. The current ownership model is explicit: projects and sections are workspace resources; tasks are user+workspace resources; labels are user+workspace resources. Fine-grained collaboration roles remain an M5 concern and are not being inferred inside M2.
4. Task create/update/move/move-many validate target projects and sections before mutation. A section-only move derives its project, a project change clears a stale section, an explicit project clear clears both project and section, and a section/project mismatch is rejected.
5. Cross-workspace project/section IDs cannot be used to move or update a task. Failed foreign-move attempts leave the task's existing placement unchanged.
6. Project archive/unarchive and favorite state have exact persisted-state assertions. Inbox and the default board are protected from destructive archive/delete operations.
7. Project deletion has an explicit orphan policy: the project and its sections are physically removed; surviving tasks have both project and section references cleared; project-linked comment references are cleared.
8. Section deletion removes the section while preserving the task's project assignment and clearing only the task's section reference.
9. Label CRUD is tenant-scoped. Renaming a linked label changes the label observed on the task; shared-label removal and label deletion remove task-label links without deleting the task.
10. Workspace membership/share permission semantics, project-to-workspace/personal policy, collaborators, comments, and invitation authorization remain M5 rather than being overclaimed by M2.

## M3 findings

1. `TestSchedulingContractNormalizesLocalCalendarTimeAcrossDST` and `TestSchedulingContractDateOnlyUsesLocalMidnight` prove local calendar-time normalization, including the spring DST boundary and date-only midnight behavior.
2. Recurring completion now closes the current occurrence and creates the next occurrence in one database transaction. `TestSchedulingContractRecurringCloseRollsBackIfNextCreateFails` proves that a failed next insert leaves the original occurrence open and retryable.
3. The recurring transaction uses an open-only close mutation so a racing/repeated close cannot create a second future occurrence after another close has already won the state transition.
4. `TestSchedulingContractRecurringClosePreservesLocalTimeAndDeadlineLeadAcrossDST` proves a weekly 9:00 AM recurrence remains 9:00 AM after the DST offset changes and its two-hour deadline lead remains 7:00 AM local time.
5. `TestSchedulingContractMonthlyLastDayHandlesShortMonths` proves a last-day monthly rule advances January 31 → February 28 rather than overflowing into March.
6. Finite recurrence is explicit: spawned `COUNT` rules decrement instead of resetting, and `UNTIL` stops at its boundary. The semantic suite proves no extra occurrence is created.
7. Editing a recurrence changes the rule used for the next occurrence. Clearing recurrence, due, deadline, and schedule input is explicit in `UpdateInput`, persisted by SQL, and exposed by the HTTP PATCH contract.
8. Home scheduling now treats `dueText` as the primary scheduling date and `dueDeadline` as fallback. Overdue work is bucketed into Today; Upcoming remains strictly future work. These rules live in the pure `home-scheduling.ts` module and are covered by Node unit tests.
9. Browser-level scheduling acceptance remains M6; M3 proves the underlying service/API and client-rule semantics without treating navigation alone as sufficient evidence.

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
| Complete recurring task and spawn next occurrence | `VERIFIED` | transactional recurrence path in `task.Service.Close` / repository | M3 contracts prove next occurrence, DST/month-end, edited rules, finite `COUNT`/`UNTIL`, deadline lead, rollback on spawn failure, and repeat-close protection | Browser recurrence acceptance remains M6 |
| Reorder tasks | `VERIFIED` | sort order persistence + UI drag/drop | Playwright drag-and-drop test asserts order changes and remains after reload | Add collision/concurrency cases only if product contract requires them |
| Soft-delete versus hard-delete contract | `PARTIAL` | task model/repository uses deletion state and query exclusion | M1 proves deleted tasks disappear from Get/List and later mutations return not-found | Explicitly define whether physical row retention is part of the public contract and prove storage state |
| Task ownership/workspace isolation | `VERIFIED` | `UserID`, `WorkspaceID`, repository predicates and auth context | M1 service contract covers core mutations; M2 proves foreign-workspace organization IDs cannot be used to reposition a task | Fine-grained shared-workspace write permissions remain M5 |

## B. Task fields and metadata

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Content/title | `VERIFIED` | canonical required field | M1 service + HTTP create/update round trips; empty create/update validation asserted | None for core field semantics |
| Description | `VERIFIED` | canonical field | M1 service + HTTP create/update persistence | None for core field semantics |
| Priority 1–4 | `VERIFIED` | canonical field and validation | M1 round trip plus create priority `5` and update priority `0` rejection | UI priority acceptance remains M6 |
| Project assignment | `VERIFIED` | `ProjectID` on task + compatibility placement validator | M1 persistence + M2 validated moves, foreign-workspace rejection, explicit clear, and non-mutation on rejected moves | Archived-project creation policy and browser acceptance remain separate |
| Section assignment | `VERIFIED` | `SectionID` on task + compatibility placement validator | M1 persistence + M2 section-only move, mismatch rejection, explicit clear, and section-deletion cleanup | Browser acceptance remains M6 |
| Labels | `VERIFIED` for backend CRUD/link semantics | task labels repository + tenant-scoped compatibility CRUD | M1 normalized round trips + M2 rename/remove/delete effects on linked tasks | Duplicate/case policy and browser acceptance remain |
| Due date/time | `VERIFIED` for current scheduling contract | `DueText` plus timezone-aware scheduling normalization | M1 persistence/clear + M3 local date-only, relative-time and DST normalization; client rule tests prove due-date view precedence and overdue bucketing | Browser acceptance remains M6 |
| Deadline | `VERIFIED` for current scheduling contract | `DueDeadline` plus timezone-aware normalization | M1 persistence + M3 DST normalization, recurring deadline-lead preservation, and HTTP clear semantics | Browser acceptance remains M6 |
| Recurrence RRULE | `VERIFIED` for supported execution matrix | canonical `Recurrence`, RRULE parser, transactional close/spawn | parser specs + M3 daily/weekly/monthly execution, edit/clear, DST, month-end, finite `COUNT`/`UNTIL`, and rollback recovery | Additional exotic BY* combinations remain parser-level unless explicitly exercised |
| Schedule input/original text | `VERIFIED` for persistence/clear contract | `ScheduleInput` | M1 create/update persistence + M3 continuity across recurrence and explicit service/HTTP clear | Product wording/display polish remains UI work |
| Checked/completed state | `VERIFIED` | `Checked`, `ProcessedCount` | M1 lifecycle + M3 atomic recurring close prove processed-count and completion behavior | Browser recurrence acceptance remains M6 |
| Subtasks / parent-child tasks | `UNIMPLEMENTED` | no parent/subtask field found in canonical task model | canonical model inspection | Decide intended model before implementation |
| Durable task assignee | `UNIMPLEMENTED` | parser recognizes assignee syntax, canonical task model has no assignee field | parser specs demonstrate syntax only | Decide assignment model; do not advertise parser token as persisted assignment |
| Reminders | `UNIMPLEMENTED` | no reminder field/service found in canonical task model | current source/model inspection | Define reminder model/provider before implementation |
| Task attachments/uploads | `UNIMPLEMENTED` | upload compatibility actions are skipped by parity runner | explicit runner skip | Define storage/security model before implementation |

## C. Projects, sections, and labels

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Create project | `VERIFIED` for current backend contract | canonical project service + compatibility path | M2 semantic contract asserts returned project and favorite state | Duplicate/name collision policy remains to define |
| Read/list projects | `PARTIAL` | canonical project service/repository + compatibility lookup | M2 proves active/archived visibility and workspace-bounded get; existing list code supplies pagination wrapper | Explicit ordering/pagination and collaboration visibility need focused evidence |
| Update/rename project | `VERIFIED` for current backend contract | project service update | M2 semantic contract asserts durable rename + favorite update | Browser reload assertion remains M6 |
| Archive project | `VERIFIED` for current backend contract | compatibility archive state | M2 asserts persisted archived state and active/archived list visibility | Archived-target task-creation policy remains to define |
| Unarchive project | `VERIFIED` for current backend contract | compatibility surface | M2 asserts persisted return to active state | Browser workflow remains M6 |
| Delete project | `VERIFIED` for current backend contract | transactional compatibility deletion | M2 asserts project/sections removed while tasks survive with project+section cleared | UI confirmation/undo policy remains product work |
| Favorite project | `VERIFIED` for current backend contract | `IsFavorite` via canonical upsert | M2 asserts false→true persistence | Sidebar ordering/UI remains M6 |
| Inbox/default project behavior | `PARTIAL` | default-project migration + destructive guards | M2 asserts Inbox delete and default-board archive are rejected | Uniqueness/default routing and broader default policy remain |
| Sections CRUD | `VERIFIED` for current backend contract | compatibility SQL with workspace-bound project lookup | M2 asserts create/read/rename/delete and task-reference cleanup | Fine-grained collaboration permissions remain M5 |
| Labels CRUD | `VERIFIED` for current backend contract | user+workspace-scoped compatibility SQL | M2 asserts create/read/update/delete and task-link cleanup | Duplicate/case policy remains to define |
| Shared labels | `PARTIAL` | compatibility surface | M2 asserts rename changes linked task label and remove deletes link | True multi-user/shared-label semantics remain M5 |

## D. Scheduling, recurrence, and views

| Capability | Status | Implementation | Strongest current evidence | Gap / next proof |
| --- | --- | --- | --- | --- |
| Relative due parsing | `VERIFIED` | quick-add parser/service | parser specs + service normalization tests + M3 DST-local normalization | M4 will prove server/local preview parity |
| Calendar-style due parsing | `VERIFIED` for current date contract | quick-add parser/service | parser specs + M3 date-only local-midnight persistence | Browser acceptance remains M6 |
| Deadline parsing | `VERIFIED` for covered forms | quick-add parser/service | executable specs + M3 DST normalization, recurring lead preservation, and HTTP clear | Browser acceptance remains M6 |
| Daily/weekly/monthly interval recurrence | `VERIFIED` for execution matrix | parser + RRULE + transactional recurrence service | M3 executes daily edited/finite rules, weekly DST, and monthly last-day semantics | Exotic RRULE combinations are not implied by this row |
| Recurring next occurrence | `VERIFIED` | transactional service/repository recurrence path | M3 proves close→spawn, local-time preservation, deadline shift, month-end, edited rule, finite stop, and rollback recovery | Browser acceptance remains M6 |
| Inbox view | `PARTIAL` | client task view/model + backend filtering | Playwright navigation/tasks | Define exact inclusion/exclusion and prove against persisted data |
| Today view | `VERIFIED` for scheduling inclusion rule | client `home-scheduling.ts` used by Home counters/filter | Node contract proves due-first scheduling and overdue→Today bucketing | Browser acceptance/reload remains M6 |
| Upcoming view | `VERIFIED` for scheduling inclusion rule | client `home-scheduling.ts` used by Home counters/filter | Node contract proves future work remains strictly after Today and due date takes precedence over deadline | Browser ordering/reload remains M6 |
| Overdue behavior | `VERIFIED` for scheduling inclusion rule | Home scheduling bucket | Node contract proves overdue scheduled work remains visible in Today | Browser rendering remains M6 |
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
| Workspaces | `PARTIAL` | account/compat schema/services | compatibility routes + account tests; M2 documents workspace project visibility | M5 must prove membership and permission semantics |
| Workspace invitations | `PARTIAL` | schema/compat/account paths | compatibility auth/error coverage | Add semantic accept/reject/idempotency state assertions |
| Project sharing/collaborators | `PARTIAL` | compatibility layer | workspace project/section visibility is explicit in M2 | M5: prove membership, mutation permissions, collaborator state, UI acceptance |
| Task comments | `PARTIAL` | compatibility comments implementation | routes/cases | Add create/update/delete/list exact-state and tenant tests |
| Durable task assignment | `UNIMPLEMENTED` | absent from canonical task model | M0 model inspection | Model before UI/API claims |
| Activity log | `UNIMPLEMENTED` / placeholder | compatibility action currently returns no meaningful activity data | source inspection | Define event model and persistence before advertising |
| Productivity statistics | `PARTIAL` | compatibility endpoint exists and is task-tenant scoped | M2 scopes the underlying counts; transport coverage exists | Verify formulas and returned values against seeded semantic data |
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
| Cross-tenant task isolation | `VERIFIED` | M1 covers user/workspace lifecycle isolation; M2 proves cross-workspace project/section IDs cannot reposition owned tasks | Fine-grained shared-workspace write permissions remain M5 |
| Organization resource isolation | `VERIFIED` for M2 boundary | M2 semantic contract proves workspace-bounded project/section access, user+workspace labels/tasks, and rejected foreign-workspace movement | Fine-grained membership/write permissions remain M5 |
| Recurring close atomicity | `VERIFIED` | M3 rollback contract proves failed next-occurrence creation does not close the original; open-only close prevents duplicate spawn after the state transition | Cross-process load testing is optional hardening, not a semantic gap |
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

Known M1 deferrals are explicitly retained as `PARTIAL` rows rather than hidden: broader list inclusion/filter rules and later organization/scheduling/browser acceptance work.

### M2 — organization gate — COMPLETE

Completed evidence:

1. Project create/read/update, favorite, archive/unarchive, and delete semantics.
2. Inbox/default-board destructive protections.
3. Section create/read/update/delete and task-reference cleanup.
4. Label create/read/update/delete plus rename/remove effects on linked tasks.
5. Task project/section movement, explicit clearing, section→project consistency, mismatch rejection, and rejected-move non-mutation.
6. Cross-workspace organization-resource isolation and user-scoped task/label isolation.
7. Explicit workspace-resource versus user-resource ownership boundaries.

Collaboration membership and fine-grained shared-workspace write policy intentionally remain M5.

### M3 — scheduling gate — COMPLETE

Completed evidence:

1. Timezone-aware due/deadline normalization, including date-only values and DST transitions.
2. Atomic recurring close + next-occurrence creation with rollback on failure and open-only duplicate-spawn protection.
3. Daily/weekly/monthly recurrence execution across edited rules, DST and month-end boundaries.
4. Finite `COUNT` decrement/termination and `UNTIL` boundary termination.
5. Recurring deadline-lead preservation and schedule-input/label continuity.
6. Explicit service/repository/HTTP clearing for recurrence, due, deadline, and schedule input.
7. Client Today/Upcoming scheduling rules: due date before deadline, overdue included in Today, future work in Upcoming.

Browser acceptance remains M6 and is intentionally not being used to inflate the M3 semantic claims.

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
