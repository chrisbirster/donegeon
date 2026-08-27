# M3 — Scheduling human verification

Goal: verify that dates, deadlines, time zones, recurrence, Today, Upcoming, and overdue behavior match user expectations.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Automated evidence: `________________`
- Final verdict: `NOT_REVIEWED`

## Automated edge cases

DST, finite recurrence, month-end rollover, rollback, and duplicate-spawn protection should be reviewed through deterministic Go evidence before the browser walkthrough. Human review focuses on whether the resulting product behavior makes sense.

## Human verification

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Set date-only due date | Task displays/buckets on the intended local calendar day | `NOT_REVIEWED` | |
| Set due date/time | Time remains understandable after reload | `NOT_REVIEWED` | |
| Set deadline | Deadline is distinct from due date and shown meaningfully | `NOT_REVIEWED` | |
| Clear due date | Scheduling state visibly clears and remains cleared | `NOT_REVIEWED` | |
| Clear deadline | Deadline visibly clears and remains cleared | `NOT_REVIEWED` | |
| Create daily recurrence | Rule shown to user matches intended cadence | `NOT_REVIEWED` | |
| Create weekly recurrence | Rule shown to user matches intended cadence | `NOT_REVIEWED` | |
| Create monthly recurrence | Rule shown to user matches intended cadence | `NOT_REVIEWED` | |
| Complete recurring task | Current occurrence completes and exactly one next occurrence appears | `NOT_REVIEWED` | |
| Reload recurring result | Next occurrence remains durable | `NOT_REVIEWED` | |
| Edit recurrence | Future occurrence uses the edited rule | `NOT_REVIEWED` | |
| Clear recurrence | Task stops recurring | `NOT_REVIEWED` | |
| Overdue task | Remains visible in Today according to current contract | `NOT_REVIEWED` | |
| Today task | Appears in Today and not unexpectedly elsewhere | `NOT_REVIEWED` | |
| Future task | Appears in Upcoming according to current rules | `NOT_REVIEWED` | |
| Due + deadline together | Due date drives scheduling bucket; deadline remains secondary metadata | `NOT_REVIEWED` | |

## Product questions

- [ ] Today including overdue work is the behavior we want.
- [ ] Upcoming being future-only is the behavior we want.
- [ ] Due date vs deadline terminology is clear enough.
- [ ] Recurrence text is understandable without knowing RRULE syntax.
- [ ] Completing a recurring task feels natural rather than surprising.

## M3 exit decision

- [ ] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

1. `________________`
2. `________________`
3. `________________`