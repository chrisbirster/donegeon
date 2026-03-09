package quickadd

import (
	"path/filepath"
	"slices"
	"testing"

	"donegeon/internal/testspec"
)

type quickAddSpec struct {
	Tests []quickAddSpecTest `yaml:"tests"`
}

type quickAddSpecTest struct {
	TestID string `yaml:"test_id"`
	When   struct {
		Action  string `yaml:"action"`
		Payload struct {
			Text string `yaml:"text"`
		} `yaml:"payload"`
	} `yaml:"when"`
	Then struct {
		Success bool `yaml:"success"`
		Parsed  struct {
			Content     string   `yaml:"content"`
			Project     *string  `yaml:"project"`
			Labels      []string `yaml:"labels"`
			Assignee    *string  `yaml:"assignee"`
			Priority    *int     `yaml:"priority"`
			Deadline    *string  `yaml:"deadline"`
			DueText     *string  `yaml:"due_text"`
			Recurrence  *string  `yaml:"recurrence_rule"`
			Description string   `yaml:"description"`
		} `yaml:"parsed"`
	} `yaml:"then"`
}

func TestParserFromSourceOfTruth(t *testing.T) {
	specRoot := filepath.Join("..", "..", "docs", "specs", "quickadd")
	tests, files, err := testspec.LoadTests[quickAddSpecTest](specRoot)
	if err != nil {
		t.Fatalf("load quick-add specs: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("no quick-add spec files found")
	}

	parser := NewParser()
	count := 0
	for _, testCase := range tests {
		if testCase.When.Action != "parse_quick_add_text" {
			continue
		}
		count++
		got := parser.Parse(testCase.When.Payload.Text)
		expected := testCase.Then.Parsed

		if got.Content != expected.Content {
			t.Errorf("%s content mismatch: got=%q want=%q", testCase.TestID, got.Content, expected.Content)
		}
		if !equalStringPtr(got.Project, expected.Project) {
			t.Errorf("%s project mismatch: got=%v want=%v", testCase.TestID, strOrNil(got.Project), strOrNil(expected.Project))
		}
		if !equalLabels(got.Labels, expected.Labels) {
			t.Errorf("%s labels mismatch: got=%v want=%v", testCase.TestID, got.Labels, expected.Labels)
		}
		if !equalStringPtr(got.Assignee, expected.Assignee) {
			t.Errorf("%s assignee mismatch: got=%v want=%v", testCase.TestID, strOrNil(got.Assignee), strOrNil(expected.Assignee))
		}
		if !equalIntPtr(got.Priority, expected.Priority) {
			t.Errorf("%s priority mismatch: got=%v want=%v", testCase.TestID, intOrNil(got.Priority), intOrNil(expected.Priority))
		}
		if !equalStringPtr(got.Deadline, expected.Deadline) {
			t.Errorf("%s deadline mismatch: got=%v want=%v", testCase.TestID, strOrNil(got.Deadline), strOrNil(expected.Deadline))
		}
		if !equalStringPtr(got.DueText, expected.DueText) {
			t.Errorf("%s due_text mismatch: got=%v want=%v", testCase.TestID, strOrNil(got.DueText), strOrNil(expected.DueText))
		}
		if !equalStringPtr(got.RecurrenceRule, expected.Recurrence) {
			t.Errorf("%s recurrence_rule mismatch: got=%v want=%v", testCase.TestID, strOrNil(got.RecurrenceRule), strOrNil(expected.Recurrence))
		}
		if got.Description != expected.Description {
			t.Errorf("%s description mismatch: got=%q want=%q", testCase.TestID, got.Description, expected.Description)
		}
	}

	if count == 0 {
		t.Fatal("no parse_quick_add_text tests found in source of truth")
	}
}

func equalStringPtr(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func equalIntPtr(a, b *int) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func equalLabels(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	aCopy := append([]string(nil), a...)
	bCopy := append([]string(nil), b...)
	slices.Sort(aCopy)
	slices.Sort(bCopy)
	return slices.Equal(aCopy, bCopy)
}

func strOrNil(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}

func intOrNil(v *int) any {
	if v == nil {
		return nil
	}
	return *v
}
