# M1 — Core lifecycle human verification

Goal: confirm the core task lifecycle feels correct to a human and matches durable/API evidence.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Automated evidence: `________________`
- Final verdict: `NOT_REVIEWED`

## Automated proof to review first

Expected evidence includes the canonical service lifecycle contract, HTTP lifecycle contract, and browser acceptance where the workflow is user-visible.

## Human verification

For each flow, verify the immediate UI state and then reload before declaring `PASS`.

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Create task | New task appears immediately with entered content | `NOT_REVIEWED` | |
| Reload after create | Same task remains | `NOT_REVIEWED` | |
| Open task detail | Correct task and fields appear | `NOT_REVIEWED` | |
| Edit title | Saved title appears immediately and after reload | `NOT_REVIEWED` | |
| Edit description | Saved description appears immediately and after reload | `NOT_REVIEWED` | |
| Cancel an edit | Original value remains | `NOT_REVIEWED` | |
| Complete task | Task leaves the active view according to current rules | `NOT_REVIEWED` | |
| Reload after complete | Completed state remains durable | `NOT_REVIEWED` | |
| Reopen task | Task becomes active again without losing unrelated fields | `NOT_REVIEWED` | |
| Delete task | Task disappears and cannot be reopened by normal UI navigation | `NOT_REVIEWED` | |
| Reload after delete | Deleted task remains absent | `NOT_REVIEWED` | |
| Reorder tasks | Order changes predictably | `NOT_REVIEWED` | |
| Reload after reorder | Order remains durable | `NOT_REVIEWED` | |
| Validation | Empty/invalid mutations give useful feedback and do not corrupt state | `NOT_REVIEWED` | |

## Product questions

- [ ] Completion behavior matches the mental model we want.
- [ ] Reopen behavior is discoverable enough.
- [ ] Delete behavior/confirmation is acceptable.
- [ ] Reorder interaction feels intentional rather than accidental.
- [ ] Error feedback is understandable.

## M1 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`