package task

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"donegeon/internal/database"
	"donegeon/internal/quickadd"
	"donegeon/internal/rrule"
)

func TestSchedulingContractNormalizesLocalCalendarTimeAcrossDST(t *testing.T) {
	t.Parallel()

	service, _ := newSchedulingContractService(t)
	service.nowFn = func() time.Time {
		return time.Date(2026, time.March, 7, 15, 0, 0, 0, time.UTC)
	}
	ctx := WithTimezone(context.Background(), "America/New_York")

	created, err := service.Create(ctx, CreateInput{
		Content:     "DST task",
		Priority:    4,
		DueText:     strPtr("tomorrow at 9am"),
		DueDeadline: strPtr("tomorrow at 7am"),
	})
	if err != nil {
		t.Fatalf("create DST task: %v", err)
	}
	if got, want := strOrNil(created.DueText), any("2026-03-08T09:00:00-04:00"); got != want {
		t.Fatalf("due across DST: got=%v want=%v", got, want)
	}
	if got, want := strOrNil(created.DueDeadline), any("2026-03-08T07:00:00-04:00"); got != want {
		t.Fatalf("deadline across DST: got=%v want=%v", got, want)
	}
}

func TestSchedulingContractRecurringClosePreservesLocalTimeAndDeadlineLeadAcrossDST(t *testing.T) {
	t.Parallel()

	service, _ := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")

	created, err := service.Create(ctx, CreateInput{
		Content:       "Weekly DST task",
		Priority:      2,
		Recurrence:    strPtr("FREQ=WEEKLY;INTERVAL=1;BYDAY=SU;BYHOUR=9;BYMINUTE=0"),
		DueText:       strPtr("2026-03-01T09:00:00-05:00"),
		DueDeadline:   strPtr("2026-03-01T07:00:00-05:00"),
		ScheduleInput: strPtr("weekly at 9am with a two-hour lead"),
		Labels:        []string{"weekly"},
	})
	if err != nil {
		t.Fatalf("create recurring DST task: %v", err)
	}

	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close recurring DST task: %v", err)
	}

	closed, next := recurringPair(t, service, ctx, created.ID)
	if !closed.Checked || closed.ProcessedCount != 1 {
		t.Fatalf("original recurring task state: %+v", closed)
	}
	if got, want := strOrNil(next.DueText), any("2026-03-08T09:00:00-04:00"); got != want {
		t.Fatalf("next due across DST: got=%v want=%v", got, want)
	}
	if got, want := strOrNil(next.DueDeadline), any("2026-03-08T07:00:00-04:00"); got != want {
		t.Fatalf("next deadline across DST: got=%v want=%v", got, want)
	}
	if got, want := strOrNil(next.ScheduleInput), any("weekly at 9am with a two-hour lead"); got != want {
		t.Fatalf("schedule input continuity: got=%v want=%v", got, want)
	}
	if len(next.Labels) != 1 || next.Labels[0] != "weekly" {
		t.Fatalf("label continuity: got=%v want=[weekly]", next.Labels)
	}
}

func TestSchedulingContractMonthlyLastDayHandlesShortMonths(t *testing.T) {
	t.Parallel()

	service, _ := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")
	created, err := service.Create(ctx, CreateInput{
		Content:    "Month end close",
		Priority:   4,
		Recurrence: strPtr("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-1;BYHOUR=9;BYMINUTE=0"),
		DueText:    strPtr("2026-01-31T09:00:00-05:00"),
	})
	if err != nil {
		t.Fatalf("create month-end task: %v", err)
	}
	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close month-end task: %v", err)
	}
	_, next := recurringPair(t, service, ctx, created.ID)
	if got, want := strOrNil(next.DueText), any("2026-02-28T09:00:00-05:00"); got != want {
		t.Fatalf("month-end next due: got=%v want=%v", got, want)
	}
}

func TestSchedulingContractFiniteCountDoesNotResetOnSpawn(t *testing.T) {
	t.Parallel()

	service, _ := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")
	created, err := service.Create(ctx, CreateInput{
		Content:    "Twice only",
		Priority:   4,
		Recurrence: strPtr("FREQ=DAILY;COUNT=2;BYHOUR=9;BYMINUTE=0"),
		DueText:    strPtr("2026-03-01T09:00:00-05:00"),
	})
	if err != nil {
		t.Fatalf("create finite recurring task: %v", err)
	}
	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close first finite occurrence: %v", err)
	}
	_, next := recurringPair(t, service, ctx, created.ID)
	if next.Recurrence == nil {
		t.Fatal("spawned finite occurrence lost recurrence")
	}
	parsed, err := rrule.Parse(*next.Recurrence)
	if err != nil {
		t.Fatalf("parse spawned recurrence: %v", err)
	}
	if parsed.Count == nil || *parsed.Count != 1 {
		t.Fatalf("spawned COUNT: got=%v want=1", parsed.Count)
	}

	if err := service.Close(ctx, next.ID); err != nil {
		t.Fatalf("close final finite occurrence: %v", err)
	}
	list, err := service.List(ctx, ListParams{Limit: 50})
	if err != nil {
		t.Fatalf("list finite occurrences: %v", err)
	}
	if len(list.Items) != 2 {
		t.Fatalf("finite recurrence spawned extra occurrence: got=%d want=2", len(list.Items))
	}
}

func TestSchedulingContractRecurringCloseRollsBackIfNextCreateFails(t *testing.T) {
	t.Parallel()

	service, repo := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")
	created, err := service.Create(ctx, CreateInput{
		Content:    "Atomic recurrence",
		Priority:   4,
		Recurrence: strPtr("FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0"),
		DueText:    strPtr("2026-03-01T09:00:00-05:00"),
	})
	if err != nil {
		t.Fatalf("create atomic recurrence: %v", err)
	}

	originalCreateQuery := repo.queries["task_create.sql"]
	repo.queries["task_create.sql"] = "INSERT INTO missing_recurring_table(value) VALUES (1)"
	if err := service.Close(ctx, created.ID); err == nil {
		t.Fatal("expected recurring close to fail when next insert fails")
	}

	persisted, err := repo.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("get task after failed recurring close: %v", err)
	}
	if persisted.Checked || persisted.ProcessedCount != 0 {
		t.Fatalf("failed recurring close was not rolled back: %+v", persisted)
	}

	repo.queries["task_create.sql"] = originalCreateQuery
	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("retry recurring close: %v", err)
	}
	closed, _ := recurringPair(t, service, ctx, created.ID)
	if !closed.Checked || closed.ProcessedCount != 1 {
		t.Fatalf("retry recurring close state: %+v", closed)
	}
}

func TestSchedulingContractExplicitClearStopsRecurrence(t *testing.T) {
	t.Parallel()

	service, _ := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")
	created, err := service.Create(ctx, CreateInput{
		Content:       "Clear schedule",
		Priority:      4,
		Recurrence:    strPtr("FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0"),
		DueText:       strPtr("2026-03-01T09:00:00-05:00"),
		DueDeadline:   strPtr("2026-03-01T08:00:00-05:00"),
		ScheduleInput: strPtr("every day at 9am {8am}"),
	})
	if err != nil {
		t.Fatalf("create scheduled task: %v", err)
	}

	updated, err := service.Update(ctx, created.ID, UpdateInput{
		ClearRecurrence:    true,
		ClearDueText:       true,
		ClearDueDeadline:   true,
		ClearScheduleInput: true,
	})
	if err != nil {
		t.Fatalf("clear task schedule: %v", err)
	}
	if updated.Recurrence != nil || updated.DueText != nil || updated.DueDeadline != nil || updated.ScheduleInput != nil {
		t.Fatalf("schedule clear did not persist: %+v", updated)
	}

	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close cleared task: %v", err)
	}
	list, err := service.List(ctx, ListParams{Limit: 50})
	if err != nil {
		t.Fatalf("list after clear+close: %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("cleared recurrence spawned another task: got=%d want=1", len(list.Items))
	}
}

func newSchedulingContractService(t *testing.T) (*Service, *Repository) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "scheduling-contract.db")
	if err := database.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	db, err := database.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	queries, err := database.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}
	repo := NewRepository(db, queries)
	return NewService(repo, quickadd.NewParser()), repo
}

func recurringPair(t *testing.T, service *Service, ctx context.Context, originalID string) (Task, Task) {
	t.Helper()
	list, err := service.List(ctx, ListParams{Limit: 50})
	if err != nil {
		t.Fatalf("list recurring pair: %v", err)
	}
	if len(list.Items) != 2 {
		t.Fatalf("recurring pair task count: got=%d want=2", len(list.Items))
	}
	var original Task
	var next Task
	for _, item := range list.Items {
		if item.ID == originalID {
			original = item
		} else {
			next = item
		}
	}
	if original.ID == "" || next.ID == "" {
		t.Fatalf("recurring pair missing original/next: %+v", list.Items)
	}
	return original, next
}
