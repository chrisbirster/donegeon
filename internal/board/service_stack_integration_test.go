package board

import (
	"donegeon/internal/task"
	"errors"
	"fmt"
	"strings"
	"testing"
)

func TestStackMoveSnapsToBoardGrid(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	stack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     500,
		"y":     120,
		"data": map[string]any{
			"title": "Snap Me",
		},
	}), "stack")

	result := env.command(t, "stack.move", map[string]any{
		"stackId": stack.ID,
		"x":       540,
		"y":       160,
	})
	moved := patchStack(t, result, "stack")
	expected := Point{X: 551, Y: 155}
	if moved.Pos != expected {
		t.Fatalf("expected moved stack to snap to %+v, got %+v", expected, moved.Pos)
	}

	after := env.state(t)
	persisted := after.Stacks[stack.ID]
	if persisted == nil {
		t.Fatalf("expected moved stack %s to remain", stack.ID)
	}
	if persisted.Pos != expected {
		t.Fatalf("expected persisted stack to snap to %+v, got %+v", expected, persisted.Pos)
	}
}

func TestStackSplitNewPositionSnapsToBoardGrid(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	stackA := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     500,
		"y":     120,
		"data": map[string]any{
			"title": "Split Snap",
		},
	}), "stack")
	stackB := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "mod.next_action",
		"x":     560,
		"y":     120,
	}), "stack")
	env.command(t, "stack.merge", map[string]any{
		"targetId": stackA.ID,
		"sourceId": stackB.ID,
	})

	result := env.command(t, "stack.split", map[string]any{
		"stackId": stackA.ID,
		"index":   1,
		"newX":    540,
		"newY":    160,
	})
	newStack := patchStack(t, result, "newStack")
	expected := Point{X: 551, Y: 155}
	if newStack.Pos != expected {
		t.Fatalf("expected split stack to snap to %+v, got %+v", expected, newStack.Pos)
	}
}

func TestStackMergeResourceOntoBlankTaskRejected(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	blankTaskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     520,
		"y":     260,
		"data": map[string]any{
			"title": "Blank Task",
		},
	}), "stack")
	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.tree",
		"x":     580,
		"y":     260,
	}), "stack")

	err := env.commandExpectError(t, "stack.merge", map[string]any{
		"targetId": blankTaskStack.ID,
		"sourceId": resourceStack.ID,
	})
	if !errors.Is(err, ErrInvalidStackPair) && !strings.Contains(err.Error(), ErrInvalidStackPair.Error()) {
		t.Fatalf("expected ErrInvalidStackPair for blank-task+resource merge, got: %v", err)
	}
}

func TestMergePlacesVillagerOnTopOfMultiResourceStack(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.tree",
		"x":     560,
		"y":     240,
	}), "stack")
	secondResource := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.tree",
		"x":     620,
		"y":     240,
	}), "stack")
	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     680,
		"y":     240,
	}), "stack")

	env.command(t, "stack.merge", map[string]any{
		"targetId": resourceStack.ID,
		"sourceId": secondResource.ID,
	})
	env.command(t, "stack.merge", map[string]any{
		"targetId": resourceStack.ID,
		"sourceId": villagerStack.ID,
	})

	after := env.state(t)
	merged := after.Stacks[resourceStack.ID]
	if merged == nil {
		t.Fatal("expected merged resource stack")
	}
	if len(merged.Cards) != 3 {
		t.Fatalf("expected 3 cards after merge, got %d", len(merged.Cards))
	}

	kinds := make([]string, 0, len(merged.Cards))
	resourceCount := 0
	for _, cardID := range merged.Cards {
		card := after.Cards[cardID]
		if card == nil {
			t.Fatalf("expected card %s to exist", cardID)
		}
		kind := cardKind(card.DefID)
		kinds = append(kinds, kind)
		if kind == "resource" {
			resourceCount++
		}
	}

	if kinds[0] != "villager" {
		t.Fatalf("expected villager to render on top of multi-resource stack, got order %v", kinds)
	}
	if kinds[len(kinds)-1] != "resource" {
		t.Fatalf("expected resource to remain face card, got order %v", kinds)
	}
	if resourceCount != 2 {
		t.Fatalf("expected two resources in merged stack, got order %v", kinds)
	}
}

func TestStackMergeRejectsSecondVillagerOnAssignedResourceStack(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.tree",
		"x":     560,
		"y":     280,
	}), "stack")
	firstVillager := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     620,
		"y":     280,
	}), "stack")
	secondVillager := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     680,
		"y":     280,
	}), "stack")

	env.command(t, "stack.merge", map[string]any{
		"targetId": resourceStack.ID,
		"sourceId": firstVillager.ID,
	})

	err := env.commandExpectError(t, "stack.merge", map[string]any{
		"targetId": resourceStack.ID,
		"sourceId": secondVillager.ID,
	})
	lower := strings.ToLower(err.Error())
	if !strings.Contains(lower, "cannot") && !strings.Contains(lower, "invalid") {
		t.Fatalf("expected invalid merge rejection for second villager on assigned resource stack, got: %v", err)
	}

	after := env.state(t)
	assigned := after.Stacks[resourceStack.ID]
	if assigned == nil {
		t.Fatalf("expected assigned resource stack %s to remain", resourceStack.ID)
	}
	villagerCount := 0
	for _, cardID := range assigned.Cards {
		card := after.Cards[cardID]
		if card != nil && cardKind(card.DefID) == "villager" {
			villagerCount++
		}
	}
	if villagerCount != 1 {
		t.Fatalf("expected assigned resource stack to keep exactly one villager, got=%d cards=%v", villagerCount, assigned.Cards)
	}
	if after.Stacks[secondVillager.ID] == nil || !stackHasKindFromResponse(after, after.Stacks[secondVillager.ID], "villager") {
		t.Fatalf("expected second villager stack %s to remain unchanged after rejected merge", secondVillager.ID)
	}
}

func TestResourceGatherMergesRepeatedDropsAtSamePosition(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.tree",
		"x":     760,
		"y":     320,
		"data": map[string]any{
			"charges": 2,
		},
	}), "stack")
	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     820,
		"y":     320,
	}), "stack")

	env.command(t, "resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": villagerStack.ID,
	})
	env.command(t, "resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": resourceStack.ID,
	})

	after := env.state(t)
	lootPartStacks := 0
	lootPartCards := 0
	for _, stack := range after.Stacks {
		stackLootParts := 0
		for _, cardID := range stack.Cards {
			card := after.Cards[cardID]
			if card == nil || card.DefID != "loot.parts" {
				continue
			}
			stackLootParts++
			lootPartCards++
		}
		if stackLootParts > 0 {
			lootPartStacks++
			if stackLootParts != 2 {
				t.Fatalf("expected repeated loot drops to stack together, got %d loot.parts cards in one stack", stackLootParts)
			}
		}
	}

	if lootPartStacks != 1 {
		t.Fatalf("expected one loot.parts stack after repeated gathers, got %d", lootPartStacks)
	}
	if lootPartCards != 2 {
		t.Fatalf("expected two loot.parts cards after repeated gathers, got %d", lootPartCards)
	}
}

func TestResourceGatherRejectsSecondVillagerOnAssignedResourceStack(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.tree",
		"x":     760,
		"y":     360,
		"data": map[string]any{
			"charges": 3,
		},
	}), "stack")
	firstVillager := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     820,
		"y":     360,
	}), "stack")
	secondVillager := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     880,
		"y":     360,
	}), "stack")

	env.command(t, "resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": firstVillager.ID,
	})

	rawState, err := env.boardSvc.repo.Load(env.ctx, DefaultBoardID)
	if err != nil {
		t.Fatalf("load raw state: %v", err)
	}
	rawSecondVillager := rawState.GetStack(secondVillager.ID)
	if rawSecondVillager == nil {
		t.Fatalf("expected second villager stack %s in raw state", secondVillager.ID)
	}
	secondVillagerID := firstVillagerIDFromStack(rawState, rawSecondVillager)
	if secondVillagerID == "" {
		t.Fatalf("expected villager id for secondary villager stack %s", secondVillager.ID)
	}
	beforeStamina := 5
	ensureVillager(&rawState.Meta, secondVillagerID).Stamina = beforeStamina
	if err := env.boardSvc.repo.Save(env.ctx, DefaultBoardID, rawState); err != nil {
		t.Fatalf("save second villager stamina fixture: %v", err)
	}

	err = env.commandExpectError(t, "resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": secondVillager.ID,
	})
	lower := strings.ToLower(err.Error())
	if !strings.Contains(lower, "cannot") && !strings.Contains(lower, "invalid") {
		t.Fatalf("expected invalid gather rejection for second villager on assigned resource stack, got: %v", err)
	}

	after := env.state(t)
	assigned := after.Stacks[resourceStack.ID]
	if assigned == nil {
		t.Fatalf("expected assigned resource stack %s to remain", resourceStack.ID)
	}
	villagerCount := 0
	for _, cardID := range assigned.Cards {
		card := after.Cards[cardID]
		if card != nil && cardKind(card.DefID) == "villager" {
			villagerCount++
		}
	}
	if villagerCount != 1 {
		t.Fatalf("expected assigned resource stack to keep exactly one villager after rejected gather, got=%d cards=%v", villagerCount, assigned.Cards)
	}
	if after.Stacks[secondVillager.ID] == nil || !stackHasKindFromResponse(after, after.Stacks[secondVillager.ID], "villager") {
		t.Fatalf("expected second villager stack %s to remain after rejected gather", secondVillager.ID)
	}
	progress := after.Meta.Villagers[secondVillagerID]
	if progress == nil {
		t.Fatalf("expected villager progress for second villager id=%s", secondVillagerID)
	}
	if progress.Stamina != beforeStamina {
		t.Fatalf("expected rejected gather not to spend second villager stamina, before=%d after=%d", beforeStamina, progress.Stamina)
	}
}

func TestQuestWeekOneStoryCanBeClaimed(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	env.command(t, "board.seed_default", map[string]any{})

	initial := env.state(t)
	if initial.Meta.Quests == nil {
		t.Fatal("expected quests state in board meta")
	}
	if initial.Meta.Quests.CurrentWeek != 1 {
		t.Fatalf("expected week=1 on fresh board, got %d", initial.Meta.Quests.CurrentWeek)
	}
	story := findActiveQuestByID(initial.Meta.Quests.Active, "W01_Awakening")
	if story == nil {
		t.Fatalf("expected week-one story quest, active=%v", questIDs(initial.Meta.Quests.Active))
	}

	firstDayDeck := findStackWithTopDef(initial, "deck.first_day")
	if firstDayDeck == nil {
		t.Fatal("expected first day deck stack")
	}
	env.command(t, "deck.spawn_pack", map[string]any{
		"deckStackId": firstDayDeck.ID,
		"x":           300,
		"y":           360,
	})
	pack := findStackWithTopDef(env.state(t), "deck.first_day_pack")
	if pack == nil {
		t.Fatal("expected spawned first day pack")
	}
	env.command(t, "deck.open_pack", map[string]any{
		"packStackId": pack.ID,
		"deckId":      "deck.first_day",
		"radius":      100,
		"count":       3,
	})

	create := env.command(t, "task.create_blank", map[string]any{
		"x":     520,
		"y":     220,
		"title": "Quest completion task",
	})
	taskStack := patchStack(t, create, "stack")
	villagerStack := findFirstStackWithKind(env.state(t), "villager")
	if villagerStack == nil {
		t.Fatal("expected villager stack before assignment")
	}
	env.command(t, "task.assign_villager", map[string]any{
		"taskStackId":     taskStack.ID,
		"villagerStackId": villagerStack.ID,
	})

	afterProgress := env.state(t)
	if afterProgress.Meta.Quests == nil {
		t.Fatal("expected quests after progress")
	}
	story = findActiveQuestByID(afterProgress.Meta.Quests.Active, "W01_Awakening")
	if story == nil {
		t.Fatalf("expected story quest to remain active, active=%v", questIDs(afterProgress.Meta.Quests.Active))
	}
	if !story.Claimable {
		t.Fatalf("expected story quest to be claimable, objectives=%+v", story.Objectives)
	}
	beforeHistory := len(afterProgress.Meta.Quests.History)

	result := env.command(t, "quest.claim_reward", map[string]any{
		"questId": story.ID,
	})
	patch := patchMap(t, result, "")
	if got, _ := patch["questId"].(string); got != story.ID {
		t.Fatalf("expected questId=%s in claim patch, got %q", story.ID, got)
	}

	afterClaim := env.state(t)
	if afterClaim.Meta.Quests == nil {
		t.Fatal("expected quests after claim")
	}
	if findActiveQuestByID(afterClaim.Meta.Quests.Active, story.ID) != nil {
		t.Fatalf("expected claimed quest removed from active list: %s", story.ID)
	}
	historyEntry := findHistoryQuestByID(afterClaim.Meta.Quests.History, story.ID)
	if historyEntry == nil {
		t.Fatalf("expected claimed quest in history: %s", story.ID)
	}
	if !historyEntry.Claimed {
		t.Fatalf("expected history entry to be marked claimed: %+v", *historyEntry)
	}
	if len(afterClaim.Meta.Quests.History) <= beforeHistory {
		t.Fatalf("expected history length to grow, before=%d after=%d", beforeHistory, len(afterClaim.Meta.Quests.History))
	}
	if !hasQuestUnlock(afterClaim.Meta.Quests.Unlocked, "system_feature", "board_view") {
		t.Fatalf("expected week-one quest unlock to include system_feature/board_view, got=%+v", afterClaim.Meta.Quests.Unlocked)
	}
}

func TestQuestProcessInboxCompletesViaTaskActivate(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	catalog := DefaultQuestCatalog()
	catalog.DailyDrawCount = 1
	catalog.DailyTemplates = []questDefinition{
		{
			ID:               "DQ_ProcessInbox",
			TemplateID:       "DQ_ProcessInbox",
			Title:            "Process the Inbox",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "Activate three tasks onto the board.",
			DefinitionOfDone: "process_inbox_count reaches 3.",
			Objectives: []questObjectiveSpec{
				{Op: "process_inbox_count", Count: 3, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
	}
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithQuestCatalog(catalog))

	initial := env.state(t)
	quest := findActiveQuestByID(initial.Meta.Quests.Active, "DQ_ProcessInbox::day1")
	if quest == nil {
		t.Fatalf("expected process inbox quest active on day 1, active=%v", questIDs(initial.Meta.Quests.Active))
	}

	projectID := "board"
	for i := 0; i < 3; i++ {
		created, err := env.taskService.Create(env.ctx, task.CreateInput{
			Content:   fmt.Sprintf("Process inbox quest task %d", i+1),
			ProjectID: &projectID,
			Priority:  4,
		})
		if err != nil {
			t.Fatalf("create board project task %d: %v", i+1, err)
		}
		env.command(t, "task.activate", map[string]any{
			"taskId": created.ID,
			"x":      360 + i*30,
			"y":      260,
		})
	}

	after := env.state(t)
	quest = findActiveQuestByID(after.Meta.Quests.Active, "DQ_ProcessInbox::day1")
	if quest == nil {
		t.Fatalf("expected process inbox quest to remain active until claimed, active=%v", questIDs(after.Meta.Quests.Active))
	}
	if !quest.Completed || !quest.Claimable {
		t.Fatalf("expected process inbox quest completed+claimable after three activations, quest=%+v", *quest)
	}
	if len(quest.Objectives) != 1 {
		t.Fatalf("expected one objective on process inbox quest, got %d", len(quest.Objectives))
	}
	if quest.Objectives[0].Current < 3 {
		t.Fatalf("expected process_inbox_count progress >= 3, objective=%+v", quest.Objectives[0])
	}
}

func TestVillagerLevelingPersistsAcrossStackMerges(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Villagers.Leveling.XPSources.CompleteTask.BaseXP = 1
	cfg.Villagers.Leveling.Thresholds = map[int]int{
		2: 2,
		3: 4,
	}
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	spawnVillager := env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     420,
		"y":     220,
	})
	villagerStack := patchStack(t, spawnVillager, "stack")
	villagerCard := patchCard(t, spawnVillager, "card")
	villagerID := dataStringPatch(villagerCard.Data["villagerId"])
	if villagerID == "" {
		t.Fatalf("expected spawned villager card to include villagerId, card=%+v", villagerCard)
	}

	currentVillagerStackID := villagerStack.ID
	for i := 0; i < 2; i++ {
		spawnTask := env.command(t, "card.spawn", map[string]any{
			"defId": "task.blank",
			"x":     560 + i*20,
			"y":     240 + i*20,
			"data": map[string]any{
				"title": fmt.Sprintf("villager leveling task %d", i+1),
			},
		})
		taskStack := patchStack(t, spawnTask, "stack")

		env.command(t, "task.assign_villager", map[string]any{
			"taskStackId":     taskStack.ID,
			"villagerStackId": currentVillagerStackID,
		})

		complete := env.command(t, "task.complete_stack", map[string]any{
			"stackId": taskStack.ID,
		})
		completePatch := patchMap(t, complete, "")
		progressPatch := patchAnyMap(t, completePatch, "villagerProgress")
		if gotID := dataStringPatch(progressPatch["id"]); gotID != villagerID {
			t.Fatalf("expected stable villager progress id=%s, got=%s patch=%v", villagerID, gotID, progressPatch)
		}

		createdStacks := patchStacks(t, complete, "createdStacks")
		nextVillagerStackID := ""
		after := env.state(t)
		for _, created := range createdStacks {
			if created == nil {
				continue
			}
			createdState := after.Stacks[created.ID]
			if createdState == nil {
				continue
			}
			if stackHasKindFromResponse(after, createdState, "villager") {
				nextVillagerStackID = createdState.ID
				break
			}
		}
		if nextVillagerStackID == "" {
			t.Fatalf("expected completion to leave villager survivor stack, created=%+v", createdStacks)
		}
		currentVillagerStackID = nextVillagerStackID
	}

	final := env.state(t)
	progress := final.Meta.Villagers[villagerID]
	if progress == nil {
		t.Fatalf("expected villager progress for villagerId=%s, villagers=%+v", villagerID, final.Meta.Villagers)
	}
	if progress.XP < 2 {
		t.Fatalf("expected villager XP to accumulate across completions, got=%d progress=%+v", progress.XP, *progress)
	}
	if progress.Level < 2 {
		t.Fatalf("expected villager level >= 2 after two completions, got=%d progress=%+v", progress.Level, *progress)
	}
}
