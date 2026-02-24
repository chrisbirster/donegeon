package rrule

import "testing"

func TestParse_AllRuleParts(t *testing.T) {
	raw := "RRULE:FREQ=YEARLY;UNTIL=20261231T235959Z;INTERVAL=2;BYSECOND=0,30,60;BYMINUTE=0,15,59;BYHOUR=0,12,23;BYDAY=MO,-1FR,+2TU;BYMONTHDAY=1,-1,31;BYYEARDAY=1,-1,366,-366;BYWEEKNO=1,-1,53,-53;BYMONTH=1,6,12;BYSETPOS=1,-1,366,-366;WKST=SU;X-CUSTOM=abc;IANA-TOKEN=value"

	rule, err := Parse(raw)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if rule.Freq != FreqYearly {
		t.Fatalf("unexpected freq %q", rule.Freq)
	}
	if rule.Until == nil || rule.Until.Value != "20261231T235959Z" {
		t.Fatalf("unexpected until %+v", rule.Until)
	}
	if rule.Interval == nil || *rule.Interval != 2 {
		t.Fatalf("unexpected interval %+v", rule.Interval)
	}
	if len(rule.BySecond) != 3 || rule.BySecond[2] != 60 {
		t.Fatalf("unexpected bysecond %v", rule.BySecond)
	}
	if len(rule.ByDay) != 3 {
		t.Fatalf("unexpected byday len %d", len(rule.ByDay))
	}
	if rule.ByDay[1].Ordinal == nil || *rule.ByDay[1].Ordinal != -1 || rule.ByDay[1].Weekday != WeekdayFriday {
		t.Fatalf("unexpected byday[1] %+v", rule.ByDay[1])
	}
	if rule.WeekStart == nil || *rule.WeekStart != WeekdaySunday {
		t.Fatalf("unexpected wkst %+v", rule.WeekStart)
	}
	if rule.ExtensionParts["X-CUSTOM"] != "abc" || rule.ExtensionParts["IANA-TOKEN"] != "value" {
		t.Fatalf("unexpected extension parts %v", rule.ExtensionParts)
	}
}

func TestParse_CountAndUntilConflict(t *testing.T) {
	_, err := Parse("FREQ=DAILY;COUNT=10;UNTIL=20270101")
	if err == nil {
		t.Fatal("expected error for COUNT+UNTIL")
	}
}

func TestParse_InvalidBySecond(t *testing.T) {
	_, err := Parse("FREQ=DAILY;BYSECOND=61")
	if err == nil {
		t.Fatal("expected BYSECOND range error")
	}
}

func TestParse_InvalidByDay(t *testing.T) {
	_, err := Parse("FREQ=WEEKLY;BYDAY=XY")
	if err == nil {
		t.Fatal("expected invalid BYDAY error")
	}
}

func TestParse_BySetPosRequiresOtherByPart(t *testing.T) {
	_, err := Parse("FREQ=MONTHLY;BYSETPOS=1")
	if err == nil {
		t.Fatal("expected BYSETPOS error")
	}
}

func TestParse_Canonical(t *testing.T) {
	rule, err := Parse("RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;WKST=MO")
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}

	canonical := rule.Canonical()
	want := "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;WKST=MO"
	if canonical != want {
		t.Fatalf("canonical mismatch\n got: %s\nwant: %s", canonical, want)
	}
}
