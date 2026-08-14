package board

import (
	"context"
	"fmt"
	"strings"
)

func (s *Service) cmdTaskCompleteStack(ctx context.Context, state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}

	stack := state.GetStack(stackID)
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	if len(stack.Cards) == 0 {
		return nil, fmt.Errorf("stack has no cards: %s", stackID)
	}

	meta := ensureMeta(state)
	villagerID := firstVillagerIDFromStack(state, stack)
	hasVillager := villagerID != ""

	taskIDs := make([]string, 0, 1)
	seenTaskIDs := map[string]struct{}{}
	removedCards := make([]string, 0, len(stack.Cards))
	survivorCards := make([]string, 0, len(stack.Cards))
	completedTaskCards := make([]*Card, 0, len(stack.Cards))
	completedTaskCardCount := 0
	basePos := stack.Pos
	offset := 18

	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if isTaskCard(card) {
			completedTaskCardCount++
			completedTaskCards = append(completedTaskCards, card)
			removedCards = append(removedCards, cardID)
			if taskID := cardTaskID(card); taskID != "" {
				if _, exists := seenTaskIDs[taskID]; !exists {
					seenTaskIDs[taskID] = struct{}{}
					taskIDs = append(taskIDs, taskID)
				}
			}
			delete(state.Cards, cardID)
			continue
		}
		if modifierSingleUseOnTaskComplete(card.DefID) {
			removedCards = append(removedCards, cardID)
			delete(state.Cards, cardID)
			continue
		}
		survivorCards = append(survivorCards, cardID)
	}

	if len(removedCards) == 0 {
		return nil, fmt.Errorf("stack has no task card: %s", stackID)
	}

	delete(state.Stacks, stackID)

	createdStacks := make([]*Stack, 0, len(survivorCards))
	for i, cardID := range survivorCards {
		pos := Point{
			X: basePos.X + i*offset,
			Y: basePos.Y + i*offset,
		}
		createdStacks = append(createdStacks, state.CreateStack(pos, []string{cardID}))
	}

	completedTaskIDs := make([]string, 0, len(taskIDs))
	if s.tasks != nil {
		for _, taskID := range taskIDs {
			if err := s.tasks.Close(ctx, taskID); err != nil {
				return nil, err
			}
			completedTaskIDs = append(completedTaskIDs, taskID)
		}
	}

	completedCount := len(completedTaskIDs)
	if completedCount < completedTaskCardCount {
		completedCount = completedTaskCardCount
	}
	meta.Metrics["tasks_completed"] += completedCount
	incrementQuestMetric(meta, "complete_task", "", completedCount)

	var progressBefore *VillagerProgress
	if hasVillager {
		progressBefore = ensureVillager(meta, villagerID)
	}

	var rewardPatch map[string]any
	if rewards := s.taskCompletionRewards(progressBefore, completedTaskCards, stack.ID, basePos); len(rewards) > 0 {
		rewardStacks := s.spawnResolvedRewards(state, rewards, Point{
			X: basePos.X + len(createdStacks)*offset + 28,
			Y: basePos.Y + len(createdStacks)*offset + 12,
		})
		createdStacks = append(createdStacks, rewardStacks...)
		rewardPatch = rewardPatchFromResolvedRewards(rewards, rewardStacks, "spawned")
	}

	xpGained := 0
	villagerProgressPatch := map[string]any{
		"id":       villagerID,
		"xp":       0,
		"level":    1,
		"perks":    []string{},
		"xpGained": 0,
		"newPerks": []string{},
	}
	if hasVillager {
		xpGained = s.taskCompletionXP(progressBefore, completedTaskCards)
		progress, newPerks := s.awardVillagerXP(meta, villagerID, xpGained)
		villagerProgressPatch["xp"] = progress.XP
		villagerProgressPatch["level"] = progress.Level
		villagerProgressPatch["perks"] = append([]string{}, progress.Perks...)
		villagerProgressPatch["maxStamina"] = s.villagerMaxStamina(progress)
		nextLevel, nextLevelXP, xpToNext := s.nextLevelProgress(progress)
		villagerProgressPatch["nextLevel"] = nextLevel
		villagerProgressPatch["nextLevelXP"] = nextLevelXP
		villagerProgressPatch["xpToNextLevel"] = xpToNext
		villagerProgressPatch["xpGained"] = xpGained
		villagerProgressPatch["newPerks"] = newPerks
	}

	return map[string]any{
		"removedStack":      stackID,
		"removedCards":      removedCards,
		"createdStacks":     createdStacks,
		"completedTaskIds":  completedTaskIDs,
		"reward":            rewardPatch,
		"completionByStack": hasVillager,
		"villagerProgress":  villagerProgressPatch,
	}, nil
}

func (s *Service) cmdTaskCompleteByTaskID(ctx context.Context, state *State, args map[string]any) (any, error) {
	taskID, err := getString(args, "taskId")
	if err != nil {
		return nil, err
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, fmt.Errorf("taskId is required")
	}

	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil || !isTaskCard(card) {
				continue
			}
			if cardTaskID(card) == taskID {
				return s.cmdTaskCompleteStack(ctx, state, map[string]any{
					"stackId": stack.ID,
				})
			}
		}
	}

	if s.tasks != nil {
		if err := s.tasks.Close(ctx, taskID); err != nil {
			return nil, err
		}
	}
	meta := ensureMeta(state)
	meta.Metrics["tasks_completed"]++
	incrementQuestMetric(meta, "complete_task", "", 1)

	var rewardPatch map[string]any
	if rewards := s.taskCompletionInventoryRewards(1); len(rewards) > 0 {
		for _, reward := range rewards {
			if reward.Kind != "loot" {
				continue
			}
			meta.Inventory[reward.ID] += reward.Amount
		}
		rewardPatch = rewardPatchFromResolvedRewards(rewards, nil, "inventory")
	}

	return map[string]any{
		"completedTaskId": taskID,
		"mode":            "repo_only",
		"reward":          rewardPatch,
	}, nil
}

func (s *Service) cmdBoardSeedDefault(state *State, args map[string]any) (any, error) {
	if len(state.Stacks) > 0 {
		return map[string]any{
			"seeded": false,
			"reason": "already_initialized",
		}, nil
	}

	deckY := getIntOr(args, "deckRowY", 500)
	deckStartX := 60
	deckSpacing := 110
	decks := []string{"deck.first_day"}
	if s.cfg.DeckByID("deck.collect") != nil {
		decks = append(decks, "deck.collect")
	} else {
		progression := s.cfg.ProgressionDeckDefIDs()
		if len(progression) > 0 {
			decks = append(decks, progression[0])
		}
	}

	created := make([]*Stack, 0, len(decks)+5)
	for i, deckID := range decks {
		x := deckStartX + i*deckSpacing
		created = append(created, createSingleCardStack(state, deckID, Point{X: x, Y: deckY}, nil))
	}

	created = append(created, createSingleCardStack(state, "villager.basic", Point{X: 300, Y: 200}, map[string]any{"name": "Flicker"}))
	created = append(created, createSingleCardStack(state, "villager.basic", Point{X: 420, Y: 200}, map[string]any{"name": "Pip"}))

	resourceDefID := "resource.tree"
	resourceData := map[string]any{"charges": 3}
	if len(s.cfg.Resources.Nodes) > 0 {
		node := s.cfg.Resources.Nodes[0]
		if id := strings.TrimSpace(node.ID); id != "" {
			resourceDefID = "resource." + id
		}
		resourceData["charges"] = randomResourceCharges(node.Charges.Min, node.Charges.Max, nil)
		if node.Gather.BaseTimeS > 0 {
			resourceData["gatherTimeS"] = node.Gather.BaseTimeS
		}
	}

	foodDefID := "food.apple"
	foodData := map[string]any{"amount": 2}
	if len(s.cfg.Food.Items) > 0 {
		item := s.cfg.Food.Items[0]
		if id := strings.TrimSpace(item.ID); id != "" {
			foodDefID = "food." + id
		}
	}

	created = append(created, createSingleCardStack(state, resourceDefID, Point{X: 260, Y: 340}, resourceData))
	created = append(created, createSingleCardStack(state, foodDefID, Point{X: 440, Y: 340}, foodData))

	return map[string]any{
		"seeded":  true,
		"created": created,
	}, nil
}

func cmdCardSpawn(state *State, args map[string]any) (any, error) {
	defID, err := getString(args, "defId")
	if err != nil {
		return nil, err
	}
	x, err := getInt(args, "x")
	if err != nil {
		return nil, err
	}
	y, err := getInt(args, "y")
	if err != nil {
		return nil, err
	}
	data, err := getObjectOrNil(args, "data")
	if err != nil {
		return nil, err
	}

	stack := createSingleCardStack(state, defID, Point{X: x, Y: y}, data)
	return map[string]any{
		"stack": stack,
		"card":  topCard(state, stack),
	}, nil
}

func (s *Service) cmdDeckSpawnPack(ctx context.Context, state *State, args map[string]any) (any, error) {
	deckStackID, err := getString(args, "deckStackId")
	if err != nil {
		return nil, err
	}
	x, err := getInt(args, "x")
	if err != nil {
		return nil, err
	}
	y, err := getInt(args, "y")
	if err != nil {
		return nil, err
	}

	packDefID := strings.TrimSpace(getStringOr(args, "packDefId"))

	deckStack := state.GetStack(deckStackID)
	if deckStack == nil {
		return nil, fmt.Errorf("stack not found: %s", deckStackID)
	}
	deckCard := topCard(state, deckStack)
	if deckCard == nil || cardKind(deckCard.DefID) != "deck" {
		return nil, fmt.Errorf("stack is not a deck: %s", deckStackID)
	}
	deckCfg, ok := s.deckConfigByID(deckCard.DefID)
	if !ok {
		return nil, fmt.Errorf("deck not found in config: %s", deckCard.DefID)
	}
	if deckCfg.ID == "deck.collect" {
		return nil, fmt.Errorf("deck.collect cannot spawn packs")
	}
	if unlocked, reason := s.isDeckUnlocked(ctx, state, deckCfg); !unlocked {
		return nil, fmt.Errorf("deck is locked: %s", reason)
	}

	meta := ensureMeta(state)
	deckOpenCount := meta.DeckOpen[deckCfg.ID]
	freeOpenUsed := deckOpenCount < deckCfg.FreeOpens
	zombieCount := countZombieStacks(state)
	overrunLevel := meta.Metrics["overrun_level"]
	baseCost := s.deckOpenCost(deckCfg, zombieCount, overrunLevel)
	costCurrency := strings.TrimSpace(s.cfg.Decks.Economy.BaseCostCurrency)
	if costCurrency == "" {
		costCurrency = "coin"
	}
	costCharged := 0
	if !freeOpenUsed {
		costCharged = baseCost
		if meta.Inventory[costCurrency] < costCharged {
			return nil, fmt.Errorf("not enough %s for deck spawn (need %d)", costCurrency, costCharged)
		}
		meta.Inventory[costCurrency] -= costCharged
	}

	if packDefID == "" {
		packDefID = packDefIDForDeck(deckCfg.ID)
	}

	stack := createSingleCardStack(state, packDefID, Point{X: x, Y: y}, map[string]any{
		"deckId":               deckCfg.ID,
		"deckOpenCountAtSpawn": deckOpenCount,
		"costCharged":          costCharged,
		"baseCost":             baseCost,
		"costCurrency":         costCurrency,
		"freeOpenUsed":         freeOpenUsed,
	})
	meta.DeckOpen[deckCfg.ID] = deckOpenCount + 1

	return map[string]any{
		"stack": stack,
		"card":  topCard(state, stack),
		"deck": map[string]any{
			"id":            deckCfg.ID,
			"costCharged":   costCharged,
			"baseCost":      baseCost,
			"costCurrency":  costCurrency,
			"freeOpenUsed":  freeOpenUsed,
			"deckOpenCount": meta.DeckOpen[deckCfg.ID],
		},
		"inventory": copyIntMap(meta.Inventory),
	}, nil
}
