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
