package board

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"donegeon/internal/datbase"
	"donegeon/internal/quickadd"
	"donegeon/internal/task"
	"github.com/jmoiron/sqlx"
)

type boardIntegrationEnv struct {
	ctx         context.Context
	db          *sqlx.DB
	queries     map[string]string
	taskService *task.Service
	boardSvc    *Service
}

func newBoardIntegrationEnv(t *testing.T) *boardIntegrationEnv {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "board-service-test.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	taskRepo := task.NewRepository(db, queries)
	taskSvc := task.NewService(taskRepo, quickadd.NewParser())
	boardRepo := NewRepository(db, queries)
	boardSvc := NewService(boardRepo, taskSvc)

	return &boardIntegrationEnv{
		ctx:         context.Background(),
		db:          db,
		queries:     queries,
		taskService: taskSvc,
		boardSvc:    boardSvc,
	}
}

func (e *boardIntegrationEnv) restartBoardService() {
	e.boardSvc = NewService(NewRepository(e.db, e.queries), e.taskService)
}

func (e *boardIntegrationEnv) state(t *testing.T) StateResponse {
	t.Helper()
	out, err := e.boardSvc.GetState(e.ctx, DefaultBoardID)
	if err != nil {
		t.Fatalf("get state: %v", err)
	}
	return out
}

func (e *boardIntegrationEnv) command(t *testing.T, cmd string, args map[string]any) CommandResult {
	t.Helper()
	s := e.state(t)
	result, err := e.boardSvc.Command(e.ctx, DefaultBoardID, CommandRequest{
		Cmd:           cmd,
		Args:          args,
		ClientVersion: s.Version,
	})
	if err != nil {
		t.Fatalf("run command %s: %v", cmd, err)
	}
	return result
}

func (e *boardIntegrationEnv) commandExpectError(t *testing.T, cmd string, args map[string]any) error {
	t.Helper()
	s := e.state(t)
	_, err := e.boardSvc.Command(e.ctx, DefaultBoardID, CommandRequest{
		Cmd:           cmd,
		Args:          args,
		ClientVersion: s.Version,
	})
	if err == nil {
		t.Fatalf("expected command %s to fail", cmd)
	}
	return err
}

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

	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     540,
		"y":     220,
		"data": map[string]any{
			"title": "Face card task",
		},
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

func findActiveQuestByID(active []*QuestRuntime, id string) *QuestRuntime {
	for _, item := range active {
		if item == nil {
			continue
		}
		if strings.EqualFold(item.ID, id) {
			return item
		}
	}
	return nil
}

func findHistoryQuestByID(history []QuestHistoryEntry, id string) *QuestHistoryEntry {
	for index := range history {
		if strings.EqualFold(history[index].ID, id) {
			return &history[index]
		}
	}
	return nil
}

func hasQuestUnlock(unlocks []QuestUnlockState, kind, id string) bool {
	for _, unlock := range unlocks {
		if strings.EqualFold(unlock.Kind, kind) && strings.EqualFold(unlock.ID, id) {
			return true
		}
	}
	return false
}

func questIDs(active []*QuestRuntime) []string {
	ids := make([]string, 0, len(active))
	for _, item := range active {
		if item == nil {
			continue
		}
		ids = append(ids, item.ID)
	}
	return ids
}

func findStackWithTopDef(state StateResponse, defID string) *Stack {
	for _, stack := range state.Stacks {
		if stack == nil || len(stack.Cards) == 0 {
			continue
		}
		top := state.Cards[stack.Cards[len(stack.Cards)-1]]
		if top != nil && top.DefID == defID {
			return stack
		}
	}
	return nil
}

func findFirstStackWithKind(state StateResponse, kind string) *Stack {
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.Cards[cardID]
			if card == nil {
				continue
			}
			if cardKind(card.DefID) == kind {
				return stack
			}
		}
	}
	return nil
}

func patchStack(t *testing.T, result CommandResult, key string) *Stack {
	t.Helper()
	patch, ok := result.Patch.(map[string]any)
	if !ok {
		t.Fatalf("patch is not a map for key %s", key)
	}
	stack, ok := patch[key].(*Stack)
	if !ok || stack == nil {
		t.Fatalf("patch[%q] missing *Stack", key)
	}
	return stack
}

func patchCard(t *testing.T, result CommandResult, key string) *Card {
	t.Helper()
	patch, ok := result.Patch.(map[string]any)
	if !ok {
		t.Fatalf("patch is not a map for key %s", key)
	}
	card, ok := patch[key].(*Card)
	if !ok || card == nil {
		t.Fatalf("patch[%q] missing *Card", key)
	}
	return card
}

func patchStacks(t *testing.T, result CommandResult, key string) []*Stack {
	t.Helper()
	patch, ok := result.Patch.(map[string]any)
	if !ok {
		t.Fatalf("patch is not a map for key %s", key)
	}
	stacks, ok := patch[key].([]*Stack)
	if !ok {
		t.Fatalf("patch[%q] missing []*Stack", key)
	}
	return stacks
}

func patchMap(t *testing.T, result CommandResult, key string) map[string]any {
	t.Helper()
	patch, ok := result.Patch.(map[string]any)
	if !ok {
		t.Fatalf("patch is not a map for key %s", key)
	}
	if key == "" {
		return patch
	}
	value, ok := patch[key].(map[string]any)
	if !ok {
		t.Fatalf("patch[%q] missing map[string]any", key)
	}
	return value
}

func patchAnyMap(t *testing.T, source map[string]any, key string) map[string]any {
	t.Helper()
	value, ok := source[key].(map[string]any)
	if !ok {
		t.Fatalf("expected %q to be map[string]any, got %T", key, source[key])
	}
	return value
}

func intFromPatch(value any) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func boolFromPatch(value any) bool {
	typed, ok := value.(bool)
	return ok && typed
}

func patchStringSlice(t *testing.T, value any) []string {
	t.Helper()
	switch v := value.(type) {
	case []string:
		return v
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		t.Fatalf("expected string slice, got %T", value)
		return nil
	}
}

func contains(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

func stackHasKindFromResponse(state StateResponse, stack *Stack, kind string) bool {
	for _, cardID := range stack.Cards {
		card := state.Cards[cardID]
		if card == nil {
			continue
		}
		if cardKind(card.DefID) == kind {
			return true
		}
	}
	return false
}

func stackContainsDefID(state StateResponse, stack *Stack, defID string) bool {
	for _, cardID := range stack.Cards {
		card := state.Cards[cardID]
		if card == nil {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(card.DefID), strings.TrimSpace(defID)) {
			return true
		}
	}
	return false
}

func dataStringPatch(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func strPtr(value string) *string {
	return &value
}
