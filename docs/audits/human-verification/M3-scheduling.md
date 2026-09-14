# M3 — Scheduling + reminders human verification

Goal: verify that dates, deadlines, reminders, time zones, recurrence, Today, Upcoming, and overdue behavior match user expectations.

## Session

- Commit: `039a25861693190153fdd1d960cdc29ac00fa11b`
- Date: `2026-09-13`
- Reviewer: `Chris Birster`
- Automated evidence: M3 Remediation Audit #7 (`34737566736`) — 20/20 Playwright cases passed with retries disabled; protected CI #248 (`34737566769`) — PASS
- Final verdict: `PASS`

## M3 reminder contract

M3 v1 supports one absolute reminder date/time per task. It is stored as a concrete instant and displayed in the user's current timezone. Create, edit, clear, persistence, tenant isolation, and recurring-occurrence shifting are required. Quick Add reminder syntax and relative-to-due reminder expressions are intentionally deferred; users set reminders through Full Add Task or Task Detail.

## Automated edge cases

DST, finite recurrence, month-end rollover, rollback, duplicate-spawn protection, reminder timezone normalization, reminder clear/update, tenant isolation, and recurring reminder shifting were covered by deterministic Go evidence before the browser walkthrough. Human review focused on whether the resulting product behavior made sense.

## Human verification

| Flow | Expected behavior | Verdict | Notes |
| --- | --- | --- | --- |
| Set date-only due date | Task displays/buckets on the intended local calendar day | `PASS` | Human verified. |
| Set due date/time | Time remains understandable after reload | `PASS` | Human verified. |
| Set deadline | Deadline is distinct from due date and shown meaningfully | `PASS` | Human verified. |
| Clear due date | Scheduling state visibly clears and remains cleared | `PASS` | Human verified. |
| Clear deadline | Deadline visibly clears and remains cleared | `PASS` | Human verified. |
| Set reminder | Reminder is understandable, visible in task metadata/detail, and survives reload | `PASS` | Human verified. |
| Edit reminder | Updated reminder replaces the previous instant after reload | `PASS` | Human verified. |
| Clear reminder | Reminder visibly clears and remains cleared | `PASS` | Human verified. |
| Recurring reminder follows next occurrence | Completing a recurring task shifts its reminder by the same due/reminder offset | `PASS` | Human verified. |
| Create daily recurrence | Rule shown to user matches intended cadence | `PASS` | Human verified. |
| Create weekly recurrence | Rule shown to user matches intended cadence | `PASS` | Human verified. |
| Create monthly recurrence | Rule shown to user matches intended cadence | `PASS` | Human verified. |
| Complete recurring task | Current occurrence completes and exactly one next occurrence appears | `PASS` | Human verified. |
| Reload recurring result | Next occurrence remains durable | `PASS` | Human verified. |
| Edit recurrence | Future occurrence uses the edited rule | `PASS` | Human verified. |
| Clear recurrence | Task stops recurring | `PASS` | Human verified. |
| Overdue task | Remains visible in Today according to current contract | `PASS` | Human verified. |
| Today task | Appears in Today and not unexpectedly elsewhere | `PASS` | Human verified. |
| Future task | Appears in Upcoming according to current rules | `PASS` | Human verified. |
| Due + deadline together | Due date drives scheduling bucket; deadline remains secondary metadata | `PASS` | Human verified. |

## Accessibility smoke check

- [x] All scheduling/reminder inputs have understandable accessible names.
- [x] Keyboard-only users can set, edit, clear, save, and dismiss scheduling controls.
- [x] Focus remains visible and trapped correctly inside Task Detail / Create Task dialogs.
- [x] VoiceOver announces reminder, due, deadline, recurrence, Save changes, and clear controls naturally.

## Product questions

- [x] Today including overdue work is the behavior we want.
- [x] Upcoming being future-only is the behavior we want.
- [x] Due date vs deadline terminology is clear enough.
- [x] Reminder terminology and its one-instant v1 behavior are understandable.
- [x] Deferring Quick Add reminder syntax to a later parser milestone is acceptable.
- [x] Recurrence text is understandable without knowing RRULE syntax.
- [x] Completing a recurring task feels natural rather than surprising.

## M3 exit decision

- [x] `PASS`
- [ ] `NEEDS_WORK`
- [ ] `FAIL`

### Findings / follow-up

No blocking findings remained after the human walkthrough. M3 is eligible for certification in the protected browser set.
