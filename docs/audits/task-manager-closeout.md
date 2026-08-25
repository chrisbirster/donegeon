# Task manager semantic audit closeout

Status: **M7 complete when this branch is green and merged**

This document is the release-facing conclusion of the task-manager audit started in `docs/task-manager-audit-plan.md` and detailed in `docs/audits/task-manager-feature-matrix.md`.

The rule for this closeout is simple: **implemented code is not the same thing as supported product behavior**. A capability is listed as verified only when an executable test proves meaningful state/result semantics. The large compatibility YAML suite remains useful regression evidence, but its case count is not a product-support statement.

## Release-gated task-manager contract

The following behaviors are supported by the maintained product model and have semantic evidence:

| Area | Status | Release evidence |
| --- | --- | --- |
| Canonical task create/get/list/update/delete | `VERIFIED` | Go service/repository contracts plus HTTP lifecycle tests |
| Complete/reopen non-recurring tasks | `VERIFIED` | Durable lifecycle and HTTP state assertions |
| Quick Add create and parsed metadata | `VERIFIED` | parser/service tests plus M6 browser POST → persistence → UI checks |
| Content, description, priority, labels | `VERIFIED` | backend round trips plus M6 detail assertions |
| Project/section placement and tenant isolation | `VERIFIED` | organization semantic tests and cross-workspace rejection |
| Due/deadline normalization and clearing | `VERIFIED` | scheduling contracts including local time/DST plus HTTP tests |
| Recurrence execution | `VERIFIED` | transactional close/spawn, finite recurrence, DST/month-end and rollback tests |
| Inbox/Today/Upcoming scheduling rules | `VERIFIED` for maintained rules | client rule tests; M6 proves persisted browser hydration/search workflow |
| Search/detail after reload | `VERIFIED` | M6 Chromium acceptance against real Go server and SQLite |
| Mobile add/search/detail/complete core flow | `VERIFIED` | M6 Chromium responsive acceptance |
| Browser mutation hydration | `VERIFIED` | M6 specifically proves successful mutations become visible and survive reload |

The authoritative browser acceptance is `web/apps/client/tests/e2e/task-manager-audit.spec.ts`. CI runs it as the `Browser acceptance` job against a real Go process, temporary SQLite database, Vite client, and Chromium.

## Intentionally not advertised as supported

| Capability | Status | Reason |
| --- | --- | --- |
| Durable assignee on a task | `UNIMPLEMENTED` | parser syntax exists, canonical task model has no assignee field |
| Subtasks / parent-child tasks | `UNIMPLEMENTED` | no canonical parent relationship exists |
| Reminders | `UNIMPLEMENTED` | no maintained reminder model/provider exists |
| Task uploads / attachments | `UNIMPLEMENTED` | compatibility upload actions are intentionally skipped/not implemented |
| Legacy TaskManager comments | `RETIRED` | compatibility SQL is not the maintained tenant-scoped collaboration model |
| Legacy workspace membership/invitations | `RETIRED` | authoritative team/account APIs own membership and invitation behavior |
| Legacy project-to-workspace/personal moves | `RETIRED` | compatibility semantics conflict with the maintained workspace/tenant model |
| Legacy collaborator/shared-label shims | `RETIRED` | use maintained team/board-member/project/label product APIs instead |

## Retired compatibility HTTP actions

`POST /api/taskmanager/action` now rejects the following before dispatching to the compatibility service:

- `moveProjectToWorkspace`, `moveProjectToPersonal`
- `getWorkspaceActiveProjects`, `getWorkspaceArchivedProjects`, `getProjectCollaborators`
- `getSharedLabels`, `renameSharedLabel`, `removeSharedLabel`
- `getWorkspaces`, `getWorkspaceUsers`
- `getWorkspaceInvitations`, `getAllWorkspaceInvitations`
- `joinWorkspace`, `acceptWorkspaceInvitation`, `rejectWorkspaceInvitation`, `deleteWorkspaceInvitation`
- `getWorkspacePlanDetails`
- `addComment`, `getComment`, `getComments`, `updateComment`, `deleteComment`

The old implementations and YAML fixtures may remain temporarily as historical compatibility evidence. They are not reachable through the maintained HTTP compatibility endpoint and must not be counted as supported collaboration features. Removing the dead implementations/fixtures later is cleanup, not a prerequisite for this support boundary.

## Evidence hierarchy

1. Canonical Go domain/repository tests prove durable semantics.
2. HTTP semantic tests prove request/authorization/response/persistence contracts.
3. The M6 browser gate proves the supported user journey across client + HTTP + SQLite.
4. Compatibility YAML cases are secondary regression evidence only; a passing `2xx` does not promote a capability to `VERIFIED`.
5. `docs/test-catalog.md` inventories executable tests. It does **not** override the support statuses in this closeout or the feature matrix.

## Closeout rule for future changes

A task-manager change is release-ready only when the strongest relevant layer remains green. New user-visible lifecycle/scheduling behavior should extend the M6 browser audit or add an equally authoritative acceptance spec; new backend-only behavior needs semantic durable-state assertions. Compatibility case count must never be used as a proxy for feature completeness.
