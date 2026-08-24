package task

import (
	"context"
	"testing"
)

func TestSchedulingContractRecurringTransactionDoesNotSpawnTwiceAfterCloseWins(t *testing.T) {
	t.Parallel()

	service, repo := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")
	created, err := service.Create(ctx, CreateInput{
		Content:    "Single spawn",
		Priority:   4,
		Recurrence: strPtr("FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0"),
		DueText:    strPtr("2026-03-01T09:00:00-05:00"),
	})
	if err != nil {
		t.Fatalf("create recurring task: %v", err)
	}

	next := CreateInput{
		Content:    created.Content,
		Priority:   created.Priority,
		Recurrence: created.Recurrence,
		DueText:    strPtr("2026-03-02T09:00:00-05:00"),
	}
	if err := repo.CloseRecurringAndCreateNext(ctx, created.ID, next); err != nil {
		t.Fatalf("first recurring transaction: %v", err)
	}
	if err := repo.CloseRecurringAndCreateNext(ctx, created.ID, next); err != nil {
		t.Fatalf("stale repeated recurring transaction: %v", err)
	}

	list, err := service.List(ctx, ListParams{Limit: 50})
	if err != nil {
		t.Fatalf("list after repeated recurring transaction: %v", err)
	}
	if len(list.Items) != 2 {
		t.Fatalf("repeated recurring transaction spawned duplicate: got=%d want=2", len(list.Items))
	}
}
