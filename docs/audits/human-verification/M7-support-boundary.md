# M7 — Support boundary human verification

Goal: verify that Donegeon tells the truth about what it supports, what it has retired, and what it has not implemented.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Automated evidence: `________________`
- Final verdict: `NOT_REVIEWED`

## Supported behavior review

- [ ] Core task lifecycle claims match what was observed in M1.
- [ ] Organization claims match what was observed in M2.
- [ ] Scheduling/recurrence claims match what was observed in M3.
- [ ] Quick Add/search claims match what was observed in M4.
- [ ] Collaboration/calendar claims match what was observed in M5.
- [ ] Browser support claims match what was observed in M6.

## Retired behavior review

Each retired compatibility action should remain unreachable through the maintained HTTP compatibility endpoint.

| Area | Expected | Verdict | Notes |
| --- | --- | --- | --- |
| Legacy comments | Rejected/retired | `NOT_REVIEWED` | |
| Legacy workspace membership/invitations | Rejected/retired | `NOT_REVIEWED` | |
| Legacy personal/workspace project moves | Rejected/retired | `NOT_REVIEWED` | |
| Legacy collaborator/shared-label shims | Rejected/retired | `NOT_REVIEWED` | |

## Unimplemented behavior review

| Feature | Expected | Verdict | Notes |
| --- | --- | --- | --- |
| Durable assignee | Not advertised as supported | `NOT_REVIEWED` | |
| Subtasks | Not advertised as supported | `NOT_REVIEWED` | |
| Reminders | Not advertised as supported | `NOT_REVIEWED` | |
| Attachments/uploads | Not advertised as supported | `NOT_REVIEWED` | |

## Test-quality review

- [ ] Generated compatibility test count is not presented as feature completeness.
- [ ] Retired YAML fixtures are clearly historical/regression evidence only.
- [ ] Semantic Go/API/browser tests are the evidence used for support claims.
- [ ] No known duplicate/shallow test is being cited as unique product proof.
- [ ] `docs/test-catalog.md` is treated as inventory, not support matrix.

## M7 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`