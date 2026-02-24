package rrule

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Frequency string

const (
	FreqSecondly Frequency = "SECONDLY"
	FreqMinutely Frequency = "MINUTELY"
	FreqHourly   Frequency = "HOURLY"
	FreqDaily    Frequency = "DAILY"
	FreqWeekly   Frequency = "WEEKLY"
	FreqMonthly  Frequency = "MONTHLY"
	FreqYearly   Frequency = "YEARLY"
)

type Weekday string

const (
	WeekdaySunday    Weekday = "SU"
	WeekdayMonday    Weekday = "MO"
	WeekdayTuesday   Weekday = "TU"
	WeekdayWednesday Weekday = "WE"
	WeekdayThursday  Weekday = "TH"
	WeekdayFriday    Weekday = "FR"
	WeekdaySaturday  Weekday = "SA"
)

type ByDayEntry struct {
	Ordinal *int    `json:"ordinal,omitempty"`
	Weekday Weekday `json:"weekday"`
}

type Until struct {
	Value  string `json:"value"`
	IsDate bool   `json:"isDate"`
	UTC    bool   `json:"utc"`
}

type Rule struct {
	Raw            string            `json:"raw"`
	Freq           Frequency         `json:"freq"`
	Until          *Until            `json:"until,omitempty"`
	Count          *int              `json:"count,omitempty"`
	Interval       *int              `json:"interval,omitempty"`
	BySecond       []int             `json:"bySecond,omitempty"`
	ByMinute       []int             `json:"byMinute,omitempty"`
	ByHour         []int             `json:"byHour,omitempty"`
	ByDay          []ByDayEntry      `json:"byDay,omitempty"`
	ByMonthDay     []int             `json:"byMonthDay,omitempty"`
	ByYearDay      []int             `json:"byYearDay,omitempty"`
	ByWeekNo       []int             `json:"byWeekNo,omitempty"`
	ByMonth        []int             `json:"byMonth,omitempty"`
	BySetPos       []int             `json:"bySetPos,omitempty"`
	WeekStart      *Weekday          `json:"weekStart,omitempty"`
	ExtensionParts map[string]string `json:"extensionParts,omitempty"`
}

var (
	tokenNamePattern = regexp.MustCompile(`^[A-Z][A-Z0-9-]*$`)
	byDayPattern     = regexp.MustCompile(`^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$`)
	datePattern      = regexp.MustCompile(`^\d{8}$`)
	dateTimePattern  = regexp.MustCompile(`^\d{8}T\d{6}Z?$`)
	unsignedPattern  = regexp.MustCompile(`^\d+$`)
)

func Parse(input string) (Rule, error) {
	raw := strings.TrimSpace(input)
	if raw == "" {
		return Rule{}, fmt.Errorf("rrule is empty")
	}

	value := raw
	if strings.HasPrefix(strings.ToUpper(value), "RRULE:") {
		value = strings.TrimSpace(value[len("RRULE:"):])
	}
	if value == "" {
		return Rule{}, fmt.Errorf("rrule body is empty")
	}

	rule := Rule{
		Raw:            raw,
		ExtensionParts: map[string]string{},
	}
	seen := map[string]bool{}

	parts := strings.Split(value, ";")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return Rule{}, fmt.Errorf("invalid empty rule part")
		}

		pieces := strings.SplitN(part, "=", 2)
		if len(pieces) != 2 {
			return Rule{}, fmt.Errorf("invalid rule part %q", part)
		}

		name := strings.ToUpper(strings.TrimSpace(pieces[0]))
		partValue := strings.TrimSpace(pieces[1])
		if name == "" || partValue == "" {
			return Rule{}, fmt.Errorf("invalid rule part %q", part)
		}
		if seen[name] {
			return Rule{}, fmt.Errorf("duplicate rule part %s", name)
		}

		switch name {
		case "FREQ":
			freq, err := parseFrequency(partValue)
			if err != nil {
				return Rule{}, err
			}
			rule.Freq = freq
		case "UNTIL":
			until, err := parseUntil(partValue)
			if err != nil {
				return Rule{}, err
			}
			rule.Until = &until
		case "COUNT":
			count, err := parseUnsignedInt(partValue)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid COUNT: %w", err)
			}
			rule.Count = &count
		case "INTERVAL":
			interval, err := parseUnsignedInt(partValue)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid INTERVAL: %w", err)
			}
			rule.Interval = &interval
		case "BYSECOND":
			vals, err := parseIntList(partValue, 0, 60, false)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYSECOND: %w", err)
			}
			rule.BySecond = vals
		case "BYMINUTE":
			vals, err := parseIntList(partValue, 0, 59, false)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYMINUTE: %w", err)
			}
			rule.ByMinute = vals
		case "BYHOUR":
			vals, err := parseIntList(partValue, 0, 23, false)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYHOUR: %w", err)
			}
			rule.ByHour = vals
		case "BYDAY":
			vals, err := parseByDayList(partValue)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYDAY: %w", err)
			}
			rule.ByDay = vals
		case "BYMONTHDAY":
			vals, err := parseIntList(partValue, -31, 31, true)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYMONTHDAY: %w", err)
			}
			rule.ByMonthDay = vals
		case "BYYEARDAY":
			vals, err := parseIntList(partValue, -366, 366, true)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYYEARDAY: %w", err)
			}
			rule.ByYearDay = vals
		case "BYWEEKNO":
			vals, err := parseIntList(partValue, -53, 53, true)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYWEEKNO: %w", err)
			}
			rule.ByWeekNo = vals
		case "BYMONTH":
			vals, err := parseIntList(partValue, 1, 12, false)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYMONTH: %w", err)
			}
			rule.ByMonth = vals
		case "BYSETPOS":
			vals, err := parseIntList(partValue, -366, 366, true)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid BYSETPOS: %w", err)
			}
			rule.BySetPos = vals
		case "WKST":
			weekday, err := parseWeekday(partValue)
			if err != nil {
				return Rule{}, fmt.Errorf("invalid WKST: %w", err)
			}
			rule.WeekStart = &weekday
		default:
			if !tokenNamePattern.MatchString(name) {
				return Rule{}, fmt.Errorf("invalid rule part name %q", name)
			}
			rule.ExtensionParts[name] = partValue
		}

		seen[name] = true
	}

	if rule.Freq == "" {
		return Rule{}, fmt.Errorf("FREQ is required")
	}
	if rule.Count != nil && rule.Until != nil {
		return Rule{}, fmt.Errorf("COUNT and UNTIL must not both be present")
	}
	if len(rule.BySetPos) > 0 &&
		len(rule.BySecond) == 0 &&
		len(rule.ByMinute) == 0 &&
		len(rule.ByHour) == 0 &&
		len(rule.ByDay) == 0 &&
		len(rule.ByMonthDay) == 0 &&
		len(rule.ByYearDay) == 0 &&
		len(rule.ByWeekNo) == 0 &&
		len(rule.ByMonth) == 0 {
		return Rule{}, fmt.Errorf("BYSETPOS requires at least one other BY* rule part")
	}

	if len(rule.ExtensionParts) == 0 {
		rule.ExtensionParts = nil
	}

	return rule, nil
}

func (r Rule) Canonical() string {
	parts := []string{fmt.Sprintf("FREQ=%s", r.Freq)}

	if r.Until != nil {
		parts = append(parts, "UNTIL="+r.Until.Value)
	}
	if r.Count != nil {
		parts = append(parts, fmt.Sprintf("COUNT=%d", *r.Count))
	}
	if r.Interval != nil {
		parts = append(parts, fmt.Sprintf("INTERVAL=%d", *r.Interval))
	}
	if len(r.BySecond) > 0 {
		parts = append(parts, "BYSECOND="+joinInts(r.BySecond))
	}
	if len(r.ByMinute) > 0 {
		parts = append(parts, "BYMINUTE="+joinInts(r.ByMinute))
	}
	if len(r.ByHour) > 0 {
		parts = append(parts, "BYHOUR="+joinInts(r.ByHour))
	}
	if len(r.ByDay) > 0 {
		parts = append(parts, "BYDAY="+joinByDay(r.ByDay))
	}
	if len(r.ByMonthDay) > 0 {
		parts = append(parts, "BYMONTHDAY="+joinInts(r.ByMonthDay))
	}
	if len(r.ByYearDay) > 0 {
		parts = append(parts, "BYYEARDAY="+joinInts(r.ByYearDay))
	}
	if len(r.ByWeekNo) > 0 {
		parts = append(parts, "BYWEEKNO="+joinInts(r.ByWeekNo))
	}
	if len(r.ByMonth) > 0 {
		parts = append(parts, "BYMONTH="+joinInts(r.ByMonth))
	}
	if len(r.BySetPos) > 0 {
		parts = append(parts, "BYSETPOS="+joinInts(r.BySetPos))
	}
	if r.WeekStart != nil {
		parts = append(parts, "WKST="+string(*r.WeekStart))
	}
	if len(r.ExtensionParts) > 0 {
		names := make([]string, 0, len(r.ExtensionParts))
		for name := range r.ExtensionParts {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			parts = append(parts, fmt.Sprintf("%s=%s", name, r.ExtensionParts[name]))
		}
	}

	return strings.Join(parts, ";")
}

func parseFrequency(value string) (Frequency, error) {
	freq := Frequency(strings.ToUpper(value))
	switch freq {
	case FreqSecondly, FreqMinutely, FreqHourly, FreqDaily, FreqWeekly, FreqMonthly, FreqYearly:
		return freq, nil
	default:
		return "", fmt.Errorf("unsupported FREQ value %q", value)
	}
}

func parseUntil(value string) (Until, error) {
	upper := strings.ToUpper(strings.TrimSpace(value))
	if datePattern.MatchString(upper) {
		if _, err := time.Parse("20060102", upper); err != nil {
			return Until{}, fmt.Errorf("invalid UNTIL date %q", value)
		}
		return Until{Value: upper, IsDate: true}, nil
	}
	if dateTimePattern.MatchString(upper) {
		layout := "20060102T150405"
		utc := false
		if strings.HasSuffix(upper, "Z") {
			layout = "20060102T150405Z"
			utc = true
		}
		if _, err := time.Parse(layout, upper); err != nil {
			return Until{}, fmt.Errorf("invalid UNTIL datetime %q", value)
		}
		return Until{Value: upper, IsDate: false, UTC: utc}, nil
	}
	return Until{}, fmt.Errorf("UNTIL must be date (YYYYMMDD) or date-time (YYYYMMDDThhmmss[Z])")
}

func parseUnsignedInt(value string) (int, error) {
	if !unsignedPattern.MatchString(value) {
		return 0, fmt.Errorf("must be a positive integer")
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0, err
	}
	if n <= 0 {
		return 0, fmt.Errorf("must be > 0")
	}
	return n, nil
}

func parseIntList(value string, min int, max int, disallowZero bool) ([]int, error) {
	raw := strings.Split(value, ",")
	if len(raw) == 0 {
		return nil, fmt.Errorf("empty list")
	}

	result := make([]int, 0, len(raw))
	for _, part := range raw {
		part = strings.TrimSpace(part)
		if part == "" {
			return nil, fmt.Errorf("empty list value")
		}
		n, err := strconv.Atoi(part)
		if err != nil {
			return nil, fmt.Errorf("invalid integer %q", part)
		}
		if disallowZero && n == 0 {
			return nil, fmt.Errorf("0 is not allowed")
		}
		if n < min || n > max {
			return nil, fmt.Errorf("%d out of range (%d..%d)", n, min, max)
		}
		result = append(result, n)
	}

	return result, nil
}

func parseByDayList(value string) ([]ByDayEntry, error) {
	raw := strings.Split(value, ",")
	if len(raw) == 0 {
		return nil, fmt.Errorf("empty list")
	}

	result := make([]ByDayEntry, 0, len(raw))
	for _, part := range raw {
		part = strings.ToUpper(strings.TrimSpace(part))
		match := byDayPattern.FindStringSubmatch(part)
		if match == nil {
			return nil, fmt.Errorf("invalid BYDAY value %q", part)
		}

		entry := ByDayEntry{Weekday: Weekday(match[2])}
		if match[1] != "" {
			ord, err := strconv.Atoi(match[1])
			if err != nil {
				return nil, fmt.Errorf("invalid BYDAY ordinal %q", match[1])
			}
			if ord == 0 || ord < -53 || ord > 53 {
				return nil, fmt.Errorf("BYDAY ordinal %d out of range (-53..-1,1..53)", ord)
			}
			entry.Ordinal = &ord
		}
		result = append(result, entry)
	}

	return result, nil
}

func parseWeekday(value string) (Weekday, error) {
	weekday := Weekday(strings.ToUpper(strings.TrimSpace(value)))
	switch weekday {
	case WeekdaySunday, WeekdayMonday, WeekdayTuesday, WeekdayWednesday, WeekdayThursday, WeekdayFriday, WeekdaySaturday:
		return weekday, nil
	default:
		return "", fmt.Errorf("invalid weekday %q", value)
	}
}

func joinInts(values []int) string {
	parts := make([]string, 0, len(values))
	for _, v := range values {
		parts = append(parts, strconv.Itoa(v))
	}
	return strings.Join(parts, ",")
}

func joinByDay(values []ByDayEntry) string {
	parts := make([]string, 0, len(values))
	for _, value := range values {
		prefix := ""
		if value.Ordinal != nil {
			prefix = strconv.Itoa(*value.Ordinal)
		}
		parts = append(parts, prefix+string(value.Weekday))
	}
	return strings.Join(parts, ",")
}
