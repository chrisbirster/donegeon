package board

import (
	"donegeon/internal/task"
	"strings"
	"testing"
	"time"
)

func TestServiceBoardStatePersistsAcrossRestart(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})
	env.command(t, "world.end_day", map[string]any{})

	before := env.state(t)
	if before.Meta.DayTickCount < 1 {
		t.Fatalf("expected day tick before restart, got %d", before.Meta.DayTickCount)
	}

	env.restartBoardService()

	after := env.state(t)
	if after.Meta.DayTickCount != before.Meta.DayTickCount {
		t.Fatalf("expected persisted day tick count, got before=%d after=%d", before.Meta.DayTickCount, after.Meta.DayTickCount)
	}
	if after.Meta.Metrics["day_ticks"] != before.Meta.Metrics["day_ticks"] {
		t.Fatalf(
			"expected persisted day_ticks metric, got before=%d after=%d",
			before.Meta.Metrics["day_ticks"],
			after.Meta.Metrics["day_ticks"],
		)
	}
}

func TestDeckUnlockAndEconomyCostParity(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{"deckRowY": 500})
	env.command(t, "world.end_day", map[string]any{})

	state := env.state(t)
	orgDeck := findStackWithTopDef(state, "deck.organization")
	if orgDeck == nil {
		t.Fatal("expected organization deck stack from seed")
	}

	err := env.commandExpectError(t, "deck.spawn_pack", map[string]any{
		"deckStackId": orgDeck.ID,
		"x":           380,
		"y":           380,
	})
	if !strings.Contains(strings.ToLower(err.Error()), "locked") {
		t.Fatalf("expected locked error for organization deck, got: %v", err)
	}

	for i := 0; i < 3; i++ {
		item, createErr := env.taskService.Create(env.ctx, task.CreateInput{
			Content:  "processed unlock task",
			Priority: 4,
		})
		if createErr != nil {
			t.Fatalf("create unlock task: %v", createErr)
		}
		if closeErr := env.taskService.Close(env.ctx, item.ID); closeErr != nil {
			t.Fatalf("close unlock task: %v", closeErr)
		}
	}

	spawnFirst := env.command(t, "deck.spawn_pack", map[string]any{
		"deckStackId": orgDeck.ID,
		"x":           380,
		"y":           380,
	})
	spawnFirstDeck := patchMap(t, spawnFirst, "deck")
	if got := intFromPatch(spawnFirstDeck["costCharged"]); got != 0 {
		t.Fatalf("expected free open to be charged at spawn, got cost=%d", got)
	}
	pack := findStackWithTopDef(env.state(t), "deck.organization_pack")
	if pack == nil {
		t.Fatal("expected organization pack after unlock")
	}

	lootStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "loot.coin",
		"x":     900,
		"y":     200,
		"data": map[string]any{
			"amount": 20,
		},
	}), "stack")
	env.command(t, "loot.collect_stack", map[string]any{
		"stackId": lootStack.ID,
	})

	openFirst := env.command(t, "deck.open_pack", map[string]any{
		"packStackId": pack.ID,
		"deckId":      "deck.organization",
		"radius":      90,
		"seed":        42,
	})
	deckPatch := patchMap(t, openFirst, "deck")
	if got := intFromPatch(deckPatch["costCharged"]); got != 0 {
		t.Fatalf("expected free open for first organization deck open, got cost=%d", got)
	}

	beforeSpawnCoin := env.state(t).Meta.Inventory["coin"]
	spawnSecond := env.command(t, "deck.spawn_pack", map[string]any{
		"deckStackId": orgDeck.ID,
		"x":           460,
		"y":           380,
	})
	spawnSecondDeck := patchMap(t, spawnSecond, "deck")
	if got := intFromPatch(spawnSecondDeck["costCharged"]); got <= 0 {
		t.Fatalf("expected non-zero cost at spawn after free opens exhausted, got=%d", got)
	}
	afterSpawnCoin := env.state(t).Meta.Inventory["coin"]
	if afterSpawnCoin >= beforeSpawnCoin {
		t.Fatalf("expected coin spend on second spawn, before=%d after=%d", beforeSpawnCoin, afterSpawnCoin)
	}
	pack2 := findStackWithTopDef(env.state(t), "deck.organization_pack")
	if pack2 == nil {
		t.Fatal("expected second organization pack")
	}
	beforeCoin := env.state(t).Meta.Inventory["coin"]
	openSecond := env.command(t, "deck.open_pack", map[string]any{
		"packStackId": pack2.ID,
		"deckId":      "deck.organization",
		"radius":      90,
		"seed":        99,
	})
	deckPatch2 := patchMap(t, openSecond, "deck")
	if got := intFromPatch(deckPatch2["costCharged"]); got != intFromPatch(spawnSecondDeck["costCharged"]) {
		t.Fatalf("expected open payload to report spawn-time charge, want=%d got=%d", intFromPatch(spawnSecondDeck["costCharged"]), got)
	}
	afterCoin := env.state(t).Meta.Inventory["coin"]
	if afterCoin != beforeCoin {
		t.Fatalf("expected no additional coin spend on open, before=%d after=%d", beforeCoin, afterCoin)
	}
}

func TestDeckSpawnPackRequiresCurrencyBeforePackAppears(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{"deckRowY": 500})
	env.command(t, "world.end_day", map[string]any{})

	state := env.state(t)
	orgDeck := findStackWithTopDef(state, "deck.organization")
	if orgDeck == nil {
		t.Fatal("expected organization deck stack from seed")
	}

	for i := 0; i < 3; i++ {
		item, createErr := env.taskService.Create(env.ctx, task.CreateInput{
			Content:  "unlock task",
			Priority: 4,
		})
		if createErr != nil {
			t.Fatalf("create unlock task: %v", createErr)
		}
		if closeErr := env.taskService.Close(env.ctx, item.ID); closeErr != nil {
			t.Fatalf("close unlock task: %v", closeErr)
		}
	}

	env.command(t, "deck.spawn_pack", map[string]any{
		"deckStackId": orgDeck.ID,
		"x":           320,
		"y":           360,
	})

	err := env.commandExpectError(t, "deck.spawn_pack", map[string]any{
		"deckStackId": orgDeck.ID,
		"x":           420,
		"y":           360,
	})
	lower := strings.ToLower(err.Error())
	if !strings.Contains(lower, "not enough") || !strings.Contains(lower, "spawn") {
		t.Fatalf("expected spawn-time currency error, got: %v", err)
	}
}

func TestWorldEndDayRecurrenceAndOverdueZombiePipeline(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	recurrence := "FREQ=MONTHLY;INTERVAL=2"
	recDue := "2026-01-01"
	recTask, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:     "Recurring completed task",
		Priority:    2,
		Recurrence:  &recurrence,
		DueDeadline: &recDue,
	})
	if err != nil {
		t.Fatalf("create recurring task: %v", err)
	}
	if err := env.taskService.Close(env.ctx, recTask.ID); err != nil {
		t.Fatalf("close recurring task: %v", err)
	}

	overdue := time.Now().AddDate(0, 0, -2).Format("2006-01-02")
	overdueTask, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:     "Overdue pending task",
		Priority:    3,
		DueDeadline: &overdue,
	})
	if err != nil {
		t.Fatalf("create overdue task: %v", err)
	}

	worldResult := env.command(t, "world.end_day", map[string]any{})
	patch, ok := worldResult.Patch.(map[string]any)
	if !ok {
		t.Fatalf("expected world.end_day patch map, got %T", worldResult.Patch)
	}
	respawned := patchStringSlice(t, patch["recurrenceRespawnedTaskIds"])
	if !contains(respawned, recTask.ID) {
		t.Fatalf("expected recurrence respawn to include %s, got %v", recTask.ID, respawned)
	}
	overdueTaskIDs := patchStringSlice(t, patch["overdueTaskIds"])
	if !contains(overdueTaskIDs, overdueTask.ID) {
		t.Fatalf("expected overdue ids to include %s, got %v", overdueTask.ID, overdueTaskIDs)
	}
	if intFromPatch(patch["spawnedZombieCount"]) <= 0 {
		t.Fatalf("expected at least one zombie spawn, patch=%v", patch)
	}

	updatedRecTask, err := env.taskService.Get(env.ctx, recTask.ID)
	if err != nil {
		t.Fatalf("get recurring task after day tick: %v", err)
	}
	if updatedRecTask.Checked {
		t.Fatalf("expected recurring task to reopen after day tick: %s", recTask.ID)
	}
	if updatedRecTask.DueDeadline == nil || strings.TrimSpace(*updatedRecTask.DueDeadline) == "" {
		t.Fatalf("expected recurring task due deadline to be updated: %+v", updatedRecTask)
	}

	state := env.state(t)
	if state.Meta.Metrics["zombies_seen"] <= 0 {
		t.Fatalf("expected zombies_seen metric to increment, got=%d", state.Meta.Metrics["zombies_seen"])
	}

	foundOverdueZombie := false
	for _, stack := range state.Stacks {
		if stack == nil || !stackHasKindFromResponse(state, stack, "zombie") {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.Cards[cardID]
			if card == nil || !strings.HasPrefix(card.DefID, "zombie.") {
				continue
			}
			if dataStringPatch(card.Data["taskId"]) == overdueTask.ID {
				foundOverdueZombie = true
			}
		}
	}
	if !foundOverdueZombie {
		t.Fatal("expected overdue zombie stack to include overdue task id")
	}
}

func TestStackMergeCollectDeckConsumesSourceAndDecksDoNotMerge(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	state := env.state(t)
	collectDeck := findStackWithTopDef(state, "deck.collect")
	if collectDeck == nil {
		t.Fatal("expected collect deck in seeded board")
	}
	firstDayDeck := findStackWithTopDef(state, "deck.first_day")
	if firstDayDeck == nil {
		t.Fatal("expected first day deck in seeded board")
	}

	lootStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "loot.coin",
		"x":     520,
		"y":     320,
		"data": map[string]any{
			"amount": 3,
		},
	}), "stack")
	beforeCoin := env.state(t).Meta.Inventory["coin"]

	result := env.command(t, "stack.merge", map[string]any{
		"targetId": collectDeck.ID,
		"sourceId": lootStack.ID,
	})
	patch, ok := result.Patch.(map[string]any)
	if !ok {
		t.Fatalf("expected patch map from collect merge, got %T", result.Patch)
	}
	if removed, _ := patch["removedStack"].(string); removed != lootStack.ID {
		t.Fatalf("expected removedStack=%s, got %q", lootStack.ID, removed)
	}
	after := env.state(t)
	if after.Meta.Inventory["coin"] <= beforeCoin {
		t.Fatalf("expected collect merge to increase coin inventory, before=%d after=%d", beforeCoin, after.Meta.Inventory["coin"])
	}
	if after.Stacks[collectDeck.ID] == nil {
		t.Fatal("expected collect deck stack to persist after collection")
	}

	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     640,
		"y":     280,
		"data": map[string]any{
			"title": "Deck merge should fail",
		},
	}), "stack")
	err := env.commandExpectError(t, "stack.merge", map[string]any{
		"targetId": firstDayDeck.ID,
		"sourceId": taskStack.ID,
	})
	if !strings.Contains(strings.ToLower(err.Error()), "cannot") &&
		!strings.Contains(strings.ToLower(err.Error()), "invalid") {
		t.Fatalf("expected deck merge rejection error, got: %v", err)
	}
}

func TestFirstDayPackFirstOpenIncludesStarterCards(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	state := env.state(t)
	firstDayDeck := findStackWithTopDef(state, "deck.first_day")
	if firstDayDeck == nil {
		t.Fatal("expected first day deck")
	}

	env.command(t, "deck.spawn_pack", map[string]any{
		"deckStackId": firstDayDeck.ID,
		"x":           240,
		"y":           360,
	})
	pack := findStackWithTopDef(env.state(t), "deck.first_day_pack")
	if pack == nil {
		t.Fatal("expected first day pack stack")
	}

	openResult := env.command(t, "deck.open_pack", map[string]any{
		"packStackId": pack.ID,
		"deckId":      "deck.first_day",
		"radius":      100,
		"count":       5,
	})
	created := patchStacks(t, openResult, "createdStacks")
	if len(created) != 5 {
		t.Fatalf("expected 5 created stacks, got %d", len(created))
	}

	after := env.state(t)
	hasVillager := false
	hasResource := false
	hasFood := false
	for _, stack := range created {
		if stack == nil || len(stack.Cards) == 0 {
			continue
		}
		top := after.Cards[stack.Cards[len(stack.Cards)-1]]
		if top == nil {
			continue
		}
		switch cardKind(top.DefID) {
		case "villager":
			hasVillager = true
		case "resource":
			hasResource = true
		case "food":
			hasFood = true
		}
	}
	if !hasVillager || !hasResource || !hasFood {
		t.Fatalf("expected first open starter set (villager/resource/food), got villager=%t resource=%t food=%t", hasVillager, hasResource, hasFood)
	}
}

func TestMergePrioritizesTaskResourceFoodAsFaceCards(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	taskStack := patchStack(t, env.command(t, "task.create_blank", map[string]any{
		"x":     540,
		"y":     220,
		"title": "Face card task",
	}), "stack")
	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.tree",
		"x":     600,
		"y":     220,
	}), "stack")
	foodStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "food.apple",
		"x":     660,
		"y":     220,
	}), "stack")

	env.command(t, "stack.merge", map[string]any{
		"targetId": resourceStack.ID,
		"sourceId": foodStack.ID,
	})
	afterResourceFood := env.state(t)
	resourceFoodStack := afterResourceFood.Stacks[resourceStack.ID]
	if resourceFoodStack == nil {
		t.Fatal("expected merged resource+food stack")
	}
	resourceFoodTop := afterResourceFood.Cards[resourceFoodStack.Cards[len(resourceFoodStack.Cards)-1]]
	if resourceFoodTop == nil {
		t.Fatal("expected top card on merged resource+food stack")
	}
	if cardKind(resourceFoodTop.DefID) != "resource" {
		t.Fatalf("expected resource face card for resource+food stack, got %s", resourceFoodTop.DefID)
	}

	env.command(t, "stack.merge", map[string]any{
		"targetId": taskStack.ID,
		"sourceId": resourceStack.ID,
	})
	afterTaskMerge := env.state(t)
	merged := afterTaskMerge.Stacks[taskStack.ID]
	if merged == nil {
		t.Fatal("expected merged task stack")
	}
	top := afterTaskMerge.Cards[merged.Cards[len(merged.Cards)-1]]
	if top == nil {
		t.Fatal("expected top card on merged task stack")
	}
	if cardKind(top.DefID) != "task" {
		t.Fatalf("expected task face card when task/resource/food are merged, got %s", top.DefID)
	}
}
