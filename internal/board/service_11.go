package board

import (
	"encoding/json"
	"fmt"
	"strings"
)

func (s *Service) taskCompletionRewards(progress *VillagerProgress, cards []*Card, stackID string, basePos Point) []resolvedReward {
	repeats := len(cards)
	if repeats <= 0 {
		return nil
	}
	table := s.cfg.Villagers.Leveling.TaskCompletionRewards
	rewards := resolveRewardTable(
		table,
		repeats,
		"task.complete",
		stackID,
		fmt.Sprintf("%d:%d", basePos.X, basePos.Y),
	)
	if len(rewards) == 0 {
		rewards = []resolvedReward{{Kind: "loot", ID: "coin", Amount: repeats}}
	}
	if bonusCurrency := s.taskCompleteCurrencyBonus(progress); bonusCurrency > 0 {
		rewards = append(rewards, resolvedReward{
			Kind:   "loot",
			ID:     "coin",
			Amount: bonusCurrency * repeats,
		})
	}
	return collapseResolvedRewards(rewards)
}

func (s *Service) taskCompletionInventoryRewards(completedCount int) []resolvedReward {
	if completedCount <= 0 {
		return nil
	}
	filtered := make([]resolvedReward, 0, completedCount*len(s.cfg.Villagers.Leveling.TaskCompletionRewards.Guaranteed))
	for repeat := 0; repeat < completedCount; repeat++ {
		for _, entry := range s.cfg.Villagers.Leveling.TaskCompletionRewards.Guaranteed {
			if reward, ok := normalizeResolvedReward(entry.Type, entry.ID, entry.Amount); ok && reward.Kind == "loot" {
				filtered = append(filtered, reward)
			}
		}
	}
	if len(filtered) == 0 {
		filtered = append(filtered, resolvedReward{Kind: "loot", ID: "coin", Amount: completedCount})
	}
	return collapseResolvedRewards(filtered)
}

func (s *Service) resourceGatherRewards(progress *VillagerProgress, resourceCard *Card, villagerID string, stackID string, chargesRemaining int) []resolvedReward {
	if resourceCard == nil {
		return nil
	}
	resourceID := strings.TrimSpace(strings.TrimPrefix(resourceCard.DefID, "resource."))
	var rewards []resolvedReward
	if node := s.cfg.ResourceNodeByID(resourceID); node != nil {
		rewards = resolveRewardTable(
			node.Gather.Rewards,
			1,
			"resource.gather",
			resourceCard.ID,
			villagerID,
			stackID,
			resourceID,
			fmt.Sprintf("charges:%d", chargesRemaining),
		)
	}
	if len(rewards) == 0 {
		if fallback, ok := normalizeResolvedReward("loot", strings.TrimPrefix(resourceDropDefID(resourceCard.DefID), "loot."), 1); ok {
			rewards = []resolvedReward{fallback}
		}
	}
	bonus := s.resourceDropAmountBonus(progress)
	if bonus > 0 {
		for index := range rewards {
			if rewards[index].Kind == "loot" {
				rewards[index].Amount += bonus
			}
		}
	}
	return collapseResolvedRewards(rewards)
}

func (s *Service) zombieClearReward(zombieStackID, villagerID string, clearedCount int) (string, int) {
	if len(s.cfg.Zombies.Types) == 0 {
		return "coin", 1
	}
	rewards := resolveRewardTable(
		s.cfg.Zombies.Types[0].Cleanup.RewardOnClear,
		1,
		"zombie.clear",
		zombieStackID,
		villagerID,
		fmt.Sprintf("cleared:%d", clearedCount),
	)
	for _, reward := range rewards {
		if reward.Kind == "loot" {
			return reward.ID, reward.Amount
		}
	}
	return "", 0
}

func (s *Service) taskDueGraceHours() int {
	grace := s.cfg.Tasks.DueDate.GraceHours
	if grace < 0 {
		return 0
	}
	return grace
}

func (s *Service) staminaRestoreForFood(foodDefID string, progress *VillagerProgress) int {
	foodID := strings.TrimSpace(strings.TrimPrefix(foodDefID, "food."))
	if item := s.cfg.FoodByID(foodID); item != nil && item.StaminaRestore > 0 {
		return item.StaminaRestore + s.foodStaminaRestoreBonus(progress)
	}
	switch strings.TrimSpace(foodDefID) {
	case "food.bread":
		return 3 + s.foodStaminaRestoreBonus(progress)
	case "food.berries", "food.berry":
		return 2 + s.foodStaminaRestoreBonus(progress)
	default:
		return 1 + s.foodStaminaRestoreBonus(progress)
	}
}

func perkSummary(perk *PerkConfig) string {
	if perk == nil || perk.Apply == nil {
		return ""
	}
	parts := []string{}
	if value := intFromAny(perk.Apply["max_stamina_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d max stamina", value))
	}
	if value := intFromAny(perk.Apply["task_complete_currency_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d coin on task completion", value))
	}
	if value := intFromAny(perk.Apply["task_complete_xp_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d XP on task completion", value))
	}
	if value := intFromAny(perk.Apply["zombie_clear_stamina_cost_add"]); value != 0 {
		summary := fmt.Sprintf("%+d zombie clear stamina cost", value)
		if minCost := intFromAny(perk.Apply["min_zombie_clear_cost"]); minCost > 0 {
			summary += fmt.Sprintf(" (min %d)", minCost)
		}
		parts = append(parts, summary)
	}
	if value := intFromAny(perk.Apply["resource_drop_amount_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d resource loot", value))
	}
	if value := intFromAny(perk.Apply["food_stamina_restore_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d stamina from food", value))
	}
	return strings.Join(parts, ", ")
}

func copyIntMap(src map[string]int) map[string]int {
	dst := make(map[string]int, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

func maxInt(v, fallback int) int {
	if v < fallback {
		return fallback
	}
	return v
}

func intFromAny(value any) int {
	if value == nil {
		return 0
	}
	if num, ok := asInt(value); ok {
		return num
	}
	return 0
}

func asString(value any) string {
	if value == nil {
		return ""
	}
	switch raw := value.(type) {
	case string:
		return strings.TrimSpace(raw)
	case fmt.Stringer:
		return strings.TrimSpace(raw.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", raw))
	}
}

func asStringOr(value any, fallback string) string {
	out := asString(value)
	if out == "" {
		return fallback
	}
	return out
}

func getObjectOrNil(args map[string]any, key string) (map[string]any, error) {
	value, ok := args[key]
	if !ok || value == nil {
		return map[string]any{}, nil
	}
	obj, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("field %s must be an object", key)
	}
	return obj, nil
}

func getString(args map[string]any, key string) (string, error) {
	value, ok := args[key]
	if !ok {
		return "", fmt.Errorf("missing required field: %s", key)
	}
	s, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("field %s must be a string", key)
	}
	return s, nil
}

func getStringOr(args map[string]any, key string) string {
	value, ok := args[key]
	if !ok || value == nil {
		return ""
	}
	s, ok := value.(string)
	if !ok {
		return ""
	}
	return s
}

func getInt(args map[string]any, key string) (int, error) {
	value, ok := args[key]
	if !ok {
		return 0, fmt.Errorf("missing required field: %s", key)
	}
	num, ok := asInt(value)
	if !ok {
		return 0, fmt.Errorf("field %s must be a number", key)
	}
	return num, nil
}

func getIntOr(args map[string]any, key string, fallback int) int {
	value, ok := args[key]
	if !ok {
		return fallback
	}
	num, ok := asInt(value)
	if !ok {
		return fallback
	}
	return num
}

func getBoolOr(args map[string]any, key string, fallback bool) bool {
	value, ok := args[key]
	if !ok || value == nil {
		return fallback
	}
	switch raw := value.(type) {
	case bool:
		return raw
	case string:
		normalized := strings.TrimSpace(strings.ToLower(raw))
		switch normalized {
		case "true", "t", "1", "yes", "y":
			return true
		case "false", "f", "0", "no", "n":
			return false
		default:
			return fallback
		}
	default:
		if num, ok := asInt(raw); ok {
			return num != 0
		}
	}
	return fallback
}

func getIntPtr(args map[string]any, key string) (*int, error) {
	value, ok := args[key]
	if !ok {
		return nil, nil
	}
	num, ok := asInt(value)
	if !ok {
		return nil, fmt.Errorf("field %s must be a number", key)
	}
	return &num, nil
}

func getPositions(args map[string]any, key string) ([]Point, error) {
	value, ok := args[key]
	if !ok || value == nil {
		return nil, nil
	}

	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("field %s must be an array", key)
	}

	positions := make([]Point, 0, len(items))
	for i, item := range items {
		pointArgs, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("field %s[%d] must be an object", key, i)
		}
		x := getIntOr(pointArgs, "x", 0)
		y := getIntOr(pointArgs, "y", 0)
		positions = append(positions, Point{X: x, Y: y})
	}
	return positions, nil
}

func asInt(value any) (int, bool) {
	switch v := value.(type) {
	case float64:
		return int(v), true
	case float32:
		return int(v), true
	case int:
		return v, true
	case int8:
		return int(v), true
	case int16:
		return int(v), true
	case int32:
		return int(v), true
	case int64:
		return int(v), true
	case uint:
		return int(v), true
	case uint8:
		return int(v), true
	case uint16:
		return int(v), true
	case uint32:
		return int(v), true
	case uint64:
		return int(v), true
	case json.Number:
		if i, err := v.Int64(); err == nil {
			return int(i), true
		}
		if f, err := v.Float64(); err == nil {
			return int(f), true
		}
	}
	return 0, false
}
