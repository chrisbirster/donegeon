package task

import (
	"context"
	stderrors "errors"
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
	}); err == nil || !hasReminderAppCode(err, apperrors.CodeValidationError) {
		t.Fatalf("invalid reminder should be validation error: %v", err)
	}

	created, err := service.Create(ownerCtx, CreateInput{
		Content: "Tenant reminder", Priority: 4, ReminderAt: strPtr("2026-09-15T10:00:00Z"),
	})
	if err != nil {
		t.Fatalf("create tenant reminder: %v", err)
	}
	if _, err := service.Get(otherCtx, created.ID); err == nil || !hasReminderAppCode(err, apperrors.CodeNotFound) {
		t.Fatalf("cross-tenant reminder read should be not found: %v", err)
	}
	if _, err := service.Update(otherCtx, created.ID, UpdateInput{ReminderAt: strPtr("2026-09-16T10:00:00Z")}); err == nil || !hasReminderAppCode(err, apperrors.CodeNotFound) {
		t.Fatalf("cross-tenant reminder update should be not found: %v", err)
	}
}

func hasReminderAppCode(err error, code apperrors.Code) bool {
	var appErr *apperrors.AppError
	return stderrors.As(err, &appErr) && appErr.Code == code
}
