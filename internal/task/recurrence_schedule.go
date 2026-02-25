package task

import (
	"context"
	"strings"
	"time"

	parsedrrule "donegeon/internal/rrule"
	rrulelib "github.com/teambition/rrule-go"
)

type timezoneContextKey struct{}

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

	options, err := rrulelib.StrToROptionInLocation(ruleText, loc)
	if err != nil {
		return "", false
	}
	if options.Dtstart.IsZero() {
		options.Dtstart = anchor
	}

	rule, err := rrulelib.NewRRule(*options)
	if err != nil {
		return "", false
	}

	next := rule.After(anchor, include)
	if next.IsZero() {
		return "", false
	}

	if recurrenceHasClockTime(ruleText) {
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
