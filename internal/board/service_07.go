package board

import (
	"context"
	"fmt"
	"hash/fnv"
	"math/rand"
	"sort"
	"strings"
	"time"

	"donegeon/internal/task"
	"donegeon/internal/tenant"
)

func (s *Service) newDeckRand(state *State, deckID, packStackID string, seedArg *int) *rand.Rand {
	if seedArg != nil {
		return rand.New(rand.NewSource(int64(*seedArg)))
	}

	if !s.cfg.SeededRNG.Enabled || !s.cfg.SeededRNG.DeterministicDeckDraws {
		return rand.New(rand.NewSource(time.Now().UnixNano()))
	}

	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(strings.TrimSpace(deckID)))
	_, _ = hasher.Write([]byte("|"))
	_, _ = hasher.Write([]byte(strings.TrimSpace(packStackID)))
	_, _ = hasher.Write([]byte("|"))
	_, _ = hasher.Write([]byte(fmt.Sprintf("%d", state.NextZ)))
	return rand.New(rand.NewSource(int64(hasher.Sum64())))
}

func randomResourceCharges(min, max int, rng *rand.Rand) int {
	if min <= 0 && max <= 0 {
		return 1
	}
	if min <= 0 {
		min = max
	}
	if max <= 0 {
		max = min
	}
	if max < min {
		max = min
	}
	if rng == nil || min == max {
		return max
	}
	return min + rng.Intn((max-min)+1)
}

func packDefIDForDeck(deckDefID string) string {
	deckDefID = strings.TrimSpace(deckDefID)
	if deckDefID == "" {
		return "deck.first_day_pack"
	}
	return deckDefID + "_pack"
}

func findTaskStackIDByTaskID(state *State, taskID string) string {
	if state == nil || strings.TrimSpace(taskID) == "" {
		return ""
	}
	taskID = strings.TrimSpace(taskID)
	for stackID, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil || !isTaskCard(card) {
				continue
			}
			if cardTaskID(card) == taskID {
				return stackID
			}
		}
	}
	return ""
}

func buildSpawnModifierDefIDs(row task.Task) []string {
	mods := make([]string, 0, 3)
	seen := map[string]struct{}{}
	add := func(defID string) {
		defID = strings.TrimSpace(defID)
		if defID == "" {
			return
		}
		if _, exists := seen[defID]; exists {
			return
		}
		seen[defID] = struct{}{}
		mods = append(mods, defID)
	}

	if row.DueDeadline != nil && strings.TrimSpace(*row.DueDeadline) != "" {
		add("mod.deadline_pin")
	}
	if row.DueText != nil && strings.TrimSpace(*row.DueText) != "" {
		add("mod.deadline_pin")
	}
	if row.Recurrence != nil && strings.TrimSpace(*row.Recurrence) != "" {
		add("mod.recurring")
	}
	if hasNextActionLabel(row.Labels) {
		add("mod.next_action")
	}
	return mods
}

func taskCardDataFromTaskRow(row task.Task) map[string]any {
	title := strings.TrimSpace(row.Content)
	if title == "" {
		title = "Untitled task"
	}

	priority := row.Priority
	if priority < 1 || priority > 4 {
		priority = 4
	}

	data := map[string]any{
		"taskId":      strings.TrimSpace(row.ID),
		"title":       title,
		"description": strings.TrimSpace(row.Description),
		"priority":    priority,
	}

	if row.ProjectID != nil && strings.TrimSpace(*row.ProjectID) != "" {
		data["project"] = strings.TrimSpace(*row.ProjectID)
	}
	if row.Recurrence != nil && strings.TrimSpace(*row.Recurrence) != "" {
		data["recurrence"] = strings.TrimSpace(*row.Recurrence)
	}
	if row.DueText != nil && strings.TrimSpace(*row.DueText) != "" {
		data["dueText"] = strings.TrimSpace(*row.DueText)
	}
	if row.DueDeadline != nil && strings.TrimSpace(*row.DueDeadline) != "" {
		data["dueDeadline"] = strings.TrimSpace(*row.DueDeadline)
	}
	if row.ScheduleInput != nil && strings.TrimSpace(*row.ScheduleInput) != "" {
		data["scheduleInput"] = strings.TrimSpace(*row.ScheduleInput)
	}

	labels := make([]string, 0, len(row.Labels))
	for _, label := range row.Labels {
		normalized := strings.TrimSpace(label)
		if normalized == "" {
			continue
		}
		labels = append(labels, normalized)
	}
	if len(labels) > 0 {
		data["labels"] = labels
	}

	return data
}

func syncTaskCardDataFromTaskRow(card *Card, row task.Task) {
	if card == nil {
		return
	}
	if card.Data == nil {
		card.Data = map[string]any{}
	}

	next := taskCardDataFromTaskRow(row)
	syncedKeys := []string{
		"taskId",
		"title",
		"description",
		"priority",
		"project",
		"recurrence",
		"dueText",
		"dueDeadline",
		"scheduleInput",
		"labels",
	}

	for _, key := range syncedKeys {
		value, ok := next[key]
		if !ok {
			delete(card.Data, key)
			continue
		}
		card.Data[key] = value
	}
}

func cardQuestCreateCounted(card *Card) bool {
	if card == nil || card.Data == nil {
		return false
	}
	switch value := card.Data["questCreateCounted"].(type) {
	case bool:
		return value
	case float64:
		return value != 0
	case int:
		return value != 0
	case string:
		normalized := strings.TrimSpace(strings.ToLower(value))
		return normalized == "1" || normalized == "true" || normalized == "yes"
	default:
		return false
	}
}

func markQuestCreateCounted(card *Card) {
	if card == nil {
		return
	}
	if card.Data == nil {
		card.Data = map[string]any{}
	}
	card.Data["questCreateCounted"] = true
}

func shouldCountQuestCreateFromTitle(card *Card, title string) bool {
	if card == nil {
		return false
	}
	if cardQuestCreateCounted(card) {
		return false
	}
	if strings.TrimSpace(cardTaskID(card)) != "" {
		return false
	}
	normalized := strings.TrimSpace(title)
	if normalized == "" {
		return false
	}
	return !strings.EqualFold(normalized, "untitled task")
}

func modifierRequirementCounts(defIDs []string) map[string]int {
	counts := map[string]int{}
	for _, defID := range defIDs {
		normalized := strings.TrimSpace(strings.ToLower(defID))
		if normalized == "" {
			continue
		}
		counts[normalized]++
	}
	return counts
}

func sortedModifierDefIDs(counts map[string]int) []string {
	ordered := make([]string, 0, len(counts))
	for defID, count := range counts {
		if strings.TrimSpace(defID) == "" || count <= 0 {
			continue
		}
		ordered = append(ordered, defID)
	}
	sort.Strings(ordered)
	return ordered
}

func collectConsumableModifierCards(state *State) map[string][]modifierCardRef {
	available := map[string][]modifierCardRef{}
	if state == nil {
		return available
	}

	stackIDs := make([]string, 0, len(state.Stacks))
	for stackID := range state.Stacks {
		stackIDs = append(stackIDs, stackID)
	}
	sort.Strings(stackIDs)

	for _, stackID := range stackIDs {
		stack := state.GetStack(stackID)
		if stack == nil || len(stack.Cards) == 0 {
			continue
		}

		refs := make([]modifierCardRef, 0, len(stack.Cards))
		modifierOnly := true
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil {
				modifierOnly = false
				break
			}
			defID := strings.TrimSpace(strings.ToLower(card.DefID))
			if !strings.HasPrefix(defID, "mod.") {
				modifierOnly = false
				break
			}
			refs = append(refs, modifierCardRef{
				StackID: stackID,
				CardID:  cardID,
				DefID:   defID,
			})
		}
		if !modifierOnly {
			continue
		}

		for _, ref := range refs {
			available[ref.DefID] = append(available[ref.DefID], ref)
		}
	}

	return available
}

func taskActivationCoinCost(requiredModifierTotal int) int {
	if requiredModifierTotal <= 0 {
		return 0
	}
	return requiredModifierTotal
}

func detachCardFromStack(state *State, stackID, cardID string) {
	if state == nil {
		return
	}
	stack := state.GetStack(stackID)
	if stack == nil {
		return
	}

	filtered := make([]string, 0, len(stack.Cards))
	removed := false
	for _, current := range stack.Cards {
		if !removed && current == cardID {
			removed = true
			continue
		}
		filtered = append(filtered, current)
	}
	stack.Cards = filtered

	if len(stack.Cards) == 0 {
		delete(state.Stacks, stackID)
		return
	}
	ensurePriorityFaceCard(state, stack)
}

func boardProjectIDForBoard(boardID string) string {
	normalized := strings.TrimSpace(boardID)
	if normalized == "" || strings.EqualFold(normalized, DefaultBoardID) {
		return "board"
	}
	return normalized
}

func matchesBoardProject(raw string, boardID string) bool {
	return strings.EqualFold(tenant.ProjectSlug(raw), tenant.ProjectSlug(boardProjectIDForBoard(boardID)))
}

func matchesBoardProjectPtr(value *string, boardID string) bool {
	if value == nil {
		return false
	}
	return matchesBoardProject(*value, boardID)
}

func isBoardLiveLabel(raw string) bool {
	normalized := strings.TrimSpace(strings.ToLower(raw))
	normalized = strings.TrimPrefix(normalized, "@")
	normalized = strings.NewReplacer("_", "", "-", "", " ", "").Replace(normalized)
	return normalized == "boardlive"
}

func hasBoardLiveLabel(labels []string) bool {
	for _, label := range labels {
		if isBoardLiveLabel(label) {
			return true
		}
	}
	return false
}

func appendBoardLiveLabel(labels []string) []string {
	if hasBoardLiveLabel(labels) {
		return append([]string{}, labels...)
	}
	next := append([]string{}, labels...)
	next = append(next, boardLiveLabelValue)
	return next
}

func (s *Service) ensureTaskHasBoardLiveLabel(ctx context.Context, taskID string) error {
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
	labels := appendBoardLiveLabel(item.Labels)
	if len(labels) == len(item.Labels) {
		return nil
	}
	_, err = s.tasks.Update(ctx, taskID, task.UpdateInput{Labels: &labels})
	return err
}

func hasNextActionLabel(labels []string) bool {
	for _, label := range labels {
		if isNextActionLabel(label) {
			return true
		}
	}
	return false
}

func isNextActionLabel(raw string) bool {
	normalized := strings.TrimSpace(strings.ToLower(raw))
	normalized = strings.TrimPrefix(normalized, "@")
	normalized = strings.NewReplacer("_", "", "-", "", " ", "").Replace(normalized)
	return normalized == "nextaction"
}
