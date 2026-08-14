package board

import (
	"donegeon/internal/task"
	"errors"
	"strings"
	"testing"
)

func TestBoardStateIncludesProgressionMetadata(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	villagerSpawn := env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     520,
	})
	villagerStack := patchStack(t, villagerSpawn, "stack")
	villagerID := setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {})

	state := env.state(t)
	if state.Meta.Progression == nil {
		t.Fatal("expected board state to include progression metadata")
	}
	if got := state.Meta.Progression.MaxLevel; got != 10 {
		t.Fatalf("expected max level 10, got=%d", got)
	}
	if got := state.Meta.Progression.Thresholds["2"]; got != 20 {
		t.Fatalf("expected threshold for level 2 = 20, got=%d", got)
	}
	if len(state.Meta.Progression.PerksByLevel["2"]) == 0 || state.Meta.Progression.PerksByLevel["2"][0].Label != "Heartier" {
		t.Fatalf("expected level 2 progression perk metadata, got=%+v", state.Meta.Progression.PerksByLevel["2"])
	}

	progress := state.Meta.Villagers[villagerID]
	if progress == nil {
		t.Fatalf("expected villager progress in board meta for %s", villagerID)
	}
	if progress.MaxStamina != 8 {
		t.Fatalf("expected max stamina 8, got=%d", progress.MaxStamina)
	}
	if progress.NextLevel != 2 || progress.NextLevelXP != 20 || progress.XPToNext != 20 {
		t.Fatalf("expected next level metadata {2,20,20}, got=%+v", *progress)
	}
}

func TestStackMergeTaskAndVillagerCountsAsAssignmentForQuests(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     480,
		"y":     220,
		"data": map[string]any{
			"title": "Assignment metric task",
		},
	}), "stack")
	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     540,
		"y":     220,
	}), "stack")

	before := env.state(t).Meta.Metrics["quest.assign_villager"]
	env.command(t, "stack.merge", map[string]any{
		"targetId": taskStack.ID,
		"sourceId": villagerStack.ID,
	})

	afterState := env.state(t)
	after := afterState.Meta.Metrics["quest.assign_villager"]
	if after != before+1 {
		t.Fatalf("expected quest.assign_villager metric +1 after task+villager merge, before=%d after=%d", before, after)
	}

	merged := afterState.Stacks[taskStack.ID]
	if merged == nil {
		t.Fatalf("expected merged stack %s", taskStack.ID)
	}
	foundAssignedID := false
	for _, cardID := range merged.Cards {
		card := afterState.Cards[cardID]
		if card == nil || cardKind(card.DefID) != "task" {
			continue
		}
		if dataStringPatch(card.Data["assignedVillagerId"]) != "" {
			foundAssignedID = true
			break
		}
	}
	if !foundAssignedID {
		t.Fatalf("expected task card in merged stack to include assignedVillagerId: stack=%+v", merged)
	}
}

func TestStackMergeVillagerOntoZombieTriggersZombieClear(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	zombieStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "zombie.default",
		"x":     520,
		"y":     260,
	}), "stack")
	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     560,
		"y":     260,
	}), "stack")

	beforeCleared := env.state(t).Meta.Metrics["zombies_cleared"]
	result := env.command(t, "stack.merge", map[string]any{
		"targetId": zombieStack.ID,
		"sourceId": villagerStack.ID,
	})
	patch, ok := result.Patch.(map[string]any)
	if !ok {
		t.Fatalf("expected patch map from villager+zombie merge, got %T", result.Patch)
	}
	if got := dataStringPatch(patch["villagerStackId"]); got != villagerStack.ID {
		t.Fatalf("expected villagerStackId=%s in patch, got=%q", villagerStack.ID, got)
	}

	after := env.state(t)
	if after.Meta.Metrics["zombies_cleared"] != beforeCleared+1 {
		t.Fatalf(
			"expected zombies_cleared metric +1 after villager+zombie merge, before=%d after=%d",
			beforeCleared,
			after.Meta.Metrics["zombies_cleared"],
		)
	}
	if after.Stacks[villagerStack.ID] == nil {
		t.Fatalf("expected villager stack %s to remain after zombie clear", villagerStack.ID)
	}
	if cleared := after.Stacks[zombieStack.ID]; cleared != nil && stackHasKindFromResponse(after, cleared, "zombie") {
		t.Fatalf("expected zombie stack %s to be cleared, stack=%+v", zombieStack.ID, cleared)
	}
}

func TestStackMergeFoodOntoExhaustedVillagerConsumesFood(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	foodStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "food.apple",
		"x":     520,
		"y":     300,
		"data": map[string]any{
			"amount": 1,
		},
	}), "stack")
	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     580,
		"y":     300,
	}), "stack")

	rawState, err := env.boardSvc.repo.Load(env.ctx, DefaultBoardID)
	if err != nil {
		t.Fatalf("load raw state: %v", err)
	}
	rawVillager := rawState.GetStack(villagerStack.ID)
	if rawVillager == nil {
		t.Fatalf("expected villager stack %s in raw state", villagerStack.ID)
	}
	villagerID := firstVillagerIDFromStack(rawState, rawVillager)
	if villagerID == "" {
		t.Fatalf("expected villager id for stack %s", villagerStack.ID)
	}
	ensureVillager(&rawState.Meta, villagerID).Stamina = 0
	if err := env.boardSvc.repo.Save(env.ctx, DefaultBoardID, rawState); err != nil {
		t.Fatalf("save exhausted villager state: %v", err)
	}

	result := env.command(t, "stack.merge", map[string]any{
		"targetId": villagerStack.ID,
		"sourceId": foodStack.ID,
	})
	patch, ok := result.Patch.(map[string]any)
	if !ok {
		t.Fatalf("expected patch map from villager+food merge, got %T", result.Patch)
	}
	if got := intFromAny(patch["staminaBefore"]); got != 0 {
		t.Fatalf("expected staminaBefore=0 for exhausted villager, got=%d patch=%v", got, patch)
	}
	if got := intFromAny(patch["staminaRemaining"]); got <= 0 {
		t.Fatalf("expected food merge to restore stamina, got=%d patch=%v", got, patch)
	}

	after := env.state(t)
	progress := after.Meta.Villagers[villagerID]
	if progress == nil {
		t.Fatalf("expected villager progress for villagerId=%s, villagers=%+v", villagerID, after.Meta.Villagers)
	}
	if progress.Stamina <= 0 {
		t.Fatalf("expected exhausted villager to recover stamina after food merge, progress=%+v", *progress)
	}
	if food := after.Stacks[foodStack.ID]; food != nil && stackHasKindFromResponse(after, food, "food") {
		t.Fatalf("expected food stack %s to be consumed, stack=%+v", foodStack.ID, food)
	}
	if after.Stacks[villagerStack.ID] == nil {
		t.Fatalf("expected villager stack %s to remain after consuming food", villagerStack.ID)
	}
}

func TestStackMergeVillagerOntoLootPartsRejected(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	partsStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "loot.parts",
		"x":     520,
		"y":     320,
	}), "stack")
	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     580,
		"y":     320,
	}), "stack")

	err := env.commandExpectError(t, "stack.merge", map[string]any{
		"targetId": partsStack.ID,
		"sourceId": villagerStack.ID,
	})
	if !errors.Is(err, ErrInvalidStackPair) && !strings.Contains(err.Error(), ErrInvalidStackPair.Error()) {
		t.Fatalf("expected ErrInvalidStackPair for villager+loot.parts merge, got: %v", err)
	}
}

func TestStackMergeModifierOntoVillagerWithoutTaskRejected(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     360,
	}), "stack")
	modifierStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "mod.next_action",
		"x":     580,
		"y":     360,
	}), "stack")

	err := env.commandExpectError(t, "stack.merge", map[string]any{
		"targetId": villagerStack.ID,
		"sourceId": modifierStack.ID,
	})
	if !errors.Is(err, ErrInvalidStackPair) && !strings.Contains(err.Error(), ErrInvalidStackPair.Error()) {
		t.Fatalf("expected ErrInvalidStackPair for villager+modifier merge without task, got: %v", err)
	}
}

func TestTaskSetTaskIDCountsAsCreateTaskForQuests(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	spawn := env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     520,
		"y":     260,
		"data": map[string]any{
			"title": "Link task id quest metric",
		},
	})
	card := patchCard(t, spawn, "card")

	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:  "Persistent task for linking",
		Priority: 4,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	before := env.state(t).Meta.Metrics["quest.create_task"]
	env.command(t, "task.set_task_id", map[string]any{
		"taskCardId": card.ID,
		"taskId":     created.ID,
	})
	after := env.state(t).Meta.Metrics["quest.create_task"]
	if after != before+1 {
		t.Fatalf("expected quest.create_task metric +1 on first task.set_task_id link, before=%d after=%d", before, after)
	}
}

func TestTaskSetTitleCountsCreateTaskOnceBeforeLinking(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	spawn := env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     520,
		"y":     280,
		"data": map[string]any{
			"title": "Untitled task",
		},
	})
	card := patchCard(t, spawn, "card")

	before := env.state(t).Meta.Metrics["quest.create_task"]
	env.command(t, "task.set_title", map[string]any{
		"taskCardId": card.ID,
		"title":      "Write release notes",
	})
	afterTitle := env.state(t).Meta.Metrics["quest.create_task"]
	if afterTitle != before+1 {
		t.Fatalf("expected task.set_title to increment quest.create_task once, before=%d after=%d", before, afterTitle)
	}

	env.command(t, "task.set_title", map[string]any{
		"taskCardId": card.ID,
		"title":      "Write release notes v2",
	})
	afterSecondTitle := env.state(t).Meta.Metrics["quest.create_task"]
	if afterSecondTitle != afterTitle {
		t.Fatalf("expected second task.set_title not to increment again, afterTitle=%d afterSecondTitle=%d", afterTitle, afterSecondTitle)
	}

	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:  "Persistent linked task",
		Priority: 4,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	env.command(t, "task.set_task_id", map[string]any{
		"taskCardId": card.ID,
		"taskId":     created.ID,
	})
	afterLink := env.state(t).Meta.Metrics["quest.create_task"]
	if afterLink != afterSecondTitle {
		t.Fatalf("expected task.set_task_id after counted title not to double count, afterSecondTitle=%d afterLink=%d", afterSecondTitle, afterLink)
	}
}

func TestGrantStorePurchaseCreditsCoinAndIsIdempotent(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	first, err := env.boardSvc.GrantStorePurchase(env.ctx, DefaultBoardID, StorePurchaseGrant{
		SessionID: "cs_test_store_coin",
		ItemID:    storeItemCoinStash,
	})
	if err != nil {
		t.Fatalf("grant coin stash: %v", err)
	}
	if first.AlreadyApplied {
		t.Fatal("expected first store grant to apply")
	}
	if got := first.Inventory["coin"]; got != 25 {
		t.Fatalf("expected coin stash to grant 25 coin, got=%d inventory=%+v", got, first.Inventory)
	}

	state := env.state(t)
	if got := state.Meta.Inventory["coin"]; got != 25 {
		t.Fatalf("expected board inventory coin=25 after store grant, got=%d inventory=%+v", got, state.Meta.Inventory)
	}
	if len(state.Stacks) == 0 {
		t.Fatal("expected store grant to seed the board when empty")
	}
	receipt := state.Meta.StoreReceipts["cs_test_store_coin"]
	if receipt == nil {
		t.Fatalf("expected store receipt for session id, receipts=%+v", state.Meta.StoreReceipts)
	}
	if receipt.ItemID != storeItemCoinStash {
		t.Fatalf("expected receipt item id=%s, got=%s", storeItemCoinStash, receipt.ItemID)
	}

	second, err := env.boardSvc.GrantStorePurchase(env.ctx, DefaultBoardID, StorePurchaseGrant{
		SessionID: "cs_test_store_coin",
		ItemID:    storeItemCoinStash,
	})
	if err != nil {
		t.Fatalf("grant coin stash second time: %v", err)
	}
	if !second.AlreadyApplied {
		t.Fatal("expected repeated session id to be idempotent")
	}
	if got := env.state(t).Meta.Inventory["coin"]; got != 25 {
		t.Fatalf("expected idempotent store grant to keep coin at 25, got=%d", got)
	}
}

func TestGrantStorePurchaseSpawnsBoardRewards(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	if _, err := env.boardSvc.GrantStorePurchase(env.ctx, DefaultBoardID, StorePurchaseGrant{
		SessionID: "cs_test_store_pack",
		ItemID:    storeItemOrganizationPack,
	}); err != nil {
		t.Fatalf("grant organization pack: %v", err)
	}
	if _, err := env.boardSvc.GrantStorePurchase(env.ctx, DefaultBoardID, StorePurchaseGrant{
		SessionID: "cs_test_store_mods",
		ItemID:    storeItemModifierBundle,
	}); err != nil {
		t.Fatalf("grant modifier bundle: %v", err)
	}
	if _, err := env.boardSvc.GrantStorePurchase(env.ctx, DefaultBoardID, StorePurchaseGrant{
		SessionID: "cs_test_store_villager",
		ItemID:    storeItemVillagerContract,
	}); err != nil {
		t.Fatalf("grant villager contract: %v", err)
	}

	state := env.state(t)
	pack := findStackWithTopDef(state, "deck.organization_pack")
	if pack == nil {
		t.Fatalf("expected organization pack stack to spawn, stacks=%+v", state.Stacks)
	}
	top := state.Cards[pack.Cards[len(pack.Cards)-1]]
	if top == nil {
		t.Fatalf("expected top card for spawned organization pack stack %+v", pack)
	}
	if got := dataStringPatch(top.Data["deckId"]); got != "deck.organization" {
		t.Fatalf("expected organization pack deckId=deck.organization, got=%q data=%+v", got, top.Data)
	}

	modifierCounts := map[string]int{}
	foundRecruit := false
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.Cards[cardID]
			if card == nil {
				continue
			}
			switch card.DefID {
			case "mod.next_action", "mod.deadline_pin", "mod.recurring":
				modifierCounts[card.DefID] += 1
			case "villager.basic":
				if dataStringPatch(card.Data["title"]) == "Field Recruit" {
					foundRecruit = true
				}
			}
		}
	}
	if modifierCounts["mod.next_action"] != 2 {
		t.Fatalf("expected 2 next action modifiers, got=%d counts=%+v", modifierCounts["mod.next_action"], modifierCounts)
	}
	if modifierCounts["mod.deadline_pin"] != 1 {
		t.Fatalf("expected 1 deadline pin modifier, got=%d counts=%+v", modifierCounts["mod.deadline_pin"], modifierCounts)
	}
	if modifierCounts["mod.recurring"] != 1 {
		t.Fatalf("expected 1 recurring modifier, got=%d counts=%+v", modifierCounts["mod.recurring"], modifierCounts)
	}
	if !foundRecruit {
		t.Fatalf("expected villager contract to spawn the Field Recruit villager, state=%+v", state)
	}
}
