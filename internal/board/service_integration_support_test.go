package board

import (
	"context"
	"donegeon/internal/database"
	"donegeon/internal/quickadd"
	"donegeon/internal/task"
	"github.com/jmoiron/sqlx"
	"path/filepath"
	"strings"
	"testing"
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
