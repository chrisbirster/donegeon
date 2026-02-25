package quickadd

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type Parsed struct {
	Content        string   `json:"content"`
	Project        *string  `json:"project,omitempty"`
	Labels         []string `json:"labels"`
	Assignee       *string  `json:"assignee,omitempty"`
	Priority       *int     `json:"priority,omitempty"`
	Deadline       *string  `json:"deadline,omitempty"`
	DueText        *string  `json:"dueText,omitempty"`
	RecurrenceRule *string  `json:"recurrenceRule,omitempty"`
	Description    string   `json:"description"`
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

	numberWithOrdinalPattern = regexp.MustCompile(`^(\d+)(?:st|nd|rd|th)?$`)

	recurrenceIntervalPattern              = regexp.MustCompile(`(?i)\bevery\s+((?:\d+)(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|other)\s+(day|days|week|weeks|month|months|year|years)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b`)
	recurrenceSinglePattern                = regexp.MustCompile(`(?i)\bevery\s+(day|week|month|year)\b`)
	recurrenceWeekdayPattern               = regexp.MustCompile(`(?i)\bevery\s+(weekday|weekdays|weekend|weekends|monday|mondays|tuesday|tuesdays|wednesday|wednesdays|thursday|thursdays|friday|fridays|saturday|saturdays|sunday|sundays)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b`)
	recurrencePluralWeekdayWithTimePattern = regexp.MustCompile(`(?i)\b(weekdays|weekends|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b`)
	recurrenceDailyAtPattern               = regexp.MustCompile(`(?i)\b(?:daily|every\s+day)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b`)
	recurrenceBiweeklyPattern              = regexp.MustCompile(`(?i)\bbiweekly\b`)
	recurrenceTwiceAMonthPattern           = regexp.MustCompile(`(?i)\btwice\s+a\s+month\b`)
	recurrenceMorningNightPattern          = regexp.MustCompile(`(?i)\bevery\s+(morning|night)\b`)
	recurrenceEveryMonthOnMonthDayPattern  = regexp.MustCompile(`(?i)\bevery\s+month\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b`)
	recurrenceOnMonthDayEveryMonthPattern  = regexp.MustCompile(`(?i)\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:each|every)\s+month\b`)
	recurrenceMonthlyOrdinalWeekdayPattern = regexp.MustCompile(`(?i)\b(first|second|third|fourth|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(?:each|every)\s+month\b`)
)

var duePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b`),
	regexp.MustCompile(`(?i)\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b`),
	regexp.MustCompile(`(?i)\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b`),
	regexp.MustCompile(`(?i)\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b`),
	regexp.MustCompile(`(?i)\b\d+\s+(?:day|days|week|weeks|month|months)\s+from\s+now\b`),
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
	recurrenceRule, content := extractRecurrenceRule(content)
	if recurrenceRule != "" {
		result.RecurrenceRule = stringPtr(recurrenceRule)
	}

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

func extractRecurrenceRule(content string) (string, string) {
	if content == "" {
		return "", ""
	}

	type recurrenceMatch struct {
		start int
		end   int
		rule  string
	}

	best := recurrenceMatch{start: -1}
	register := func(start, end int, rule string) {
		if start < 0 || end <= start || strings.TrimSpace(rule) == "" {
			return
		}
		if best.start == -1 || start < best.start || (start == best.start && end-start > best.end-best.start) {
			best = recurrenceMatch{start: start, end: end, rule: rule}
		}
	}

	if loc := recurrenceEveryMonthOnMonthDayPattern.FindStringSubmatchIndex(content); loc != nil {
		dayText := readGroup(content, loc, 1)
		if day, ok := parseMonthDay(dayText); ok {
			register(loc[0], loc[1], fmt.Sprintf("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=%d", day))
		}
	}

	if loc := recurrenceOnMonthDayEveryMonthPattern.FindStringSubmatchIndex(content); loc != nil {
		dayText := readGroup(content, loc, 1)
		if day, ok := parseMonthDay(dayText); ok {
			register(loc[0], loc[1], fmt.Sprintf("FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=%d", day))
		}
	}

	if loc := recurrenceMonthlyOrdinalWeekdayPattern.FindStringSubmatchIndex(content); loc != nil {
		ordinalText := strings.ToLower(readGroup(content, loc, 1))
		weekdayText := strings.ToLower(readGroup(content, loc, 2))
		if ordinal, ok := recurrenceOrdinal(ordinalText); ok {
			if byDay, ok := recurrenceByDay(weekdayText); ok {
				register(loc[0], loc[1], fmt.Sprintf("FREQ=MONTHLY;INTERVAL=1;BYDAY=%d%s", ordinal, byDay))
			}
		}
	}

	if loc := recurrenceIntervalPattern.FindStringSubmatchIndex(content); loc != nil {
		intervalText := strings.ToLower(readGroup(content, loc, 1))
		if interval, ok := parseIntervalToken(intervalText); ok {
			unit := strings.ToLower(readGroup(content, loc, 2))
			freq, ok := recurrenceFrequency(unit)
			if ok {
				timeSuffix := recurrenceTimeSuffix(
					readGroup(content, loc, 3),
					readGroup(content, loc, 4),
					readGroup(content, loc, 5),
				)
				register(loc[0], loc[1], fmt.Sprintf("FREQ=%s;INTERVAL=%d%s", freq, interval, timeSuffix))
			}
		}
	}

	if loc := recurrenceWeekdayPattern.FindStringSubmatchIndex(content); loc != nil {
		day := strings.ToLower(readGroup(content, loc, 1))
		byDay, ok := recurrenceByDay(day)
		if ok {
			timeSuffix := recurrenceTimeSuffix(
				readGroup(content, loc, 2),
				readGroup(content, loc, 3),
				readGroup(content, loc, 4),
			)
			register(loc[0], loc[1], fmt.Sprintf("FREQ=WEEKLY;INTERVAL=1;BYDAY=%s%s", byDay, timeSuffix))
		}
	}

	if loc := recurrencePluralWeekdayWithTimePattern.FindStringSubmatchIndex(content); loc != nil {
		day := strings.ToLower(readGroup(content, loc, 1))
		byDay, ok := recurrenceByDay(day)
		if ok {
			timeSuffix := recurrenceTimeSuffix(
				readGroup(content, loc, 2),
				readGroup(content, loc, 3),
				readGroup(content, loc, 4),
			)
			register(loc[0], loc[1], fmt.Sprintf("FREQ=WEEKLY;INTERVAL=1;BYDAY=%s%s", byDay, timeSuffix))
		}
	}

	if loc := recurrenceDailyAtPattern.FindStringSubmatchIndex(content); loc != nil {
		timeSuffix := recurrenceTimeSuffix(
			readGroup(content, loc, 1),
			readGroup(content, loc, 2),
			readGroup(content, loc, 3),
		)
		register(loc[0], loc[1], fmt.Sprintf("FREQ=DAILY;INTERVAL=1%s", timeSuffix))
	}

	if loc := recurrenceBiweeklyPattern.FindStringSubmatchIndex(content); loc != nil {
		register(loc[0], loc[1], "FREQ=WEEKLY;INTERVAL=2")
	}

	if loc := recurrenceTwiceAMonthPattern.FindStringSubmatchIndex(content); loc != nil {
		register(loc[0], loc[1], "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1,15")
	}

	if loc := recurrenceMorningNightPattern.FindStringSubmatchIndex(content); loc != nil {
		segment := strings.ToLower(readGroup(content, loc, 1))
		switch segment {
		case "morning":
			register(loc[0], loc[1], "FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0")
		case "night":
			register(loc[0], loc[1], "FREQ=DAILY;INTERVAL=1;BYHOUR=21;BYMINUTE=0")
		}
	}

	if loc := recurrenceSinglePattern.FindStringSubmatchIndex(content); loc != nil {
		unit := strings.ToLower(readGroup(content, loc, 1))
		freq, ok := recurrenceFrequency(unit)
		if ok {
			register(loc[0], loc[1], fmt.Sprintf("FREQ=%s;INTERVAL=1", freq))
		}
	}

	if best.start == -1 {
		return "", normalizeSpaces(content)
	}

	without := normalizeSpaces(content[:best.start] + " " + content[best.end:])
	return best.rule, without
}

func recurrenceFrequency(unit string) (string, bool) {
	switch strings.ToLower(unit) {
	case "day", "days":
		return "DAILY", true
	case "week", "weeks":
		return "WEEKLY", true
	case "month", "months":
		return "MONTHLY", true
	case "year", "years":
		return "YEARLY", true
	default:
		return "", false
	}
}

func recurrenceByDay(day string) (string, bool) {
	switch strings.ToLower(day) {
	case "weekday", "weekdays":
		return "MO,TU,WE,TH,FR", true
	case "weekend", "weekends":
		return "SA,SU", true
	case "monday", "mondays":
		return "MO", true
	case "tuesday", "tuesdays":
		return "TU", true
	case "wednesday", "wednesdays":
		return "WE", true
	case "thursday", "thursdays":
		return "TH", true
	case "friday", "fridays":
		return "FR", true
	case "saturday", "saturdays":
		return "SA", true
	case "sunday", "sundays":
		return "SU", true
	default:
		return "", false
	}
}

func parseIntervalToken(value string) (int, bool) {
	token := strings.ToLower(strings.TrimSpace(value))
	if token == "" {
		return 0, false
	}

	switch token {
	case "one":
		return 1, true
	case "two":
		return 2, true
	case "three":
		return 3, true
	case "four":
		return 4, true
	case "five":
		return 5, true
	case "six":
		return 6, true
	case "seven":
		return 7, true
	case "eight":
		return 8, true
	case "nine":
		return 9, true
	case "ten":
		return 10, true
	case "other":
		return 2, true
	}

	match := numberWithOrdinalPattern.FindStringSubmatch(token)
	if match == nil {
		return 0, false
	}

	interval, err := strconv.Atoi(match[1])
	if err != nil || interval <= 0 {
		return 0, false
	}

	return interval, true
}

func parseMonthDay(value string) (int, bool) {
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0, false
	}
	if n < 1 || n > 31 {
		return 0, false
	}
	return n, true
}

func recurrenceOrdinal(value string) (int, bool) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "first":
		return 1, true
	case "second":
		return 2, true
	case "third":
		return 3, true
	case "fourth":
		return 4, true
	case "last":
		return -1, true
	default:
		return 0, false
	}
}

func recurrenceTimeSuffix(hoursRaw string, minutesRaw string, periodRaw string) string {
	hour, minute, ok := parseClockTime(hoursRaw, minutesRaw, periodRaw)
	if !ok {
		return ""
	}
	return fmt.Sprintf(";BYHOUR=%d;BYMINUTE=%d", hour, minute)
}

func parseClockTime(hoursRaw string, minutesRaw string, periodRaw string) (int, int, bool) {
	hoursText := strings.TrimSpace(hoursRaw)
	if hoursText == "" {
		return 0, 0, false
	}

	hour, err := strconv.Atoi(hoursText)
	if err != nil {
		return 0, 0, false
	}

	minute := 0
	if strings.TrimSpace(minutesRaw) != "" {
		minute, err = strconv.Atoi(strings.TrimSpace(minutesRaw))
		if err != nil {
			return 0, 0, false
		}
	}
	if minute < 0 || minute > 59 {
		return 0, 0, false
	}

	period := strings.ToLower(strings.TrimSpace(periodRaw))
	if period == "" {
		if hour < 0 || hour > 23 {
			return 0, 0, false
		}
		return hour, minute, true
	}

	if hour < 1 || hour > 12 {
		return 0, 0, false
	}

	switch period {
	case "am":
		if hour == 12 {
			hour = 0
		}
	case "pm":
		if hour != 12 {
			hour += 12
		}
	default:
		return 0, 0, false
	}

	return hour, minute, true
}

func readGroup(content string, loc []int, group int) string {
	base := group * 2
	if base+1 >= len(loc) {
		return ""
	}
	start := loc[base]
	end := loc[base+1]
	if start < 0 || end < 0 || end <= start {
		return ""
	}
	return content[start:end]
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
