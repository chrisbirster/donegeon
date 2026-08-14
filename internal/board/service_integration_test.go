package board

import (
	"donegeon/internal/task"
	"strings"
	"testing"
)

func TestServiceCommandMatrixLegacyParity(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	executed := map[string]bool{}
	run := func(cmd string, args map[string]any) CommandResult {
		executed[cmd] = true
		return env.command(t, cmd, args)
	}

	run("board.seed_default", map[string]any{"deckRowY": 500})
	state := env.state(t)
	firstDayDeck := findStackWithTopDef(state, "deck.first_day")
	if firstDayDeck == nil {
		t.Fatal("expected seeded first day deck stack")
	}
	villagerStack := findFirstStackWithKind(state, "villager")
	if villagerStack == nil {
		t.Fatal("expected seeded villager stack")
	}

	run("deck.spawn_pack", map[string]any{
		"deckStackId": firstDayDeck.ID,
		"x":           220,
		"y":           360,
	})
	state = env.state(t)
	firstDayPack := findStackWithTopDef(state, "deck.first_day_pack")
	if firstDayPack == nil {
		t.Fatal("expected spawned first day pack")
	}
	run("deck.open_pack", map[string]any{
		"packStackId": firstDayPack.ID,
		"deckId":      "deck.first_day",
		"radius":      110,
		"count":       3,
	})

	stackA := patchStack(t, run("card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     500,
		"y":     120,
		"data": map[string]any{
			"title": "Stack Ops",
		},
	}), "stack")
	run("stack.move", map[string]any{
		"stackId": stackA.ID,
		"x":       540,
		"y":       160,
	})
	run("stack.bringToFront", map[string]any{
		"stackId": stackA.ID,
	})
	stackB := patchStack(t, run("card.spawn", map[string]any{
		"defId": "mod.next_action",
		"x":     560,
		"y":     120,
	}), "stack")
	run("stack.merge", map[string]any{
		"targetId": stackA.ID,
		"sourceId": stackB.ID,
	})
	splitStack := patchStack(t, run("stack.split", map[string]any{
		"stackId": stackA.ID,
		"index":   1,
	}), "newStack")
	run("stack.merge", map[string]any{
		"targetId": stackA.ID,
		"sourceId": splitStack.ID,
	})
	unstackCreated := patchStacks(t, run("stack.unstack", map[string]any{
		"stackId": stackA.ID,
	}), "createdStacks")
	if len(unstackCreated) == 0 {
		t.Fatal("expected stack.unstack to create stacks")
	}
	run("stack.remove", map[string]any{
		"stackId": unstackCreated[0].ID,
	})

	linkedTask, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:  "Linked matrix task",
		Priority: 2,
	})
	if err != nil {
		t.Fatalf("create linked task: %v", err)
	}

	createPatch := run("task.create_blank", map[string]any{
		"x":     640,
		"y":     180,
		"title": "Task stack",
	})
	taskStack := patchStack(t, createPatch, "stack")
	taskCard := patchCard(t, createPatch, "card")

	run("task.set_title", map[string]any{
		"taskCardId": taskCard.ID,
		"title":      "Task stack updated",
	})
	run("task.set_description", map[string]any{
		"taskCardId":  taskCard.ID,
		"description": "integration test description",
	})
	run("task.set_task_id", map[string]any{
		"taskCardId": taskCard.ID,
		"taskId":     linkedTask.ID,
	})
	run("task.set_priority", map[string]any{
		"taskCardId": taskCard.ID,
		"priority":   1,
	})
	run("task.add_modifier", map[string]any{
		"taskStackId":   taskStack.ID,
		"modifierDefId": "next_action",
	})

	villagerStack = findFirstStackWithKind(env.state(t), "villager")
	if villagerStack == nil {
		t.Fatal("expected villager stack before task.assign_villager")
	}
	run("task.assign_villager", map[string]any{
		"taskStackId":     taskStack.ID,
		"villagerStackId": villagerStack.ID,
	})
	run("task.complete_stack", map[string]any{
		"stackId": taskStack.ID,
	})

	linkedTaskAfter, err := env.taskService.Get(env.ctx, linkedTask.ID)
	if err != nil {
		t.Fatalf("get linked task after completion: %v", err)
	}
	if !linkedTaskAfter.Checked {
		t.Fatalf("expected linked task to be checked after task.complete_stack: %s", linkedTask.ID)
	}

	spawnTask, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:    "Spawn existing task",
		Priority:   1,
		Recurrence: strPtr("FREQ=MONTHLY;INTERVAL=2"),
	})
	if err != nil {
		t.Fatalf("create spawn task: %v", err)
	}
	run("task.spawn_existing", map[string]any{
		"taskId": spawnTask.ID,
		"x":      700,
		"y":      260,
	})
	run("task.complete_by_task_id", map[string]any{
		"taskId": spawnTask.ID,
	})
	spawnTaskAfter, err := env.taskService.Get(env.ctx, spawnTask.ID)
	if err != nil {
		t.Fatalf("get spawn task after completion: %v", err)
	}
	if !spawnTaskAfter.Checked {
		t.Fatalf("expected spawned task to be checked after task.complete_by_task_id: %s", spawnTask.ID)
	}

	resourceStack := patchStack(t, run("card.spawn", map[string]any{
		"defId": "resource.tree",
		"x":     760,
		"y":     320,
		"data": map[string]any{
			"charges": 1,
		},
	}), "stack")
	gatherVillager := patchStack(t, run("card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     820,
		"y":     320,
	}), "stack")
	run("resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": gatherVillager.ID,
	})

	foodStack := patchStack(t, run("card.spawn", map[string]any{
		"defId": "food.apple",
		"x":     760,
		"y":     380,
		"data": map[string]any{
			"amount": 1,
		},
	}), "stack")
	eatVillager := patchStack(t, run("card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     820,
		"y":     380,
	}), "stack")
	run("food.consume", map[string]any{
		"foodStackId":     foodStack.ID,
		"villagerStackId": eatVillager.ID,
	})

	zombieStack := patchStack(t, run("card.spawn", map[string]any{
		"defId": "zombie.default",
		"x":     760,
		"y":     440,
	}), "stack")
	clearVillager := patchStack(t, run("card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     820,
		"y":     440,
	}), "stack")
	run("zombie.clear", map[string]any{
		"zombieStackId":   zombieStack.ID,
		"villagerStackId": clearVillager.ID,
	})

	lootStack := patchStack(t, run("card.spawn", map[string]any{
		"defId": "loot.coin",
		"x":     880,
		"y":     260,
		"data": map[string]any{
			"amount": 2,
		},
	}), "stack")
	run("loot.collect_stack", map[string]any{
		"stackId": lootStack.ID,
	})

	run("world.end_day", map[string]any{})
	state = env.state(t)
	if state.Meta.DayTickCount < 1 {
		t.Fatalf("expected day tick count to increment, got %d", state.Meta.DayTickCount)
	}
	if findStackWithTopDef(state, "deck.first_day") != nil {
		t.Fatal("expected first day deck to retire after world.end_day")
	}
	if state.Meta.Metrics["day_ticks"] < 1 {
		t.Fatalf("expected day_ticks metric to increment, got %d", state.Meta.Metrics["day_ticks"])
	}

	expectedCommands := []string{
		"board.seed_default",
		"card.spawn",
		"deck.spawn_pack",
		"deck.open_pack",
		"stack.move",
		"stack.bringToFront",
		"stack.merge",
		"stack.split",
		"stack.unstack",
		"stack.remove",
		"task.create_blank",
		"task.spawn_existing",
		"task.set_title",
		"task.set_description",
		"task.set_priority",
		"task.set_task_id",
		"task.add_modifier",
		"task.assign_villager",
		"task.complete_stack",
		"task.complete_by_task_id",
		"world.end_day",
		"zombie.clear",
		"resource.gather",
		"food.consume",
		"loot.collect_stack",
	}

	for _, cmd := range expectedCommands {
		if !executed[cmd] {
			t.Fatalf("expected command not exercised in matrix: %s", cmd)
		}
	}
}

func TestTaskCreateBlankDefaultsToBoardProject(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	result := env.command(t, "task.create_blank", map[string]any{
		"x":     420,
		"y":     180,
		"title": "Created from board",
	})

	patch, ok := result.Patch.(map[string]any)
	if !ok {
		t.Fatalf("expected patch map from task.create_blank, got %T", result.Patch)
	}
	taskID, _ := patch["taskId"].(string)
	if strings.TrimSpace(taskID) == "" {
		t.Fatal("expected task.create_blank to create persistent task id")
	}

	created, err := env.taskService.Get(env.ctx, taskID)
	if err != nil {
		t.Fatalf("failed to load created task: %v", err)
	}
	if created.ProjectID == nil || strings.TrimSpace(*created.ProjectID) != "board" {
		t.Fatalf("expected created task project_id=board, got %v", created.ProjectID)
	}
}

func TestTaskSetPriorityPersistsCardAndTask(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:  "Priority sync task",
		Priority: 4,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	spawnResult := env.command(t, "task.spawn_existing", map[string]any{
		"taskId": created.ID,
		"x":      520,
		"y":      220,
	})
	card := patchCard(t, spawnResult, "card")

	env.command(t, "task.set_priority", map[string]any{
		"taskCardId": card.ID,
		"priority":   2,
	})

	state := env.state(t)
	updatedCard := state.Cards[card.ID]
	if updatedCard == nil {
		t.Fatalf("expected updated board card %s", card.ID)
	}
	if got := intFromPatch(updatedCard.Data["priority"]); got != 2 {
		t.Fatalf("expected board card priority 2, got %d", got)
	}

	updatedTask, err := env.taskService.Get(env.ctx, created.ID)
	if err != nil {
		t.Fatalf("load updated task: %v", err)
	}
	if updatedTask.Priority != 2 {
		t.Fatalf("expected task priority 2, got %d", updatedTask.Priority)
	}
}

func TestTaskSyncFromTaskCopiesScheduleInputToBoardCard(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:  "testing",
		Priority: 4,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	spawnResult := env.command(t, "task.spawn_existing", map[string]any{
		"taskId": created.ID,
		"x":      520,
		"y":      220,
	})
	card := patchCard(t, spawnResult, "card")

	rawInput := "testing due Thursday at 8pm every 1 month p1"
	dueText := "2026-03-19T20:00:00-04:00"
	recurrence := "FREQ=MONTHLY;INTERVAL=1"
	priority := 1
	labels := []string{"next_action"}
	content := "testing"
	if _, err := env.taskService.Update(env.ctx, created.ID, task.UpdateInput{
		Content:       &content,
		Priority:      &priority,
		DueText:       &dueText,
		Recurrence:    &recurrence,
		ScheduleInput: &rawInput,
		Labels:        &labels,
	}); err != nil {
		t.Fatalf("update task: %v", err)
	}

	env.command(t, "task.sync_from_task", map[string]any{
		"taskCardId": card.ID,
	})

	updatedTask, err := env.taskService.Get(env.ctx, created.ID)
	if err != nil {
		t.Fatalf("load updated task: %v", err)
	}
	expectedDueText := ""
	if updatedTask.DueText != nil {
		expectedDueText = strings.TrimSpace(*updatedTask.DueText)
	}

	state := env.state(t)
	updatedCard := state.Cards[card.ID]
	if updatedCard == nil {
		t.Fatalf("expected updated board card %s", card.ID)
	}
	if got := dataStringPatch(updatedCard.Data["title"]); got != "testing" {
		t.Fatalf("expected synced board title 'testing', got %q", got)
	}
	if got := intFromPatch(updatedCard.Data["priority"]); got != 1 {
		t.Fatalf("expected synced board priority 1, got %d", got)
	}
	if got := dataStringPatch(updatedCard.Data["scheduleInput"]); got != rawInput {
		t.Fatalf("expected synced scheduleInput %q, got %q", rawInput, got)
	}
	if got := dataStringPatch(updatedCard.Data["dueText"]); got != expectedDueText {
		t.Fatalf("expected synced dueText %q, got %q", expectedDueText, got)
	}
	if !contains(patchStringSlice(t, updatedCard.Data["labels"]), "next_action") {
		t.Fatalf("expected synced labels to include next_action, got %v", updatedCard.Data["labels"])
	}
}

func TestTaskAddModifierNextActionPersistsTaskLabel(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:  "Label sync task",
		Priority: 4,
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	spawnResult := env.command(t, "task.spawn_existing", map[string]any{
		"taskId": created.ID,
		"x":      420,
		"y":      220,
	})
	stack := patchStack(t, spawnResult, "stack")

	env.command(t, "task.add_modifier", map[string]any{
		"taskStackId":   stack.ID,
		"modifierDefId": "next_action",
	})

	updatedTask, err := env.taskService.Get(env.ctx, created.ID)
	if err != nil {
		t.Fatalf("load updated task: %v", err)
	}
	if !contains(updatedTask.Labels, "next_action") {
		t.Fatalf("expected task labels to include next_action, got %v", updatedTask.Labels)
	}
}

func TestTaskSpawnExistingIncludesNextActionModifierFromLabel(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:  "Spawn label modifier",
		Priority: 4,
		Labels:   []string{"next_action"},
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	spawnResult := env.command(t, "task.spawn_existing", map[string]any{
		"taskId": created.ID,
		"x":      460,
		"y":      260,
	})
	stack := patchStack(t, spawnResult, "stack")

	state := env.state(t)
	stackFromState := state.Stacks[stack.ID]
	if stackFromState == nil {
		t.Fatalf("expected spawned stack %s", stack.ID)
	}
	if !stackContainsDefID(state, stackFromState, "mod.next_action") {
		t.Fatalf("expected spawned stack to include mod.next_action, stack=%+v", stackFromState)
	}
}

func TestTaskActivatePreviewReportsMissingRequirements(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	recurrence := "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH"
	deadline := "2026-03-05T19:00:00-05:00"
	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:     "Activate preview task",
		Priority:    3,
		ProjectID:   strPtr("board"),
		Recurrence:  &recurrence,
		DueDeadline: &deadline,
	})
	if err != nil {
		t.Fatalf("create board task: %v", err)
	}

	result := env.command(t, "task.activate", map[string]any{
		"taskId":  created.ID,
		"preview": true,
	})
	patch := patchMap(t, result, "requirements")
	coin := patchAnyMap(t, patch, "coin")
	if intFromPatch(coin["required"]) != 2 {
		t.Fatalf("expected coin requirement=2, got %v", coin["required"])
	}
	if intFromPatch(coin["missing"]) <= 0 {
		t.Fatalf("expected missing coin requirement, got %v", coin["missing"])
	}

	fullPatch := patchMap(t, result, "")
	if boolFromPatch(fullPatch["canActivate"]) {
		t.Fatalf("expected canActivate=false for missing requirements, patch=%v", fullPatch)
	}
}

func TestTaskActivateSeedsEmptyBoardBeforeSpawningTask(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:   "Activate onto empty board",
		Priority:  4,
		ProjectID: strPtr("board"),
	})
	if err != nil {
		t.Fatalf("create board task: %v", err)
	}

	result := env.command(t, "task.activate", map[string]any{
		"taskId":  created.ID,
		"preview": false,
	})

	patch := patchMap(t, result, "")
	if !boolFromPatch(patch["activated"]) {
		t.Fatalf("expected activated=true, patch=%v", patch)
	}

	state := env.state(t)
	if findStackWithTopDef(state, "deck.first_day") == nil {
		t.Fatalf("expected empty board activation to seed deck.first_day, state=%+v", state)
	}
	if findFirstStackWithKind(state, "villager") == nil {
		t.Fatalf("expected empty board activation to seed a villager stack, state=%+v", state)
	}
	if findFirstStackWithKind(state, "resource") == nil {
		t.Fatalf("expected empty board activation to seed a resource stack, state=%+v", state)
	}
	if findFirstStackWithKind(state, "food") == nil {
		t.Fatalf("expected empty board activation to seed a food stack, state=%+v", state)
	}

	stack, ok := patch["stack"].(*Stack)
	if !ok || stack == nil {
		t.Fatalf("expected activated stack in patch, got %T", patch["stack"])
	}
	createdStack := state.Stacks[stack.ID]
	if createdStack == nil {
		t.Fatalf("expected activated stack %s in state", stack.ID)
	}
	if !stackContainsDefID(state, createdStack, "task.instance") {
		t.Fatalf("expected activated stack to include task.instance, stack=%+v", createdStack)
	}
	if len(state.Stacks) < 6 {
		t.Fatalf("expected seeded board plus activated task, stackCount=%d", len(state.Stacks))
	}
}

func TestTaskActivateConsumesResourcesAndMarksTaskLive(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)

	recurrence := "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH"
	deadline := "2026-03-05T19:00:00-05:00"
	created, err := env.taskService.Create(env.ctx, task.CreateInput{
		Content:     "Activate live task",
		Priority:    1,
		ProjectID:   strPtr("board"),
		Recurrence:  &recurrence,
		DueDeadline: &deadline,
		Labels:      []string{"next_action"},
	})
	if err != nil {
		t.Fatalf("create board task: %v", err)
	}

	env.command(t, "card.spawn", map[string]any{
		"defId": "mod.recurring",
		"x":     220,
		"y":     300,
	})
	env.command(t, "card.spawn", map[string]any{
		"defId": "mod.deadline_pin",
		"x":     260,
		"y":     300,
	})
	env.command(t, "card.spawn", map[string]any{
		"defId": "mod.next_action",
		"x":     300,
		"y":     300,
	})
	lootStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "loot.coin",
		"x":     360,
		"y":     300,
		"data": map[string]any{
			"amount": 10,
		},
	}), "stack")
	env.command(t, "loot.collect_stack", map[string]any{
		"stackId": lootStack.ID,
	})

	beforeCoin := env.state(t).Meta.Inventory["coin"]
	result := env.command(t, "task.activate", map[string]any{
		"taskId":  created.ID,
		"preview": false,
		"x":       600,
		"y":       260,
	})

	patch := patchMap(t, result, "")
	if !boolFromPatch(patch["activated"]) {
		t.Fatalf("expected activated=true, patch=%v", patch)
	}
	if !boolFromPatch(patch["canActivate"]) {
		t.Fatalf("expected canActivate=true, patch=%v", patch)
	}
	stack, ok := patch["stack"].(*Stack)
	if !ok || stack == nil {
		t.Fatalf("expected activated stack in patch, got %T", patch["stack"])
	}

	state := env.state(t)
	createdStack := state.Stacks[stack.ID]
	if createdStack == nil {
		t.Fatalf("expected activated stack %s in state", stack.ID)
	}
	if !stackContainsDefID(state, createdStack, "task.instance") {
		t.Fatalf("expected activated stack to include task.instance, stack=%+v", createdStack)
	}
	if !stackContainsDefID(state, createdStack, "mod.recurring") {
		t.Fatalf("expected activated stack to include mod.recurring, stack=%+v", createdStack)
	}
	if !stackContainsDefID(state, createdStack, "mod.deadline_pin") {
		t.Fatalf("expected activated stack to include mod.deadline_pin, stack=%+v", createdStack)
	}
	if !stackContainsDefID(state, createdStack, "mod.next_action") {
		t.Fatalf("expected activated stack to include mod.next_action, stack=%+v", createdStack)
	}

	afterCoin := state.Meta.Inventory["coin"]
	if beforeCoin-afterCoin != 3 {
		t.Fatalf("expected activation coin cost=3, before=%d after=%d", beforeCoin, afterCoin)
	}

	updatedTask, err := env.taskService.Get(env.ctx, created.ID)
	if err != nil {
		t.Fatalf("get activated task: %v", err)
	}
	if !contains(updatedTask.Labels, "board_live") {
		t.Fatalf("expected activated task labels to include board_live, got %v", updatedTask.Labels)
	}

	secondBeforeCoin := env.state(t).Meta.Inventory["coin"]
	second := env.command(t, "task.activate", map[string]any{
		"taskId":  created.ID,
		"preview": false,
	})
	secondPatch := patchMap(t, second, "")
	if !boolFromPatch(secondPatch["alreadyLive"]) {
		t.Fatalf("expected alreadyLive=true on second activate, patch=%v", secondPatch)
	}
	if boolFromPatch(secondPatch["activated"]) {
		t.Fatalf("expected activated=false on second activate, patch=%v", secondPatch)
	}
	secondAfterCoin := env.state(t).Meta.Inventory["coin"]
	if secondAfterCoin != secondBeforeCoin {
		t.Fatalf("expected no additional coin spend on second activate, before=%d after=%d", secondBeforeCoin, secondAfterCoin)
	}
}
