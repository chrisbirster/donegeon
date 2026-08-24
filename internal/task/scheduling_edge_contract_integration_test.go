package task

import (
	"context"
	"testing"

	"donegeon/internal/rrule"
)

func TestSchedulingContractDateOnlyUsesLocalMidnight(t *testing.T) {
	t.Parallel()

	service, _ := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")
	created, err := service.Create(ctx, CreateInput{
		Content:  "Date-only task",
		Priority: 4,
		DueText:  strPtr("2026-03-08"),
	})
	if err != nil {
		t.Fatalf("create date-only task: %v", err)
	}
	if got, want := strOrNil(created.DueText), any("2026-03-08T00:00:00-05:00"); got != want {
		t.Fatalf("date-only local midnight: got=%v want=%v", got, want)
	}
}

func TestSchedulingContractEditedRecurrenceDrivesNextOccurrence(t *testing.T) {
	t.Parallel()

	service, _ := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")
	created, err := service.Create(ctx, CreateInput{
		Content:    "Edited recurrence",
		Priority:   4,
		Recurrence: strPtr("FREQ=WEEKLY;INTERVAL=1;BYDAY=SU;BYHOUR=9;BYMINUTE=0"),
		DueText:    strPtr("2026-03-01T09:00:00-05:00"),
	})
	if err != nil {
		t.Fatalf("create edited recurrence: %v", err)
	}

	updated, err := service.Update(ctx, created.ID, UpdateInput{
		Recurrence: strPtr("FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0"),
	})
	if err != nil {
		t.Fatalf("edit recurrence: %v", err)
	}
	parsed, err := rrule.Parse(*updated.Recurrence)
	if err != nil || parsed.Freq != rrule.FreqDaily {
		t.Fatalf("edited recurrence did not persist: recurrence=%v err=%v", strOrNil(updated.Recurrence), err)
	}

	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close edited recurrence: %v", err)
	}
	_, next := recurringPair(t, service, ctx, created.ID)
	if got, want := strOrNil(next.DueText), any("2026-03-02T09:00:00-05:00"); got != want {
		t.Fatalf("edited recurrence next due: got=%v want=%v", got, want)
	}
}

func TestSchedulingContractUntilBoundaryStopsRecurrence(t *testing.T) {
	t.Parallel()

	service, _ := newSchedulingContractService(t)
	ctx := WithTimezone(context.Background(), "America/New_York")
	created, err := service.Create(ctx, CreateInput{
		Content:    "Until boundary",
		Priority:   4,
		Recurrence: strPtr("FREQ=DAILY;UNTIL=20260301T140000Z;BYHOUR=9;BYMINUTE=0"),
		DueText:    strPtr("2026-03-01T09:00:00-05:00"),
	})
	if err != nil {
		t.Fatalf("create UNTIL recurrence: %v", err)
	}
	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close UNTIL boundary: %v", err)
	}

	list, err := service.List(ctx, ListParams{Limit: 50})
	if err != nil {
		t.Fatalf("list UNTIL recurrence: %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("UNTIL recurrence spawned past boundary: got=%d want=1", len(list.Items))
	}
	if !list.Items[0].Checked || list.Items[0].ProcessedCount != 1 {
		t.Fatalf("UNTIL final occurrence state: %+v", list.Items[0])
	}
}
