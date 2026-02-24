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

func strOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}
