package board

import (
	"fmt"
	"hash/fnv"
	"math/rand"
	"strings"
)

func (s *Service) zombieClearStaminaCost(progress *VillagerProgress) int {
	cost := s.cfg.Villagers.Actions.ClearZombie.StaminaCost
	if cost <= 0 {
		cost = 2
	}
	if len(s.cfg.Zombies.Types) > 0 && s.cfg.Zombies.Types[0].Cleanup.StaminaCost > 0 {
		cost = s.cfg.Zombies.Types[0].Cleanup.StaminaCost
	}

	minCost := s.cfg.Villagers.Actions.ClearZombie.MinCostAfterPerks
	if minCost <= 0 {
		minCost = 1
	}

	if progress != nil {
		for _, perkID := range progress.Perks {
			perk := s.cfg.PerkByID(perkID)
			if perk == nil || perk.Apply == nil {
				continue
			}
			cost += intFromAny(perk.Apply["zombie_clear_stamina_cost_add"])
			if perkMin := intFromAny(perk.Apply["min_zombie_clear_cost"]); perkMin > minCost {
				minCost = perkMin
			}
		}
	}

	if cost < minCost {
		cost = minCost
	}
	if cost <= 0 {
		cost = 1
	}
	return cost
}

func (s *Service) awardVillagerXP(meta *BoardMeta, villagerID string, xp int) (*VillagerProgress, []string) {
	progress := ensureVillager(meta, villagerID)
	if xp <= 0 {
		return progress, []string{}
	}

	progress.XP += xp
	if progress.Level <= 0 {
		progress.Level = 1
	}

	maxLevel := s.cfg.Villagers.Defaults.MaxLevel
	if maxLevel <= 0 {
		maxLevel = 10
	}
	if progress.Level > maxLevel {
		progress.Level = maxLevel
	}

	newLevel := progress.Level
	thresholdLevels := s.cfg.LevelThresholdsSorted()
	if len(thresholdLevels) > 0 {
		for _, level := range thresholdLevels {
			threshold := s.cfg.Villagers.Leveling.Thresholds[level]
			if progress.XP >= threshold && level > newLevel {
				newLevel = level
			}
		}
	} else {
		newLevel = (progress.XP / xpPerLevel) + 1
	}
	if newLevel < 1 {
		newLevel = 1
	}
	if newLevel > maxLevel {
		newLevel = maxLevel
	}

	newPerks := []string{}
	if len(s.cfg.Villagers.Leveling.PerksByLevel) > 0 {
		for lvl := progress.Level + 1; lvl <= newLevel; lvl++ {
			for _, perkID := range s.cfg.PerksForLevel(lvl) {
				if perkID == "" || villagerHasPerk(progress, perkID) {
					continue
				}
				progress.Perks = append(progress.Perks, perkID)
				newPerks = append(newPerks, perkID)
			}
		}
	} else if len(s.cfg.Villagers.Leveling.PerkPool) > 0 {
		choicesPerLevel := s.cfg.Villagers.Leveling.ChoicesPerLevel
		if choicesPerLevel <= 0 {
			choicesPerLevel = 1
		}
		for lvl := progress.Level + 1; lvl <= newLevel; lvl++ {
			picked := 0
			for _, perk := range s.cfg.Villagers.Leveling.PerkPool {
				perkID := strings.TrimSpace(perk.ID)
				if perkID == "" || villagerHasPerk(progress, perkID) {
					continue
				}
				progress.Perks = append(progress.Perks, perkID)
				newPerks = append(newPerks, perkID)
				picked++
				if picked >= choicesPerLevel {
					break
				}
			}
		}
	}
	progress.Level = newLevel
	maxStamina := s.villagerMaxStamina(progress)
	if progress.Stamina > maxStamina {
		progress.Stamina = maxStamina
	}
	return progress, newPerks
}

func taskCardPriority(card *Card) int {
	if card == nil {
		return 4
	}
	priority := intFromAny(card.Data["priority"])
	if priority < 1 || priority > 4 {
		return 4
	}
	return priority
}

func (s *Service) taskPriorityXPBonus(priority int) int {
	key := "none"
	switch priority {
	case 1:
		key = "high"
	case 2:
		key = "medium"
	case 3:
		key = "low"
	}
	return maxInt(s.cfg.Villagers.Leveling.XPSources.CompleteTask.ByPriority[key], 0)
}

func (s *Service) taskCompleteXPBonus(progress *VillagerProgress) int {
	if progress == nil {
		return 0
	}
	bonus := 0
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		bonus += intFromAny(perk.Apply["task_complete_xp_add"])
	}
	return maxInt(bonus, 0)
}

func (s *Service) taskCompleteCurrencyBonus(progress *VillagerProgress) int {
	if progress == nil {
		return 0
	}
	bonus := 0
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		bonus += intFromAny(perk.Apply["task_complete_currency_add"])
	}
	return maxInt(bonus, 0)
}

func (s *Service) resourceDropAmountBonus(progress *VillagerProgress) int {
	if progress == nil {
		return 0
	}
	bonus := 0
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		bonus += intFromAny(perk.Apply["resource_drop_amount_add"])
	}
	return maxInt(bonus, 0)
}

func (s *Service) foodStaminaRestoreBonus(progress *VillagerProgress) int {
	if progress == nil {
		return 0
	}
	bonus := 0
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		bonus += intFromAny(perk.Apply["food_stamina_restore_add"])
	}
	return maxInt(bonus, 0)
}

func (s *Service) taskCompletionXP(progress *VillagerProgress, cards []*Card) int {
	baseXP := s.cfg.Villagers.Leveling.XPSources.CompleteTask.BaseXP
	if baseXP <= 0 {
		baseXP = 1
	}
	total := 0
	for _, card := range cards {
		total += baseXP + s.taskPriorityXPBonus(taskCardPriority(card)) + s.taskCompleteXPBonus(progress)
	}
	if total == 0 && len(cards) == 0 {
		total = baseXP + s.taskCompleteXPBonus(progress)
	}
	if total < 0 {
		return 0
	}
	return total
}

func normalizeResolvedReward(kind, id string, amount int) (resolvedReward, bool) {
	kind = strings.ToLower(strings.TrimSpace(kind))
	id = strings.TrimSpace(id)
	switch kind {
	case "", "none":
		return resolvedReward{}, false
	case "loot":
		id = normalizeCollectLoot(id)
	case "food":
		id = strings.TrimSpace(strings.TrimPrefix(strings.ToLower(id), "food."))
	default:
		return resolvedReward{}, false
	}
	if id == "" || amount <= 0 {
		return resolvedReward{}, false
	}
	return resolvedReward{Kind: kind, ID: id, Amount: amount}, true
}

func (s *Service) gatherResourceXP() int {
	xp := s.cfg.Villagers.Leveling.XPSources.GatherResourceCycle.BaseXP
	if xp < 0 {
		return 0
	}
	return xp
}

func (s *Service) zombieClearXP() int {
	xp := s.cfg.Villagers.Leveling.XPSources.ClearZombie.BaseXP
	if xp < 0 {
		return 0
	}
	return xp
}

func deterministicRewardSeed(parts ...string) int64 {
	hasher := fnv.New64a()
	for _, part := range parts {
		_, _ = hasher.Write([]byte(part))
		_, _ = hasher.Write([]byte("|"))
	}
	return int64(hasher.Sum64())
}

func weightedRewardRoll(entries []RewardTableEntryConfig, seed int64) (resolvedReward, bool) {
	totalWeight := 0
	for _, entry := range entries {
		if entry.Weight > 0 {
			totalWeight += entry.Weight
		}
	}
	if totalWeight <= 0 {
		return resolvedReward{}, false
	}
	rng := rand.New(rand.NewSource(seed))
	target := rng.Intn(totalWeight)
	running := 0
	for _, entry := range entries {
		if entry.Weight <= 0 {
			continue
		}
		running += entry.Weight
		if target >= running {
			continue
		}
		return normalizeResolvedReward(entry.Type, entry.ID, entry.Amount)
	}
	return resolvedReward{}, false
}

func collapseResolvedRewards(rewards []resolvedReward) []resolvedReward {
	if len(rewards) == 0 {
		return nil
	}
	order := make([]string, 0, len(rewards))
	merged := map[string]resolvedReward{}
	for _, reward := range rewards {
		if reward.Kind == "" || reward.ID == "" || reward.Amount <= 0 {
			continue
		}
		key := reward.Kind + ":" + reward.ID
		if existing, ok := merged[key]; ok {
			existing.Amount += reward.Amount
			merged[key] = existing
			continue
		}
		order = append(order, key)
		merged[key] = reward
	}
	out := make([]resolvedReward, 0, len(order))
	for _, key := range order {
		out = append(out, merged[key])
	}
	return out
}

func resolveRewardTable(table RewardTableConfig, repeats int, seedParts ...string) []resolvedReward {
	if repeats <= 0 {
		return nil
	}
	rewards := make([]resolvedReward, 0, repeats*(len(table.Guaranteed)+maxInt(table.BonusRolls, 0)))
	for repeat := 0; repeat < repeats; repeat++ {
		for _, entry := range table.Guaranteed {
			if reward, ok := normalizeResolvedReward(entry.Type, entry.ID, entry.Amount); ok {
				rewards = append(rewards, reward)
			}
		}
		for roll := 0; roll < table.BonusRolls; roll++ {
			seed := deterministicRewardSeed(append(seedParts, fmt.Sprintf("repeat:%d", repeat), fmt.Sprintf("roll:%d", roll))...)
			if reward, ok := weightedRewardRoll(table.RNGPool, seed); ok {
				rewards = append(rewards, reward)
			}
		}
	}
	return collapseResolvedRewards(rewards)
}

func resolvedRewardDefID(reward resolvedReward) string {
	switch reward.Kind {
	case "loot":
		return "loot." + reward.ID
	case "food":
		return "food." + reward.ID
	default:
		return ""
	}
}

func rewardPatchFromResolvedRewards(rewards []resolvedReward, stacks []*Stack, mode string) map[string]any {
	if len(rewards) == 0 {
		return nil
	}
	primary := rewards[0]
	patch := map[string]any{
		"type":   primary.ID,
		"amount": primary.Amount,
		"mode":   mode,
	}
	if len(stacks) > 0 {
		patch["stackId"] = stacks[0].ID
	}
	if primary.Kind != "" {
		patch["kind"] = primary.Kind
	}
	if len(rewards) > 1 {
		items := make([]map[string]any, 0, len(rewards))
		for _, reward := range rewards {
			items = append(items, map[string]any{
				"kind":   reward.Kind,
				"type":   reward.ID,
				"amount": reward.Amount,
			})
		}
		patch["items"] = items
	}
	return patch
}

func (s *Service) spawnResolvedRewards(state *State, rewards []resolvedReward, pos Point) []*Stack {
	if len(rewards) == 0 {
		return nil
	}
	created := make([]*Stack, 0, len(rewards))
	for index, reward := range rewards {
		defID := resolvedRewardDefID(reward)
		if defID == "" {
			continue
		}
		stack := createSingleCardStack(state, defID, Point{
			X: pos.X + index*18,
			Y: pos.Y + (index%2)*12,
		}, map[string]any{
			"amount": reward.Amount,
		})
		created = append(created, s.finalizeSpawnedStack(state, stack))
	}
	return created
}
