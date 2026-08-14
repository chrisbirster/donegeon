package board

import (
	"context"
	"fmt"
	"math"
	"strings"

	"donegeon/internal/tenant"
)

func (s *Service) cmdDeckOpenPack(ctx context.Context, state *State, args map[string]any) (any, error) {
	packStackID, err := getString(args, "packStackId")
	if err != nil {
		return nil, err
	}

	packStack := state.GetStack(packStackID)
	if packStack == nil {
		return nil, fmt.Errorf("stack not found: %s", packStackID)
	}
	if len(packStack.Cards) == 0 {
		return nil, fmt.Errorf("stack has no cards: %s", packStackID)
	}

	packCard := topCard(state, packStack)
	if packCard == nil || !strings.HasSuffix(packCard.DefID, "_pack") {
		return nil, fmt.Errorf("stack is not a pack: %s", packStackID)
	}

	deckID := strings.TrimSpace(getStringOr(args, "deckId"))
	if packCard.Data != nil {
		if fromPack, ok := packCard.Data["deckId"].(string); ok {
			fromPack = strings.TrimSpace(fromPack)
			if deckID == "" {
				deckID = fromPack
			}
			if fromPack != "" && deckID != fromPack {
				return nil, fmt.Errorf("pack belongs to %s, not %s", fromPack, deckID)
			}
		}
	}
	if deckID == "" {
		deckID = "deck.first_day"
	}
	deckCfg, ok := s.deckConfigByID(deckID)
	if !ok {
		return nil, fmt.Errorf("deck not found in config: %s", deckID)
	}
	if unlocked, reason := s.isDeckUnlocked(ctx, state, deckCfg); !unlocked {
		return nil, fmt.Errorf("deck is locked: %s", reason)
	}

	radius := getIntOr(args, "radius", 170)
	if radius <= 0 {
		radius = 170
	}
	count := deckCfg.DrawCount
	if count <= 0 {
		count = 3
	}
	if argCount := getIntOr(args, "count", count); argCount > 0 {
		count = argCount
	}
	seedArg, err := getIntPtr(args, "seed")
	if err != nil {
		return nil, err
	}

	meta := ensureMeta(state)
	deckOpenCount := meta.DeckOpen[deckCfg.ID]
	costCurrency := strings.TrimSpace(s.cfg.Decks.Economy.BaseCostCurrency)
	if costCurrency == "" {
		costCurrency = "coin"
	}
	deckOpenCountAtSpawn := deckOpenCount
	costCharged := 0
	baseCost := s.deckOpenCost(deckCfg, countZombieStacks(state), meta.Metrics["overrun_level"])
	freeOpenUsed := deckOpenCountAtSpawn < deckCfg.FreeOpens
	if packCard.Data != nil {
		if raw, ok := packCard.Data["deckOpenCountAtSpawn"]; ok {
			deckOpenCountAtSpawn = intFromAny(raw)
		}
		if raw, ok := packCard.Data["costCharged"]; ok {
			costCharged = intFromAny(raw)
		}
		if raw, ok := packCard.Data["baseCost"]; ok {
			if fromData := intFromAny(raw); fromData > 0 {
				baseCost = fromData
			}
		}
		if raw, ok := packCard.Data["costCurrency"]; ok {
			if fromData, ok := raw.(string); ok && strings.TrimSpace(fromData) != "" {
				costCurrency = strings.TrimSpace(fromData)
			}
		}
		if raw, ok := packCard.Data["freeOpenUsed"]; ok {
			if fromData, ok := raw.(bool); ok {
				freeOpenUsed = fromData
			}
		} else {
			freeOpenUsed = deckOpenCountAtSpawn < deckCfg.FreeOpens
		}
	}

	origin := packStack.Pos
	for _, cardID := range packStack.Cards {
		delete(state.Cards, cardID)
	}
	delete(state.Stacks, packStackID)

	rng := s.newDeckRand(state, deckCfg.ID, packStackID, seedArg)
	drawPlan := make([]weightedDeckDraw, 0, count)
	if deckCfg.ID == "deck.first_day" && deckOpenCountAtSpawn == 0 {
		for _, starter := range s.firstDayStarterDraws() {
			if len(drawPlan) >= count {
				break
			}
			drawPlan = append(drawPlan, starter)
		}
	}
	for len(drawPlan) < count {
		drawn, err := pickWeightedDeckEntry(deckCfg.DrawPool, rng)
		if err != nil {
			return nil, err
		}
		drawPlan = append(drawPlan, drawn)
	}

	created := make([]*Stack, 0, count)
	for i, drawn := range drawPlan {
		defID, data, err := s.mapDeckDrawToCard(drawn, rng)
		if err != nil {
			return nil, err
		}
		angle := (-math.Pi / 2) + (float64(i)/float64(count))*(math.Pi*2)
		x := origin.X + int(math.Cos(angle)*float64(radius))
		y := origin.Y + int(math.Sin(angle)*(float64(radius)*0.72))
		created = append(created, createSingleCardStack(state, defID, Point{X: x, Y: y}, data))
	}
	incrementQuestMetric(meta, "open_deck", deckCfg.ID, 1)
	return map[string]any{
		"removedStack":  packStackID,
		"createdStacks": created,
		"deck": map[string]any{
			"id":            deckCfg.ID,
			"draws":         count,
			"costCharged":   costCharged,
			"baseCost":      baseCost,
			"costCurrency":  costCurrency,
			"freeOpenUsed":  freeOpenUsed,
			"deckOpenCount": deckOpenCount,
		},
		"inventory": copyIntMap(meta.Inventory),
	}, nil
}

func (s *Service) firstDayStarterDraws() []weightedDeckDraw {
	resourceID := "tree"
	if len(s.cfg.Resources.Nodes) > 0 && strings.TrimSpace(s.cfg.Resources.Nodes[0].ID) != "" {
		resourceID = strings.TrimSpace(s.cfg.Resources.Nodes[0].ID)
	}
	foodID := "apple"
	if len(s.cfg.Food.Items) > 0 && strings.TrimSpace(s.cfg.Food.Items[0].ID) != "" {
		foodID = strings.TrimSpace(s.cfg.Food.Items[0].ID)
	}
	return []weightedDeckDraw{
		{CardType: "villager", Weight: 1},
		{CardType: "resource", ResourceID: resourceID, Weight: 1},
		{CardType: "food", FoodID: foodID, Amount: 1, Weight: 1},
		{CardType: "blank", Weight: 1},
		{CardType: "loot", LootID: "coin", Amount: 1, Weight: 1},
	}
}

func (s *Service) cmdTaskSpawnExisting(ctx context.Context, state *State, boardID string, args map[string]any) (any, error) {
	if s.tasks == nil {
		return nil, fmt.Errorf("task service unavailable")
	}

	taskID, err := getString(args, "taskId")
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

	row, err := s.tasks.Get(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}
	if matchesBoardProjectPtr(row.ProjectID, boardID) {
		if err := s.ensureTaskHasBoardLiveLabel(ctx, row.ID); err != nil {
			return nil, err
		}
		row, err = s.tasks.Get(ctx, taskID)
		if err != nil {
			return nil, fmt.Errorf("task not found: %s", taskID)
		}
	}
	if row.Checked || row.IsDeleted {
		return nil, fmt.Errorf("cannot move completed task to board")
	}
	if stackID := findTaskStackIDByTaskID(state, row.ID); stackID != "" {
		return nil, fmt.Errorf("task is already on the board")
	}
	cardData := taskCardDataFromTaskRow(row)

	modifierDefs := buildSpawnModifierDefIDs(row)
	cardIDs := make([]string, 0, len(modifierDefs)+1)
	for _, defID := range modifierDefs {
		modCard := state.CreateCard(defID, nil)
		cardIDs = append(cardIDs, modCard.ID)
	}
	card := state.CreateCard("task.instance", cardData)
	cardIDs = append(cardIDs, card.ID)
	stack := state.CreateStack(Point{X: x, Y: y}, cardIDs)
	ensurePriorityFaceCard(state, stack)
	if getBoolOr(args, "countAsCreated", false) {
		incrementQuestMetric(ensureMeta(state), "create_task", "", 1)
	}
	if row.ProjectID != nil && strings.EqualFold(tenant.ProjectSlug(*row.ProjectID), "inbox") {
		incrementQuestMetric(ensureMeta(state), "process_inbox_count", "", 1)
	}

	return map[string]any{
		"stack": stack,
		"card":  card,
	}, nil
}

type modifierCardRef struct {
	StackID string
	CardID  string
	DefID   string
}

func (s *Service) cmdTaskActivate(ctx context.Context, state *State, boardID string, args map[string]any) (any, error) {
	if s.tasks == nil {
		return nil, fmt.Errorf("task service unavailable")
	}

	taskID, err := getString(args, "taskId")
	if err != nil {
		return nil, err
	}
	preview := getBoolOr(args, "preview", false)

	row, err := s.tasks.Get(ctx, taskID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}
	if row.Checked || row.IsDeleted {
		return nil, fmt.Errorf("cannot activate completed task")
	}
	if !matchesBoardProjectPtr(row.ProjectID, boardID) {
		return nil, fmt.Errorf("task project must match board %q to activate", boardProjectIDForBoard(boardID))
	}

	meta := ensureMeta(state)
	requiredModifierCounts := modifierRequirementCounts(buildSpawnModifierDefIDs(row))
	availableModifierCards := collectConsumableModifierCards(state)
	modifierRequirementRows := make([]map[string]any, 0, len(requiredModifierCounts))

	modifierDefs := sortedModifierDefIDs(requiredModifierCounts)
	canActivate := true
	for _, defID := range modifierDefs {
		required := requiredModifierCounts[defID]
		available := len(availableModifierCards[defID])
		missing := maxInt(required-available, 0)
		if missing > 0 {
			canActivate = false
		}
		modifierRequirementRows = append(modifierRequirementRows, map[string]any{
			"defId":     defID,
			"required":  required,
			"available": available,
			"missing":   missing,
		})
	}

	requiredModifierTotal := 0
	for _, count := range requiredModifierCounts {
		requiredModifierTotal += count
	}

	costCurrency := strings.TrimSpace(s.cfg.Decks.Economy.BaseCostCurrency)
	if costCurrency == "" {
		costCurrency = "coin"
	}
	coinRequired := taskActivationCoinCost(requiredModifierTotal)
	coinAvailable := meta.Inventory[costCurrency]
	coinMissing := maxInt(coinRequired-coinAvailable, 0)
	if coinMissing > 0 {
		canActivate = false
	}

	requirements := map[string]any{
		"coin": map[string]any{
			"currency":  costCurrency,
			"required":  coinRequired,
			"available": coinAvailable,
			"missing":   coinMissing,
		},
		"modifiers": modifierRequirementRows,
	}

	if stackID := findTaskStackIDByTaskID(state, row.ID); stackID != "" {
		if err := s.ensureTaskHasBoardLiveLabel(ctx, row.ID); err != nil {
			return nil, err
		}
		return map[string]any{
			"taskId":       row.ID,
			"stackId":      stackID,
			"alreadyLive":  true,
			"activated":    false,
			"canActivate":  true,
			"requirements": requirements,
			"inventory":    copyIntMap(meta.Inventory),
		}, nil
	}

	if preview || !canActivate {
		return map[string]any{
			"taskId":       row.ID,
			"alreadyLive":  false,
			"activated":    false,
			"canActivate":  canActivate,
			"requirements": requirements,
			"inventory":    copyIntMap(meta.Inventory),
		}, nil
	}

	if len(state.Stacks) == 0 {
		if _, err := s.cmdBoardSeedDefault(state, nil); err != nil {
			return nil, err
		}
	}

	x := getIntOr(args, "x", 120+(len(state.Stacks)*37)%720)
	y := getIntOr(args, "y", 120+(len(state.Stacks)*23)%380)

	consumedModifierCards := make([]modifierCardRef, 0, requiredModifierTotal)
	for _, defID := range modifierDefs {
		refs := availableModifierCards[defID]
		need := requiredModifierCounts[defID]
		if need <= 0 {
			continue
		}
		consumedModifierCards = append(consumedModifierCards, refs[:need]...)
	}

	if coinRequired > 0 {
		meta.Inventory[costCurrency] -= coinRequired
	}

	consumedModifierCounts := map[string]int{}
	consumedModifierCardIDs := make([]string, 0, len(consumedModifierCards))
	for _, ref := range consumedModifierCards {
		detachCardFromStack(state, ref.StackID, ref.CardID)
		consumedModifierCardIDs = append(consumedModifierCardIDs, ref.CardID)
		consumedModifierCounts[ref.DefID]++
	}

	cardData := taskCardDataFromTaskRow(row)
	card := state.CreateCard("task.instance", cardData)
	cardIDs := make([]string, 0, len(consumedModifierCardIDs)+1)
	cardIDs = append(cardIDs, consumedModifierCardIDs...)
	cardIDs = append(cardIDs, card.ID)
	stack := state.CreateStack(Point{X: x, Y: y}, cardIDs)
	ensurePriorityFaceCard(state, stack)

	if err := s.ensureTaskHasBoardLiveLabel(ctx, row.ID); err != nil {
		return nil, err
	}
	incrementQuestMetric(ensureMeta(state), "process_inbox_count", "", 1)

	consumedModifierRows := make([]map[string]any, 0, len(consumedModifierCounts))
	for _, defID := range sortedModifierDefIDs(consumedModifierCounts) {
		consumedModifierRows = append(consumedModifierRows, map[string]any{
			"defId": defID,
			"count": consumedModifierCounts[defID],
		})
	}

	return map[string]any{
		"taskId":       row.ID,
		"stack":        stack,
		"card":         card,
		"alreadyLive":  false,
		"activated":    true,
		"canActivate":  true,
		"requirements": requirements,
		"consumed": map[string]any{
			"coin": map[string]any{
				"currency": costCurrency,
				"amount":   coinRequired,
			},
			"modifiers": consumedModifierRows,
		},
		"inventory": copyIntMap(meta.Inventory),
	}, nil
}
