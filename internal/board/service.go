package board

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/task"
)

const DefaultBoardID = "default"

var boardIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

const (
	defaultVillagerStamina = 8
	xpPerLevel             = 10
	boardGridSpacing       = 22
	boardGridOriginOffset  = 1
)

var defaultLootTypes = []string{"coin", "paper", "ink", "gear", "parts"}

const (
	boardLiveLabelValue = "board_live"
)

type TaskService interface {
	Create(context.Context, task.CreateInput) (task.Task, error)
	Get(context.Context, string) (task.Task, error)
	List(context.Context, task.ListParams) (task.ListResult, error)
	Update(context.Context, string, task.UpdateInput) (task.Task, error)
	Close(context.Context, string) error
	Reopen(context.Context, string) error
}

type Service struct {
	repo      *Repository
	tasks     TaskService
	cfg       GameplayConfig
	quests    QuestCatalog
	validator *Validator
	mu        sync.Mutex
}

type ServiceOption func(*Service)

func WithGameplayConfig(cfg GameplayConfig) ServiceOption {
	return func(s *Service) {
		s.cfg = cfg
	}
}

func WithQuestCatalog(catalog QuestCatalog) ServiceOption {
	return func(s *Service) {
		s.quests = catalog
	}
}

type StateResponse struct {
	Stacks  map[string]*Stack `json:"stacks"`
	Cards   map[string]*Card  `json:"cards"`
	Meta    BoardMeta         `json:"meta,omitempty"`
	Version string            `json:"version"`
}

type CommandRequest struct {
	Cmd           string         `json:"cmd"`
	Args          map[string]any `json:"args"`
	ClientVersion string         `json:"clientVersion,omitempty"`
}

type CommandResult struct {
	OK         bool   `json:"ok"`
	NewVersion string `json:"newVersion"`
	Patch      any    `json:"patch,omitempty"`
}

type resolvedReward struct {
	Kind   string
	ID     string
	Amount int
}

type VersionConflictError struct {
	ServerVersion string
}

func (e *VersionConflictError) Error() string {
	return "board version conflict"
}

func NewService(repo *Repository, tasks TaskService, opts ...ServiceOption) *Service {
	svc := &Service{
		repo:   repo,
		tasks:  tasks,
		cfg:    DefaultGameplayConfig(),
		quests: DefaultQuestCatalog(),
	}
	for _, opt := range opts {
		if opt != nil {
			opt(svc)
		}
	}
	svc.cfg.Normalize()
	svc.quests.Normalize()
	svc.validator = NewValidator(ValidationRulesFromGameplay(svc.cfg))
	return svc
}

func (s *Service) GetState(ctx context.Context, boardID string) (StateResponse, error) {
	boardID, err := NormalizeBoardID(boardID)
	if err != nil {
		return StateResponse{}, err
	}

	state, err := s.repo.Load(ctx, boardID)
	if err != nil {
		return StateResponse{}, err
	}
	if err := s.refreshQuestState(ctx, state); err != nil {
		return StateResponse{}, err
	}

	return StateResponse{
		Stacks:  state.Stacks,
		Cards:   state.Cards,
		Meta:    s.responseMeta(state.Meta),
		Version: state.Version(),
	}, nil
}

func (s *Service) Command(ctx context.Context, boardID string, req CommandRequest) (CommandResult, error) {
	boardID, err := NormalizeBoardID(boardID)
	if err != nil {
		return CommandResult{}, err
	}

	cmd := strings.TrimSpace(req.Cmd)
	if cmd == "" {
		return CommandResult{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "cmd is required"), "cmd")
	}
	if req.Args == nil {
		req.Args = map[string]any{}
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.repo.Load(ctx, boardID)
	if err != nil {
		return CommandResult{}, err
	}

	serverVersion := state.Version()
	if strings.TrimSpace(req.ClientVersion) != "" && strings.TrimSpace(req.ClientVersion) != serverVersion {
		return CommandResult{}, &VersionConflictError{ServerVersion: serverVersion}
	}
	if err := s.refreshQuestState(ctx, state); err != nil {
		return CommandResult{}, err
	}

	patch, err := s.executeCommand(ctx, state, boardID, cmd, req.Args)
	if err != nil {
		var appErr *apperrors.AppError
		if errors.As(err, &appErr) {
			return CommandResult{}, err
		}
		return CommandResult{}, apperrors.New(apperrors.CodeValidationError, err.Error())
	}
	if err := s.refreshQuestState(ctx, state); err != nil {
		return CommandResult{}, err
	}

	if err := s.repo.Save(ctx, boardID, state); err != nil {
		return CommandResult{}, err
	}

	return CommandResult{
		OK:         true,
		NewVersion: state.Version(),
		Patch:      patch,
	}, nil
}

func NormalizeBoardID(raw string) (string, error) {
	boardID := strings.TrimSpace(raw)
	if boardID == "" {
		return DefaultBoardID, nil
	}
	if !boardIDPattern.MatchString(boardID) {
		return "", apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invalid board id"), "board")
	}
	return boardID, nil
}

func (s *Service) executeCommand(ctx context.Context, state *State, boardID string, cmd string, args map[string]any) (any, error) {
	switch cmd {
	case "board.seed_default":
		return s.cmdBoardSeedDefault(state, args)
	case "card.spawn":
		return cmdCardSpawn(state, args)
	case "deck.spawn_pack":
		return s.cmdDeckSpawnPack(ctx, state, args)
	case "deck.open_pack":
		return s.cmdDeckOpenPack(ctx, state, args)
	case "stack.move":
		return cmdStackMove(state, args)
	case "stack.bringToFront":
		return cmdStackBringToFront(state, args)
	case "stack.merge":
		return s.cmdStackMerge(ctx, state, args)
	case "stack.split":
		return cmdStackSplit(state, args)
	case "stack.unstack":
		return cmdStackUnstack(state, args)
	case "stack.remove":
		return cmdStackRemove(state, args)
	case "task.create_blank":
		return s.cmdTaskCreateBlank(ctx, state, boardID, args)
	case "task.spawn_existing":
		return s.cmdTaskSpawnExisting(ctx, state, boardID, args)
	case "task.activate":
		return s.cmdTaskActivate(ctx, state, boardID, args)
	case "task.set_title":
		return s.cmdTaskSetTitle(ctx, state, args)
	case "task.set_description":
		return s.cmdTaskSetDescription(ctx, state, args)
	case "task.set_priority":
		return s.cmdTaskSetPriority(ctx, state, args)
	case "task.set_task_id":
		return s.cmdTaskSetTaskID(ctx, state, args)
	case "task.sync_from_task":
		return s.cmdTaskSyncFromTask(ctx, state, args)
	case "task.add_modifier":
		return s.cmdTaskAddModifier(ctx, state, args)
	case "task.assign_villager":
		return s.cmdTaskAssignVillager(state, args)
	case "task.complete_stack":
		return s.cmdTaskCompleteStack(ctx, state, args)
	case "task.complete_by_task_id":
		return s.cmdTaskCompleteByTaskID(ctx, state, args)
	case "quest.claim_reward":
		return s.cmdQuestClaimReward(ctx, state, args)
	case "world.end_day":
		return s.cmdWorldEndDay(ctx, state, args)
	case "zombie.clear":
		return s.cmdZombieClear(state, args)
	case "resource.gather":
		return s.cmdResourceGather(state, args)
	case "food.consume":
		return s.cmdFoodConsume(state, args)
	case "loot.collect_stack":
		return s.cmdLootCollectStack(ctx, state, args)
	default:
		return nil, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "unknown command: "+cmd), "cmd")
	}
}

func cmdStackMove(state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
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

	if err := state.MoveStack(stackID, snapBoardPoint(Point{X: x, Y: y})); err != nil {
		return nil, err
	}

	return map[string]any{
		"stack": state.GetStack(stackID),
	}, nil
}

func cmdStackBringToFront(state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}

	if err := state.BringToFront(stackID); err != nil {
		return nil, err
	}

	return map[string]any{
		"stack": state.GetStack(stackID),
	}, nil
}

func (s *Service) cmdStackMerge(ctx context.Context, state *State, args map[string]any) (any, error) {
	targetID, err := getString(args, "targetId")
	if err != nil {
		return nil, err
	}
	sourceID, err := getString(args, "sourceId")
	if err != nil {
		return nil, err
	}

	target := state.GetStack(targetID)
	if target == nil {
		return nil, fmt.Errorf("target stack not found: %s", targetID)
	}
	source := state.GetStack(sourceID)
	if source == nil {
		return nil, fmt.Errorf("source stack not found: %s", sourceID)
	}

	// Dragging any collectible stack onto deck.collect consumes it into inventory.
	if isCollectDeckStack(state, target) && !stackHasKind(state, source, "deck") {
		return s.cmdLootCollectStack(ctx, state, map[string]any{"stackId": sourceID})
	}
	if isCollectDeckStack(state, source) && !stackHasKind(state, target, "deck") {
		return s.cmdLootCollectStack(ctx, state, map[string]any{"stackId": targetID})
	}

	// Deck stacks are not mergeable in normal stack flow.
	if stackHasKind(state, target, "deck") || stackHasKind(state, source, "deck") {
		return nil, ErrInvalidStackPair
	}

	targetHasTask := stackHasKind(state, target, "task")
	targetHasVillager := stackHasKind(state, target, "villager")
	targetHasZombie := stackHasKind(state, target, "zombie")
	targetHasFood := stackHasKind(state, target, "food")
	sourceHasTask := stackHasKind(state, source, "task")
	sourceHasVillager := stackHasKind(state, source, "villager")
	sourceHasZombie := stackHasKind(state, source, "zombie")
	sourceHasFood := stackHasKind(state, source, "food")

	// Treat task+villager merges as explicit task assignment so assignment metadata/quests stay consistent.
	if targetHasTask && sourceHasVillager && !sourceHasTask {
		return s.cmdTaskAssignVillager(state, map[string]any{
			"taskStackId":     targetID,
			"villagerStackId": sourceID,
			"targetStackId":   targetID,
		})
	}
	if sourceHasTask && targetHasVillager && !targetHasTask {
		return s.cmdTaskAssignVillager(state, map[string]any{
			"taskStackId":     sourceID,
			"villagerStackId": targetID,
			"targetStackId":   targetID,
		})
	}

	// Treat villager+zombie merges as explicit zombie clear commands.
	if targetHasZombie && sourceHasVillager && !sourceHasZombie {
		return s.cmdZombieClear(state, map[string]any{
			"zombieStackId":   targetID,
			"villagerStackId": sourceID,
			"targetStackId":   targetID,
		})
	}
	if sourceHasZombie && targetHasVillager && !targetHasZombie {
		return s.cmdZombieClear(state, map[string]any{
			"zombieStackId":   sourceID,
			"villagerStackId": targetID,
			"targetStackId":   targetID,
		})
	}

	// Treat food+villager merges as eating so exhausted villagers recover
	// immediately instead of ending up in a no-op mixed stack.
	if targetHasFood && !targetHasVillager && sourceHasVillager && !sourceHasFood {
		return s.cmdFoodConsume(state, map[string]any{
			"foodStackId":     targetID,
			"villagerStackId": sourceID,
			"targetStackId":   targetID,
		})
	}
	if sourceHasFood && !sourceHasVillager && targetHasVillager && !targetHasFood {
		return s.cmdFoodConsume(state, map[string]any{
			"foodStackId":     sourceID,
			"villagerStackId": targetID,
			"targetStackId":   targetID,
		})
	}

	if s.validator != nil {
		if err := s.validator.ValidateStackMerge(state, targetID, sourceID); err != nil {
			return nil, err
		}
	}
	if err := state.MergeStacks(targetID, sourceID); err != nil {
		return nil, err
	}
	ensurePriorityFaceCard(state, target)
	ensureVillagerLeadsResourceStack(state, target)

	return map[string]any{
		"target":        target,
		"removedSource": sourceID,
	}, nil
}

func cmdStackSplit(state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}
	index, err := getInt(args, "index")
	if err != nil {
		return nil, err
	}
	offsetX := getIntOr(args, "offsetX", 12)
	offsetY := getIntOr(args, "offsetY", 12)
	newX, err := getIntPtr(args, "newX")
	if err != nil {
		return nil, err
	}
	newY, err := getIntPtr(args, "newY")
	if err != nil {
		return nil, err
	}

	source := state.GetStack(stackID)
	if source == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}

	newStack, err := state.SplitStack(stackID, index, Point{X: offsetX, Y: offsetY})
	if err != nil {
		return nil, err
	}
	ensurePriorityFaceCard(state, source)
	ensurePriorityFaceCard(state, newStack)
	if newX != nil && newY != nil {
		newStack.Pos = snapBoardPoint(Point{X: *newX, Y: *newY})
	}

	return map[string]any{
		"source":   source,
		"newStack": newStack,
	}, nil
}

func cmdStackUnstack(state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}

	positions, err := getPositions(args, "positions")
	if err != nil {
		return nil, err
	}

	created, err := state.Unstack(stackID, positions)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"removedStack":  stackID,
		"createdStacks": created,
	}, nil
}
