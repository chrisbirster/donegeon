package board

import (
	"context"
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

	env.command(t, "deck.spawn_pack", map[string]any{
		"deckStackId": orgDeck.ID,
		"x":           380,
		"y":           380,
	})
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

	env.command(t, "deck.spawn_pack", map[string]any{
		"deckStackId": orgDeck.ID,
		"x":           460,
		"y":           380,
	})
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
	if got := intFromPatch(deckPatch2["costCharged"]); got <= 0 {
		t.Fatalf("expected non-zero cost after free opens exhausted, got=%d", got)
	}
	afterCoin := env.state(t).Meta.Inventory["coin"]
	if afterCoin >= beforeCoin {
		t.Fatalf("expected coin spend on second open, before=%d after=%d", beforeCoin, afterCoin)
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
	value, ok := patch[key].(map[string]any)
	if !ok {
		t.Fatalf("patch[%q] missing map[string]any", key)
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

func dataStringPatch(value any) string {
	text, _ := value.(string)
	return strings.TrimSpace(text)
}

func strPtr(value string) *string {
	return &value
}
