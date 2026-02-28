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
	inHoursPattern     = regexp.MustCompile(`(?i)^in\s+(\d+)\s+hours?$`)
	inRelativePattern  = regexp.MustCompile(`(?i)^in\s+(\d+)\s+(day|days|week|weeks|month|months)$`)
	fromNowPattern     = regexp.MustCompile(`(?i)^(\d+)\s+(day|days|week|weeks|month|months)\s+from\s+now$`)
	tomorrowPattern    = regexp.MustCompile(`(?i)^tomorrow(?:\s+at\s+(.+))?$`)
	nextWeekPattern    = regexp.MustCompile(`(?i)^next\s+week$`)
	weekdayPattern     = regexp.MustCompile(`(?i)^(next\s+)?(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+(.+))?$`)
	monthDayPattern    = regexp.MustCompile(`(?i)^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+at\s+(.+))?$`)
	clockTimePattern   = regexp.MustCompile(`(?i)^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$`)
	weekdayIndexByName = map[string]time.Weekday{"sunday": time.Sunday, "monday": time.Monday, "tuesday": time.Tuesday, "wednesday": time.Wednesday, "thursday": time.Thursday, "friday": time.Friday, "saturday": time.Saturday}
	monthIndexByName   = map[string]time.Month{"january": time.January, "february": time.February, "march": time.March, "april": time.April, "may": time.May, "june": time.June, "july": time.July, "august": time.August, "september": time.September, "october": time.October, "november": time.November, "december": time.December}
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

func normalizeDueText(value *string, timezone string, now time.Time) *string {
	return normalizeTemporalValue(value, timezone, now)
}

func normalizeDeadline(value *string, timezone string, now time.Time) *string {
	if value == nil {
		return nil
	}

	raw := strings.TrimSpace(*value)
	if raw == "" {
		return nil
	}

	return normalizeTemporalValue(value, timezone, now)
}

func normalizeTemporalValue(value *string, timezone string, anchor time.Time) *string {
	if value == nil {
		return nil
	}

	raw := strings.TrimSpace(*value)
	if raw == "" {
		return nil
	}

	loc := locationFromTimezone(timezone)
	if parsed, ok := resolveTemporalText(raw, loc, anchor.In(loc)); ok {
		return strPtr(parsed.Format(time.RFC3339))
	}
	return strPtr(raw)
}

func resolveTemporalText(raw string, loc *time.Location, anchor time.Time) (time.Time, bool) {
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

	if match := inHoursPattern.FindStringSubmatch(value); match != nil {
		hours, err := strconv.Atoi(match[1])
		if err != nil || hours <= 0 {
			return time.Time{}, false
		}
		return anchor.Add(time.Duration(hours) * time.Hour), true
	}

	if match := inRelativePattern.FindStringSubmatch(value); match != nil {
		count, err := strconv.Atoi(match[1])
		if err != nil || count <= 0 {
			return time.Time{}, false
		}
		return shiftRelative(anchor, count, strings.ToLower(strings.TrimSpace(match[2]))), true
	}

	if match := fromNowPattern.FindStringSubmatch(value); match != nil {
		count, err := strconv.Atoi(match[1])
		if err != nil || count <= 0 {
			return time.Time{}, false
		}
		return shiftRelative(anchor, count, strings.ToLower(strings.TrimSpace(match[2]))), true
	}

	if match := tomorrowPattern.FindStringSubmatch(value); match != nil {
		base := anchor.AddDate(0, 0, 1)
		withClock, ok := applyClock(base, strings.TrimSpace(match[1]), anchor)
		if !ok {
			return time.Time{}, false
		}
		return withClock, true
	}

	if nextWeekPattern.MatchString(value) {
		return anchor.AddDate(0, 0, 7), true
	}

	if match := weekdayPattern.FindStringSubmatch(value); match != nil {
		isNext := strings.TrimSpace(match[1]) != ""
		weekdayName := strings.ToLower(strings.TrimSpace(match[2]))
		targetWeekday, ok := weekdayIndexByName[weekdayName]
		if !ok {
			return time.Time{}, false
		}

		daysAhead := (int(targetWeekday) - int(anchor.Weekday()) + 7) % 7
		if isNext && daysAhead == 0 {
			daysAhead = 7
		}

		base := anchor.AddDate(0, 0, daysAhead)
		withClock, ok := applyClock(base, strings.TrimSpace(match[3]), anchor)
		if !ok {
			return time.Time{}, false
		}
		if !isNext && daysAhead == 0 && withClock.Before(anchor) {
			withClock = withClock.AddDate(0, 0, 7)
		}
		return withClock, true
	}

	if match := monthDayPattern.FindStringSubmatch(value); match != nil {
		monthName := strings.ToLower(strings.TrimSpace(match[1]))
		monthValue, ok := monthIndexByName[monthName]
		if !ok {
			return time.Time{}, false
		}

		day, err := strconv.Atoi(match[2])
		if err != nil || day < 1 || day > 31 {
			return time.Time{}, false
		}

		year := anchor.Year()
		if strings.TrimSpace(match[3]) != "" {
			explicitYear, err := strconv.Atoi(strings.TrimSpace(match[3]))
			if err != nil || explicitYear < 1 {
				return time.Time{}, false
			}
			year = explicitYear
		}

		base, ok := buildDateTime(year, monthValue, day, anchor.Hour(), anchor.Minute(), anchor.Second(), loc)
		if !ok {
			return time.Time{}, false
		}

		withClock, ok := applyClock(base, strings.TrimSpace(match[4]), anchor)
		if !ok {
			return time.Time{}, false
		}

		if strings.TrimSpace(match[3]) == "" && withClock.Before(anchor) {
			rolled, ok := buildDateTime(year+1, monthValue, day, withClock.Hour(), withClock.Minute(), withClock.Second(), loc)
			if !ok {
				return time.Time{}, false
			}
			withClock = rolled
		}

		return withClock, true
	}

	return time.Time{}, false
}

func shiftRelative(anchor time.Time, count int, unit string) time.Time {
	switch unit {
	case "day", "days":
		return anchor.AddDate(0, 0, count)
	case "week", "weeks":
		return anchor.AddDate(0, 0, count*7)
	case "month", "months":
		return anchor.AddDate(0, count, 0)
	default:
		return anchor
	}
}

func applyClock(base time.Time, rawClock string, fallback time.Time) (time.Time, bool) {
	trimmed := strings.TrimSpace(rawClock)
	if trimmed == "" {
		return time.Date(base.Year(), base.Month(), base.Day(), fallback.Hour(), fallback.Minute(), fallback.Second(), 0, base.Location()), true
	}

	hour, minute, ok := parseClock(trimmed)
	if !ok {
		return time.Time{}, false
	}
	return time.Date(base.Year(), base.Month(), base.Day(), hour, minute, 0, 0, base.Location()), true
}

func parseClock(raw string) (int, int, bool) {
	match := clockTimePattern.FindStringSubmatch(strings.TrimSpace(raw))
	if match == nil {
		return 0, 0, false
	}

	hour, err := strconv.Atoi(match[1])
	if err != nil {
		return 0, 0, false
	}

	minute := 0
	if strings.TrimSpace(match[2]) != "" {
		minute, err = strconv.Atoi(strings.TrimSpace(match[2]))
		if err != nil {
			return 0, 0, false
		}
	}
	if minute < 0 || minute > 59 {
		return 0, 0, false
	}

	period := strings.ToLower(strings.TrimSpace(match[3]))
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

func buildDateTime(year int, month time.Month, day int, hour int, minute int, second int, loc *time.Location) (time.Time, bool) {
	candidate := time.Date(year, month, day, hour, minute, second, 0, loc)
	if candidate.Year() != year || candidate.Month() != month || candidate.Day() != day {
		return time.Time{}, false
	}
	return candidate, true
}
