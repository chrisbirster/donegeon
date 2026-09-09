package quickadd

import "testing"

func TestParseTimedTomorrowDuePhrase(t *testing.T) {
	parsed := NewParser().Parse("adding a task here @home @chore #task due tomorrow at 8pm")

	if got, want := parsed.Content, "adding a task here"; got != want {
		t.Fatalf("content: got %q want %q", got, want)
	}
	if parsed.DueText == nil || *parsed.DueText != "tomorrow at 8pm" {
		t.Fatalf("due text: got %v want %q", parsed.DueText, "tomorrow at 8pm")
	}
	if parsed.Project == nil || *parsed.Project != "task" {
		t.Fatalf("project: got %v want task", parsed.Project)
	}
	if len(parsed.Labels) != 2 || parsed.Labels[0] != "home" || parsed.Labels[1] != "chore" {
		t.Fatalf("labels: got %v want [home chore]", parsed.Labels)
	}
}
