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
		return time.Date(2026, time.February, 25, 15, 0, 0, 0, time.UTC)
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

func strOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}
