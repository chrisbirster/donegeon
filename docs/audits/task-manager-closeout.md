# Task manager semantic audit closeout

Status: **semantic evidence established; human/browser milestone certification in progress**

This document is the release-facing conclusion of the semantic task-manager audit started in `docs/task-manager-audit-plan.md` and detailed in `docs/audits/task-manager-feature-matrix.md`.

The rule for this closeout is simple: **implemented code is not the same thing as supported product behavior**. A backend capability can have strong semantic evidence while its user-facing workflow is still incomplete or undiscoverable. Human/browser certification is therefore tracked separately by `docs/audits/human-verification/` and `web/apps/client/tests/e2e/audit/audit-contract.json`.

The large compatibility YAML suite remains useful regression evidence, but its case count is not a product-support statement.

## Semantic task-manager contract

The following maintained behaviors have meaningful executable evidence at the indicated layer:

| Area | Semantic status | Evidence |
| --- | --- | --- |
| Canonical task create/get/list/update/delete | `VERIFIED` | Go service/repository contracts plus HTTP lifecycle tests |
| Complete/reopen non-recurring tasks | `VERIFIED` | Durable lifecycle and HTTP state assertions |
| Quick Add parsing/create semantics | `VERIFIED` for documented semantic cases | parser/service contracts; browser certification is tracked by M4/M6 |
| Content, description, priority, labels | `VERIFIED` at durable/API layer | backend round trips; browser presentation is milestone evidence |
| Project/section placement and tenant isolation | `VERIFIED` at durable/API layer | organization semantic tests and cross-workspace rejection; this does not imply project/section management is exposed well in the UI |
| Due/deadline normalization and clearing | `VERIFIED` | scheduling contracts including local time/DST plus HTTP tests |
| Recurrence execution | `VERIFIED` | transactional close/spawn, finite recurrence, DST/month-end and rollback tests |
| Inbox/Today/Upcoming scheduling rules | `VERIFIED` for maintained client rules | deterministic client rules; browser certification is tracked separately |

## Browser certification is milestone-based

There is no longer one file whose green status is allowed to stand in for the whole task manager.

The authoritative browser model is:

```text
web/apps/client/tests/e2e/audit/audit-contract.json
web/apps/client/tests/e2e/audit/m1-core-lifecycle.spec.ts
web/apps/client/tests/e2e/audit/m2-organization.spec.ts
web/apps/client/tests/e2e/audit/m3-scheduling.spec.ts
web/apps/client/tests/e2e/audit/m4-quickadd-search.spec.ts
web/apps/client/tests/e2e/audit/m5-collaboration.spec.ts
web/apps/client/tests/e2e/audit/m6-browser-acceptance.spec.ts
```

Every browser-observable human checklist row must map to an exact, non-skipped `[M#] <row>` case. Protected CI runs only the milestones explicitly listed in `certifiedBrowserMilestones`.

A milestone enters that list only after both its automated spec and matching manual human review pass. This means semantic project/section CRUD can remain backend-verified while M2 browser certification is still `NEEDS_WORK`; that is an intentional distinction, not a contradiction.

Application entry remains a separate protected real-auth contract in `web/apps/client/tests/e2e/application-entry.spec.ts`.

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

`POST /api/taskmanager/action` rejects the following retired actions before maintained dispatch:

- `moveProjectToWorkspace`, `moveProjectToPersonal`
- `getWorkspaceActiveProjects`, `getWorkspaceArchivedProjects`, `getProjectCollaborators`
- `getSharedLabels`, `renameSharedLabel`, `removeSharedLabel`
- `getWorkspaces`, `getWorkspaceUsers`
- `getWorkspaceInvitations`, `getAllWorkspaceInvitations`
- `joinWorkspace`, `acceptWorkspaceInvitation`, `rejectWorkspaceInvitation`, `deleteWorkspaceInvitation`
- `getWorkspacePlanDetails`
- `addComment`, `getComment`, `getComments`, `updateComment`, `deleteComment`

Historical implementations/fixtures may remain as regression evidence. They are not maintained product support.

## Evidence hierarchy

1. Canonical Go domain/repository tests prove durable semantics.
2. HTTP semantic tests prove request/authorization/response/persistence contracts.
3. Exact-title milestone Playwright specs prove browser-observable rows from the human checklists.
4. The protected real-auth application-entry gate proves a fresh user can traverse login/onboarding/waitlist boundaries.
5. Manual milestone review decides whether technically working behavior is actually acceptable and discoverable.
6. Compatibility YAML cases are secondary regression evidence only; a passing `2xx` does not promote a capability to product/browser `VERIFIED`.
7. `docs/test-catalog.md` is inventory, not the support matrix.

## Closeout rule for future changes

A task-manager change is release-ready only when the strongest relevant evidence layer remains green **and** any affected manually certified milestone remains valid.

- Backend-only state changes require semantic durable-state assertions.
- HTTP changes require authorization/response/persistence assertions.
- Browser-observable changes update the matching human checklist and exact-title milestone Playwright case.
- If a change invalidates a milestone's human contract, remove/rework certification rather than teaching a stale test to accept the new behavior.
- Login/beta/waitlist/onboarding/protected-routing changes extend the real-auth application-entry suite.
- Compatibility test count is never a proxy for feature completeness.
