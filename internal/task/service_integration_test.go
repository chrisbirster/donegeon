package task

import (
	"context"
	"path/filepath"
	"testing"

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

func strOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}
