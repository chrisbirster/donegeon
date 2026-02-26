package task

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"donegeon/internal/datbase"
	"donegeon/internal/quickadd"
)

func TestServiceCreateFromQuickAddPersistsRecurrence(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "service-test.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	repo := NewRepository(db, queries)
	service := NewService(repo, quickadd.NewParser())

	created, parsed, err := service.CreateFromQuickAdd(context.Background(), "prepare report every 2 months p2")
	if err != nil {
		t.Fatalf("create from quick add: %v", err)
	}

	if parsed.RecurrenceRule == nil || *parsed.RecurrenceRule != "FREQ=MONTHLY;INTERVAL=2" {
		t.Fatalf("unexpected parsed recurrence rule: %v", strOrNil(parsed.RecurrenceRule))
	}

	if created.Recurrence == nil || *created.Recurrence != "FREQ=MONTHLY;INTERVAL=2" {
		t.Fatalf("unexpected created recurrence rule: %v", strOrNil(created.Recurrence))
	}
}

func TestServiceCreateFromQuickAddPersistsProjectAndPriority(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "service-project-test.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	repo := NewRepository(db, queries)
	service := NewService(repo, quickadd.NewParser())

	created, parsed, err := service.CreateFromQuickAdd(context.Background(), "asssign a task p3 #home @another {in 2 days}")
	if err != nil {
		t.Fatalf("create from quick add: %v", err)
	}

	if parsed.Project == nil || *parsed.Project != "home" {
		t.Fatalf("unexpected parsed project: %v", strOrNil(parsed.Project))
	}
	if created.ProjectID == nil || *created.ProjectID != "home" {
		t.Fatalf("unexpected created project: %v", strOrNil(created.ProjectID))
	}
	if created.Priority != 3 {
		t.Fatalf("unexpected created priority: got=%d want=3", created.Priority)
	}
	if created.Content != "asssign a task" {
		t.Fatalf("unexpected created content: got=%q want=%q", created.Content, "asssign a task")
	}
	if created.DueDeadline == nil || *created.DueDeadline != "in 2 days" {
		t.Fatalf("unexpected created deadline: %v", strOrNil(created.DueDeadline))
	}
}

func TestServiceCreateFromQuickAddAutofillsDueFromRecurrenceUsingTimezone(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "service-recurrence-due-test.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	repo := NewRepository(db, queries)
	service := NewService(repo, quickadd.NewParser())
	service.nowFn = func() time.Time {
		return time.Date(2026, time.February, 25, 15, 0, 43, 0, time.UTC)
	}

	ctx := WithTimezone(context.Background(), "America/New_York")
	created, parsed, err := service.CreateFromQuickAdd(ctx, "take out the trash every thursday at 7pm #home p1 @chore")
	if err != nil {
		t.Fatalf("create from quick add: %v", err)
	}

	expectedDue := "2026-02-26T19:00:00-05:00"
	if parsed.DueText == nil || *parsed.DueText != expectedDue {
		t.Fatalf("unexpected parsed due text: got=%v want=%q", strOrNil(parsed.DueText), expectedDue)
	}
	if created.DueText == nil || *created.DueText != expectedDue {
		t.Fatalf("unexpected created due text: got=%v want=%q", strOrNil(created.DueText), expectedDue)
	}
}

func TestServiceCloseRecurringTaskSpawnsNextOccurrence(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "service-recurrence-close-test.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	repo := NewRepository(db, queries)
	service := NewService(repo, quickadd.NewParser())
	service.nowFn = func() time.Time {
		return time.Date(2026, time.February, 25, 15, 0, 0, 0, time.UTC)
	}
	ctx := WithTimezone(context.Background(), "America/New_York")

	created, _, err := service.CreateFromQuickAdd(ctx, "take out the trash every thursday at 7pm #home p1 @chore")
	if err != nil {
		t.Fatalf("create from quick add: %v", err)
	}
	if created.DueText == nil || *created.DueText != "2026-02-26T19:00:00-05:00" {
		t.Fatalf("unexpected initial due text: %v", strOrNil(created.DueText))
	}

	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close recurring task: %v", err)
	}

	list, err := service.List(ctx, ListParams{Limit: 50, Cursor: 0})
	if err != nil {
		t.Fatalf("list tasks: %v", err)
	}

	if len(list.Items) != 2 {
		t.Fatalf("unexpected task count after close: got=%d want=2", len(list.Items))
	}

	var closed Task
	var next *Task
	for i := range list.Items {
		item := list.Items[i]
		if item.ID == created.ID {
			closed = item
			continue
		}
		candidate := item
		next = &candidate
	}

	if !closed.Checked {
		t.Fatalf("expected original task to be checked")
	}
	if next == nil {
		t.Fatal("expected spawned next recurring task")
	}
	if next.Checked {
		t.Fatalf("expected spawned recurring task to be open")
	}
	if next.Recurrence == nil || created.Recurrence == nil || *next.Recurrence != *created.Recurrence {
		t.Fatalf("unexpected spawned recurrence: got=%v want=%v", strOrNil(next.Recurrence), strOrNil(created.Recurrence))
	}
	if next.DueText == nil {
		t.Fatalf("expected spawned task due text")
	}
	if !strings.HasPrefix(*next.DueText, "2026-03-05T19:00:00-05:00") {
		t.Fatalf("unexpected spawned due text: %q", *next.DueText)
	}
}

func TestServiceCreateFromQuickAddNormalizesInHoursDeadline(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "service-deadline-hours-test.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	repo := NewRepository(db, queries)
	service := NewService(repo, quickadd.NewParser())
	service.nowFn = func() time.Time {
		return time.Date(2026, time.February, 25, 15, 0, 0, 0, time.UTC)
	}

	ctx := WithTimezone(context.Background(), "America/New_York")
	created, _, err := service.CreateFromQuickAdd(ctx, "take out the trash every thursday at 7pm {in 12 hours} #home p1 @chore")
	if err != nil {
		t.Fatalf("create from quick add: %v", err)
	}

	expected := "2026-02-25T22:00:00-05:00"
	if created.DueDeadline == nil || *created.DueDeadline != expected {
		t.Fatalf("unexpected normalized deadline: got=%v want=%q", strOrNil(created.DueDeadline), expected)
	}
}

func TestServiceParseQuickAddNormalizesInHoursDeadline(t *testing.T) {
	t.Parallel()

	service := NewService(nil, quickadd.NewParser())
	service.nowFn = func() time.Time {
		return time.Date(2026, time.February, 25, 15, 0, 0, 0, time.UTC)
	}

	ctx := WithTimezone(context.Background(), "America/New_York")
	parsed := service.ParseQuickAdd(ctx, "take out the trash every thursday at 7pm {in 12 hours}")

	expected := "2026-02-25T22:00:00-05:00"
	if parsed.Deadline == nil || *parsed.Deadline != expected {
		t.Fatalf("unexpected parsed deadline: got=%v want=%q", strOrNil(parsed.Deadline), expected)
	}
}

func TestServiceGetNormalizesLegacyInHoursDeadlineFromCreatedAt(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "service-get-deadline-hours-test.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	repo := NewRepository(db, queries)
	service := NewService(repo, quickadd.NewParser())

	created, err := repo.Create(context.Background(), CreateInput{
		Content:     "legacy deadline",
		Priority:    4,
		DueDeadline: strPtr("in 12 hours"),
	})
	if err != nil {
		t.Fatalf("seed legacy task: %v", err)
	}

	createdAt, err := time.Parse(time.RFC3339, created.CreatedAt)
	if err != nil {
		t.Fatalf("parse created_at: %v", err)
	}

	ctx := WithTimezone(context.Background(), "America/New_York")
	item, err := service.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("get task: %v", err)
	}

	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatalf("load location: %v", err)
	}
	expected := createdAt.In(loc).Add(12 * time.Hour).Format(time.RFC3339)
	if item.DueDeadline == nil || *item.DueDeadline != expected {
		t.Fatalf("unexpected normalized deadline on get: got=%v want=%q", strOrNil(item.DueDeadline), expected)
	}
}

func TestServiceCreateFromQuickAddPersistsLabelsAndScheduleInput(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "service-quick-add-labels-schedule-test.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	repo := NewRepository(db, queries)
	service := NewService(repo, quickadd.NewParser())

	text := "take out trash every thursday at 7pm {tomorrow} p1 @chore @home"
	created, _, err := service.CreateFromQuickAdd(context.Background(), text)
	if err != nil {
		t.Fatalf("create from quick add: %v", err)
	}

	if created.ScheduleInput == nil || *created.ScheduleInput != text {
		t.Fatalf("unexpected schedule input: got=%v want=%q", strOrNil(created.ScheduleInput), text)
	}
	if len(created.Labels) != 2 {
		t.Fatalf("unexpected labels length: got=%d want=2", len(created.Labels))
	}
	if created.Labels[0] != "chore" || created.Labels[1] != "home" {
		t.Fatalf("unexpected labels: got=%v want=[chore home]", created.Labels)
	}
}

func strOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}
