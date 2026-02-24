package quickadd

import (
	"regexp"
	"strings"
)

type Parsed struct {
	Content     string   `json:"content"`
	Project     *string  `json:"project,omitempty"`
	Labels      []string `json:"labels"`
	Assignee    *string  `json:"assignee,omitempty"`
	Priority    *int     `json:"priority,omitempty"`
	Deadline    *string  `json:"deadline,omitempty"`
	DueText     *string  `json:"dueText,omitempty"`
	Description string   `json:"description"`
}

type Parser struct{}

func NewParser() *Parser {
	return &Parser{}
}

var (
	deadlinePattern = regexp.MustCompile(`\{([^{}]+)\}`)
	projectPattern  = regexp.MustCompile(`^#[A-Za-z][A-Za-z0-9_-]*$`)
	labelPattern    = regexp.MustCompile(`^@[A-Za-z][A-Za-z0-9_-]*$`)
	assigneePattern = regexp.MustCompile(`^\+[A-Za-z][A-Za-z0-9_-]*$`)
	priorityPattern = regexp.MustCompile(`^p([1-4])$`)
)

var duePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?(?:am|pm)\b`),
	regexp.MustCompile(`(?i)\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b`),
	regexp.MustCompile(`(?i)\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b`),
	regexp.MustCompile(`(?i)\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b`),
	regexp.MustCompile(`(?i)\btomorrow\b`),
}

func (p *Parser) Parse(text string) Parsed {
	result := Parsed{
		Labels:      make([]string, 0, 2),
		Description: "",
	}

	working := strings.TrimSpace(text)

	if idx := strings.Index(working, "//"); idx >= 0 {
		result.Description = strings.TrimSpace(working[idx+2:])
		working = strings.TrimSpace(working[:idx])
	}

	working = deadlinePattern.ReplaceAllStringFunc(working, func(match string) string {
		if result.Deadline == nil {
			value := strings.TrimSpace(match[1 : len(match)-1])
			if value != "" {
				result.Deadline = stringPtr(value)
			}
		}
		return " "
	})

	parts := strings.Fields(working)
	contentParts := make([]string, 0, len(parts))

	for _, part := range parts {
		switch {
		case result.Project == nil && projectPattern.MatchString(part):
			result.Project = stringPtr(part[1:])
		case labelPattern.MatchString(part):
			result.Labels = append(result.Labels, part[1:])
		case result.Assignee == nil && assigneePattern.MatchString(part):
			result.Assignee = stringPtr(part[1:])
		case priorityPattern.MatchString(part):
			result.Priority = intPtr(int(part[1] - '0'))
		default:
			contentParts = append(contentParts, part)
		}
	}

	content := normalizeSpaces(strings.Join(contentParts, " "))
	due, content := extractDueText(content)
	if due != "" {
		result.DueText = stringPtr(due)
	}

	result.Content = content
	return result
}

func extractDueText(content string) (string, string) {
	if content == "" {
		return "", ""
	}

	start, end := -1, -1
	match := ""
	for _, pattern := range duePatterns {
		loc := pattern.FindStringIndex(content)
		if loc == nil {
			continue
		}
		if start == -1 || loc[0] < start || (loc[0] == start && loc[1]-loc[0] > end-start) {
			start = loc[0]
			end = loc[1]
			match = strings.TrimSpace(content[loc[0]:loc[1]])
		}
	}

	if start == -1 {
		return "", normalizeSpaces(content)
	}

	without := normalizeSpaces(content[:start] + " " + content[end:])
	return match, without
}

func normalizeSpaces(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func stringPtr(value string) *string {
	v := strings.TrimSpace(value)
	if v == "" {
		return nil
	}
	return &v
}

func intPtr(value int) *int {
	v := value
	return &v
}
