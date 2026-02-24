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
