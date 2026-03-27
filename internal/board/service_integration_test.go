package board

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"donegeon/internal/database"
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
	if err := database.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}

	db, err := database.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	queries, err := database.LoadQueries()
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

func TestTaskCompleteStackSpawnsCoinReward(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     520,
		"y":     240,
		"data": map[string]any{
			"title": "Rewarded completion",
		},
	}), "stack")

	before := env.state(t)
	result := env.command(t, "task.complete_stack", map[string]any{
		"stackId": taskStack.ID,
	})
	patch := patchMap(t, result, "")
	reward := patchAnyMap(t, patch, "reward")
	if got := dataStringPatch(reward["type"]); got != "coin" {
		t.Fatalf("expected task completion reward type coin, got=%q patch=%v", got, reward)
	}
	if got := intFromPatch(reward["amount"]); got != 1 {
		t.Fatalf("expected task completion reward amount 1, got=%d patch=%v", got, reward)
	}
	if got := dataStringPatch(reward["mode"]); got != "spawned" {
		t.Fatalf("expected task completion reward mode spawned, got=%q patch=%v", got, reward)
	}

	createdStacks := patchStacks(t, result, "createdStacks")
	foundLoot := false
	after := env.state(t)
	for _, created := range createdStacks {
		if created == nil {
			continue
		}
		createdState := after.Stacks[created.ID]
		if createdState == nil {
			continue
		}
		if stackContainsDefID(after, createdState, "loot.coin") {
			foundLoot = true
			break
		}
	}
	if !foundLoot {
		t.Fatalf("expected task completion to spawn a loot.coin stack, created=%+v", createdStacks)
	}
	if after.Meta.Metrics["tasks_completed"] <= before.Meta.Metrics["tasks_completed"] {
		t.Fatalf(
			"expected tasks_completed metric to increase after completion, before=%d after=%d",
			before.Meta.Metrics["tasks_completed"],
			after.Meta.Metrics["tasks_completed"],
		)
	}
}

func TestTaskCompletionXPRespectsPriorityMapping(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		priority int
		wantXP   int
	}{
		{name: "P1", priority: 1, wantXP: 18},
		{name: "P2", priority: 2, wantXP: 15},
		{name: "P3", priority: 3, wantXP: 13},
		{name: "P4", priority: 4, wantXP: 12},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			env := newBoardIntegrationEnv(t)
			cfg := DefaultGameplayConfig()
			cfg.Villagers.Leveling.Thresholds = map[int]int{
				1: 0,
				2: 999,
			}
			cfg.Villagers.Leveling.TaskCompletionRewards.BonusRolls = 0
			cfg.Villagers.Leveling.TaskCompletionRewards.RNGPool = nil
			env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

			villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
				"defId": "villager.basic",
				"x":     520,
				"y":     240,
			}), "stack")
			taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
				"defId": "task.blank",
				"x":     580,
				"y":     240,
				"data": map[string]any{
					"title":    "Priority XP task",
					"priority": tc.priority,
				},
			}), "stack")

			env.command(t, "task.assign_villager", map[string]any{
				"taskStackId":     taskStack.ID,
				"villagerStackId": villagerStack.ID,
			})
			result := env.command(t, "task.complete_stack", map[string]any{
				"stackId": taskStack.ID,
			})

			progress := patchAnyMap(t, patchMap(t, result, ""), "villagerProgress")
			if got := intFromPatch(progress["xpGained"]); got != tc.wantXP {
				t.Fatalf("expected xpGained=%d for priority %d, got=%d patch=%v", tc.wantXP, tc.priority, got, progress)
			}
		})
	}
}

func TestTaskCompletionCanGrantMultipleMilestonePerksInSingleAward(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Villagers.Leveling.XPSources.CompleteTask.BaseXP = 48
	cfg.Villagers.Leveling.XPSources.CompleteTask.ByPriority = map[string]int{
		"none":   0,
		"low":    0,
		"medium": 0,
		"high":   0,
	}
	cfg.Villagers.Leveling.Thresholds = map[int]int{
		1: 0,
		2: 10,
		3: 20,
		4: 30,
	}
	cfg.Villagers.Leveling.TaskCompletionRewards.BonusRolls = 0
	cfg.Villagers.Leveling.TaskCompletionRewards.RNGPool = nil
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     280,
	}), "stack")
	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     580,
		"y":     280,
		"data": map[string]any{
			"title":    "Milestone sprint",
			"priority": 4,
		},
	}), "stack")

	env.command(t, "task.assign_villager", map[string]any{
		"taskStackId":     taskStack.ID,
		"villagerStackId": villagerStack.ID,
	})
	result := env.command(t, "task.complete_stack", map[string]any{
		"stackId": taskStack.ID,
	})

	progress := patchAnyMap(t, patchMap(t, result, ""), "villagerProgress")
	if got := intFromPatch(progress["level"]); got != 4 {
		t.Fatalf("expected villager to jump to level 4, got=%d patch=%v", got, progress)
	}
	if got := intFromPatch(progress["maxStamina"]); got != 10 {
		t.Fatalf("expected Heartier to raise max stamina to 10, got=%d patch=%v", got, progress)
	}
	perks := patchStringSlice(t, progress["perks"])
	for _, perkID := range []string{"perk_heartier", "perk_bounty_hunter", "perk_focused_worker"} {
		if !contains(perks, perkID) {
			t.Fatalf("expected perk %s in villager progression, got=%v", perkID, perks)
		}
	}
	newPerks := patchStringSlice(t, progress["newPerks"])
	if len(newPerks) != 3 {
		t.Fatalf("expected three newly granted perks, got=%v", newPerks)
	}
}

func TestTaskCompletionCurrencyPerkAddsCoinReward(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Villagers.Leveling.TaskCompletionRewards.BonusRolls = 0
	cfg.Villagers.Leveling.TaskCompletionRewards.RNGPool = nil
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     320,
	}), "stack")
	setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Perks = []string{"perk_bounty_hunter"}
	})
	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     580,
		"y":     320,
		"data": map[string]any{
			"title": "Coin bonus task",
		},
	}), "stack")

	env.command(t, "task.assign_villager", map[string]any{
		"taskStackId":     taskStack.ID,
		"villagerStackId": villagerStack.ID,
	})
	result := env.command(t, "task.complete_stack", map[string]any{
		"stackId": taskStack.ID,
	})

	reward := patchAnyMap(t, patchMap(t, result, ""), "reward")
	if got := intFromPatch(reward["amount"]); got != 2 {
		t.Fatalf("expected guaranteed coin reward plus perk bonus = 2, got=%d patch=%v", got, reward)
	}

	after := env.state(t)
	lootStack := findCreatedStackWithDefID(after, patchStacks(t, result, "createdStacks"), "loot.coin")
	if lootStack == nil {
		t.Fatalf("expected task completion to spawn loot.coin, created=%+v", patchStacks(t, result, "createdStacks"))
	}
	if got := stackCardAmount(after, lootStack, "loot.coin"); got != 2 {
		t.Fatalf("expected loot.coin stack amount=2, got=%d", got)
	}
}

func TestResourceGatherCostsNoStaminaAndBerryBushDropsFood(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Resources.Nodes = []ResourceNodeConfig{
		{
			ID: "berry_bush",
			Charges: ResourceChargesConfig{
				Min: 1,
				Max: 1,
			},
			Gather: ResourceGatherConfig{
				Rewards: RewardTableConfig{
					Guaranteed: []RewardTableEntryConfig{
						{Type: "food", ID: "berries", Amount: 1},
					},
				},
			},
		},
	}
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     360,
	}), "stack")
	villagerID := setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Stamina = 1
	})
	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.berry_bush",
		"x":     580,
		"y":     360,
		"data": map[string]any{
			"charges": 1,
		},
	}), "stack")

	result := env.command(t, "resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": villagerStack.ID,
	})
	patch := patchMap(t, result, "")
	if got := intFromPatch(patch["staminaCost"]); got != 0 {
		t.Fatalf("expected zero gather stamina cost, got=%d patch=%v", got, patch)
	}
	progress := patchAnyMap(t, patch, "villagerProgress")
	if got := intFromPatch(progress["xpGained"]); got != 4 {
		t.Fatalf("expected gather xp=4, got=%d patch=%v", got, progress)
	}

	after := env.state(t)
	rewardStack := findCreatedStackWithDefID(after, patchStacks(t, result, "createdStacks"), "food.berries")
	if rewardStack == nil {
		t.Fatalf("expected berry bush gather to spawn food.berries, created=%+v", patchStacks(t, result, "createdStacks"))
	}
	if stateProgress := after.Meta.Villagers[villagerID]; stateProgress == nil || stateProgress.Stamina != 1 {
		t.Fatalf("expected villager stamina to remain 1 after zero-cost gather, progress=%+v", after.Meta.Villagers[villagerID])
	}
}

func TestSalvagerPerkAddsLootAmountOnResourceGather(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Resources.Nodes = []ResourceNodeConfig{
		{
			ID: "scrap_pile",
			Charges: ResourceChargesConfig{
				Min: 1,
				Max: 1,
			},
			Gather: ResourceGatherConfig{
				Rewards: RewardTableConfig{
					Guaranteed: []RewardTableEntryConfig{
						{Type: "loot", ID: "parts", Amount: 1},
					},
				},
			},
		},
	}
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     400,
	}), "stack")
	setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Perks = []string{"perk_salvager"}
	})
	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.scrap_pile",
		"x":     580,
		"y":     400,
		"data": map[string]any{
			"charges": 1,
		},
	}), "stack")

	result := env.command(t, "resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": villagerStack.ID,
	})

	after := env.state(t)
	rewardStack := findCreatedStackWithDefID(after, patchStacks(t, result, "createdStacks"), "loot.parts")
	if rewardStack == nil {
		t.Fatalf("expected salvage gather to spawn loot.parts, created=%+v", patchStacks(t, result, "createdStacks"))
	}
	if got := stackCardAmount(after, rewardStack, "loot.parts"); got != 2 {
		t.Fatalf("expected salvager perk to raise loot.parts amount to 2, got=%d", got)
	}
}

func TestFoodPerkAddsStaminaRestore(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     440,
	}), "stack")
	setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Stamina = 1
		progress.Perks = []string{"perk_field_snacks"}
	})
	foodStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "food.bread",
		"x":     580,
		"y":     440,
		"data": map[string]any{
			"amount": 1,
		},
	}), "stack")

	result := env.command(t, "food.consume", map[string]any{
		"foodStackId":     foodStack.ID,
		"villagerStackId": villagerStack.ID,
	})

	patch := patchMap(t, result, "")
	if got := intFromPatch(patch["staminaRemaining"]); got != 7 {
		t.Fatalf("expected villager stamina 1 -> 7 after bread + field snacks, got=%d patch=%v", got, patch)
	}
	foodConsumed := patchAnyMap(t, patch, "foodConsumed")
	if got := intFromPatch(foodConsumed["staminaRestore"]); got != 6 {
		t.Fatalf("expected bread restore=6 with field snacks, got=%d patch=%v", got, foodConsumed)
	}
}

func TestZombieSlayerPerkKeepsMinimumClearCostAtOne(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Villagers.Actions.ClearZombie.StaminaCost = 1
	if len(cfg.Zombies.Types) > 0 {
		cfg.Zombies.Types[0].Cleanup.StaminaCost = 1
	}
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     480,
	}), "stack")
	setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Perks = []string{"perk_zombie_slayer"}
	})
	zombieStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "zombie.default",
		"x":     580,
		"y":     480,
	}), "stack")

	result := env.command(t, "zombie.clear", map[string]any{
		"zombieStackId":   zombieStack.ID,
		"villagerStackId": villagerStack.ID,
	})

	patch := patchMap(t, result, "")
	if got := intFromPatch(patch["staminaCost"]); got != 1 {
		t.Fatalf("expected zombie slayer to respect min clear cost 1, got=%d patch=%v", got, patch)
	}
}

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

func findCreatedStackWithDefID(state StateResponse, stacks []*Stack, defID string) *Stack {
	for _, created := range stacks {
		if created == nil {
			continue
		}
		stack := state.Stacks[created.ID]
		if stack == nil {
			continue
		}
		if stackContainsDefID(state, stack, defID) {
			return stack
		}
	}
	return nil
}

func stackCardAmount(state StateResponse, stack *Stack, defID string) int {
	if stack == nil {
		return 0
	}
	for _, cardID := range stack.Cards {
		card := state.Cards[cardID]
		if card == nil || !strings.EqualFold(strings.TrimSpace(card.DefID), strings.TrimSpace(defID)) {
			continue
		}
		if card.Data != nil {
			if amount := intFromPatch(card.Data["amount"]); amount > 0 {
				return amount
			}
		}
		return 1
	}
	return 0
}

func setVillagerProgressForStack(t *testing.T, env *boardIntegrationEnv, stackID string, mutate func(*VillagerProgress)) string {
	t.Helper()

	rawState, err := env.boardSvc.repo.Load(env.ctx, DefaultBoardID)
	if err != nil {
		t.Fatalf("load raw state: %v", err)
	}
	stack := rawState.GetStack(stackID)
	if stack == nil {
		t.Fatalf("expected raw stack %s", stackID)
	}
	villagerID := firstVillagerIDFromStack(rawState, stack)
	if villagerID == "" {
		t.Fatalf("expected villager id for stack %s", stackID)
	}
	progress := ensureVillager(&rawState.Meta, villagerID)
	if mutate != nil {
		mutate(progress)
	}
	if err := env.boardSvc.repo.Save(env.ctx, DefaultBoardID, rawState); err != nil {
		t.Fatalf("save villager progress: %v", err)
	}
	return villagerID
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
