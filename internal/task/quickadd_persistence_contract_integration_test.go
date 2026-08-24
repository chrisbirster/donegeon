package task

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"donegeon/internal/database"
	"donegeon/internal/quickadd"
)

func TestQuickAddDurableMetadataContract(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "quickadd-contract.db")
	if err := database.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	db, err := database.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	queries, err := database.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	service := NewService(NewRepository(db, queries), quickadd.NewParser())
	service.nowFn = func() time.Time {
		return time.Date(2026, time.August, 24, 14, 0, 0, 0, time.UTC)
	}
	ctx := WithTimezone(context.Background(), "America/New_York")
	input := "Ship release #home @urgent @ops +alex p2 every thursday at 5pm {in 2 days} // verify rollout"

	created, parsed, err := service.CreateFromQuickAdd(ctx, input)
	if err != nil {
		t.Fatalf("create from quick add: %v", err)
	}

	if parsed.Content != "Ship release" || parsed.Description != "verify rollout" {
		t.Fatalf("unexpected parsed text: %+v", parsed)
	}
	if parsed.Project == nil || *parsed.Project != "home" {
		t.Fatalf("unexpected parsed project: %v", strOrNil(parsed.Project))
	}
	if parsed.Assignee == nil || *parsed.Assignee != "alex" {
		t.Fatalf("unexpected parser-only assignee metadata: %v", strOrNil(parsed.Assignee))
	}
	if parsed.Priority == nil || *parsed.Priority != 2 {
		t.Fatalf("unexpected parsed priority: %v", parsed.Priority)
	}
	if parsed.RecurrenceRule == nil || *parsed.RecurrenceRule != "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH;BYHOUR=17;BYMINUTE=0" {
		t.Fatalf("unexpected parsed recurrence: %v", strOrNil(parsed.RecurrenceRule))
	}
	if parsed.DueText == nil || *parsed.DueText != "2026-08-27T17:00:00-04:00" {
		t.Fatalf("unexpected normalized parsed due: %v", strOrNil(parsed.DueText))
	}
	if parsed.Deadline == nil || *parsed.Deadline != "2026-08-26T10:00:00-04:00" {
		t.Fatalf("unexpected normalized parsed deadline: %v", strOrNil(parsed.Deadline))
	}

	if created.Content != parsed.Content || created.Description != parsed.Description || created.Priority != 2 {
		t.Fatalf("durable scalar metadata mismatch: %+v", created)
	}
	if created.ProjectID == nil || *created.ProjectID != "home" {
		t.Fatalf("durable project mismatch: %v", strOrNil(created.ProjectID))
	}
	if len(created.Labels) != 2 || created.Labels[0] != "ops" || created.Labels[1] != "urgent" {
		t.Fatalf("durable labels mismatch: %v", created.Labels)
	}
	if created.Recurrence == nil || *created.Recurrence != *parsed.RecurrenceRule {
		t.Fatalf("durable recurrence mismatch: %v", strOrNil(created.Recurrence))
	}
	if created.DueText == nil || *created.DueText != *parsed.DueText {
		t.Fatalf("durable due mismatch: %v", strOrNil(created.DueText))
	}
	if created.DueDeadline == nil || *created.DueDeadline != *parsed.Deadline {
		t.Fatalf("durable deadline mismatch: %v", strOrNil(created.DueDeadline))
	}
	if created.ScheduleInput == nil || *created.ScheduleInput != input {
		t.Fatalf("durable schedule input mismatch: %v", strOrNil(created.ScheduleInput))
	}

	// Assignee is intentionally parser-only today: task.Task has no durable
	// assignee field. This contract prevents parser syntax from being mistaken
	// for a persisted assignment capability until M5 makes an explicit product decision.
}
