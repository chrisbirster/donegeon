package board

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"donegeon/internal/rrule"
	"donegeon/internal/task"
)

func appendNextActionLabel(labels []string) []string {
	if hasNextActionLabel(labels) {
		return append([]string{}, labels...)
	}
	next := append([]string{}, labels...)
	next = append(next, "next_action")
	return next
}

func (s *Service) ensureTaskHasNextActionLabel(ctx context.Context, taskID string) error {
	if s == nil || s.tasks == nil {
		return nil
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil
	}

	item, err := s.tasks.Get(ctx, taskID)
	if err != nil {
		return err
	}

	labels := appendNextActionLabel(item.Labels)
	if len(labels) == len(item.Labels) {
		return nil
	}
	_, err = s.tasks.Update(ctx, taskID, task.UpdateInput{Labels: &labels})
	return err
}

func normalizeModifierDefID(raw string) string {
	modifierDefID := strings.TrimSpace(raw)
	if modifierDefID == "" {
		return ""
	}
	if !strings.HasPrefix(modifierDefID, "mod.") {
		modifierDefID = "mod." + modifierDefID
	}
	return modifierDefID
}

func isGlobalUniqueModifier(defID string) bool {
	switch strings.TrimSpace(defID) {
	case "mod.deadline_pin":
		return true
	default:
		return false
	}
}

func hasCardDefID(state *State, defID string) bool {
	if state == nil {
		return false
	}
	defID = strings.TrimSpace(defID)
	for _, card := range state.Cards {
		if card == nil {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(card.DefID), defID) {
			return true
		}
	}
	return false
}

func modifierSingleUseOnTaskComplete(defID string) bool {
	return strings.EqualFold(strings.TrimSpace(defID), "mod.next_action")
}

func inferDeckRowY(state *State, fallback int) int {
	if state == nil {
		return fallback
	}
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		card := topCard(state, stack)
		if card == nil {
			continue
		}
		if strings.HasPrefix(card.DefID, "deck.") {
			return stack.Pos.Y
		}
	}
	return fallback
}

func retireFirstDayDeckStacks(state *State) []string {
	if state == nil {
		return nil
	}
	removed := make([]string, 0)
	for stackID, stack := range state.Stacks {
		if stack == nil || len(stack.Cards) == 0 {
			continue
		}
		card := topCard(state, stack)
		if card == nil {
			continue
		}
		defID := strings.TrimSpace(card.DefID)
		if defID == "deck.first_day" || defID == "deck.first_day_pack" {
			for _, cardID := range stack.Cards {
				delete(state.Cards, cardID)
			}
			delete(state.Stacks, stackID)
			removed = append(removed, stackID)
		}
	}
	return removed
}

func (s *Service) ensurePostFirstDayDeckStacks(state *State, deckRowY int) []string {
	if state == nil {
		return nil
	}
	progression := s.cfg.ProgressionDeckDefIDs()
	created := make([]string, 0, len(progression))
	startX := 60
	spacing := 110
	for i, defID := range progression {
		if hasTopCardDefID(state, defID) {
			continue
		}
		slot := i + 1
		stack := createSingleCardStack(state, defID, Point{
			X: startX + slot*spacing,
			Y: deckRowY,
		}, nil)
		created = append(created, stack.ID)
	}
	return created
}

func hasTopCardDefID(state *State, defID string) bool {
	if state == nil {
		return false
	}
	for _, stack := range state.Stacks {
		if stack == nil || len(stack.Cards) == 0 {
			continue
		}
		card := topCard(state, stack)
		if card == nil {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(card.DefID), strings.TrimSpace(defID)) {
			return true
		}
	}
	return false
}

func countZombieStacks(state *State) int {
	if state == nil {
		return 0
	}
	count := 0
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		if stackHasKind(state, stack, "zombie") {
			count++
		}
	}
	return count
}

func (s *Service) isDeckUnlocked(ctx context.Context, state *State, deckCfg deckConfig) (bool, string) {
	condType := strings.ToLower(strings.TrimSpace(deckCfg.Unlock.Type))
	switch condType {
	case "", "always", "unlocked":
		return true, ""
	case "day_ticks_gte":
		meta := ensureMeta(state)
		need := maxInt(deckCfg.Unlock.Value, 0)
		if meta.DayTickCount >= need {
			return true, ""
		}
		return false, fmt.Sprintf("day ticks %d/%d", meta.DayTickCount, need)
	case "processed_tasks_gte":
		need := maxInt(deckCfg.Unlock.Value, 0)
		if need == 0 {
			return true, ""
		}
		processed := 0
		if s.tasks != nil {
			items, err := listAllTasks(ctx, s.tasks)
			if err == nil {
				for _, item := range items {
					processed += maxInt(item.ProcessedCount, 0)
				}
			}
		}
		if processed >= need {
			return true, ""
		}
		return false, fmt.Sprintf("processed tasks %d/%d", processed, need)
	case "zombies_seen_gte":
		need := maxInt(deckCfg.Unlock.Value, 0)
		meta := ensureMeta(state)
		seen := meta.Metrics["zombies_seen"]
		if seen >= need {
			return true, ""
		}
		return false, fmt.Sprintf("zombies seen %d/%d", seen, need)
	default:
		return false, fmt.Sprintf("unsupported unlock condition: %s", condType)
	}
}

func (s *Service) deckOpenCost(deckCfg deckConfig, zombieCount int, overrunLevel int) int {
	if deckCfg.BaseCost <= 0 {
		return 0
	}
	zombieMultiplier := s.cfg.Decks.Economy.ZombieCostMultiplierPerZombie
	overrunMultiplier := s.cfg.Decks.Economy.OverrunCostMultiplierPerLevel
	factor := 1.0 + (float64(zombieCount) * zombieMultiplier) + (float64(overrunLevel) * overrunMultiplier)
	if factor < 0 {
		factor = 0
	}
	return int(math.Ceil(float64(deckCfg.BaseCost) * factor))
}

func listAllTasks(ctx context.Context, svc TaskService) ([]task.Task, error) {
	if svc == nil {
		return nil, nil
	}
	cursor := 0
	limit := 200
	items := make([]task.Task, 0, 256)
	for {
		result, err := svc.List(ctx, task.ListParams{
			Limit:  limit,
			Cursor: cursor,
		})
		if err != nil {
			return nil, err
		}
		items = append(items, result.Items...)
		if result.NextCursor == nil {
			break
		}
		cursor = *result.NextCursor
	}
	return items, nil
}

func isTaskOverdueAtTick(item task.Task, tickDate time.Time, graceHours int) bool {
	if item.Checked || item.IsDeleted {
		return false
	}
	due, ok := bestTaskDueTime(item, tickDate.Location())
	if !ok {
		return false
	}
	if graceHours > 0 {
		due = due.Add(time.Duration(graceHours) * time.Hour)
	}
	return due.Before(tickDate)
}

func bestTaskDueTime(item task.Task, location *time.Location) (time.Time, bool) {
	if due, ok := parseTaskDueTime(item.DueDeadline, location); ok {
		return due, true
	}
	if due, ok := parseTaskDueTime(item.DueText, location); ok {
		return due, true
	}
	return time.Time{}, false
}

func parseTaskDueTime(value *string, location *time.Location) (time.Time, bool) {
	if value == nil {
		return time.Time{}, false
	}
	raw := strings.TrimSpace(*value)
	if raw == "" {
		return time.Time{}, false
	}
	upper := strings.ToUpper(raw)
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed.In(location), true
	}
	if parsed, err := time.ParseInLocation("2006-01-02", raw, location); err == nil {
		return parsed, true
	}
	if parsed, err := time.ParseInLocation("20060102", raw, location); err == nil {
		return parsed, true
	}
	if upper == "TODAY" {
		now := time.Now().In(location)
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location), true
	}
	if upper == "TOMORROW" {
		now := time.Now().In(location).AddDate(0, 0, 1)
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location), true
	}
	if strings.HasPrefix(strings.ToLower(raw), "in ") && strings.HasSuffix(strings.ToLower(raw), " days") {
		num := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.ToLower(raw), "in "), " days"))
		if n, err := atoi(num); err == nil && n >= 0 {
			now := time.Now().In(location).AddDate(0, 0, n)
			return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location), true
		}
	}
	if strings.HasPrefix(strings.ToLower(raw), "in ") && strings.HasSuffix(strings.ToLower(raw), " day") {
		num := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.ToLower(raw), "in "), " day"))
		if n, err := atoi(num); err == nil && n >= 0 {
			now := time.Now().In(location).AddDate(0, 0, n)
			return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location), true
		}
	}
	return time.Time{}, false
}

func nextRecurrenceDueDate(rruleValue string, item task.Task, tickDate time.Time) string {
	rule, err := rrule.Parse(rruleValue)
	if err != nil {
		return tickDate.Format("2006-01-02")
	}

	base := tickDate
	if due, ok := bestTaskDueTime(item, tickDate.Location()); ok {
		base = due
	}
	interval := 1
	if rule.Interval != nil && *rule.Interval > 0 {
		interval = *rule.Interval
	}

	next := base
	for next.Before(tickDate) {
		switch rule.Freq {
		case rrule.FreqWeekly:
			next = next.AddDate(0, 0, 7*interval)
		case rrule.FreqMonthly:
			next = next.AddDate(0, interval, 0)
		case rrule.FreqYearly:
			next = next.AddDate(interval, 0, 0)
		case rrule.FreqHourly:
			next = next.Add(time.Duration(interval) * time.Hour)
		case rrule.FreqMinutely:
			next = next.Add(time.Duration(interval) * time.Minute)
		case rrule.FreqSecondly:
			next = next.Add(time.Duration(interval) * time.Second)
		case rrule.FreqDaily:
			fallthrough
		default:
			next = next.AddDate(0, 0, interval)
		}
	}

	if rule.Until != nil {
		until, ok := parseRuleUntil(*rule.Until, tickDate.Location())
		if ok && next.After(until) {
			return tickDate.Format("2006-01-02")
		}
	}
	return next.Format("2006-01-02")
}

func parseRuleUntil(until rrule.Until, location *time.Location) (time.Time, bool) {
	value := strings.TrimSpace(until.Value)
	if value == "" {
		return time.Time{}, false
	}
	if until.IsDate {
		parsed, err := time.ParseInLocation("20060102", value, location)
		if err != nil {
			return time.Time{}, false
		}
		return parsed, true
	}
	layout := "20060102T150405"
	if until.UTC {
		layout = "20060102T150405Z"
		parsed, err := time.Parse(layout, value)
		if err != nil {
			return time.Time{}, false
		}
		return parsed.In(location), true
	}
	parsed, err := time.ParseInLocation(layout, value, location)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
}
