package board

import (
	"context"
	"fmt"
	"math/rand"
	"strings"
)

func (s *Service) cmdQuestClaimReward(ctx context.Context, state *State, args map[string]any) (any, error) {
	questID, err := getString(args, "questId")
	if err != nil {
		return nil, err
	}
	questID = strings.TrimSpace(questID)
	if questID == "" {
		return nil, fmt.Errorf("questId is required")
	}

	if err := s.refreshQuestState(ctx, state); err != nil {
		return nil, err
	}

	meta := ensureMeta(state)
	quests := ensureQuestState(meta)

	index := -1
	var quest *QuestRuntime
	for i, item := range quests.Active {
		if item == nil {
			continue
		}
		if strings.EqualFold(item.ID, questID) {
			index = i
			quest = item
			break
		}
	}
	if quest == nil {
		return nil, fmt.Errorf("quest not found: %s", questID)
	}
	if quest.Claimed {
		return nil, fmt.Errorf("quest already claimed: %s", questID)
	}
	if !quest.Claimable {
		return nil, fmt.Errorf("quest is not complete: %s", questID)
	}

	rewardSeed := deterministicQuestSeed(
		"claim:"+quest.ID,
		fmt.Sprintf("day:%d", quests.CurrentDay),
		fmt.Sprintf("history:%d", len(quests.History)),
	)
	rng := rand.New(rand.NewSource(rewardSeed))

	grantedRewards := make([]QuestRewardState, 0, len(quest.Rewards))
	createdStacks := make([]*Stack, 0, 4)
	for _, reward := range quest.Rewards {
		resolved, stacks, err := s.applyQuestReward(state, reward, rng)
		if err != nil {
			return nil, err
		}
		grantedRewards = append(grantedRewards, resolved...)
		createdStacks = append(createdStacks, stacks...)
	}

	appliedUnlocks := make([]QuestUnlockState, 0, len(quest.Unlocks))
	unlockedSet := map[string]struct{}{}
	for _, existing := range quests.Unlocked {
		key := existing.Kind + "::" + existing.ID
		unlockedSet[key] = struct{}{}
	}
	for _, unlock := range quest.Unlocks {
		key := unlock.Kind + "::" + unlock.ID
		if _, ok := unlockedSet[key]; ok {
			continue
		}
		unlockedSet[key] = struct{}{}
		quests.Unlocked = append(quests.Unlocked, unlock)
		appliedUnlocks = append(appliedUnlocks, unlock)
	}

	quest.Claimed = true
	quest.Claimable = false
	quest.ClaimedDay = quests.CurrentDay

	if quest.Type == questTypeDaily {
		switch {
		case quests.LastDailyClaimDay == quests.CurrentDay:
			// Already counted for this day.
		case quests.LastDailyClaimDay+1 == quests.CurrentDay:
			quests.DailyStreak++
			quests.LastDailyClaimDay = quests.CurrentDay
		default:
			quests.DailyStreak = 1
			quests.LastDailyClaimDay = quests.CurrentDay
		}
	}

	archived := removeActiveQuestAt(quests, index)
	archiveQuest(quests, archived, false)
	sortActiveQuests(quests)

	return map[string]any{
		"questId":          questID,
		"grantedRewards":   grantedRewards,
		"createdStacks":    createdStacks,
		"appliedUnlocks":   appliedUnlocks,
		"dailyStreak":      quests.DailyStreak,
		"inventory":        copyIntMap(meta.Inventory),
		"activeQuestCount": len(quests.Active),
	}, nil
}

func questRewardTableEntryPick(table questRewardTable, rng *rand.Rand) (questRewardSpec, bool) {
	totalWeight := 0
	for _, entry := range table.Entries {
		if entry.Weight <= 0 {
			continue
		}
		totalWeight += entry.Weight
	}
	if totalWeight <= 0 {
		return questRewardSpec{}, false
	}
	roll := rng.Intn(totalWeight)
	cursor := 0
	for _, entry := range table.Entries {
		if entry.Weight <= 0 {
			continue
		}
		cursor += entry.Weight
		if roll < cursor {
			return entry.Reward, true
		}
	}
	return questRewardSpec{}, false
}

func questRewardFromSpec(spec questRewardSpec) QuestRewardState {
	cardCount := spec.CardCount
	if cardCount <= 0 {
		cardCount = 1
	}
	return QuestRewardState{
		Kind:       normalizeQuestOp(spec.Kind),
		Currency:   strings.TrimSpace(strings.ToLower(spec.Currency)),
		Amount:     spec.Amount,
		TableID:    strings.TrimSpace(strings.ToLower(spec.TableID)),
		CardType:   strings.TrimSpace(strings.ToLower(spec.CardType)),
		CardCount:  cardCount,
		CardCharge: spec.CardUsage,
		XP:         spec.XP,
	}
}

func questCardToBoardDef(cardType string) (string, map[string]any, bool) {
	switch strings.TrimSpace(strings.ToLower(cardType)) {
	case "blank_task":
		return "task.blank", map[string]any{"title": "Quest reward task"}, true
	case "villager":
		return "villager.basic", map[string]any{}, true
	case "recurring_contract":
		return "mod.recurring_contract", map[string]any{}, true
	case "deadline_pin":
		return "mod.deadline_pin", map[string]any{}, true
	case "schedule_token":
		return "mod.schedule_token", map[string]any{}, true
	case "importance_seal":
		return "mod.importance_seal", map[string]any{}, true
	case "cleanup_tool":
		return "mod.cleanup_tool", map[string]any{}, true
	case "coin_card":
		return "loot.coin", map[string]any{"amount": 1}, true
	case "paper_card":
		return "loot.paper", map[string]any{"amount": 1}, true
	case "ink_card":
		return "loot.ink", map[string]any{"amount": 1}, true
	case "gear_card":
		return "loot.gear", map[string]any{"amount": 1}, true
	case "parts_card":
		return "loot.parts", map[string]any{"amount": 1}, true
	case "integration_core_part":
		return "loot.parts", map[string]any{"amount": 2}, true
	case "blueprint_shard":
		return "loot.parts", map[string]any{"amount": 1}, true
	default:
		return "", nil, false
	}
}

func questRewardSpawnBase(state *State) Point {
	if state != nil {
		for _, stack := range state.Stacks {
			if stack == nil {
				continue
			}
			card := topCard(state, stack)
			if card == nil {
				continue
			}
			if strings.EqualFold(strings.TrimSpace(card.DefID), "deck.collect") {
				return Point{X: stack.Pos.X + 110, Y: stack.Pos.Y - 26}
			}
		}
		for _, stack := range state.Stacks {
			if stack == nil {
				continue
			}
			card := topCard(state, stack)
			if card == nil {
				continue
			}
			if strings.HasPrefix(strings.TrimSpace(card.DefID), "deck.") {
				return Point{X: stack.Pos.X + 90, Y: stack.Pos.Y - 20}
			}
		}
	}
	return Point{X: 210, Y: 220}
}

func (s *Service) applyQuestReward(state *State, reward QuestRewardState, rng *rand.Rand) ([]QuestRewardState, []*Stack, error) {
	meta := ensureMeta(state)
	kind := normalizeQuestOp(reward.Kind)
	switch kind {
	case "currency":
		currency := strings.TrimSpace(strings.ToLower(reward.Currency))
		if currency == "" {
			currency = "coin"
		}
		amount := maxInt(reward.Amount, 0)
		if amount <= 0 {
			return nil, nil, nil
		}
		meta.Inventory[currency] += amount
		return []QuestRewardState{{
			Kind:     "currency",
			Currency: currency,
			Amount:   amount,
		}}, nil, nil
	case "xp":
		xp := maxInt(reward.XP, reward.Amount)
		if xp <= 0 {
			return nil, nil, nil
		}
		meta.Metrics["quest_xp"] += xp
		return []QuestRewardState{{
			Kind: "xp",
			XP:   xp,
		}}, nil, nil
	case "card":
		defID, data, ok := questCardToBoardDef(reward.CardType)
		if !ok {
			return nil, nil, fmt.Errorf("unsupported quest reward card type: %s", reward.CardType)
		}
		count := maxInt(reward.CardCount, 1)
		base := questRewardSpawnBase(state)
		created := make([]*Stack, 0, count)
		for index := 0; index < count; index++ {
			payload := map[string]any{}
			for key, value := range data {
				payload[key] = value
			}
			if reward.CardCharge > 0 {
				payload["charges"] = reward.CardCharge
			}
			x := base.X + (index%5)*20
			y := base.Y + (index/5)*24
			stack := createSingleCardStack(state, defID, Point{X: x, Y: y}, payload)
			created = append(created, stack)
		}
		return []QuestRewardState{{
			Kind:       "card",
			CardType:   strings.TrimSpace(strings.ToLower(reward.CardType)),
			CardCount:  count,
			CardCharge: reward.CardCharge,
		}}, created, nil
	case "roll_table":
		tableID := strings.TrimSpace(strings.ToLower(reward.TableID))
		table, ok := s.quests.RewardTables[tableID]
		if !ok {
			return nil, nil, fmt.Errorf("unknown reward table: %s", tableID)
		}
		rolls := maxInt(table.Rolls, 1)
		applied := make([]QuestRewardState, 0, rolls)
		created := make([]*Stack, 0, rolls)
		for i := 0; i < rolls; i++ {
			pick, ok := questRewardTableEntryPick(table, rng)
			if !ok {
				continue
			}
			resolved, stacks, err := s.applyQuestReward(state, questRewardFromSpec(pick), rng)
			if err != nil {
				return nil, nil, err
			}
			applied = append(applied, resolved...)
			created = append(created, stacks...)
		}
		return applied, created, nil
	case "cosmetic":
		meta.Metrics["quest_cosmetics"]++
		return []QuestRewardState{{
			Kind: "cosmetic",
		}}, nil, nil
	default:
		return nil, nil, fmt.Errorf("unsupported quest reward kind: %s", reward.Kind)
	}
}
