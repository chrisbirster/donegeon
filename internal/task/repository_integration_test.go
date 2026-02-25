package task

import (
	"context"
	"path/filepath"
	"testing"

	"donegeon/internal/datbase"
)

func TestRepositoryListAndCreate(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "repo-test.db")
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

	list, err := repo.List(context.Background(), ListParams{Limit: 50, Cursor: 0})
	if err != nil {
		t.Fatalf("list tasks: %v", err)
	}
	if list.Total != 0 {
		t.Fatalf("expected empty list, got total=%d", list.Total)
	}

	created, err := repo.Create(context.Background(), CreateInput{Content: "Smoke", Priority: 4})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected created task id")
	}

	listAfter, err := repo.List(context.Background(), ListParams{Limit: 50, Cursor: 0})
	if err != nil {
		t.Fatalf("list tasks after create: %v", err)
	}
	if listAfter.Total != 1 {
		t.Fatalf("expected total=1, got total=%d", listAfter.Total)
	}
}

func TestRepositoryCloseIncrementsProcessedCountOnce(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "repo-processed.db")
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

	created, err := repo.Create(context.Background(), CreateInput{Content: "processed-count", Priority: 4})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	if err := repo.Close(context.Background(), created.ID); err != nil {
		t.Fatalf("close task: %v", err)
	}
	closed, err := repo.Get(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get closed task: %v", err)
	}
	if closed.ProcessedCount != 1 {
		t.Fatalf("expected processed_count=1 after first close, got %d", closed.ProcessedCount)
	}

	if err := repo.Close(context.Background(), created.ID); err != nil {
		t.Fatalf("close task again: %v", err)
	}
	closedAgain, err := repo.Get(context.Background(), created.ID)
	if err != nil {
		t.Fatalf("get task after second close: %v", err)
	}
	if closedAgain.ProcessedCount != 1 {
		t.Fatalf("expected processed_count to remain 1 after second close, got %d", closedAgain.ProcessedCount)
	}
}
