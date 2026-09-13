# M3 — Scheduling + reminders human verification

Goal: verify that dates, deadlines, reminders, time zones, recurrence, Today, Upcoming, and overdue behavior match user expectations.

## Session

- Commit: `________________`
- Date: `________________`
- Reviewer: `________________`
- Automated evidence: `________________`
- Final verdict: `NOT_REVIEWED`

## M3 reminder contract

M3 v1 supports one absolute reminder date/time per task. It is stored as a concrete instant and displayed in the user's current timezone. Create, edit, clear, persistence, tenant isolation, and recurring-occurrence shifting are required. Quick Add reminder syntax and relative-to-due reminder expressions are intentionally deferred; users set reminders through Full Add Task or Task Detail.

## Automated edge cases

DST, finite recurrence, month-end rollover, rollback, duplicate-spawn protection, reminder timezone normalization, reminder clear/update, tenant isolation, and recurring reminder shifting should be reviewed through deterministic Go evidence before the browser walkthrough. Human review focuses on whether the resulting product behavior makes sense.

## Human verification

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Set date-only due date | Task displays/buckets on the intended local calendar day | `NOT_REVIEWED` | |
| Set due date/time | Time remains understandable after reload | `NOT_REVIEWED` | |
| Set deadline | Deadline is distinct from due date and shown meaningfully | `NOT_REVIEWED` | |
| Clear due date | Scheduling state visibly clears and remains cleared | `NOT_REVIEWED` | |
| Clear deadline | Deadline visibly clears and remains cleared | `NOT_REVIEWED` | |
| Set reminder | Reminder is understandable, visible in task metadata/detail, and survives reload | `NOT_REVIEWED` | |
| Edit reminder | Updated reminder replaces the previous instant after reload | `NOT_REVIEWED` | |
| Clear reminder | Reminder visibly clears and remains cleared | `NOT_REVIEWED` | |
| Recurring reminder follows next occurrence | Completing a recurring task shifts its reminder by the same due/reminder offset | `NOT_REVIEWED` | |
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

## Accessibility smoke check

- [ ] All scheduling/reminder inputs have understandable accessible names.
- [ ] Keyboard-only users can set, edit, clear, save, and dismiss scheduling controls.
- [ ] Focus remains visible and trapped correctly inside Task Detail / Create Task dialogs.
- [ ] VoiceOver announces reminder, due, deadline, recurrence, Save changes, and clear controls naturally.

## Product questions

- [ ] Today including overdue work is the behavior we want.
- [ ] Upcoming being future-only is the behavior we want.
- [ ] Due date vs deadline terminology is clear enough.
- [ ] Reminder terminology and its one-instant v1 behavior are understandable.
- [ ] Deferring Quick Add reminder syntax to a later parser milestone is acceptable.
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
