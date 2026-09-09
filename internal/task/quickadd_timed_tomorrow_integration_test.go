package task

import (
	"context"
	"testing"
	"time"
)

func TestQuickAddTimedTomorrowResolvesExactLocalClock(t *testing.T) {
	service, _ := newSchedulingContractService(t)
	service.nowFn = func() time.Time {
		// 2026-09-08 20:48 in America/New_York.
		return time.Date(2026, time.September, 9, 0, 48, 0, 0, time.UTC)
	}
	ctx := WithTimezone(context.Background(), "America/New_York")

	created, parsed, err := service.CreateFromQuickAdd(ctx, "adding a task here @home @chore #task due tomorrow at 8pm")
	if err != nil {
		t.Fatalf("create timed tomorrow quick add: %v", err)
	}
	if parsed.DueText == nil || *parsed.DueText != "tomorrow at 8pm" {
		t.Fatalf("parsed due text: got %v want %q", parsed.DueText, "tomorrow at 8pm")
	}
	if got, want := strOrNil(created.DueText), any("2026-09-09T20:00:00-04:00"); got != want {
		t.Fatalf("persisted due: got=%v want=%v", got, want)
	}
	if created.Content != "adding a task here" {
		t.Fatalf("content: got %q want %q", created.Content, "adding a task here")
	}
}
