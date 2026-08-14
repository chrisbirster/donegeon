package board

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

func (s *Service) cmdResourceGather(state *State, args map[string]any) (any, error) {
	resourceStackID, err := getString(args, "resourceStackId")
	if err != nil {
		return nil, err
	}
	villagerStackID, err := getString(args, "villagerStackId")
	if err != nil {
		return nil, err
	}
	targetStackID := strings.TrimSpace(getStringOr(args, "targetStackId"))
	if targetStackID != "" && targetStackID != resourceStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match resource or villager stack")
	}

	resourceStack := state.GetStack(resourceStackID)
	if resourceStack == nil {
		return nil, fmt.Errorf("resource stack not found: %s", resourceStackID)
	}
	if !stackHasKind(state, resourceStack, "resource") {
		return nil, fmt.Errorf("stack is not a resource stack: %s", resourceStackID)
	}

	villagerStack := state.GetStack(villagerStackID)
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}
	if resourceMergeWouldCreateMultipleVillagers(state, resourceStack, villagerStack) {
		return nil, ErrInvalidStackPair
	}

	meta := ensureMeta(state)
	actualVillagerID := firstVillagerIDFromStack(state, villagerStack)
	if actualVillagerID == "" {
		actualVillagerID = villagerStackID
	}
	progress := ensureVillager(meta, actualVillagerID)
	staminaCost := s.cfg.Villagers.Actions.GatherStart.StaminaCost
	if staminaCost < 0 {
		staminaCost = 0
	}
	ok, staminaRemaining := spendVillagerStamina(progress, staminaCost)
	if !ok {
		return nil, fmt.Errorf("villager stamina too low (need %d)", staminaCost)
	}

	if targetStackID == villagerStackID {
		resourceStack.Pos = villagerStack.Pos
	}
	if resourceStackID != villagerStackID {
		if err := state.MergeStacks(resourceStackID, villagerStackID); err != nil {
			return nil, err
		}
		ensurePriorityFaceCard(state, resourceStack)
	}
	ensureVillagerLeadsResourceStack(state, resourceStack)

	resourceCard := firstCardByKind(state, resourceStack, "resource")
	if resourceCard == nil {
		return nil, fmt.Errorf("resource card not found in stack: %s", resourceStackID)
	}
	if resourceCard.Data == nil {
		resourceCard.Data = map[string]any{}
	}
	resourceCard.Data["assignedVillagerId"] = actualVillagerID

	charges := intFromAny(resourceCard.Data["charges"])
	if charges <= 0 {
		resourceID := strings.TrimSpace(strings.TrimPrefix(resourceCard.DefID, "resource."))
		if node := s.cfg.ResourceNodeByID(resourceID); node != nil {
			charges = node.Charges.Max
			if charges <= 0 {
				charges = node.Charges.Min
			}
		}
		if charges <= 0 {
			charges = 3
		}
	}
	charges--
	if charges <= 0 {
		removeCardFromStack(state, resourceStack.ID, resourceCard.ID)
	} else {
		resourceCard.Data["charges"] = charges
	}

	rewardStacks := s.spawnResolvedRewards(state, s.resourceGatherRewards(progress, resourceCard, actualVillagerID, resourceStackID, charges), Point{
		X: resourceStack.Pos.X + 98,
		Y: resourceStack.Pos.Y + 28,
	})

	xpGained := s.gatherResourceXP()
	updatedVillager, newPerks := s.awardVillagerXP(meta, actualVillagerID, xpGained)

	return map[string]any{
		"resourceStackId":          resourceStackID,
		"villagerStackId":          actualVillagerID,
		"staminaCost":              staminaCost,
		"staminaRemaining":         staminaRemaining,
		"resourceChargesRemaining": maxInt(charges, 0),
		"resourceDepleted":         charges <= 0,
		"stackHasMoreResources":    stackHasKind(state, resourceStack, "resource"),
		"createdStacks":            rewardStacks,
		"villagerProgress": map[string]any{
			"id":         actualVillagerID,
			"xp":         updatedVillager.XP,
			"level":      updatedVillager.Level,
			"perks":      append([]string{}, updatedVillager.Perks...),
			"maxStamina": s.villagerMaxStamina(updatedVillager),
			"nextLevel": func() int {
				level, _, _ := s.nextLevelProgress(updatedVillager)
				return level
			}(),
			"nextLevelXP": func() int {
				_, xp, _ := s.nextLevelProgress(updatedVillager)
				return xp
			}(),
			"xpToNextLevel": func() int {
				_, _, xpToNext := s.nextLevelProgress(updatedVillager)
				return xpToNext
			}(),
			"xpGained": xpGained,
			"newPerks": newPerks,
		},
	}, nil
}

func (s *Service) cmdFoodConsume(state *State, args map[string]any) (any, error) {
	foodStackID, err := getString(args, "foodStackId")
	if err != nil {
		return nil, err
	}
	villagerStackID, err := getString(args, "villagerStackId")
	if err != nil {
		return nil, err
	}
	targetStackID := strings.TrimSpace(getStringOr(args, "targetStackId"))
	if targetStackID != "" && targetStackID != foodStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match food or villager stack")
	}

	foodStack := state.GetStack(foodStackID)
	if foodStack == nil {
		return nil, fmt.Errorf("food stack not found: %s", foodStackID)
	}
	if !stackHasKind(state, foodStack, "food") {
		return nil, fmt.Errorf("stack is not a food stack: %s", foodStackID)
	}

	villagerStack := state.GetStack(villagerStackID)
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}

	meta := ensureMeta(state)
	actualVillagerID := firstVillagerIDFromStack(state, villagerStack)
	if actualVillagerID == "" {
		actualVillagerID = villagerStackID
	}
	progress := ensureVillager(meta, actualVillagerID)

	staminaCost := s.cfg.Villagers.Actions.EatFood.StaminaCost
	if staminaCost < 0 {
		staminaCost = 0
	}
	staminaBefore := progress.Stamina
	staminaAfterCost := staminaBefore
	if staminaCost > 0 {
		ok, remaining := spendVillagerStamina(progress, staminaCost)
		if !ok {
			return nil, fmt.Errorf("villager stamina too low (need %d)", staminaCost)
		}
		staminaAfterCost = remaining
	}

	foodCard := firstCardByKind(state, foodStack, "food")
	if foodCard == nil {
		return nil, fmt.Errorf("food card not found in stack: %s", foodStackID)
	}
	if foodCard.Data == nil {
		foodCard.Data = map[string]any{}
	}
	amount := intFromAny(foodCard.Data["amount"])
	if amount <= 0 {
		amount = 1
	}
	amount--
	if amount <= 0 {
		removeCardFromStack(state, foodStack.ID, foodCard.ID)
	} else {
		foodCard.Data["amount"] = amount
	}

	restore := s.staminaRestoreForFood(foodCard.DefID, progress)
	staminaRemaining := restoreVillagerStamina(progress, restore, s.villagerMaxStamina(progress))

	if targetStackID == foodStackID && villagerStackID != foodStackID {
		villagerStack.Pos = foodStack.Pos
	}

	return map[string]any{
		"foodStackId":      foodStackID,
		"villagerStackId":  actualVillagerID,
		"foodRemaining":    maxInt(amount, 0),
		"staminaCost":      staminaCost,
		"staminaBefore":    staminaBefore,
		"staminaAfterCost": staminaAfterCost,
		"staminaRemaining": staminaRemaining,
		"foodConsumed": map[string]any{
			"id":             strings.TrimSpace(strings.TrimPrefix(foodCard.DefID, "food.")),
			"amount":         1,
			"staminaRestore": restore,
		},
	}, nil
}

func (s *Service) cmdLootCollectStack(ctx context.Context, state *State, args map[string]any) (any, error) {
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

	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		switch {
		case strings.HasPrefix(card.DefID, "loot."):
		case strings.HasPrefix(card.DefID, "resource."):
		case strings.HasPrefix(card.DefID, "mod."):
		case strings.HasPrefix(card.DefID, "task."):
		case strings.HasPrefix(card.DefID, "food."):
		default:
			return nil, fmt.Errorf("stack contains non-collectible card: %s", card.DefID)
		}
	}

	lootTotals := map[string]int{}
	collected := 0
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		lootType := ""
		amount := 1

		switch {
		case strings.HasPrefix(card.DefID, "loot."):
			lootType = strings.TrimSpace(strings.TrimPrefix(card.DefID, "loot."))
			if card.Data != nil {
				amount = maxInt(intFromAny(card.Data["amount"]), 1)
			}
		case strings.HasPrefix(card.DefID, "resource."):
			lootType = "parts"
		case strings.HasPrefix(card.DefID, "mod."):
			lootType = "parts"
		case strings.HasPrefix(card.DefID, "task."):
			lootType = "coin"
			if s.tasks != nil {
				if taskID := cardTaskID(card); taskID != "" {
					_ = s.tasks.Close(ctx, taskID)
				}
			}
		case strings.HasPrefix(card.DefID, "food."):
			lootType = "paper"
		}

		if lootType != "" {
			lootTotals[lootType] += amount
			collected++
		}
	}
	if collected == 0 {
		return nil, fmt.Errorf("no collectible cards in stack: %s", stackID)
	}

	for _, cardID := range stack.Cards {
		delete(state.Cards, cardID)
	}
	delete(state.Stacks, stackID)

	lootCollected := make([]map[string]any, 0, len(lootTotals))
	meta := ensureMeta(state)
	for _, lootType := range defaultLootTypes {
		if _, ok := meta.Inventory[lootType]; !ok {
			meta.Inventory[lootType] = 0
		}
	}
	for lootType, amount := range lootTotals {
		meta.Inventory[lootType] += amount
		lootCollected = append(lootCollected, map[string]any{
			"type":   lootType,
			"amount": amount,
		})
	}
	primaryLoot := map[string]any{}
	if len(lootCollected) > 0 {
		primaryLoot = lootCollected[0]
	}

	return map[string]any{
		"removedStack":   stackID,
		"loot":           primaryLoot,
		"lootCollected":  lootCollected,
		"cardsCollected": collected,
		"inventory":      copyIntMap(meta.Inventory),
	}, nil
}

func isTaskCard(card *Card) bool {
	if card == nil {
		return false
	}
	return strings.HasPrefix(card.DefID, "task.")
}

func cardTaskID(card *Card) string {
	if card == nil || card.Data == nil {
		return ""
	}
	switch v := card.Data["taskId"].(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		return ""
	}
}

func createSingleCardStack(state *State, defID string, pos Point, data map[string]any) *Stack {
	payload := map[string]any{}
	for key, value := range data {
		payload[key] = value
	}
	card := state.CreateCard(strings.TrimSpace(defID), payload)
	stack := state.CreateStack(pos, []string{card.ID})
	if cardKind(card.DefID) == "villager" {
		_ = villagerIDFromCard(card, stack.ID)
	}
	return stack
}

func (s *Service) finalizeSpawnedStack(state *State, spawned *Stack) *Stack {
	if state == nil || spawned == nil {
		return spawned
	}

	for _, candidate := range stacksAtExactPosition(state, spawned.ID, spawned.Pos) {
		if s.validator != nil {
			if err := s.validator.ValidateStackMerge(state, candidate.ID, spawned.ID); err != nil {
				continue
			}
		}
		if err := state.MergeStacks(candidate.ID, spawned.ID); err != nil {
			continue
		}
		ensurePriorityFaceCard(state, candidate)
		ensureVillagerLeadsResourceStack(state, candidate)
		return candidate
	}

	if len(stacksAtExactPosition(state, spawned.ID, spawned.Pos)) == 0 {
		return spawned
	}

	for step := 1; step <= 12; step++ {
		candidate := Point{
			X: spawned.Pos.X + step*18,
			Y: spawned.Pos.Y + ((step % 2) * 12),
		}
		if len(stacksAtExactPosition(state, spawned.ID, candidate)) > 0 {
			continue
		}
		spawned.Pos = candidate
		break
	}

	return spawned
}

func stacksAtExactPosition(state *State, excludedID string, pos Point) []*Stack {
	if state == nil {
		return nil
	}

	stacks := make([]*Stack, 0)
	for _, stack := range state.Stacks {
		if stack == nil || stack.ID == excludedID {
			continue
		}
		if stack.Pos != pos {
			continue
		}
		stacks = append(stacks, stack)
	}

	sort.Slice(stacks, func(i, j int) bool {
		return stacks[i].Z > stacks[j].Z
	})

	return stacks
}
