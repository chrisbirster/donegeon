package task

import (
	"context"
	"regexp"
	"strconv"
	"strings"
	"time"

	parsedrrule "donegeon/internal/rrule"
	rrulelib "github.com/teambition/rrule-go"
)

type timezoneContextKey struct{}

var (
	inHoursPattern = regexp.MustCompile(`(?i)^in\s+(\d+)\s+hours?$`)
)

// WithTimezone attaches an IANA timezone identifier (for example, "America/New_York")
// to a request context so recurrence scheduling can be resolved in user-local time.
func WithTimezone(ctx context.Context, timezone string) context.Context {
	trimmed := strings.TrimSpace(timezone)
	if trimmed == "" {
		return ctx
	}
	return context.WithValue(ctx, timezoneContextKey{}, trimmed)
}

func timezoneFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	raw, _ := ctx.Value(timezoneContextKey{}).(string)
	return strings.TrimSpace(raw)
}

func locationFromTimezone(timezone string) *time.Location {
	if strings.TrimSpace(timezone) == "" {
		return time.UTC
	}
	loc, err := time.LoadLocation(strings.TrimSpace(timezone))
	if err != nil {
		return time.UTC
	}
	return loc
}

// nextOccurrenceDueText resolves a recurrence string into the next due text.
// Timed recurrences return RFC3339; date-only recurrences return YYYY-MM-DD.
func nextOccurrenceDueText(recurrence string, timezone string, after time.Time, include bool) (string, bool) {
	ruleText := strings.TrimSpace(recurrence)
	if ruleText == "" {
		return "", false
	}

	loc := locationFromTimezone(timezone)
	anchor := after.In(loc)

	if strings.HasPrefix(strings.ToUpper(ruleText), "RRULE:") {
		ruleText = strings.TrimSpace(ruleText[len("RRULE:"):])
	}

	timedRule := recurrenceHasClockTime(ruleText)

	options, err := rrulelib.StrToROptionInLocation(ruleText, loc)
	if err != nil {
		return "", false
	}
	if options.Dtstart.IsZero() {
		options.Dtstart = anchor
	}
	if timedRule && len(options.Bysecond) == 0 {
		options.Bysecond = []int{0}
	}

	rule, err := rrulelib.NewRRule(*options)
	if err != nil {
		return "", false
	}

	next := rule.After(anchor, include)
	if next.IsZero() {
		return "", false
	}

	if timedRule {
		return next.In(loc).Format(time.RFC3339), true
	}
	return next.In(loc).Format(time.DateOnly), true
}

func recurrenceHasClockTime(recurrence string) bool {
	parsed, err := parsedrrule.Parse(recurrence)
	if err != nil {
		return false
	}

	if len(parsed.ByHour) > 0 || len(parsed.ByMinute) > 0 || len(parsed.BySecond) > 0 {
		return true
	}

	switch parsed.Freq {
	case parsedrrule.FreqSecondly, parsedrrule.FreqMinutely, parsedrrule.FreqHourly:
		return true
	default:
		return false
	}
}

func parseDueAnchor(raw string, loc *time.Location) (time.Time, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, false
	}

	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.In(loc), true
	}
	if parsed, err := time.ParseInLocation(time.DateOnly, value, loc); err == nil {
		return parsed, true
	}
	return time.Time{}, false
}

func normalizeDeadline(value *string, timezone string, now time.Time) *string {
	if value == nil {
		return nil
	}

	raw := strings.TrimSpace(*value)
	if raw == "" {
		return nil
	}

	match := inHoursPattern.FindStringSubmatch(raw)
	if match == nil {
		return strPtr(raw)
	}

	hours, err := strconv.Atoi(match[1])
	if err != nil || hours <= 0 {
		return strPtr(raw)
	}

	loc := locationFromTimezone(timezone)
	deadline := now.In(loc).Add(time.Duration(hours) * time.Hour)
	return strPtr(deadline.Format(time.RFC3339))
}
