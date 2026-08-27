# M0 — Feature inventory human verification

Milestone goal: confirm that Donegeon's task-manager support inventory is truthful before manually validating behavior.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Automated evidence reviewed: `________________`
- Final verdict: `NOT_REVIEWED`

## How to review M0

M0 is primarily an inventory review, not a browser exercise. For every row below, answer two questions:

1. Is this capability correctly classified as supported, retired, unimplemented, or intentionally partial?
2. Is there any user-visible task-manager capability missing from the inventory?

A green test does not decide the human answer to either question.

## A. Supported core task behavior

| Capability | Current contract | Human verdict | Notes |
| --- | --- | --- | --- |
| Create task | `VERIFIED` | `NOT_REVIEWED` | |
| Get/read task | `VERIFIED` | `NOT_REVIEWED` | |
| List tasks | maintained core behavior | `NOT_REVIEWED` | |
| Edit content/title | `VERIFIED` | `NOT_REVIEWED` | |
| Edit description | `VERIFIED` | `NOT_REVIEWED` | |
| Delete task | `VERIFIED` | `NOT_REVIEWED` | |
| Complete task | `VERIFIED` | `NOT_REVIEWED` | |
| Reopen task | `VERIFIED` | `NOT_REVIEWED` | |
| Reorder tasks | `VERIFIED` | `NOT_REVIEWED` | |
| Persistence after reload/restart | `VERIFIED` for audited flows | `NOT_REVIEWED` | |
| User/workspace task isolation | `VERIFIED` | `NOT_REVIEWED` | |

### M0 questions

- [ ] This is the complete intended core lifecycle for the current product.
- [ ] No core capability is listed as supported merely because a route exists.
- [ ] No important core capability is missing.

## B. Supported task metadata

| Capability | Current contract | Human verdict | Notes |
| --- | --- | --- | --- |
| Content/title | `VERIFIED` | `NOT_REVIEWED` | |
| Description | `VERIFIED` | `NOT_REVIEWED` | |
| Priority 1–4 | `VERIFIED` | `NOT_REVIEWED` | |
| Project assignment | `VERIFIED` | `NOT_REVIEWED` | |
| Section assignment | `VERIFIED` | `NOT_REVIEWED` | |
| Labels | `VERIFIED` for maintained backend behavior | `NOT_REVIEWED` | |
| Due date/time | `VERIFIED` for maintained scheduling rules | `NOT_REVIEWED` | |
| Deadline | `VERIFIED` for maintained scheduling rules | `NOT_REVIEWED` | |
| Recurrence | `VERIFIED` for supported execution matrix | `NOT_REVIEWED` | |
| Schedule/original input | maintained persistence behavior | `NOT_REVIEWED` | |
| Checked/completed state | `VERIFIED` | `NOT_REVIEWED` | |

### M0 questions

- [ ] These fields match what we want users to think of as a Donegeon task today.
- [ ] There is no hidden maintained field that should appear here.
- [ ] No parser-only field is being confused with durable task state.

## C. Organization

| Capability | Current contract | Human verdict | Notes |
| --- | --- | --- | --- |
| Projects | maintained | `NOT_REVIEWED` | create/read/update/archive/unarchive/delete/favorite |
| Sections | maintained | `NOT_REVIEWED` | CRUD + task placement |
| Labels | maintained | `NOT_REVIEWED` | CRUD + task links |
| Inbox/default behavior | maintained with protected destructive operations | `NOT_REVIEWED` | |
| Task moves between project/section | `VERIFIED` | `NOT_REVIEWED` | |
| Project deletion orphan policy | `VERIFIED` | `NOT_REVIEWED` | task survives; project/section refs clear |
| Section deletion orphan policy | `VERIFIED` | `NOT_REVIEWED` | project remains; section ref clears |

### M0 questions

- [ ] This organization model matches the intended product mental model.
- [ ] Project/section/label ownership semantics make sense to a human reviewer.
- [ ] Delete/archive behavior is something we actually want users to experience.

## D. Scheduling and views

| Capability | Current contract | Human verdict | Notes |
| --- | --- | --- | --- |
| Relative due parsing | maintained | `NOT_REVIEWED` | |
| Calendar/date parsing | maintained | `NOT_REVIEWED` | |
| Deadlines | maintained | `NOT_REVIEWED` | |
| Daily/weekly/monthly recurrence | maintained | `NOT_REVIEWED` | |
| Next recurring occurrence | `VERIFIED` | `NOT_REVIEWED` | transactional close/spawn |
| DST-safe recurrence | `VERIFIED` | `NOT_REVIEWED` | |
| Month-end recurrence | `VERIFIED` | `NOT_REVIEWED` | |
| Finite `COUNT` / `UNTIL` | `VERIFIED` | `NOT_REVIEWED` | |
| Today inclusion rules | maintained | `NOT_REVIEWED` | overdue work buckets into Today |
| Upcoming inclusion rules | maintained | `NOT_REVIEWED` | future work only |
| Search/detail after reload | `VERIFIED` | `NOT_REVIEWED` | |

### M0 questions

- [ ] The Today/Upcoming behavior matches what we want users to expect.
- [ ] Due date and deadline are conceptually distinct in a useful way.
- [ ] The recurrence subset we support is understandable and sufficient for the current product.

## E. Quick Add and discovery

| Capability | Current contract | Human verdict | Notes |
| --- | --- | --- | --- |
| Plain Quick Add | `VERIFIED` | `NOT_REVIEWED` | |
| Project token parsing | maintained | `NOT_REVIEWED` | |
| Label token parsing | maintained | `NOT_REVIEWED` | |
| Priority parsing | maintained | `NOT_REVIEWED` | |
| Description parsing | maintained | `NOT_REVIEWED` | |
| Due/deadline parsing | maintained | `NOT_REVIEWED` | |
| Recurrence parsing | maintained | `NOT_REVIEWED` | |
| Browser preview vs server save parity | audited | `NOT_REVIEWED` | |
| Text search | maintained | `NOT_REVIEWED` | content/description/project-name browser semantics |
| Compatibility filter API | maintained narrow contract | `NOT_REVIEWED` | distinct from browser search |

### M0 questions

- [ ] Quick Add syntax is understandable enough to expose publicly.
- [ ] Browser search semantics are the semantics we actually want.
- [ ] Parser behavior and durable task capabilities are not being conflated.

## F. Maintained collaboration and integration behavior

| Capability | Current contract | Human verdict | Notes |
| --- | --- | --- | --- |
| Workspace/account roles | maintained canonical APIs | `NOT_REVIEWED` | |
| Workspace invitations | maintained canonical APIs | `NOT_REVIEWED` | not legacy compatibility shims |
| Google Calendar connection | maintained | `NOT_REVIEWED` | |
| Calendar sync tenant isolation | maintained | `NOT_REVIEWED` | |

### M0 questions

- [ ] These are the collaboration/integration capabilities we actually want to support now.
- [ ] Canonical account/team/calendar APIs—not legacy compatibility SQL—are the product source of truth.

## G. Explicitly unimplemented

These must **not** be advertised as supported simply because syntax or old fixtures exist.

| Capability | Current contract | Human verdict | Notes |
| --- | --- | --- | --- |
| Durable task assignee | `UNIMPLEMENTED` | `NOT_REVIEWED` | parser syntax exists, no canonical field |
| Subtasks / parent-child tasks | `UNIMPLEMENTED` | `NOT_REVIEWED` | |
| Reminders | `UNIMPLEMENTED` | `NOT_REVIEWED` | |
| Task attachments/uploads | `UNIMPLEMENTED` | `NOT_REVIEWED` | |

### M0 questions

- [ ] We agree these features are not part of the current release contract.
- [ ] Product copy/UI does not imply that any of them work.

## H. Explicitly retired legacy compatibility behavior

| Capability | Current contract | Human verdict | Notes |
| --- | --- | --- | --- |
| Legacy TaskManager comments | `RETIRED` | `NOT_REVIEWED` | |
| Legacy workspace membership/invitations | `RETIRED` | `NOT_REVIEWED` | |
| Legacy project personal/workspace moves | `RETIRED` | `NOT_REVIEWED` | |
| Legacy collaborator/shared-label shims | `RETIRED` | `NOT_REVIEWED` | |

### M0 questions

- [ ] We agree these compatibility actions should remain unavailable.
- [ ] Historical YAML/tests are not being interpreted as product support.

## I. Inventory completeness challenge

Before passing M0, actively try to disprove the inventory.

- [ ] Check the current UI navigation for a task-manager feature not represented above.
- [ ] Check task detail controls for a field not represented above.
- [ ] Check Quick Add syntax/help for a feature not represented above.
- [ ] Check account/workspace/calendar screens for a maintained workflow not represented above.
- [ ] Check the feature matrix for duplicate capabilities represented under multiple names.
- [ ] Check for a capability marked `VERIFIED` whose strongest evidence is only `2xx` compatibility coverage.
- [ ] Check for a retired/unimplemented feature that is still advertised in UI or docs.

## M0 exit decision

M0 passes only when the human reviewer agrees that the inventory itself is truthful.

- [ ] `PASS` — inventory matches the intended current product.
- [ ] `NEEDS_WORK` — inventory is mostly right but classifications or product wording need changes.
- [ ] `FAIL` — important maintained behavior is missing/misclassified.

### Findings / follow-up

Record every discrepancy here before moving to M1:

1. `________________`
2. `________________`
3. `________________`

### Follow-up issues / PRs

- `________________`