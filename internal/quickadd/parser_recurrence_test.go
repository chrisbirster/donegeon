package quickadd

import "testing"

func TestParseExtractsIntervalRecurrenceRule(t *testing.T) {
	parser := NewParser()
	parsed := parser.Parse("assign a task every 2 months #home p2")

	if parsed.RecurrenceRule == nil || *parsed.RecurrenceRule != "FREQ=MONTHLY;INTERVAL=2" {
		t.Fatalf("unexpected recurrence rule: %v", strOrNil(parsed.RecurrenceRule))
	}
	if parsed.Content != "assign a task" {
		t.Fatalf("unexpected content: %q", parsed.Content)
	}
}

func TestParseExtractsWeekdayRecurrenceRule(t *testing.T) {
	parser := NewParser()
	parsed := parser.Parse("water plants every monday tomorrow")

	if parsed.RecurrenceRule == nil || *parsed.RecurrenceRule != "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO" {
		t.Fatalf("unexpected recurrence rule: %v", strOrNil(parsed.RecurrenceRule))
	}
	if parsed.DueText == nil || *parsed.DueText != "tomorrow" {
		t.Fatalf("unexpected due text: %v", strOrNil(parsed.DueText))
	}
	if parsed.Content != "water plants" {
		t.Fatalf("unexpected content: %q", parsed.Content)
	}
}

func TestParseExtractsWeekdayGroupRecurrenceRule(t *testing.T) {
	parser := NewParser()
	parsed := parser.Parse("exercise every weekday")

	if parsed.RecurrenceRule == nil || *parsed.RecurrenceRule != "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR" {
		t.Fatalf("unexpected recurrence rule: %v", strOrNil(parsed.RecurrenceRule))
	}
	if parsed.Content != "exercise" {
		t.Fatalf("unexpected content: %q", parsed.Content)
	}
}

func TestParseExtractsDueKeywordWeekday(t *testing.T) {
	parser := NewParser()
	parsed := parser.Parse("take out trash due Thursday")

	if parsed.DueText == nil || *parsed.DueText != "Thursday" {
		t.Fatalf("unexpected due text: %v", strOrNil(parsed.DueText))
	}
	if parsed.Content != "take out trash" {
		t.Fatalf("unexpected content: %q", parsed.Content)
	}
}

func TestParseAllowsNumericLeadingLabel(t *testing.T) {
	parser := NewParser()
	parsed := parser.Parse("task that takes 10 min @10min @chore")

	if len(parsed.Labels) != 2 {
		t.Fatalf("unexpected labels count: got=%d want=2", len(parsed.Labels))
	}
	if parsed.Labels[0] != "10min" {
		t.Fatalf("unexpected first label: got=%q want=%q", parsed.Labels[0], "10min")
	}
	if parsed.Labels[1] != "chore" {
		t.Fatalf("unexpected second label: got=%q want=%q", parsed.Labels[1], "chore")
	}
	if parsed.Content != "task that takes 10 min" {
		t.Fatalf("unexpected content: got=%q want=%q", parsed.Content, "task that takes 10 min")
	}
}

func TestParseAllowsNumericLeadingProjectToken(t *testing.T) {
	parser := NewParser()
	parsed := parser.Parse("ship it #2658a11f-44ca-41 p2")

	if parsed.Project == nil || *parsed.Project != "2658a11f-44ca-41" {
		t.Fatalf("unexpected project: got=%v want=%q", strOrNil(parsed.Project), "2658a11f-44ca-41")
	}
	if parsed.Priority == nil || *parsed.Priority != 2 {
		t.Fatalf("unexpected priority: got=%v want=%d", intOrNil(parsed.Priority), 2)
	}
	if parsed.Content != "ship it" {
		t.Fatalf("unexpected content: got=%q want=%q", parsed.Content, "ship it")
	}
}
