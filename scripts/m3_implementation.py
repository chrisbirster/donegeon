from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace(path: str, old: str, new: str, expected: int = 1) -> None:
    text = read(path)
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} occurrence(s), found {count}: {old[:80]!r}")
    write(path, text.replace(old, new))


def append_before_final(path: str, marker: str, addition: str) -> None:
    text = read(path)
    index = text.rfind(marker)
    if index < 0:
        raise SystemExit(f"{path}: final marker not found")
    write(path, text[:index] + addition + text[index:])


# --- database -----------------------------------------------------------------
write("internal/database/migrations/000017_task_reminder_at.up.sql", "ALTER TABLE tasks ADD COLUMN reminder_at TEXT;\n")
write("internal/database/migrations/000017_task_reminder_at.down.sql", "ALTER TABLE tasks DROP COLUMN reminder_at;\n")

replace(
    "internal/database/queries/task_create.sql",
    "    due_deadline,\n    schedule_input,\n",
    "    due_deadline,\n    reminder_at,\n    schedule_input,\n",
)
replace(
    "internal/database/queries/task_create.sql",
    "    :due_deadline,\n    :schedule_input,\n",
    "    :due_deadline,\n    :reminder_at,\n    :schedule_input,\n",
)
replace(
    "internal/database/queries/task_get.sql",
    "    due_deadline,\n    schedule_input,\n",
    "    due_deadline,\n    reminder_at,\n    schedule_input,\n",
)
replace(
    "internal/database/queries/task_list.sql",
    "    due_deadline,\n    schedule_input,\n",
    "    due_deadline,\n    reminder_at,\n    schedule_input,\n",
)
replace(
    "internal/database/queries/task_update.sql",
    "    due_deadline = CASE\n        WHEN :clear_due_deadline = 1 THEN NULL\n        ELSE COALESCE(:due_deadline, due_deadline)\n    END,\n    schedule_input = CASE\n",
    "    due_deadline = CASE\n        WHEN :clear_due_deadline = 1 THEN NULL\n        ELSE COALESCE(:due_deadline, due_deadline)\n    END,\n    reminder_at = CASE\n        WHEN :clear_reminder_at = 1 THEN NULL\n        ELSE COALESCE(:reminder_at, reminder_at)\n    END,\n    schedule_input = CASE\n",
)

# --- task domain ---------------------------------------------------------------
replace(
    "internal/task/task.go",
    "\tDueDeadline    *string  `db:\"due_deadline\" json:\"dueDeadline,omitempty\"`\n\tScheduleInput  *string  `db:\"schedule_input\" json:\"scheduleInput,omitempty\"`\n",
    "\tDueDeadline    *string  `db:\"due_deadline\" json:\"dueDeadline,omitempty\"`\n\tReminderAt     *string  `db:\"reminder_at\" json:\"reminderAt,omitempty\"`\n\tScheduleInput  *string  `db:\"schedule_input\" json:\"scheduleInput,omitempty\"`\n",
)
replace(
    "internal/task/task.go",
    "\tDueDeadline   *string\n\tScheduleInput *string\n",
    "\tDueDeadline   *string\n\tReminderAt    *string\n\tScheduleInput *string\n",
)
replace(
    "internal/task/task.go",
    "\tDueDeadline        *string\n\tClearDueDeadline   bool\n\tScheduleInput      *string\n",
    "\tDueDeadline        *string\n\tClearDueDeadline   bool\n\tReminderAt         *string\n\tClearReminderAt    bool\n\tScheduleInput      *string\n",
)

replace(
    "internal/task/repository.go",
    "\t\t\"due_deadline\":    nullableString(in.DueDeadline),\n\t\t\"schedule_input\":  nullableString(in.ScheduleInput),\n",
    "\t\t\"due_deadline\":    nullableString(in.DueDeadline),\n\t\t\"reminder_at\":     nullableString(in.ReminderAt),\n\t\t\"schedule_input\":  nullableString(in.ScheduleInput),\n",
    expected=2,
)
replace(
    "internal/task/repository.go",
    "\t\t\"due_deadline\":         nullableString(in.DueDeadline),\n\t\t\"clear_due_deadline\":   boolToInt(in.ClearDueDeadline),\n\t\t\"schedule_input\":       nullableString(in.ScheduleInput),\n",
    "\t\t\"due_deadline\":         nullableString(in.DueDeadline),\n\t\t\"clear_due_deadline\":   boolToInt(in.ClearDueDeadline),\n\t\t\"reminder_at\":          nullableString(in.ReminderAt),\n\t\t\"clear_reminder_at\":    boolToInt(in.ClearReminderAt),\n\t\t\"schedule_input\":       nullableString(in.ScheduleInput),\n",
)

replace(
    "internal/task/recurrence_schedule.go",
    "func normalizeDeadline(value *string, timezone string, now time.Time) *string {\n\tif value == nil {\n\t\treturn nil\n\t}\n\n\traw := strings.TrimSpace(*value)\n\tif raw == \"\" {\n\t\treturn nil\n\t}\n\n\treturn normalizeTemporalValue(value, timezone, now)\n}\n",
    "func normalizeDeadline(value *string, timezone string, now time.Time) *string {\n\tif value == nil {\n\t\treturn nil\n\t}\n\n\traw := strings.TrimSpace(*value)\n\tif raw == \"\" {\n\t\treturn nil\n\t}\n\n\treturn normalizeTemporalValue(value, timezone, now)\n}\n\n// normalizeReminderAt resolves a reminder into one concrete instant. Unlike\n// due/deadline text, reminder values are strict because a notification must not\n// silently retain an unparseable wall-clock expression.\nfunc normalizeReminderAt(value *string, timezone string, now time.Time) (*string, bool) {\n\tif value == nil {\n\t\treturn nil, true\n\t}\n\traw := strings.TrimSpace(*value)\n\tif raw == \"\" {\n\t\treturn nil, true\n\t}\n\tloc := locationFromTimezone(timezone)\n\tparsed, ok := resolveTemporalText(raw, loc, now.In(loc))\n\tif !ok {\n\t\treturn nil, false\n\t}\n\treturn strPtr(parsed.Format(time.RFC3339)), true\n}\n",
)

replace(
    "internal/task/service.go",
    "\tin.DueText = normalizeDueText(in.DueText, timezoneFromContext(ctx), s.nowFn())\n\tin.DueDeadline = normalizeDeadline(in.DueDeadline, timezoneFromContext(ctx), s.nowFn())\n",
    "\tin.DueText = normalizeDueText(in.DueText, timezoneFromContext(ctx), s.nowFn())\n\tin.DueDeadline = normalizeDeadline(in.DueDeadline, timezoneFromContext(ctx), s.nowFn())\n\tnormalizedReminder, reminderOK := normalizeReminderAt(in.ReminderAt, timezoneFromContext(ctx), s.nowFn())\n\tif !reminderOK {\n\t\treturn Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, \"invalid reminder date/time\"), \"reminderAt\")\n\t}\n\tin.ReminderAt = normalizedReminder\n",
    expected=2,
)
replace(
    "internal/task/service.go",
    "\tnextDue := normalizeDueText(strPtr(nextDueText), timezoneFromContext(ctx), anchor)\n\tnextDeadline := shiftRecurringDeadline(current.DueText, current.DueDeadline, nextDue, timezoneFromContext(ctx))\n\n\treturn s.repo.CloseRecurringAndCreateNext(ctx, id, CreateInput{\n",
    "\tnextDue := normalizeDueText(strPtr(nextDueText), timezoneFromContext(ctx), anchor)\n\tnextDeadline := shiftRecurringDeadline(current.DueText, current.DueDeadline, nextDue, timezoneFromContext(ctx))\n\tnextReminder := shiftRecurringReminder(current.DueText, current.ReminderAt, nextDue, timezoneFromContext(ctx))\n\n\treturn s.repo.CloseRecurringAndCreateNext(ctx, id, CreateInput{\n",
)
replace(
    "internal/task/service.go",
    "\t\tDueDeadline:   nextDeadline,\n\t\tScheduleInput: current.ScheduleInput,\n",
    "\t\tDueDeadline:   nextDeadline,\n\t\tReminderAt:    nextReminder,\n\t\tScheduleInput: current.ScheduleInput,\n",
)
replace(
    "internal/task/service.go",
    "func (s *Service) Reopen(ctx context.Context, id string) error {\n",
    "func shiftRecurringReminder(currentDue, currentReminder, nextDue *string, timezone string) *string {\n\tif currentReminder == nil || currentDue == nil || nextDue == nil {\n\t\treturn nil\n\t}\n\tloc := locationFromTimezone(timezone)\n\tcurrentDueTime, dueOK := parseDueAnchor(*currentDue, loc)\n\tcurrentReminderTime, reminderOK := parseDueAnchor(*currentReminder, loc)\n\tnextDueTime, nextDueOK := parseDueAnchor(*nextDue, loc)\n\tif !dueOK || !reminderOK || !nextDueOK {\n\t\treturn nil\n\t}\n\tshifted := nextDueTime.Add(currentReminderTime.Sub(currentDueTime)).In(loc)\n\treturn strPtr(shifted.Format(time.RFC3339))\n}\n\nfunc (s *Service) Reopen(ctx context.Context, id string) error {\n",
)
replace(
    "internal/task/service.go",
    "\titem.DueText = normalizeDueText(item.DueText, timezoneFromContext(ctx), s.deadlineAnchor(*item))\n\titem.DueDeadline = normalizeDeadline(item.DueDeadline, timezoneFromContext(ctx), s.deadlineAnchor(*item))\n",
    "\titem.DueText = normalizeDueText(item.DueText, timezoneFromContext(ctx), s.deadlineAnchor(*item))\n\titem.DueDeadline = normalizeDeadline(item.DueDeadline, timezoneFromContext(ctx), s.deadlineAnchor(*item))\n\tif reminder, ok := normalizeReminderAt(item.ReminderAt, timezoneFromContext(ctx), s.deadlineAnchor(*item)); ok {\n\t\titem.ReminderAt = reminder\n\t}\n",
)

# --- HTTP ----------------------------------------------------------------------
replace(
    "internal/httpapi/server_04.go",
    "\t\tDueDeadline   *string  `json:\"dueDeadline\"`\n\t\tScheduleInput *string  `json:\"scheduleInput\"`\n",
    "\t\tDueDeadline   *string  `json:\"dueDeadline\"`\n\t\tReminderAt    *string  `json:\"reminderAt\"`\n\t\tScheduleInput *string  `json:\"scheduleInput\"`\n",
    expected=2,
)
replace(
    "internal/httpapi/server_04.go",
    "\t\tDueDeadline:   cleanPtr(req.DueDeadline),\n\t\tScheduleInput: cleanPtr(req.ScheduleInput),\n",
    "\t\tDueDeadline:   cleanPtr(req.DueDeadline),\n\t\tReminderAt:    cleanPtr(req.ReminderAt),\n\t\tScheduleInput: cleanPtr(req.ScheduleInput),\n",
)
replace(
    "internal/httpapi/server_04.go",
    "\t\tDueDeadline:        cleanPtr(req.DueDeadline),\n\t\tClearDueDeadline:   req.DueDeadline != nil && strings.TrimSpace(*req.DueDeadline) == \"\",\n\t\tScheduleInput:      cleanPtr(req.ScheduleInput),\n",
    "\t\tDueDeadline:        cleanPtr(req.DueDeadline),\n\t\tClearDueDeadline:   req.DueDeadline != nil && strings.TrimSpace(*req.DueDeadline) == \"\",\n\t\tReminderAt:         cleanPtr(req.ReminderAt),\n\t\tClearReminderAt:    req.ReminderAt != nil && strings.TrimSpace(*req.ReminderAt) == \"\",\n\t\tScheduleInput:      cleanPtr(req.ScheduleInput),\n",
)

# Extend HTTP scheduling clear contract with reminder create + clear coverage.
replace(
    "internal/httpapi/task_scheduling_contract_test.go",
    "\t\t\"dueDeadline\":    \"2026-09-01T08:00:00-04:00\",\n\t\t\"scheduleInput\":  \"every day at 9am {8am}\",\n",
    "\t\t\"dueDeadline\":    \"2026-09-01T08:00:00-04:00\",\n\t\t\"reminderAt\":     \"2026-09-01T07:30:00-04:00\",\n\t\t\"scheduleInput\":  \"every day at 9am {8am}\",\n",
)
replace(
    "internal/httpapi/task_scheduling_contract_test.go",
    "\tif created.Recurrence == nil || created.DueText == nil || created.DueDeadline == nil || created.ScheduleInput == nil {\n",
    "\tif created.Recurrence == nil || created.DueText == nil || created.DueDeadline == nil || created.ReminderAt == nil || created.ScheduleInput == nil {\n",
)
replace(
    "internal/httpapi/task_scheduling_contract_test.go",
    "\t\t\"dueDeadline\":    \"\",\n\t\t\"scheduleInput\":  \"\",\n",
    "\t\t\"dueDeadline\":    \"\",\n\t\t\"reminderAt\":     \"\",\n\t\t\"scheduleInput\":  \"\",\n",
)
replace(
    "internal/httpapi/task_scheduling_contract_test.go",
    "\tif cleared.Recurrence != nil || cleared.DueText != nil || cleared.DueDeadline != nil || cleared.ScheduleInput != nil {\n",
    "\tif cleared.Recurrence != nil || cleared.DueText != nil || cleared.DueDeadline != nil || cleared.ReminderAt != nil || cleared.ScheduleInput != nil {\n",
)

# Reminder domain contract tests.
write("internal/task/reminder_contract_integration_test.go", r'''package task

import (
    "context"
    "testing"
    "time"

    apperrors "donegeon/internal/errors"
    "donegeon/internal/sessionctx"
)

func TestReminderContractCreateUpdateClearAndCompletion(t *testing.T) {
    t.Parallel()

    service, _ := newSchedulingContractService(t)
    service.nowFn = func() time.Time {
        return time.Date(2026, time.March, 7, 15, 0, 0, 0, time.UTC)
    }
    ctx := WithTimezone(context.Background(), "America/New_York")

    created, err := service.Create(ctx, CreateInput{
        Content:    "Reminder contract",
        Priority:   4,
        DueText:    strPtr("tomorrow at 9am"),
        ReminderAt: strPtr("tomorrow at 8am"),
    })
    if err != nil {
        t.Fatalf("create reminder task: %v", err)
    }
    if got, want := strOrNil(created.ReminderAt), any("2026-03-08T08:00:00-04:00"); got != want {
        t.Fatalf("normalized reminder: got=%v want=%v", got, want)
    }

    updated, err := service.Update(ctx, created.ID, UpdateInput{
        ReminderAt: strPtr("2026-03-09T10:30:00-04:00"),
    })
    if err != nil {
        t.Fatalf("update reminder: %v", err)
    }
    if got, want := strOrNil(updated.ReminderAt), any("2026-03-09T10:30:00-04:00"); got != want {
        t.Fatalf("updated reminder: got=%v want=%v", got, want)
    }

    cleared, err := service.Update(ctx, created.ID, UpdateInput{ClearReminderAt: true})
    if err != nil {
        t.Fatalf("clear reminder: %v", err)
    }
    if cleared.ReminderAt != nil {
        t.Fatalf("reminder clear did not persist: %+v", cleared)
    }

    restored, err := service.Update(ctx, created.ID, UpdateInput{
        ReminderAt: strPtr("2026-03-09T08:00:00-04:00"),
    })
    if err != nil {
        t.Fatalf("restore reminder: %v", err)
    }
    if err := service.Close(ctx, restored.ID); err != nil {
        t.Fatalf("complete reminder task: %v", err)
    }
    list, err := service.List(ctx, ListParams{Limit: 50})
    if err != nil {
        t.Fatalf("list completed reminder task: %v", err)
    }
    if len(list.Items) != 1 || !list.Items[0].Checked || list.Items[0].ReminderAt == nil {
        t.Fatalf("completed reminder audit state: %+v", list.Items)
    }
}

func TestReminderContractRecurringOccurrenceShiftsReminderLeadAcrossDST(t *testing.T) {
    t.Parallel()

    service, _ := newSchedulingContractService(t)
    ctx := WithTimezone(context.Background(), "America/New_York")
    created, err := service.Create(ctx, CreateInput{
        Content:    "Recurring reminder",
        Priority:   4,
        Recurrence: strPtr("FREQ=WEEKLY;INTERVAL=1;BYDAY=SU;BYHOUR=9;BYMINUTE=0"),
        DueText:    strPtr("2026-03-01T09:00:00-05:00"),
        ReminderAt: strPtr("2026-03-01T08:00:00-05:00"),
    })
    if err != nil {
        t.Fatalf("create recurring reminder: %v", err)
    }
    if err := service.Close(ctx, created.ID); err != nil {
        t.Fatalf("close recurring reminder: %v", err)
    }
    _, next := recurringPair(t, service, ctx, created.ID)
    if got, want := strOrNil(next.DueText), any("2026-03-08T09:00:00-04:00"); got != want {
        t.Fatalf("next due: got=%v want=%v", got, want)
    }
    if got, want := strOrNil(next.ReminderAt), any("2026-03-08T08:00:00-04:00"); got != want {
        t.Fatalf("next reminder across DST: got=%v want=%v", got, want)
    }
}

func TestReminderContractRejectsInvalidAndIsolatesTenants(t *testing.T) {
    t.Parallel()

    service, _ := newSchedulingContractService(t)
    ownerCtx := WithTimezone(sessionctx.WithPrincipal(context.Background(), sessionctx.Principal{
        UserID: "reminder-owner", WorkspaceID: "reminder-workspace-a",
    }), "UTC")
    otherCtx := WithTimezone(sessionctx.WithPrincipal(context.Background(), sessionctx.Principal{
        UserID: "reminder-other", WorkspaceID: "reminder-workspace-b",
    }), "UTC")

    if _, err := service.Create(ownerCtx, CreateInput{
        Content: "Invalid reminder", Priority: 4, ReminderAt: strPtr("not-a-date"),
    }); err == nil || !apperrors.IsCode(err, apperrors.CodeValidationError) {
        t.Fatalf("invalid reminder should be validation error: %v", err)
    }

    created, err := service.Create(ownerCtx, CreateInput{
        Content: "Tenant reminder", Priority: 4, ReminderAt: strPtr("2026-09-15T10:00:00Z"),
    })
    if err != nil {
        t.Fatalf("create tenant reminder: %v", err)
    }
    if _, err := service.Get(otherCtx, created.ID); err == nil || !apperrors.IsCode(err, apperrors.CodeNotFound) {
        t.Fatalf("cross-tenant reminder read should be not found: %v", err)
    }
    if _, err := service.Update(otherCtx, created.ID, UpdateInput{ReminderAt: strPtr("2026-09-16T10:00:00Z")}); err == nil || !apperrors.IsCode(err, apperrors.CodeNotFound) {
        t.Fatalf("cross-tenant reminder update should be not found: %v", err)
    }
}
''')

# --- web contracts -------------------------------------------------------------
replace(
    "web/apps/client/src/domain/contracts.ts",
    "  dueText?: string;\n  dueDeadline?: string;\n};\n",
    "  dueText?: string;\n  dueDeadline?: string;\n  reminderAt?: string;\n};\n",
    expected=2,
)
replace(
    "web/apps/client/src/lib/organizationApi.ts",
    "  dueDeadline?: string;\n  recurrenceRule?: string;\n",
    "  dueDeadline?: string;\n  reminderAt?: string;\n  recurrenceRule?: string;\n",
)

# Detail-state integration.
replace(
    "web/apps/client/src/page/HomeControllerState.tsx",
    "  const [detailDueText, setDetailDueText] = createSignal(\"\");\n  const [detailDeadline, setDetailDeadline] = createSignal(\"\");\n",
    "  const [detailDueText, setDetailDueText] = createSignal(\"\");\n  const [detailDeadline, setDetailDeadline] = createSignal(\"\");\n  const [detailReminderAt, setDetailReminderAt] = createSignal(\"\");\n",
)
replace(
    "web/apps/client/src/page/HomeControllerState.tsx",
    "    detailDeadline,\n    setDetailDeadline,\n    detailProjectId,\n",
    "    detailDeadline,\n    setDetailDeadline,\n    detailReminderAt,\n    setDetailReminderAt,\n    detailProjectId,\n",
)
replace(
    "web/apps/client/src/page/HomeController.tsx",
    "    detailDeadline,\n    setDetailDeadline,\n    detailProjectId,\n",
    "    detailDeadline,\n    setDetailDeadline,\n    detailReminderAt,\n    setDetailReminderAt,\n    detailProjectId,\n",
)
replace(
    "web/apps/client/src/page/HomeController.tsx",
    "    setDetailDueText(item.dueText || \"\");\n    setDetailDeadline(item.dueDeadline || \"\");\n",
    "    setDetailDueText(item.dueText || \"\");\n    setDetailDeadline(item.dueDeadline || \"\");\n    setDetailReminderAt(item.reminderAt || \"\");\n",
)
replace(
    "web/apps/client/src/page/HomeController.tsx",
    "        dueText: detailDueText() || parsed?.dueText,\n        dueDeadline: detailDeadline() || parsed?.deadline,\n",
    "        dueText: detailDueText() || parsed?.dueText,\n        dueDeadline: detailDeadline() || parsed?.deadline,\n        reminderAt: detailReminderAt(),\n",
)

# Full Add Task reminder field.
replace(
    "web/apps/client/src/components/task/HomeTaskCreateModal.tsx",
    "  const [due, setDue] = createSignal(\"\");\n  const [deadline, setDeadline] = createSignal(\"\");\n  const [recurrence, setRecurrence] = createSignal(\"\");\n",
    "  const [due, setDue] = createSignal(\"\");\n  const [deadline, setDeadline] = createSignal(\"\");\n  const [reminder, setReminder] = createSignal(\"\");\n  const [recurrence, setRecurrence] = createSignal(\"\");\n",
)
replace(
    "web/apps/client/src/components/task/HomeTaskCreateModal.tsx",
    "    setDue(\"\");\n    setDeadline(\"\");\n    setRecurrence(\"\");\n",
    "    setDue(\"\");\n    setDeadline(\"\");\n    setReminder(\"\");\n    setRecurrence(\"\");\n",
)
replace(
    "web/apps/client/src/components/task/HomeTaskCreateModal.tsx",
    "        dueText: due() ? fromDatetimeLocalValue(due()) : undefined,\n        dueDeadline: deadline() ? fromDatetimeLocalValue(deadline()) : undefined,\n        recurrenceRule: recurrence().trim() || undefined,\n",
    "        dueText: due() ? fromDatetimeLocalValue(due()) : undefined,\n        dueDeadline: deadline() ? fromDatetimeLocalValue(deadline()) : undefined,\n        reminderAt: reminder() ? fromDatetimeLocalValue(reminder()) : undefined,\n        recurrenceRule: recurrence().trim() || undefined,\n",
)
replace(
    "web/apps/client/src/components/task/HomeTaskCreateModal.tsx",
    "              <label class={fieldLabel} for=\"task-create-recurrence\">Recurrence rule (RRULE)</label>\n",
    "              <label class={fieldLabel} for=\"task-create-reminder\">Reminder · Notify me at</label>\n              <input\n                id=\"task-create-reminder\"\n                data-testid=\"task-create-reminder\"\n                type=\"datetime-local\"\n                class={textInput}\n                value={reminder()}\n                onInput={(event) => setReminder(event.currentTarget.value)}\n              />\n              <p class={helper}>Absolute reminder time in your current timezone. Quick Add reminder syntax is not part of M3 v1.</p>\n\n              <label class={fieldLabel} for=\"task-create-recurrence\">Recurrence rule (RRULE)</label>\n",
)
replace(
    "web/apps/client/src/components/task/HomeTaskCreateModal.tsx",
    "const parsedChipsStyle = css`display:flex; flex-wrap:wrap; gap:.4rem;`;\n",
    "const helper = css`margin:0; color:var(--text-dim); font-size:.75rem; line-height:1.4;`;\nconst parsedChipsStyle = css`display:flex; flex-wrap:wrap; gap:.4rem;`;\n",
)

# Task Detail reminder field.
replace(
    "web/apps/client/src/components/task/HomeTaskDetailModal.tsx",
    "    detailDeadline,\n    setDetailDeadline,\n    detailProjectId,\n",
    "    detailDeadline,\n    setDetailDeadline,\n    detailReminderAt,\n    setDetailReminderAt,\n    detailProjectId,\n",
)
replace(
    "web/apps/client/src/components/task/HomeTaskDetailModal.tsx",
    "            <Show when={detailScheduleWarning()}><p class={warningBanner}>{detailScheduleWarning()}</p></Show>\n\n            <label class={fieldLabel} for=\"task-detail-schedule-original\">Original scheduling text</label>\n",
    "            <Show when={detailScheduleWarning()}><p class={warningBanner}>{detailScheduleWarning()}</p></Show>\n\n            <label class={fieldLabel} for=\"task-detail-reminder\">Reminder · Notify me at</label>\n            <div class={inputActionRow}>\n              <input\n                id=\"task-detail-reminder\"\n                type=\"datetime-local\"\n                value={toDatetimeLocalValue(detailReminderAt())}\n                onInput={(event) => setDetailReminderAt(fromDatetimeLocalValue(event.currentTarget.value))}\n                class={textInput}\n                data-testid=\"task-detail-reminder\"\n              />\n              <Show when={detailReminderAt()}>\n                <Button type=\"button\" iconOnly aria-label=\"Clear reminder\" onClick={() => setDetailReminderAt(\"\")}>✕</Button>\n              </Show>\n            </div>\n            <p class={helper}>This reminder is a single notification instant shown in your current timezone.</p>\n\n            <label class={fieldLabel} for=\"task-detail-schedule-original\">Original scheduling text</label>\n",
)

# Reminder badge on task rows.
replace(
    "web/apps/client/src/components/task/HomeTaskRow.tsx",
    "      <Show when={formatScheduleDateTime(props.item.dueDeadline)}>\n        {(value) => <span class={deadlineBadge}>Deadline {value()}</span>}\n      </Show>\n",
    "      <Show when={formatScheduleDateTime(props.item.dueDeadline)}>\n        {(value) => <span class={deadlineBadge}>Deadline {value()}</span>}\n      </Show>\n      <Show when={formatScheduleDateTime(props.item.reminderAt)}>\n        {(value) => <span class={reminderBadge}>Reminder {value()}</span>}\n      </Show>\n",
)
replace(
    "web/apps/client/src/components/task/HomeTaskRow.tsx",
    "const deadlineBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(74,78,156,.35); color:#ddd9ff;`;\n",
    "const deadlineBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(74,78,156,.35); color:#ddd9ff;`;\nconst reminderBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(32,95,105,.34); color:#bff5ff;`;\n",
)

# --- browser audit -------------------------------------------------------------
m3 = read("web/apps/client/tests/e2e/audit/m3-scheduling.spec.ts")
addition = r'''
  test("[M3] Set reminder", async ({ page }) => {
    await addQuickTask(page, "m3 reminder set");
    const expected = localDateTime(1, 8, 30);
    let modal = await openDetail(page, "m3 reminder set");
    await modal.getByTestId("task-detail-reminder").fill(expected);
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    modal = await openDetail(page, "m3 reminder set");
    await expect(modal.getByTestId("task-detail-reminder")).toHaveValue(expected);
  });

  test("[M3] Edit reminder", async ({ page }) => {
    await addQuickTask(page, "m3 reminder edit");
    let modal = await openDetail(page, "m3 reminder edit");
    await modal.getByTestId("task-detail-reminder").fill(localDateTime(1, 8, 0));
    await modal.getByTestId("task-detail-save").click();
    modal = await openDetail(page, "m3 reminder edit");
    const changed = localDateTime(2, 10, 15);
    await modal.getByTestId("task-detail-reminder").fill(changed);
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    modal = await openDetail(page, "m3 reminder edit");
    await expect(modal.getByTestId("task-detail-reminder")).toHaveValue(changed);
  });

  test("[M3] Clear reminder", async ({ page }) => {
    await addQuickTask(page, "m3 reminder clear");
    let modal = await openDetail(page, "m3 reminder clear");
    await modal.getByTestId("task-detail-reminder").fill(localDateTime(1, 8, 0));
    await modal.getByTestId("task-detail-save").click();
    modal = await openDetail(page, "m3 reminder clear");
    await modal.getByRole("button", { name: "Clear reminder" }).click();
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    modal = await openDetail(page, "m3 reminder clear");
    await expect(modal.getByTestId("task-detail-reminder")).toHaveValue("");
  });

  test("[M3] Recurring reminder follows next occurrence", async ({ page }) => {
    await addQuickTask(page, "m3 recurring reminder every day at 9am");
    let modal = await openDetail(page, "m3 recurring reminder");
    const due = localDateTime(1, 9, 0);
    const reminder = localDateTime(1, 8, 0);
    await modal.getByTestId("task-detail-due").fill(due);
    await modal.getByTestId("task-detail-reminder").fill(reminder);
    await modal.getByTestId("task-detail-save").click();
    modal = await openDetail(page, "m3 recurring reminder");
    await modal.getByTestId("task-detail-mark-done").click();
    await page.reload();
    modal = await openDetail(page, "m3 recurring reminder");
    const nextDue = await modal.getByTestId("task-detail-due").inputValue();
    const nextReminder = await modal.getByTestId("task-detail-reminder").inputValue();
    expect(nextDue).not.toBe("");
    expect(nextReminder).not.toBe("");
    expect(new Date(nextDue).getTime() - new Date(nextReminder).getTime()).toBe(60 * 60 * 1000);
  });

'''
idx = m3.rfind("});")
if idx < 0:
    raise SystemExit("M3 spec closing marker not found")
write("web/apps/client/tests/e2e/audit/m3-scheduling.spec.ts", m3[:idx] + addition + m3[idx:])

# Human audit sheet: add reminder rows and explicit v1 contract.
write("docs/audits/human-verification/M3-scheduling.md", '''# M3 — Scheduling + reminders human verification

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
''')

# Record implementation decision for future support-boundary review.
write("docs/audits/M3-reminder-contract.md", '''# M3 reminder contract

M3 introduces first-class task reminders.

- One absolute reminder instant per task (`reminderAt`).
- The HTTP client sends RFC3339/ISO instants; the service normalizes them in the request timezone.
- Invalid reminder values are rejected as validation errors.
- Create, read, update, and explicit clear are supported.
- Checked tasks retain their reminder value for audit/history but are no longer active work.
- Deleted tasks remain hidden by the existing soft-delete contract.
- Recurring tasks shift the next reminder by the same offset from the task due time. If a recurring task lacks a due anchor, the next occurrence does not inherit a stale absolute reminder.
- Tenant/workspace scoping is inherited from the canonical task repository and has dedicated reminder coverage.
- Quick Add reminder syntax and relative-to-due reminder rules are not part of M3 v1. They may be added later only with parser parity tests.
''')

print("M3 scheduling/reminder implementation applied")
