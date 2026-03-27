package board

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/rrule"
	"donegeon/internal/task"
	"donegeon/internal/tenant"
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

func cmdStackRemove(state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}

	removedCards, err := state.RemoveStackAndCards(stackID)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"removedStack": stackID,
		"removedCards": removedCards,
	}, nil
}

func snapBoardCoordinate(value int) int {
	return int(math.Round(float64(value-boardGridOriginOffset)/float64(boardGridSpacing)))*boardGridSpacing + boardGridOriginOffset
}

func snapBoardPoint(pos Point) Point {
	return Point{
		X: snapBoardCoordinate(pos.X),
		Y: snapBoardCoordinate(pos.Y),
	}
}

func (s *Service) cmdTaskCreateBlank(ctx context.Context, state *State, boardID string, args map[string]any) (any, error) {
	x, err := getInt(args, "x")
	if err != nil {
		return nil, err
	}
	y, err := getInt(args, "y")
	if err != nil {
		return nil, err
	}
	title := strings.TrimSpace(getStringOr(args, "title"))
	description := strings.TrimSpace(getStringOr(args, "description"))
	project := strings.TrimSpace(getStringOr(args, "project"))
	if project == "" {
		project = boardProjectIDForBoard(boardID)
	}

	taskID := ""
	createdTaskCount := 0
	if s.tasks != nil {
		content := title
		if content == "" {
			content = "Untitled task"
		}
		projectID := project
		labels := []string{}
		if matchesBoardProject(projectID, boardID) {
			labels = append(labels, boardLiveLabelValue)
		}
		created, err := s.tasks.Create(ctx, task.CreateInput{
			Content:     content,
			Description: description,
			ProjectID:   &projectID,
			Priority:    4,
			Labels:      labels,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create task: %w", err)
		}
		taskID = created.ID
		createdTaskCount = 1
	}
	if createdTaskCount > 0 {
		meta := ensureMeta(state)
		incrementQuestMetric(meta, "create_task", "", createdTaskCount)
	}

	cardData := map[string]any{
		"title":       title,
		"description": description,
		"project":     project,
	}
	if taskID != "" {
		cardData["taskId"] = taskID
	}

	card := state.CreateCard("task.blank", cardData)
	stack := state.CreateStack(Point{X: x, Y: y}, []string{card.ID})

	return map[string]any{
		"stack":  stack,
		"card":   card,
		"taskId": taskID,
	}, nil
}

func (s *Service) cmdTaskSetTitle(ctx context.Context, state *State, args map[string]any) (any, error) {
	cardID, err := getString(args, "taskCardId")
	if err != nil {
		return nil, err
	}
	title, err := getString(args, "title")
	if err != nil {
		return nil, err
	}

	card := state.GetCard(cardID)
	if card == nil {
		return nil, fmt.Errorf("card not found: %s", cardID)
	}
	if !isTaskCard(card) {
		return nil, fmt.Errorf("card is not a task: %s", cardID)
	}

	if card.Data == nil {
		card.Data = map[string]any{}
	}
	card.DefID = "task.instance"
	card.Data["title"] = title
	if shouldCountQuestCreateFromTitle(card, title) {
		incrementQuestMetric(ensureMeta(state), "create_task", "", 1)
		markQuestCreateCounted(card)
	}

	if s.tasks != nil {
		if taskID := cardTaskID(card); taskID != "" {
			content := strings.TrimSpace(title)
			if content == "" {
				content = "Untitled task"
			}
			_, err := s.tasks.Update(ctx, taskID, task.UpdateInput{Content: &content})
			if err != nil {
				return nil, err
			}
		}
	}

	return map[string]any{
		"card": card,
	}, nil
}

func (s *Service) cmdTaskSetDescription(ctx context.Context, state *State, args map[string]any) (any, error) {
	cardID, err := getString(args, "taskCardId")
	if err != nil {
		return nil, err
	}
	description, err := getString(args, "description")
	if err != nil {
		return nil, err
	}

	card := state.GetCard(cardID)
	if card == nil {
		return nil, fmt.Errorf("card not found: %s", cardID)
	}
	if !isTaskCard(card) {
		return nil, fmt.Errorf("card is not a task: %s", cardID)
	}

	if card.Data == nil {
		card.Data = map[string]any{}
	}
	card.DefID = "task.instance"
	card.Data["description"] = description

	if s.tasks != nil {
		if taskID := cardTaskID(card); taskID != "" {
			_, err := s.tasks.Update(ctx, taskID, task.UpdateInput{Description: &description})
			if err != nil {
				return nil, err
			}
		}
	}

	return map[string]any{
		"card": card,
	}, nil
}

func (s *Service) cmdTaskSetPriority(ctx context.Context, state *State, args map[string]any) (any, error) {
	cardID, err := getString(args, "taskCardId")
	if err != nil {
		return nil, err
	}
	priority, err := getInt(args, "priority")
	if err != nil {
		return nil, err
	}
	if priority < 1 || priority > 4 {
		return nil, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "priority must be 1..4"), "priority")
	}

	card := state.GetCard(cardID)
	if card == nil {
		return nil, fmt.Errorf("card not found: %s", cardID)
	}
	if !isTaskCard(card) {
		return nil, fmt.Errorf("card is not a task: %s", cardID)
	}

	if card.Data == nil {
		card.Data = map[string]any{}
	}
	card.DefID = "task.instance"
	card.Data["priority"] = priority

	if s.tasks != nil {
		if taskID := cardTaskID(card); taskID != "" {
			_, err := s.tasks.Update(ctx, taskID, task.UpdateInput{Priority: &priority})
			if err != nil {
				return nil, err
			}
		}
	}

	return map[string]any{
		"card": card,
	}, nil
}

func (s *Service) cmdTaskSetTaskID(ctx context.Context, state *State, args map[string]any) (any, error) {
	cardID, err := getString(args, "taskCardId")
	if err != nil {
		return nil, err
	}
	taskID, err := getString(args, "taskId")
	if err != nil {
		return nil, err
	}

	card := state.GetCard(cardID)
	if card == nil {
		return nil, fmt.Errorf("card not found: %s", cardID)
	}
	if !isTaskCard(card) {
		return nil, fmt.Errorf("card is not a task: %s", cardID)
	}

	if card.Data == nil {
		card.Data = map[string]any{}
	}
	card.DefID = "task.instance"
	nextTaskID := strings.TrimSpace(taskID)
	previousTaskID := strings.TrimSpace(cardTaskID(card))
	alreadyCounted := cardQuestCreateCounted(card)
	card.Data["taskId"] = nextTaskID

	if stack := findStackByCardID(state, card.ID); stack != nil && stackHasCardDefID(state, stack, "mod.next_action") {
		if err := s.ensureTaskHasNextActionLabel(ctx, nextTaskID); err != nil {
			return nil, err
		}
	}
	if previousTaskID == "" && nextTaskID != "" && !alreadyCounted {
		incrementQuestMetric(ensureMeta(state), "create_task", "", 1)
	}
	if nextTaskID != "" {
		markQuestCreateCounted(card)
	}

	return map[string]any{
		"card":   card,
		"taskId": nextTaskID,
	}, nil
}

func (s *Service) cmdTaskSyncFromTask(ctx context.Context, state *State, args map[string]any) (any, error) {
	if s.tasks == nil {
		return nil, fmt.Errorf("task service unavailable")
	}

	cardID, err := getString(args, "taskCardId")
	if err != nil {
		return nil, err
	}

	card := state.GetCard(cardID)
	if card == nil {
		return nil, fmt.Errorf("card not found: %s", cardID)
	}
	if !isTaskCard(card) {
		return nil, fmt.Errorf("card is not a task: %s", cardID)
	}

	taskID := cardTaskID(card)
	if taskID == "" {
		return nil, fmt.Errorf("task card is not linked to a task: %s", cardID)
	}

	row, err := s.tasks.Get(ctx, taskID)
	if err != nil {
		return nil, err
	}

	card.DefID = "task.instance"
	syncTaskCardDataFromTaskRow(card, row)

	return map[string]any{
		"card": card,
	}, nil
}

func (s *Service) cmdTaskCompleteStack(ctx context.Context, state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}

	stack := state.GetStack(stackID)
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	if len(stack.Cards) == 0 {
		return nil, fmt.Errorf("stack has no cards: %s", stackID)
	}

	meta := ensureMeta(state)
	villagerID := firstVillagerIDFromStack(state, stack)
	hasVillager := villagerID != ""

	taskIDs := make([]string, 0, 1)
	seenTaskIDs := map[string]struct{}{}
	removedCards := make([]string, 0, len(stack.Cards))
	survivorCards := make([]string, 0, len(stack.Cards))
	completedTaskCards := make([]*Card, 0, len(stack.Cards))
	completedTaskCardCount := 0
	basePos := stack.Pos
	offset := 18

	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if isTaskCard(card) {
			completedTaskCardCount++
			completedTaskCards = append(completedTaskCards, card)
			removedCards = append(removedCards, cardID)
			if taskID := cardTaskID(card); taskID != "" {
				if _, exists := seenTaskIDs[taskID]; !exists {
					seenTaskIDs[taskID] = struct{}{}
					taskIDs = append(taskIDs, taskID)
				}
			}
			delete(state.Cards, cardID)
			continue
		}
		if modifierSingleUseOnTaskComplete(card.DefID) {
			removedCards = append(removedCards, cardID)
			delete(state.Cards, cardID)
			continue
		}
		survivorCards = append(survivorCards, cardID)
	}

	if len(removedCards) == 0 {
		return nil, fmt.Errorf("stack has no task card: %s", stackID)
	}

	delete(state.Stacks, stackID)

	createdStacks := make([]*Stack, 0, len(survivorCards))
	for i, cardID := range survivorCards {
		pos := Point{
			X: basePos.X + i*offset,
			Y: basePos.Y + i*offset,
		}
		createdStacks = append(createdStacks, state.CreateStack(pos, []string{cardID}))
	}

	completedTaskIDs := make([]string, 0, len(taskIDs))
	if s.tasks != nil {
		for _, taskID := range taskIDs {
			if err := s.tasks.Close(ctx, taskID); err != nil {
				return nil, err
			}
			completedTaskIDs = append(completedTaskIDs, taskID)
		}
	}

	completedCount := len(completedTaskIDs)
	if completedCount < completedTaskCardCount {
		completedCount = completedTaskCardCount
	}
	meta.Metrics["tasks_completed"] += completedCount
	incrementQuestMetric(meta, "complete_task", "", completedCount)

	var progressBefore *VillagerProgress
	if hasVillager {
		progressBefore = ensureVillager(meta, villagerID)
	}

	var rewardPatch map[string]any
	if rewards := s.taskCompletionRewards(progressBefore, completedTaskCards, stack.ID, basePos); len(rewards) > 0 {
		rewardStacks := s.spawnResolvedRewards(state, rewards, Point{
			X: basePos.X + len(createdStacks)*offset + 28,
			Y: basePos.Y + len(createdStacks)*offset + 12,
		})
		createdStacks = append(createdStacks, rewardStacks...)
		rewardPatch = rewardPatchFromResolvedRewards(rewards, rewardStacks, "spawned")
	}

	xpGained := 0
	villagerProgressPatch := map[string]any{
		"id":       villagerID,
		"xp":       0,
		"level":    1,
		"perks":    []string{},
		"xpGained": 0,
		"newPerks": []string{},
	}
	if hasVillager {
		xpGained = s.taskCompletionXP(progressBefore, completedTaskCards)
		progress, newPerks := s.awardVillagerXP(meta, villagerID, xpGained)
		villagerProgressPatch["xp"] = progress.XP
		villagerProgressPatch["level"] = progress.Level
		villagerProgressPatch["perks"] = append([]string{}, progress.Perks...)
		villagerProgressPatch["maxStamina"] = s.villagerMaxStamina(progress)
		nextLevel, nextLevelXP, xpToNext := s.nextLevelProgress(progress)
		villagerProgressPatch["nextLevel"] = nextLevel
		villagerProgressPatch["nextLevelXP"] = nextLevelXP
		villagerProgressPatch["xpToNextLevel"] = xpToNext
		villagerProgressPatch["xpGained"] = xpGained
		villagerProgressPatch["newPerks"] = newPerks
	}

	return map[string]any{
		"removedStack":      stackID,
		"removedCards":      removedCards,
		"createdStacks":     createdStacks,
		"completedTaskIds":  completedTaskIDs,
		"reward":            rewardPatch,
		"completionByStack": hasVillager,
		"villagerProgress":  villagerProgressPatch,
	}, nil
}

func (s *Service) cmdTaskCompleteByTaskID(ctx context.Context, state *State, args map[string]any) (any, error) {
	taskID, err := getString(args, "taskId")
	if err != nil {
		return nil, err
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, fmt.Errorf("taskId is required")
	}

	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil || !isTaskCard(card) {
				continue
			}
			if cardTaskID(card) == taskID {
				return s.cmdTaskCompleteStack(ctx, state, map[string]any{
					"stackId": stack.ID,
				})
			}
		}
	}

	if s.tasks != nil {
		if err := s.tasks.Close(ctx, taskID); err != nil {
			return nil, err
		}
	}
	meta := ensureMeta(state)
	meta.Metrics["tasks_completed"]++
	incrementQuestMetric(meta, "complete_task", "", 1)

	var rewardPatch map[string]any
	if rewards := s.taskCompletionInventoryRewards(1); len(rewards) > 0 {
		for _, reward := range rewards {
			if reward.Kind != "loot" {
				continue
			}
			meta.Inventory[reward.ID] += reward.Amount
		}
		rewardPatch = rewardPatchFromResolvedRewards(rewards, nil, "inventory")
	}

	return map[string]any{
		"completedTaskId": taskID,
		"mode":            "repo_only",
		"reward":          rewardPatch,
	}, nil
}

func (s *Service) cmdBoardSeedDefault(state *State, args map[string]any) (any, error) {
	if len(state.Stacks) > 0 {
		return map[string]any{
			"seeded": false,
			"reason": "already_initialized",
		}, nil
	}

	deckY := getIntOr(args, "deckRowY", 500)
	deckStartX := 60
	deckSpacing := 110
	decks := []string{"deck.first_day"}
	if s.cfg.DeckByID("deck.collect") != nil {
		decks = append(decks, "deck.collect")
	} else {
		progression := s.cfg.ProgressionDeckDefIDs()
		if len(progression) > 0 {
			decks = append(decks, progression[0])
		}
	}

	created := make([]*Stack, 0, len(decks)+5)
	for i, deckID := range decks {
		x := deckStartX + i*deckSpacing
		created = append(created, createSingleCardStack(state, deckID, Point{X: x, Y: deckY}, nil))
	}

	created = append(created, createSingleCardStack(state, "villager.basic", Point{X: 300, Y: 200}, map[string]any{"name": "Flicker"}))
	created = append(created, createSingleCardStack(state, "villager.basic", Point{X: 420, Y: 200}, map[string]any{"name": "Pip"}))

	resourceDefID := "resource.tree"
	resourceData := map[string]any{"charges": 3}
	if len(s.cfg.Resources.Nodes) > 0 {
		node := s.cfg.Resources.Nodes[0]
		if id := strings.TrimSpace(node.ID); id != "" {
			resourceDefID = "resource." + id
		}
		resourceData["charges"] = randomResourceCharges(node.Charges.Min, node.Charges.Max, nil)
		if node.Gather.BaseTimeS > 0 {
			resourceData["gatherTimeS"] = node.Gather.BaseTimeS
		}
	}

	foodDefID := "food.apple"
	foodData := map[string]any{"amount": 2}
	if len(s.cfg.Food.Items) > 0 {
		item := s.cfg.Food.Items[0]
		if id := strings.TrimSpace(item.ID); id != "" {
			foodDefID = "food." + id
		}
	}

	created = append(created, createSingleCardStack(state, resourceDefID, Point{X: 260, Y: 340}, resourceData))
	created = append(created, createSingleCardStack(state, foodDefID, Point{X: 440, Y: 340}, foodData))

	return map[string]any{
		"seeded":  true,
		"created": created,
	}, nil
}

func cmdCardSpawn(state *State, args map[string]any) (any, error) {
	defID, err := getString(args, "defId")
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
	data, err := getObjectOrNil(args, "data")
	if err != nil {
		return nil, err
	}

	stack := createSingleCardStack(state, defID, Point{X: x, Y: y}, data)
	return map[string]any{
		"stack": stack,
		"card":  topCard(state, stack),
	}, nil
}

func (s *Service) cmdDeckSpawnPack(ctx context.Context, state *State, args map[string]any) (any, error) {
	deckStackID, err := getString(args, "deckStackId")
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

	packDefID := strings.TrimSpace(getStringOr(args, "packDefId"))

	deckStack := state.GetStack(deckStackID)
	if deckStack == nil {
		return nil, fmt.Errorf("stack not found: %s", deckStackID)
	}
	deckCard := topCard(state, deckStack)
	if deckCard == nil || cardKind(deckCard.DefID) != "deck" {
		return nil, fmt.Errorf("stack is not a deck: %s", deckStackID)
	}
	deckCfg, ok := s.deckConfigByID(deckCard.DefID)
	if !ok {
		return nil, fmt.Errorf("deck not found in config: %s", deckCard.DefID)
	}
	if deckCfg.ID == "deck.collect" {
		return nil, fmt.Errorf("deck.collect cannot spawn packs")
	}
	if unlocked, reason := s.isDeckUnlocked(ctx, state, deckCfg); !unlocked {
		return nil, fmt.Errorf("deck is locked: %s", reason)
	}

	meta := ensureMeta(state)
	deckOpenCount := meta.DeckOpen[deckCfg.ID]
	freeOpenUsed := deckOpenCount < deckCfg.FreeOpens
	zombieCount := countZombieStacks(state)
	overrunLevel := meta.Metrics["overrun_level"]
	baseCost := s.deckOpenCost(deckCfg, zombieCount, overrunLevel)
	costCurrency := strings.TrimSpace(s.cfg.Decks.Economy.BaseCostCurrency)
	if costCurrency == "" {
		costCurrency = "coin"
	}
	costCharged := 0
	if !freeOpenUsed {
		costCharged = baseCost
		if meta.Inventory[costCurrency] < costCharged {
			return nil, fmt.Errorf("not enough %s for deck spawn (need %d)", costCurrency, costCharged)
		}
		meta.Inventory[costCurrency] -= costCharged
	}

	if packDefID == "" {
		packDefID = packDefIDForDeck(deckCfg.ID)
	}

	stack := createSingleCardStack(state, packDefID, Point{X: x, Y: y}, map[string]any{
		"deckId":               deckCfg.ID,
		"deckOpenCountAtSpawn": deckOpenCount,
		"costCharged":          costCharged,
		"baseCost":             baseCost,
		"costCurrency":         costCurrency,
		"freeOpenUsed":         freeOpenUsed,
	})
	meta.DeckOpen[deckCfg.ID] = deckOpenCount + 1

	return map[string]any{
		"stack": stack,
		"card":  topCard(state, stack),
		"deck": map[string]any{
			"id":            deckCfg.ID,
			"costCharged":   costCharged,
			"baseCost":      baseCost,
			"costCurrency":  costCurrency,
			"freeOpenUsed":  freeOpenUsed,
			"deckOpenCount": meta.DeckOpen[deckCfg.ID],
		},
		"inventory": copyIntMap(meta.Inventory),
	}, nil
}

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

func (s *Service) cmdTaskAddModifier(ctx context.Context, state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "taskStackId")
	if err != nil {
		return nil, err
	}
	modifierDefID, err := getString(args, "modifierDefId")
	if err != nil {
		return nil, err
	}
	modifierDefID = normalizeModifierDefID(modifierDefID)
	if !strings.HasPrefix(modifierDefID, "mod.") {
		return nil, fmt.Errorf("modifierDefId must be a modifier def id")
	}

	stack := state.GetStack(stackID)
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	if !stackHasKind(state, stack, "task") {
		return nil, fmt.Errorf("stack does not include a task: %s", stackID)
	}
	if s.validator != nil {
		if err := s.validator.ValidateModifierAdd(state, stackID, modifierDefID); err != nil {
			return nil, err
		}
	}
	modCard := state.CreateCard(modifierDefID, nil)
	stack.Cards = append(stack.Cards, modCard.ID)
	ensurePriorityFaceCard(state, stack)

	if strings.EqualFold(modifierDefID, "mod.next_action") {
		taskCard := firstCardByKind(state, stack, "task")
		if taskCard != nil {
			if err := s.ensureTaskHasNextActionLabel(ctx, cardTaskID(taskCard)); err != nil {
				return nil, err
			}
		}
	}
	incrementQuestMetric(ensureMeta(state), "attach_modifier", modifierDefID, 1)

	return map[string]any{
		"stack":    stack,
		"modifier": modCard,
	}, nil
}

func (s *Service) cmdTaskAssignVillager(state *State, args map[string]any) (any, error) {
	taskStackID, err := getString(args, "taskStackId")
	if err != nil {
		return nil, err
	}
	villagerStackID, err := getString(args, "villagerStackId")
	if err != nil {
		return nil, err
	}
	targetStackID := strings.TrimSpace(getStringOr(args, "targetStackId"))
	if targetStackID != "" && targetStackID != taskStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match task or villager stack")
	}

	taskStack := state.GetStack(taskStackID)
	if taskStack == nil {
		return nil, fmt.Errorf("task stack not found: %s", taskStackID)
	}
	if !stackHasKind(state, taskStack, "task") {
		return nil, fmt.Errorf("stack is not a task stack: %s", taskStackID)
	}

	villagerStack := state.GetStack(villagerStackID)
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}

	if targetStackID == villagerStackID {
		taskStack.Pos = villagerStack.Pos
	}
	assignedVillagerID := firstVillagerIDFromStack(state, villagerStack)
	if strings.TrimSpace(assignedVillagerID) == "" {
		assignedVillagerID = strings.TrimSpace(villagerStackID)
	}
	if err := state.MergeStacks(taskStackID, villagerStackID); err != nil {
		return nil, err
	}
	ensurePriorityFaceCard(state, taskStack)

	_ = ensureVillager(ensureMeta(state), assignedVillagerID)
	for _, cardID := range taskStack.Cards {
		card := state.GetCard(cardID)
		if card == nil || cardKind(card.DefID) != "task" {
			continue
		}
		if card.Data == nil {
			card.Data = map[string]any{}
		}
		card.Data["assignedVillagerId"] = assignedVillagerID
	}
	incrementQuestMetric(ensureMeta(state), "assign_villager", "", 1)

	return map[string]any{
		"stack":              taskStack,
		"removedVillager":    villagerStackID,
		"assignedVillagerId": assignedVillagerID,
	}, nil
}

func (s *Service) cmdWorldEndDay(ctx context.Context, state *State, _ map[string]any) (any, error) {
	meta := ensureMeta(state)
	now := time.Now().In(time.Local)
	tick := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, 1)
	tickDate := tick.Format("2006-01-02")
	recurrenceSpawnEnabled := s.cfg.World.DayTick.RecurrenceRules.SpawnIfDue
	graceHours := s.taskDueGraceHours()

	workedTodayCleared := 0
	recurrenceRespawnedTaskIDs := []string{}
	overdueTaskIDs := []string{}

	if s.tasks != nil {
		allTasks, err := listAllTasks(ctx, s.tasks)
		if err != nil {
			return nil, fmt.Errorf("failed to list tasks: %w", err)
		}

		for _, item := range allTasks {
			if item.IsDeleted {
				continue
			}
			if recurrenceSpawnEnabled && item.Checked && item.Recurrence != nil && strings.TrimSpace(*item.Recurrence) != "" {
				nextDue := nextRecurrenceDueDate(*item.Recurrence, item, tick)
				if nextDue != "" {
					_, err := s.tasks.Update(ctx, item.ID, task.UpdateInput{
						DueDeadline: &nextDue,
					})
					if err != nil {
						return nil, fmt.Errorf("failed to update recurring task %s: %w", item.ID, err)
					}
				}
				if err := s.tasks.Reopen(ctx, item.ID); err != nil {
					return nil, fmt.Errorf("failed to reopen recurring task %s: %w", item.ID, err)
				}
				recurrenceRespawnedTaskIDs = append(recurrenceRespawnedTaskIDs, item.ID)
			}
		}

		updatedTasks, err := listAllTasks(ctx, s.tasks)
		if err != nil {
			return nil, fmt.Errorf("failed to list pending tasks: %w", err)
		}
		for _, item := range updatedTasks {
			if item.IsDeleted || item.Checked {
				continue
			}
			if isTaskOverdueAtTick(item, tick, graceHours) {
				overdueTaskIDs = append(overdueTaskIDs, item.ID)
			}
		}
	}

	sort.Strings(recurrenceRespawnedTaskIDs)
	sort.Strings(overdueTaskIDs)

	meta.DayTickCount++
	meta.Metrics["day_ticks"] = meta.DayTickCount

	dayTickCount := meta.DayTickCount
	deckRowY := inferDeckRowY(state, 500)
	retiredFirstDayStacks := []string{}
	spawnedProgressionDecks := []string{}
	if dayTickCount >= 1 {
		retiredFirstDayStacks = retireFirstDayDeckStacks(state)
		spawnedProgressionDecks = s.ensurePostFirstDayDeckStacks(state, deckRowY)
	}

	spawnedZombieStacks := s.spawnOverdueZombies(state, overdueTaskIDs, dayTickCount, tick)
	if len(spawnedZombieStacks) > 0 {
		meta.Metrics["zombies_seen"] += len(spawnedZombieStacks)
	}

	staminaResetVillagers := 0
	if s.cfg.World.DayTick.StaminaReset.Enabled {
		mode := strings.ToLower(strings.TrimSpace(s.cfg.World.DayTick.StaminaReset.Mode))
		for _, stack := range state.Stacks {
			if stack == nil {
				continue
			}
			villagerID := firstVillagerIDFromStack(state, stack)
			if villagerID == "" {
				continue
			}
			progress := ensureVillager(meta, villagerID)
			maxStamina := s.villagerMaxStamina(progress)
			switch mode {
			case "add", "incremental":
				restoreVillagerStamina(progress, 1, maxStamina)
				if progress.Stamina > maxStamina {
					progress.Stamina = maxStamina
				}
			default:
				progress.Stamina = maxStamina
			}
			staminaResetVillagers++
		}
	}

	meta.Metrics["overrun_level"] = countZombieStacks(state)

	return map[string]any{
		"tickDate":                   tickDate,
		"workedTodayCleared":         workedTodayCleared,
		"recurrenceRespawnedTaskIds": recurrenceRespawnedTaskIDs,
		"overdueTaskCount":           len(overdueTaskIDs),
		"overdueTaskIds":             overdueTaskIDs,
		"spawnedZombieCount":         len(spawnedZombieStacks),
		"spawnedZombieStacks":        spawnedZombieStacks,
		"staminaResetVillagers":      staminaResetVillagers,
		"dayTickCount":               dayTickCount,
		"retiredFirstDayDeck":        len(retiredFirstDayStacks) > 0,
		"retiredFirstDayStacks":      retiredFirstDayStacks,
		"spawnedProgressionDecks":    spawnedProgressionDecks,
	}, nil
}

func (s *Service) cmdZombieClear(state *State, args map[string]any) (any, error) {
	zombieStackID, err := getString(args, "zombieStackId")
	if err != nil {
		return nil, err
	}
	villagerStackID, err := getString(args, "villagerStackId")
	if err != nil {
		return nil, err
	}
	targetStackID := strings.TrimSpace(getStringOr(args, "targetStackId"))
	if targetStackID != "" && targetStackID != zombieStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match zombie or villager stack")
	}

	zombieStack := state.GetStack(zombieStackID)
	if zombieStack == nil {
		return nil, fmt.Errorf("zombie stack not found: %s", zombieStackID)
	}
	if !stackHasKind(state, zombieStack, "zombie") {
		return nil, fmt.Errorf("stack is not a zombie stack: %s", zombieStackID)
	}

	villagerStack := state.GetStack(villagerStackID)
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}

	meta := ensureMeta(state)
	actualVillagerID := firstVillagerIDFromStack(state, villagerStack)
	if actualVillagerID == "" {
		actualVillagerID = villagerStackID
	}
	progress := ensureVillager(meta, actualVillagerID)
	staminaCost := s.zombieClearStaminaCost(progress)
	ok, staminaRemaining := spendVillagerStamina(progress, staminaCost)
	if !ok {
		return nil, fmt.Errorf("villager stamina too low (need %d)", staminaCost)
	}

	origin := zombieStack.Pos
	removedZombieCards := make([]string, 0)
	kept := make([]string, 0, len(zombieStack.Cards))
	for _, cardID := range zombieStack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if cardKind(card.DefID) == "zombie" {
			delete(state.Cards, cardID)
			removedZombieCards = append(removedZombieCards, cardID)
			continue
		}
		kept = append(kept, cardID)
	}

	if len(kept) == 0 {
		delete(state.Stacks, zombieStackID)
	} else {
		zombieStack.Cards = kept
		ensurePriorityFaceCard(state, zombieStack)
	}

	if targetStackID == zombieStackID && zombieStackID != villagerStackID {
		villagerStack.Pos = origin
	}

	rewardType, rewardAmount := s.zombieClearReward(zombieStackID, actualVillagerID, meta.Metrics["zombies_cleared"])
	if rewardType != "" && rewardAmount > 0 {
		meta.Inventory[rewardType] += rewardAmount
	}
	meta.Metrics["zombies_cleared"]++
	meta.Metrics["overrun_level"] = countZombieStacks(state)
	incrementQuestMetric(meta, "clear_zombie", "", 1)

	xpGained := s.zombieClearXP()
	updatedVillager, newPerks := s.awardVillagerXP(meta, actualVillagerID, xpGained)
	inventory := copyIntMap(meta.Inventory)

	return map[string]any{
		"removedZombieStack": zombieStackID,
		"removedZombieCards": removedZombieCards,
		"villagerStackId":    villagerStackID,
		"staminaCost":        staminaCost,
		"staminaRemaining":   staminaRemaining,
		"reward": map[string]any{
			"type":   rewardType,
			"amount": rewardAmount,
		},
		"inventory": inventory,
		"villagerProgress": map[string]any{
			"id":         actualVillagerID,
			"xp":         updatedVillager.XP,
			"level":      updatedVillager.Level,
			"perks":      append([]string{}, updatedVillager.Perks...),
			"maxStamina": s.villagerMaxStamina(updatedVillager),
			"nextLevel": func() int {
				level, _, _ := s.nextLevelProgress(updatedVillager)
				return level
			}(),
			"nextLevelXP": func() int {
				_, xp, _ := s.nextLevelProgress(updatedVillager)
				return xp
			}(),
			"xpToNextLevel": func() int {
				_, _, xpToNext := s.nextLevelProgress(updatedVillager)
				return xpToNext
			}(),
			"xpGained": xpGained,
			"newPerks": newPerks,
		},
	}, nil
}

func (s *Service) cmdResourceGather(state *State, args map[string]any) (any, error) {
	resourceStackID, err := getString(args, "resourceStackId")
	if err != nil {
		return nil, err
	}
	villagerStackID, err := getString(args, "villagerStackId")
	if err != nil {
		return nil, err
	}
	targetStackID := strings.TrimSpace(getStringOr(args, "targetStackId"))
	if targetStackID != "" && targetStackID != resourceStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match resource or villager stack")
	}

	resourceStack := state.GetStack(resourceStackID)
	if resourceStack == nil {
		return nil, fmt.Errorf("resource stack not found: %s", resourceStackID)
	}
	if !stackHasKind(state, resourceStack, "resource") {
		return nil, fmt.Errorf("stack is not a resource stack: %s", resourceStackID)
	}

	villagerStack := state.GetStack(villagerStackID)
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}
	if resourceMergeWouldCreateMultipleVillagers(state, resourceStack, villagerStack) {
		return nil, ErrInvalidStackPair
	}

	meta := ensureMeta(state)
	actualVillagerID := firstVillagerIDFromStack(state, villagerStack)
	if actualVillagerID == "" {
		actualVillagerID = villagerStackID
	}
	progress := ensureVillager(meta, actualVillagerID)
	staminaCost := s.cfg.Villagers.Actions.GatherStart.StaminaCost
	if staminaCost < 0 {
		staminaCost = 0
	}
	ok, staminaRemaining := spendVillagerStamina(progress, staminaCost)
	if !ok {
		return nil, fmt.Errorf("villager stamina too low (need %d)", staminaCost)
	}

	if targetStackID == villagerStackID {
		resourceStack.Pos = villagerStack.Pos
	}
	if resourceStackID != villagerStackID {
		if err := state.MergeStacks(resourceStackID, villagerStackID); err != nil {
			return nil, err
		}
		ensurePriorityFaceCard(state, resourceStack)
	}
	ensureVillagerLeadsResourceStack(state, resourceStack)

	resourceCard := firstCardByKind(state, resourceStack, "resource")
	if resourceCard == nil {
		return nil, fmt.Errorf("resource card not found in stack: %s", resourceStackID)
	}
	if resourceCard.Data == nil {
		resourceCard.Data = map[string]any{}
	}
	resourceCard.Data["assignedVillagerId"] = actualVillagerID

	charges := intFromAny(resourceCard.Data["charges"])
	if charges <= 0 {
		resourceID := strings.TrimSpace(strings.TrimPrefix(resourceCard.DefID, "resource."))
		if node := s.cfg.ResourceNodeByID(resourceID); node != nil {
			charges = node.Charges.Max
			if charges <= 0 {
				charges = node.Charges.Min
			}
		}
		if charges <= 0 {
			charges = 3
		}
	}
	charges--
	if charges <= 0 {
		removeCardFromStack(state, resourceStack.ID, resourceCard.ID)
	} else {
		resourceCard.Data["charges"] = charges
	}

	rewardStacks := s.spawnResolvedRewards(state, s.resourceGatherRewards(progress, resourceCard, actualVillagerID, resourceStackID, charges), Point{
		X: resourceStack.Pos.X + 98,
		Y: resourceStack.Pos.Y + 28,
	})

	xpGained := s.gatherResourceXP()
	updatedVillager, newPerks := s.awardVillagerXP(meta, actualVillagerID, xpGained)

	return map[string]any{
		"resourceStackId":          resourceStackID,
		"villagerStackId":          actualVillagerID,
		"staminaCost":              staminaCost,
		"staminaRemaining":         staminaRemaining,
		"resourceChargesRemaining": maxInt(charges, 0),
		"resourceDepleted":         charges <= 0,
		"stackHasMoreResources":    stackHasKind(state, resourceStack, "resource"),
		"createdStacks":            rewardStacks,
		"villagerProgress": map[string]any{
			"id":         actualVillagerID,
			"xp":         updatedVillager.XP,
			"level":      updatedVillager.Level,
			"perks":      append([]string{}, updatedVillager.Perks...),
			"maxStamina": s.villagerMaxStamina(updatedVillager),
			"nextLevel": func() int {
				level, _, _ := s.nextLevelProgress(updatedVillager)
				return level
			}(),
			"nextLevelXP": func() int {
				_, xp, _ := s.nextLevelProgress(updatedVillager)
				return xp
			}(),
			"xpToNextLevel": func() int {
				_, _, xpToNext := s.nextLevelProgress(updatedVillager)
				return xpToNext
			}(),
			"xpGained": xpGained,
			"newPerks": newPerks,
		},
	}, nil
}

func (s *Service) cmdFoodConsume(state *State, args map[string]any) (any, error) {
	foodStackID, err := getString(args, "foodStackId")
	if err != nil {
		return nil, err
	}
	villagerStackID, err := getString(args, "villagerStackId")
	if err != nil {
		return nil, err
	}
	targetStackID := strings.TrimSpace(getStringOr(args, "targetStackId"))
	if targetStackID != "" && targetStackID != foodStackID && targetStackID != villagerStackID {
		return nil, fmt.Errorf("targetStackId must match food or villager stack")
	}

	foodStack := state.GetStack(foodStackID)
	if foodStack == nil {
		return nil, fmt.Errorf("food stack not found: %s", foodStackID)
	}
	if !stackHasKind(state, foodStack, "food") {
		return nil, fmt.Errorf("stack is not a food stack: %s", foodStackID)
	}

	villagerStack := state.GetStack(villagerStackID)
	if villagerStack == nil {
		return nil, fmt.Errorf("villager stack not found: %s", villagerStackID)
	}
	if !stackHasKind(state, villagerStack, "villager") {
		return nil, fmt.Errorf("stack is not a villager stack: %s", villagerStackID)
	}

	meta := ensureMeta(state)
	actualVillagerID := firstVillagerIDFromStack(state, villagerStack)
	if actualVillagerID == "" {
		actualVillagerID = villagerStackID
	}
	progress := ensureVillager(meta, actualVillagerID)

	staminaCost := s.cfg.Villagers.Actions.EatFood.StaminaCost
	if staminaCost < 0 {
		staminaCost = 0
	}
	staminaBefore := progress.Stamina
	staminaAfterCost := staminaBefore
	if staminaCost > 0 {
		ok, remaining := spendVillagerStamina(progress, staminaCost)
		if !ok {
			return nil, fmt.Errorf("villager stamina too low (need %d)", staminaCost)
		}
		staminaAfterCost = remaining
	}

	foodCard := firstCardByKind(state, foodStack, "food")
	if foodCard == nil {
		return nil, fmt.Errorf("food card not found in stack: %s", foodStackID)
	}
	if foodCard.Data == nil {
		foodCard.Data = map[string]any{}
	}
	amount := intFromAny(foodCard.Data["amount"])
	if amount <= 0 {
		amount = 1
	}
	amount--
	if amount <= 0 {
		removeCardFromStack(state, foodStack.ID, foodCard.ID)
	} else {
		foodCard.Data["amount"] = amount
	}

	restore := s.staminaRestoreForFood(foodCard.DefID, progress)
	staminaRemaining := restoreVillagerStamina(progress, restore, s.villagerMaxStamina(progress))

	if targetStackID == foodStackID && villagerStackID != foodStackID {
		villagerStack.Pos = foodStack.Pos
	}

	return map[string]any{
		"foodStackId":      foodStackID,
		"villagerStackId":  actualVillagerID,
		"foodRemaining":    maxInt(amount, 0),
		"staminaCost":      staminaCost,
		"staminaBefore":    staminaBefore,
		"staminaAfterCost": staminaAfterCost,
		"staminaRemaining": staminaRemaining,
		"foodConsumed": map[string]any{
			"id":             strings.TrimSpace(strings.TrimPrefix(foodCard.DefID, "food.")),
			"amount":         1,
			"staminaRestore": restore,
		},
	}, nil
}

func (s *Service) cmdLootCollectStack(ctx context.Context, state *State, args map[string]any) (any, error) {
	stackID, err := getString(args, "stackId")
	if err != nil {
		return nil, err
	}
	stack := state.GetStack(stackID)
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	if len(stack.Cards) == 0 {
		return nil, fmt.Errorf("stack has no cards: %s", stackID)
	}

	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		switch {
		case strings.HasPrefix(card.DefID, "loot."):
		case strings.HasPrefix(card.DefID, "resource."):
		case strings.HasPrefix(card.DefID, "mod."):
		case strings.HasPrefix(card.DefID, "task."):
		case strings.HasPrefix(card.DefID, "food."):
		default:
			return nil, fmt.Errorf("stack contains non-collectible card: %s", card.DefID)
		}
	}

	lootTotals := map[string]int{}
	collected := 0
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		lootType := ""
		amount := 1

		switch {
		case strings.HasPrefix(card.DefID, "loot."):
			lootType = strings.TrimSpace(strings.TrimPrefix(card.DefID, "loot."))
			if card.Data != nil {
				amount = maxInt(intFromAny(card.Data["amount"]), 1)
			}
		case strings.HasPrefix(card.DefID, "resource."):
			lootType = "parts"
		case strings.HasPrefix(card.DefID, "mod."):
			lootType = "parts"
		case strings.HasPrefix(card.DefID, "task."):
			lootType = "coin"
			if s.tasks != nil {
				if taskID := cardTaskID(card); taskID != "" {
					_ = s.tasks.Close(ctx, taskID)
				}
			}
		case strings.HasPrefix(card.DefID, "food."):
			lootType = "paper"
		}

		if lootType != "" {
			lootTotals[lootType] += amount
			collected++
		}
	}
	if collected == 0 {
		return nil, fmt.Errorf("no collectible cards in stack: %s", stackID)
	}

	for _, cardID := range stack.Cards {
		delete(state.Cards, cardID)
	}
	delete(state.Stacks, stackID)

	lootCollected := make([]map[string]any, 0, len(lootTotals))
	meta := ensureMeta(state)
	for _, lootType := range defaultLootTypes {
		if _, ok := meta.Inventory[lootType]; !ok {
			meta.Inventory[lootType] = 0
		}
	}
	for lootType, amount := range lootTotals {
		meta.Inventory[lootType] += amount
		lootCollected = append(lootCollected, map[string]any{
			"type":   lootType,
			"amount": amount,
		})
	}
	primaryLoot := map[string]any{}
	if len(lootCollected) > 0 {
		primaryLoot = lootCollected[0]
	}

	return map[string]any{
		"removedStack":   stackID,
		"loot":           primaryLoot,
		"lootCollected":  lootCollected,
		"cardsCollected": collected,
		"inventory":      copyIntMap(meta.Inventory),
	}, nil
}

func isTaskCard(card *Card) bool {
	if card == nil {
		return false
	}
	return strings.HasPrefix(card.DefID, "task.")
}

func cardTaskID(card *Card) string {
	if card == nil || card.Data == nil {
		return ""
	}
	switch v := card.Data["taskId"].(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		return ""
	}
}

func createSingleCardStack(state *State, defID string, pos Point, data map[string]any) *Stack {
	payload := map[string]any{}
	for key, value := range data {
		payload[key] = value
	}
	card := state.CreateCard(strings.TrimSpace(defID), payload)
	stack := state.CreateStack(pos, []string{card.ID})
	if cardKind(card.DefID) == "villager" {
		_ = villagerIDFromCard(card, stack.ID)
	}
	return stack
}

func (s *Service) finalizeSpawnedStack(state *State, spawned *Stack) *Stack {
	if state == nil || spawned == nil {
		return spawned
	}

	for _, candidate := range stacksAtExactPosition(state, spawned.ID, spawned.Pos) {
		if s.validator != nil {
			if err := s.validator.ValidateStackMerge(state, candidate.ID, spawned.ID); err != nil {
				continue
			}
		}
		if err := state.MergeStacks(candidate.ID, spawned.ID); err != nil {
			continue
		}
		ensurePriorityFaceCard(state, candidate)
		ensureVillagerLeadsResourceStack(state, candidate)
		return candidate
	}

	if len(stacksAtExactPosition(state, spawned.ID, spawned.Pos)) == 0 {
		return spawned
	}

	for step := 1; step <= 12; step++ {
		candidate := Point{
			X: spawned.Pos.X + step*18,
			Y: spawned.Pos.Y + ((step % 2) * 12),
		}
		if len(stacksAtExactPosition(state, spawned.ID, candidate)) > 0 {
			continue
		}
		spawned.Pos = candidate
		break
	}

	return spawned
}

func stacksAtExactPosition(state *State, excludedID string, pos Point) []*Stack {
	if state == nil {
		return nil
	}

	stacks := make([]*Stack, 0)
	for _, stack := range state.Stacks {
		if stack == nil || stack.ID == excludedID {
			continue
		}
		if stack.Pos != pos {
			continue
		}
		stacks = append(stacks, stack)
	}

	sort.Slice(stacks, func(i, j int) bool {
		return stacks[i].Z > stacks[j].Z
	})

	return stacks
}

func topCard(state *State, stack *Stack) *Card {
	if state == nil || stack == nil || len(stack.Cards) == 0 {
		return nil
	}
	return state.GetCard(stack.Cards[len(stack.Cards)-1])
}

func isCollectDeckStack(state *State, stack *Stack) bool {
	card := topCard(state, stack)
	if card == nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(card.DefID), "deck.collect")
}

func cardKind(defID string) string {
	defID = strings.TrimSpace(defID)
	if defID == "" {
		return ""
	}
	if idx := strings.Index(defID, "."); idx > 0 {
		return defID[:idx]
	}
	return defID
}

func stackHasKind(state *State, stack *Stack, kind string) bool {
	if state == nil || stack == nil {
		return false
	}
	kind = strings.TrimSpace(kind)
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if cardKind(card.DefID) == kind {
			return true
		}
	}
	return false
}

func stackHasCardDefID(state *State, stack *Stack, defID string) bool {
	if state == nil || stack == nil {
		return false
	}
	normalized := strings.TrimSpace(strings.ToLower(defID))
	if normalized == "" {
		return false
	}
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if strings.TrimSpace(strings.ToLower(card.DefID)) == normalized {
			return true
		}
	}
	return false
}

func findStackByCardID(state *State, cardID string) *Stack {
	if state == nil {
		return nil
	}
	cardID = strings.TrimSpace(cardID)
	if cardID == "" {
		return nil
	}
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, current := range stack.Cards {
			if current == cardID {
				return stack
			}
		}
	}
	return nil
}

func firstCardByKind(state *State, stack *Stack, kind string) *Card {
	if state == nil || stack == nil {
		return nil
	}
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if cardKind(card.DefID) == kind {
			return card
		}
	}
	return nil
}

func ensurePriorityFaceCard(state *State, stack *Stack) {
	if state == nil || stack == nil || len(stack.Cards) <= 1 {
		return
	}

	priorityKinds := []string{"task", "resource", "food"}
	targetIndex := -1
	for _, kind := range priorityKinds {
		for i := len(stack.Cards) - 1; i >= 0; i-- {
			card := state.GetCard(stack.Cards[i])
			if card == nil {
				continue
			}
			if cardKind(card.DefID) == kind {
				targetIndex = i
				break
			}
		}
		if targetIndex >= 0 {
			break
		}
	}

	if targetIndex < 0 || targetIndex == len(stack.Cards)-1 {
		return
	}

	faceCardID := stack.Cards[targetIndex]
	stack.Cards = append(stack.Cards[:targetIndex], stack.Cards[targetIndex+1:]...)
	stack.Cards = append(stack.Cards, faceCardID)
}

func ensureVillagerLeadsResourceStack(state *State, stack *Stack) {
	if state == nil || stack == nil || len(stack.Cards) <= 1 {
		return
	}

	faceResourceIndex := -1
	hasVillager := false
	hasResource := false
	for i, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		switch cardKind(card.DefID) {
		case "villager":
			hasVillager = true
		case "resource":
			hasResource = true
			faceResourceIndex = i
		}
	}

	if !hasVillager || !hasResource || faceResourceIndex < 0 {
		return
	}

	ordered := make([]string, 0, len(stack.Cards))
	middle := make([]string, 0, len(stack.Cards))

	for i, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if i == faceResourceIndex {
			continue
		}
		if cardKind(card.DefID) == "villager" {
			ordered = append(ordered, cardID)
			continue
		}
		middle = append(middle, cardID)
	}

	if len(ordered) == 0 {
		return
	}

	ordered = append(ordered, middle...)
	ordered = append(ordered, stack.Cards[faceResourceIndex])
	if len(ordered) != len(stack.Cards) {
		return
	}
	stack.Cards = ordered
}

func removeCardFromStack(state *State, stackID string, cardID string) {
	stack := state.GetStack(stackID)
	if stack == nil {
		return
	}
	next := make([]string, 0, len(stack.Cards))
	for _, current := range stack.Cards {
		if current == cardID {
			continue
		}
		next = append(next, current)
	}
	stack.Cards = next
	delete(state.Cards, cardID)
	if len(stack.Cards) == 0 {
		delete(state.Stacks, stackID)
	}
}

type deckUnlock struct {
	Type  string
	Value int
}

type weightedDeckDraw struct {
	CardType   string
	DefID      string
	VillagerID string
	ModifierID string
	LootID     string
	ResourceID string
	FoodID     string
	Amount     int
	Weight     int
	Data       map[string]any
}

type deckConfig struct {
	ID        string
	BaseCost  int
	FreeOpens int
	DrawCount int
	Unlock    deckUnlock
	DrawPool  []weightedDeckDraw
}

func (s *Service) deckConfigByID(deckID string) (deckConfig, bool) {
	entry := s.cfg.DeckByID(deckID)
	if entry == nil {
		return deckConfig{}, false
	}
	cfg := deckConfig{
		ID:        strings.TrimSpace(entry.ID),
		BaseCost:  entry.BaseCost,
		FreeOpens: entry.FreeOpens,
		DrawCount: entry.Draws.Count,
		Unlock: deckUnlock{
			Type:  strings.ToLower(strings.TrimSpace(asString(entry.UnlockCondition["type"]))),
			Value: intFromAny(entry.UnlockCondition["value"]),
		},
		DrawPool: make([]weightedDeckDraw, 0, len(entry.Draws.RNGPool)),
	}
	if cfg.Unlock.Type == "" {
		cfg.Unlock.Type = strings.ToLower(strings.TrimSpace(entry.Status))
	}
	if cfg.DrawCount <= 0 {
		cfg.DrawCount = 3
	}
	for _, draw := range entry.Draws.RNGPool {
		cfg.DrawPool = append(cfg.DrawPool, weightedDeckDraw{
			CardType:   strings.ToLower(strings.TrimSpace(draw.CardType)),
			VillagerID: strings.TrimSpace(draw.VillagerID),
			ModifierID: strings.TrimSpace(draw.ModifierID),
			LootID:     strings.TrimSpace(draw.LootID),
			ResourceID: strings.TrimSpace(draw.ResourceID),
			FoodID:     strings.TrimSpace(draw.FoodID),
			Amount:     draw.Amount,
			Weight:     draw.Weight,
			Data:       map[string]any{},
		})
	}
	if len(cfg.DrawPool) == 0 {
		cfg.DrawPool = []weightedDeckDraw{{CardType: "blank", Weight: 1}}
	}
	return cfg, true
}

func (s *Service) mapDeckDrawToCard(entry weightedDeckDraw, rng *rand.Rand) (string, map[string]any, error) {
	data := map[string]any{}
	for key, value := range entry.Data {
		data[key] = value
	}

	switch strings.ToLower(strings.TrimSpace(entry.CardType)) {
	case "", "blank", "task":
		defID := "task.blank"
		if strings.TrimSpace(entry.DefID) != "" {
			defID = strings.TrimSpace(entry.DefID)
		}
		data["title"] = asStringOr(data["title"], "")
		data["description"] = asStringOr(data["description"], "")
		if strings.TrimSpace(asString(data["project"])) == "" {
			data["project"] = "inbox"
		}
		return defID, data, nil
	case "villager":
		defID := "villager.basic"
		if strings.TrimSpace(entry.DefID) != "" {
			defID = strings.TrimSpace(entry.DefID)
		}
		if entry.VillagerID != "" {
			data["villagerId"] = entry.VillagerID
		}
		return defID, data, nil
	case "modifier":
		defID := normalizeModifierDefID(entry.ModifierID)
		if defID == "" {
			defID = normalizeModifierDefID(entry.DefID)
		}
		if defID == "" {
			return "", nil, fmt.Errorf("modifier entry missing modifier id")
		}
		return defID, data, nil
	case "loot":
		lootID := strings.TrimSpace(entry.LootID)
		if lootID == "" {
			if strings.TrimSpace(entry.DefID) != "" && strings.HasPrefix(strings.TrimSpace(entry.DefID), "loot.") {
				lootID = strings.TrimPrefix(strings.TrimSpace(entry.DefID), "loot.")
			}
		}
		if lootID == "" {
			return "", nil, fmt.Errorf("loot entry missing loot id")
		}
		defID := "loot." + lootID
		if entry.Amount > 0 {
			data["amount"] = entry.Amount
		} else if _, ok := data["amount"]; !ok {
			data["amount"] = 1
		}
		return defID, data, nil
	case "resource":
		resourceID := strings.TrimSpace(entry.ResourceID)
		if resourceID == "" {
			if strings.TrimSpace(entry.DefID) != "" && strings.HasPrefix(strings.TrimSpace(entry.DefID), "resource.") {
				resourceID = strings.TrimPrefix(strings.TrimSpace(entry.DefID), "resource.")
			}
		}
		if resourceID == "" {
			return "", nil, fmt.Errorf("resource entry missing resource id")
		}
		if node := s.cfg.ResourceNodeByID(resourceID); node != nil {
			charges := randomResourceCharges(node.Charges.Min, node.Charges.Max, rng)
			data["charges"] = charges
			if node.Gather.BaseTimeS > 0 {
				data["gatherTimeS"] = node.Gather.BaseTimeS
			}
		} else if _, ok := data["charges"]; !ok {
			data["charges"] = 3
		}
		return "resource." + resourceID, data, nil
	case "food":
		foodID := strings.TrimSpace(entry.FoodID)
		if foodID == "" {
			if strings.TrimSpace(entry.DefID) != "" && strings.HasPrefix(strings.TrimSpace(entry.DefID), "food.") {
				foodID = strings.TrimPrefix(strings.TrimSpace(entry.DefID), "food.")
			}
		}
		if foodID == "" {
			return "", nil, fmt.Errorf("food entry missing food id")
		}
		if entry.Amount > 0 {
			data["amount"] = entry.Amount
		} else if _, ok := data["amount"]; !ok {
			data["amount"] = 1
		}
		return "food." + foodID, data, nil
	case "zombie":
		zombieID := "default_zombie"
		if len(s.cfg.Zombies.Types) > 0 && strings.TrimSpace(s.cfg.Zombies.Types[0].ID) != "" {
			zombieID = strings.TrimSpace(s.cfg.Zombies.Types[0].ID)
		}
		if strings.TrimSpace(entry.DefID) != "" {
			if strings.HasPrefix(strings.TrimSpace(entry.DefID), "zombie.") {
				return strings.TrimSpace(entry.DefID), data, nil
			}
			zombieID = strings.TrimSpace(entry.DefID)
		}
		return "zombie." + zombieID, data, nil
	default:
		if strings.TrimSpace(entry.DefID) != "" {
			return strings.TrimSpace(entry.DefID), data, nil
		}
		return "", nil, fmt.Errorf("unsupported deck card_type: %s", entry.CardType)
	}
}

func pickWeightedDeckEntry(pool []weightedDeckDraw, rng *rand.Rand) (weightedDeckDraw, error) {
	total := 0
	for _, entry := range pool {
		if entry.Weight > 0 {
			total += entry.Weight
		}
	}
	if total <= 0 {
		return weightedDeckDraw{}, fmt.Errorf("deck rng_pool has no positive weights")
	}
	pick := rng.Intn(total)
	running := 0
	for _, entry := range pool {
		if entry.Weight <= 0 {
			continue
		}
		running += entry.Weight
		if pick < running {
			return entry, nil
		}
	}
	return weightedDeckDraw{}, fmt.Errorf("failed to draw deck entry")
}

func (s *Service) newDeckRand(state *State, deckID, packStackID string, seedArg *int) *rand.Rand {
	if seedArg != nil {
		return rand.New(rand.NewSource(int64(*seedArg)))
	}

	if !s.cfg.SeededRNG.Enabled || !s.cfg.SeededRNG.DeterministicDeckDraws {
		return rand.New(rand.NewSource(time.Now().UnixNano()))
	}

	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(strings.TrimSpace(deckID)))
	_, _ = hasher.Write([]byte("|"))
	_, _ = hasher.Write([]byte(strings.TrimSpace(packStackID)))
	_, _ = hasher.Write([]byte("|"))
	_, _ = hasher.Write([]byte(fmt.Sprintf("%d", state.NextZ)))
	return rand.New(rand.NewSource(int64(hasher.Sum64())))
}

func randomResourceCharges(min, max int, rng *rand.Rand) int {
	if min <= 0 && max <= 0 {
		return 1
	}
	if min <= 0 {
		min = max
	}
	if max <= 0 {
		max = min
	}
	if max < min {
		max = min
	}
	if rng == nil || min == max {
		return max
	}
	return min + rng.Intn((max-min)+1)
}

func packDefIDForDeck(deckDefID string) string {
	deckDefID = strings.TrimSpace(deckDefID)
	if deckDefID == "" {
		return "deck.first_day_pack"
	}
	return deckDefID + "_pack"
}

func findTaskStackIDByTaskID(state *State, taskID string) string {
	if state == nil || strings.TrimSpace(taskID) == "" {
		return ""
	}
	taskID = strings.TrimSpace(taskID)
	for stackID, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil || !isTaskCard(card) {
				continue
			}
			if cardTaskID(card) == taskID {
				return stackID
			}
		}
	}
	return ""
}

func buildSpawnModifierDefIDs(row task.Task) []string {
	mods := make([]string, 0, 3)
	seen := map[string]struct{}{}
	add := func(defID string) {
		defID = strings.TrimSpace(defID)
		if defID == "" {
			return
		}
		if _, exists := seen[defID]; exists {
			return
		}
		seen[defID] = struct{}{}
		mods = append(mods, defID)
	}

	if row.DueDeadline != nil && strings.TrimSpace(*row.DueDeadline) != "" {
		add("mod.deadline_pin")
	}
	if row.DueText != nil && strings.TrimSpace(*row.DueText) != "" {
		add("mod.deadline_pin")
	}
	if row.Recurrence != nil && strings.TrimSpace(*row.Recurrence) != "" {
		add("mod.recurring")
	}
	if hasNextActionLabel(row.Labels) {
		add("mod.next_action")
	}
	return mods
}

func taskCardDataFromTaskRow(row task.Task) map[string]any {
	title := strings.TrimSpace(row.Content)
	if title == "" {
		title = "Untitled task"
	}

	priority := row.Priority
	if priority < 1 || priority > 4 {
		priority = 4
	}

	data := map[string]any{
		"taskId":      strings.TrimSpace(row.ID),
		"title":       title,
		"description": strings.TrimSpace(row.Description),
		"priority":    priority,
	}

	if row.ProjectID != nil && strings.TrimSpace(*row.ProjectID) != "" {
		data["project"] = strings.TrimSpace(*row.ProjectID)
	}
	if row.Recurrence != nil && strings.TrimSpace(*row.Recurrence) != "" {
		data["recurrence"] = strings.TrimSpace(*row.Recurrence)
	}
	if row.DueText != nil && strings.TrimSpace(*row.DueText) != "" {
		data["dueText"] = strings.TrimSpace(*row.DueText)
	}
	if row.DueDeadline != nil && strings.TrimSpace(*row.DueDeadline) != "" {
		data["dueDeadline"] = strings.TrimSpace(*row.DueDeadline)
	}
	if row.ScheduleInput != nil && strings.TrimSpace(*row.ScheduleInput) != "" {
		data["scheduleInput"] = strings.TrimSpace(*row.ScheduleInput)
	}

	labels := make([]string, 0, len(row.Labels))
	for _, label := range row.Labels {
		normalized := strings.TrimSpace(label)
		if normalized == "" {
			continue
		}
		labels = append(labels, normalized)
	}
	if len(labels) > 0 {
		data["labels"] = labels
	}

	return data
}

func syncTaskCardDataFromTaskRow(card *Card, row task.Task) {
	if card == nil {
		return
	}
	if card.Data == nil {
		card.Data = map[string]any{}
	}

	next := taskCardDataFromTaskRow(row)
	syncedKeys := []string{
		"taskId",
		"title",
		"description",
		"priority",
		"project",
		"recurrence",
		"dueText",
		"dueDeadline",
		"scheduleInput",
		"labels",
	}

	for _, key := range syncedKeys {
		value, ok := next[key]
		if !ok {
			delete(card.Data, key)
			continue
		}
		card.Data[key] = value
	}
}

func cardQuestCreateCounted(card *Card) bool {
	if card == nil || card.Data == nil {
		return false
	}
	switch value := card.Data["questCreateCounted"].(type) {
	case bool:
		return value
	case float64:
		return value != 0
	case int:
		return value != 0
	case string:
		normalized := strings.TrimSpace(strings.ToLower(value))
		return normalized == "1" || normalized == "true" || normalized == "yes"
	default:
		return false
	}
}

func markQuestCreateCounted(card *Card) {
	if card == nil {
		return
	}
	if card.Data == nil {
		card.Data = map[string]any{}
	}
	card.Data["questCreateCounted"] = true
}

func shouldCountQuestCreateFromTitle(card *Card, title string) bool {
	if card == nil {
		return false
	}
	if cardQuestCreateCounted(card) {
		return false
	}
	if strings.TrimSpace(cardTaskID(card)) != "" {
		return false
	}
	normalized := strings.TrimSpace(title)
	if normalized == "" {
		return false
	}
	return !strings.EqualFold(normalized, "untitled task")
}

func modifierRequirementCounts(defIDs []string) map[string]int {
	counts := map[string]int{}
	for _, defID := range defIDs {
		normalized := strings.TrimSpace(strings.ToLower(defID))
		if normalized == "" {
			continue
		}
		counts[normalized]++
	}
	return counts
}

func sortedModifierDefIDs(counts map[string]int) []string {
	ordered := make([]string, 0, len(counts))
	for defID, count := range counts {
		if strings.TrimSpace(defID) == "" || count <= 0 {
			continue
		}
		ordered = append(ordered, defID)
	}
	sort.Strings(ordered)
	return ordered
}

func collectConsumableModifierCards(state *State) map[string][]modifierCardRef {
	available := map[string][]modifierCardRef{}
	if state == nil {
		return available
	}

	stackIDs := make([]string, 0, len(state.Stacks))
	for stackID := range state.Stacks {
		stackIDs = append(stackIDs, stackID)
	}
	sort.Strings(stackIDs)

	for _, stackID := range stackIDs {
		stack := state.GetStack(stackID)
		if stack == nil || len(stack.Cards) == 0 {
			continue
		}

		refs := make([]modifierCardRef, 0, len(stack.Cards))
		modifierOnly := true
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil {
				modifierOnly = false
				break
			}
			defID := strings.TrimSpace(strings.ToLower(card.DefID))
			if !strings.HasPrefix(defID, "mod.") {
				modifierOnly = false
				break
			}
			refs = append(refs, modifierCardRef{
				StackID: stackID,
				CardID:  cardID,
				DefID:   defID,
			})
		}
		if !modifierOnly {
			continue
		}

		for _, ref := range refs {
			available[ref.DefID] = append(available[ref.DefID], ref)
		}
	}

	return available
}

func taskActivationCoinCost(requiredModifierTotal int) int {
	if requiredModifierTotal <= 0 {
		return 0
	}
	return requiredModifierTotal
}

func detachCardFromStack(state *State, stackID, cardID string) {
	if state == nil {
		return
	}
	stack := state.GetStack(stackID)
	if stack == nil {
		return
	}

	filtered := make([]string, 0, len(stack.Cards))
	removed := false
	for _, current := range stack.Cards {
		if !removed && current == cardID {
			removed = true
			continue
		}
		filtered = append(filtered, current)
	}
	stack.Cards = filtered

	if len(stack.Cards) == 0 {
		delete(state.Stacks, stackID)
		return
	}
	ensurePriorityFaceCard(state, stack)
}

func boardProjectIDForBoard(boardID string) string {
	normalized := strings.TrimSpace(boardID)
	if normalized == "" || strings.EqualFold(normalized, DefaultBoardID) {
		return "board"
	}
	return normalized
}

func matchesBoardProject(raw string, boardID string) bool {
	return strings.EqualFold(tenant.ProjectSlug(raw), tenant.ProjectSlug(boardProjectIDForBoard(boardID)))
}

func matchesBoardProjectPtr(value *string, boardID string) bool {
	if value == nil {
		return false
	}
	return matchesBoardProject(*value, boardID)
}

func isBoardLiveLabel(raw string) bool {
	normalized := strings.TrimSpace(strings.ToLower(raw))
	normalized = strings.TrimPrefix(normalized, "@")
	normalized = strings.NewReplacer("_", "", "-", "", " ", "").Replace(normalized)
	return normalized == "boardlive"
}

func hasBoardLiveLabel(labels []string) bool {
	for _, label := range labels {
		if isBoardLiveLabel(label) {
			return true
		}
	}
	return false
}

func appendBoardLiveLabel(labels []string) []string {
	if hasBoardLiveLabel(labels) {
		return append([]string{}, labels...)
	}
	next := append([]string{}, labels...)
	next = append(next, boardLiveLabelValue)
	return next
}

func (s *Service) ensureTaskHasBoardLiveLabel(ctx context.Context, taskID string) error {
	if s == nil || s.tasks == nil {
		return nil
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil
	}

	item, err := s.tasks.Get(ctx, taskID)
	if err != nil {
		return err
	}
	labels := appendBoardLiveLabel(item.Labels)
	if len(labels) == len(item.Labels) {
		return nil
	}
	_, err = s.tasks.Update(ctx, taskID, task.UpdateInput{Labels: &labels})
	return err
}

func hasNextActionLabel(labels []string) bool {
	for _, label := range labels {
		if isNextActionLabel(label) {
			return true
		}
	}
	return false
}

func isNextActionLabel(raw string) bool {
	normalized := strings.TrimSpace(strings.ToLower(raw))
	normalized = strings.TrimPrefix(normalized, "@")
	normalized = strings.NewReplacer("_", "", "-", "", " ", "").Replace(normalized)
	return normalized == "nextaction"
}

func appendNextActionLabel(labels []string) []string {
	if hasNextActionLabel(labels) {
		return append([]string{}, labels...)
	}
	next := append([]string{}, labels...)
	next = append(next, "next_action")
	return next
}

func (s *Service) ensureTaskHasNextActionLabel(ctx context.Context, taskID string) error {
	if s == nil || s.tasks == nil {
		return nil
	}
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil
	}

	item, err := s.tasks.Get(ctx, taskID)
	if err != nil {
		return err
	}

	labels := appendNextActionLabel(item.Labels)
	if len(labels) == len(item.Labels) {
		return nil
	}
	_, err = s.tasks.Update(ctx, taskID, task.UpdateInput{Labels: &labels})
	return err
}

func normalizeModifierDefID(raw string) string {
	modifierDefID := strings.TrimSpace(raw)
	if modifierDefID == "" {
		return ""
	}
	if !strings.HasPrefix(modifierDefID, "mod.") {
		modifierDefID = "mod." + modifierDefID
	}
	return modifierDefID
}

func isGlobalUniqueModifier(defID string) bool {
	switch strings.TrimSpace(defID) {
	case "mod.deadline_pin":
		return true
	default:
		return false
	}
}

func hasCardDefID(state *State, defID string) bool {
	if state == nil {
		return false
	}
	defID = strings.TrimSpace(defID)
	for _, card := range state.Cards {
		if card == nil {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(card.DefID), defID) {
			return true
		}
	}
	return false
}

func modifierSingleUseOnTaskComplete(defID string) bool {
	return strings.EqualFold(strings.TrimSpace(defID), "mod.next_action")
}

func inferDeckRowY(state *State, fallback int) int {
	if state == nil {
		return fallback
	}
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		card := topCard(state, stack)
		if card == nil {
			continue
		}
		if strings.HasPrefix(card.DefID, "deck.") {
			return stack.Pos.Y
		}
	}
	return fallback
}

func retireFirstDayDeckStacks(state *State) []string {
	if state == nil {
		return nil
	}
	removed := make([]string, 0)
	for stackID, stack := range state.Stacks {
		if stack == nil || len(stack.Cards) == 0 {
			continue
		}
		card := topCard(state, stack)
		if card == nil {
			continue
		}
		defID := strings.TrimSpace(card.DefID)
		if defID == "deck.first_day" || defID == "deck.first_day_pack" {
			for _, cardID := range stack.Cards {
				delete(state.Cards, cardID)
			}
			delete(state.Stacks, stackID)
			removed = append(removed, stackID)
		}
	}
	return removed
}

func (s *Service) ensurePostFirstDayDeckStacks(state *State, deckRowY int) []string {
	if state == nil {
		return nil
	}
	progression := s.cfg.ProgressionDeckDefIDs()
	created := make([]string, 0, len(progression))
	startX := 60
	spacing := 110
	for i, defID := range progression {
		if hasTopCardDefID(state, defID) {
			continue
		}
		slot := i + 1
		stack := createSingleCardStack(state, defID, Point{
			X: startX + slot*spacing,
			Y: deckRowY,
		}, nil)
		created = append(created, stack.ID)
	}
	return created
}

func hasTopCardDefID(state *State, defID string) bool {
	if state == nil {
		return false
	}
	for _, stack := range state.Stacks {
		if stack == nil || len(stack.Cards) == 0 {
			continue
		}
		card := topCard(state, stack)
		if card == nil {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(card.DefID), strings.TrimSpace(defID)) {
			return true
		}
	}
	return false
}

func countZombieStacks(state *State) int {
	if state == nil {
		return 0
	}
	count := 0
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		if stackHasKind(state, stack, "zombie") {
			count++
		}
	}
	return count
}

func (s *Service) isDeckUnlocked(ctx context.Context, state *State, deckCfg deckConfig) (bool, string) {
	condType := strings.ToLower(strings.TrimSpace(deckCfg.Unlock.Type))
	switch condType {
	case "", "always", "unlocked":
		return true, ""
	case "day_ticks_gte":
		meta := ensureMeta(state)
		need := maxInt(deckCfg.Unlock.Value, 0)
		if meta.DayTickCount >= need {
			return true, ""
		}
		return false, fmt.Sprintf("day ticks %d/%d", meta.DayTickCount, need)
	case "processed_tasks_gte":
		need := maxInt(deckCfg.Unlock.Value, 0)
		if need == 0 {
			return true, ""
		}
		processed := 0
		if s.tasks != nil {
			items, err := listAllTasks(ctx, s.tasks)
			if err == nil {
				for _, item := range items {
					processed += maxInt(item.ProcessedCount, 0)
				}
			}
		}
		if processed >= need {
			return true, ""
		}
		return false, fmt.Sprintf("processed tasks %d/%d", processed, need)
	case "zombies_seen_gte":
		need := maxInt(deckCfg.Unlock.Value, 0)
		meta := ensureMeta(state)
		seen := meta.Metrics["zombies_seen"]
		if seen >= need {
			return true, ""
		}
		return false, fmt.Sprintf("zombies seen %d/%d", seen, need)
	default:
		return false, fmt.Sprintf("unsupported unlock condition: %s", condType)
	}
}

func (s *Service) deckOpenCost(deckCfg deckConfig, zombieCount int, overrunLevel int) int {
	if deckCfg.BaseCost <= 0 {
		return 0
	}
	zombieMultiplier := s.cfg.Decks.Economy.ZombieCostMultiplierPerZombie
	overrunMultiplier := s.cfg.Decks.Economy.OverrunCostMultiplierPerLevel
	factor := 1.0 + (float64(zombieCount) * zombieMultiplier) + (float64(overrunLevel) * overrunMultiplier)
	if factor < 0 {
		factor = 0
	}
	return int(math.Ceil(float64(deckCfg.BaseCost) * factor))
}

func listAllTasks(ctx context.Context, svc TaskService) ([]task.Task, error) {
	if svc == nil {
		return nil, nil
	}
	cursor := 0
	limit := 200
	items := make([]task.Task, 0, 256)
	for {
		result, err := svc.List(ctx, task.ListParams{
			Limit:  limit,
			Cursor: cursor,
		})
		if err != nil {
			return nil, err
		}
		items = append(items, result.Items...)
		if result.NextCursor == nil {
			break
		}
		cursor = *result.NextCursor
	}
	return items, nil
}

func isTaskOverdueAtTick(item task.Task, tickDate time.Time, graceHours int) bool {
	if item.Checked || item.IsDeleted {
		return false
	}
	due, ok := bestTaskDueTime(item, tickDate.Location())
	if !ok {
		return false
	}
	if graceHours > 0 {
		due = due.Add(time.Duration(graceHours) * time.Hour)
	}
	return due.Before(tickDate)
}

func bestTaskDueTime(item task.Task, location *time.Location) (time.Time, bool) {
	if due, ok := parseTaskDueTime(item.DueDeadline, location); ok {
		return due, true
	}
	if due, ok := parseTaskDueTime(item.DueText, location); ok {
		return due, true
	}
	return time.Time{}, false
}

func parseTaskDueTime(value *string, location *time.Location) (time.Time, bool) {
	if value == nil {
		return time.Time{}, false
	}
	raw := strings.TrimSpace(*value)
	if raw == "" {
		return time.Time{}, false
	}
	upper := strings.ToUpper(raw)
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed.In(location), true
	}
	if parsed, err := time.ParseInLocation("2006-01-02", raw, location); err == nil {
		return parsed, true
	}
	if parsed, err := time.ParseInLocation("20060102", raw, location); err == nil {
		return parsed, true
	}
	if upper == "TODAY" {
		now := time.Now().In(location)
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location), true
	}
	if upper == "TOMORROW" {
		now := time.Now().In(location).AddDate(0, 0, 1)
		return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location), true
	}
	if strings.HasPrefix(strings.ToLower(raw), "in ") && strings.HasSuffix(strings.ToLower(raw), " days") {
		num := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.ToLower(raw), "in "), " days"))
		if n, err := atoi(num); err == nil && n >= 0 {
			now := time.Now().In(location).AddDate(0, 0, n)
			return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location), true
		}
	}
	if strings.HasPrefix(strings.ToLower(raw), "in ") && strings.HasSuffix(strings.ToLower(raw), " day") {
		num := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.ToLower(raw), "in "), " day"))
		if n, err := atoi(num); err == nil && n >= 0 {
			now := time.Now().In(location).AddDate(0, 0, n)
			return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location), true
		}
	}
	return time.Time{}, false
}

func nextRecurrenceDueDate(rruleValue string, item task.Task, tickDate time.Time) string {
	rule, err := rrule.Parse(rruleValue)
	if err != nil {
		return tickDate.Format("2006-01-02")
	}

	base := tickDate
	if due, ok := bestTaskDueTime(item, tickDate.Location()); ok {
		base = due
	}
	interval := 1
	if rule.Interval != nil && *rule.Interval > 0 {
		interval = *rule.Interval
	}

	next := base
	for next.Before(tickDate) {
		switch rule.Freq {
		case rrule.FreqWeekly:
			next = next.AddDate(0, 0, 7*interval)
		case rrule.FreqMonthly:
			next = next.AddDate(0, interval, 0)
		case rrule.FreqYearly:
			next = next.AddDate(interval, 0, 0)
		case rrule.FreqHourly:
			next = next.Add(time.Duration(interval) * time.Hour)
		case rrule.FreqMinutely:
			next = next.Add(time.Duration(interval) * time.Minute)
		case rrule.FreqSecondly:
			next = next.Add(time.Duration(interval) * time.Second)
		case rrule.FreqDaily:
			fallthrough
		default:
			next = next.AddDate(0, 0, interval)
		}
	}

	if rule.Until != nil {
		until, ok := parseRuleUntil(*rule.Until, tickDate.Location())
		if ok && next.After(until) {
			return tickDate.Format("2006-01-02")
		}
	}
	return next.Format("2006-01-02")
}

func parseRuleUntil(until rrule.Until, location *time.Location) (time.Time, bool) {
	value := strings.TrimSpace(until.Value)
	if value == "" {
		return time.Time{}, false
	}
	if until.IsDate {
		parsed, err := time.ParseInLocation("20060102", value, location)
		if err != nil {
			return time.Time{}, false
		}
		return parsed, true
	}
	layout := "20060102T150405"
	if until.UTC {
		layout = "20060102T150405Z"
		parsed, err := time.Parse(layout, value)
		if err != nil {
			return time.Time{}, false
		}
		return parsed.In(location), true
	}
	parsed, err := time.ParseInLocation(layout, value, location)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
}

func (s *Service) spawnOverdueZombies(state *State, overdueTaskIDs []string, dayTickCount int, tickDate time.Time) []string {
	if state == nil || len(overdueTaskIDs) == 0 {
		return nil
	}
	spawnCfg := s.cfg.World.DayTick.OverdueRules.ZombieSpawn
	spawnEnabled := spawnCfg.Enabled
	if !spawnEnabled {
		return nil
	}

	perOverdueTask := spawnCfg.PerOverdueTask
	if perOverdueTask <= 0 {
		perOverdueTask = 1
	}
	desired := len(overdueTaskIDs) * perOverdueTask
	if desired <= 0 {
		return nil
	}

	spawnCap := spawnCfg.CapPerDay
	if maxSpawn := s.cfg.World.DayTick.MaxZombiesSpawnPerDay; maxSpawn > 0 && (spawnCap <= 0 || maxSpawn < spawnCap) {
		spawnCap = maxSpawn
	}
	if spawnCap > 0 && desired > spawnCap {
		desired = spawnCap
	}

	spawnChance := 1.0
	if spawnCfg.SpawnChance != nil {
		spawnChance = *spawnCfg.SpawnChance
	}
	if spawnChance < 0 {
		spawnChance = 0
	}
	if spawnChance > 1 {
		spawnChance = 1
	}

	layout := s.cfg.UIHints.Board.DefaultSpawnLayout.Zombies
	startX := layout.StartX
	startY := layout.StartY
	dx := layout.DX
	if dx == 0 {
		dx = 120
	}
	zombieDefID := "zombie.default_zombie"
	if len(s.cfg.Zombies.Types) > 0 && strings.TrimSpace(s.cfg.Zombies.Types[0].ID) != "" {
		zombieDefID = "zombie." + strings.TrimSpace(s.cfg.Zombies.Types[0].ID)
	}

	alreadyByTaskID := map[string]struct{}{}
	for _, stack := range state.Stacks {
		if stack == nil || !stackHasKind(state, stack, "zombie") {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil || cardKind(card.DefID) != "zombie" || card.Data == nil {
				continue
			}
			if taskID, ok := card.Data["taskId"].(string); ok && strings.TrimSpace(taskID) != "" {
				alreadyByTaskID[strings.TrimSpace(taskID)] = struct{}{}
			}
		}
	}

	sort.Strings(overdueTaskIDs)
	seed := deterministicOverdueSpawnSeed(overdueTaskIDs, countZombieStacks(state), desired, dayTickCount, tickDate)
	rng := rand.New(rand.NewSource(seed))

	spawned := make([]string, 0, desired)
	for i := 0; i < desired; i++ {
		if len(spawned) >= desired {
			break
		}
		if spawnChance < 1 && rng.Float64() > spawnChance {
			continue
		}
		taskID := overdueTaskIDs[i%len(overdueTaskIDs)]
		if _, exists := alreadyByTaskID[taskID]; exists {
			continue
		}
		stack := createSingleCardStack(state, zombieDefID, Point{
			X: startX + (countZombieStacks(state)+i)*dx,
			Y: startY,
		}, map[string]any{
			"reason": "overdue_task",
			"taskId": taskID,
		})
		spawned = append(spawned, stack.ID)
	}
	return spawned
}

func deterministicOverdueSpawnSeed(overdueTaskIDs []string, existing int, desired int, dayTickCount int, tickDate time.Time) int64 {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(fmt.Sprintf(
		"%d:%d:%d:%d:%s",
		len(overdueTaskIDs),
		existing,
		desired,
		dayTickCount,
		tickDate.Format("2006-01-02"),
	)))
	for _, taskID := range overdueTaskIDs {
		_, _ = hasher.Write([]byte("|"))
		_, _ = hasher.Write([]byte(taskID))
	}
	return int64(hasher.Sum64())
}

func atoi(value string) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, fmt.Errorf("empty integer")
	}
	var out int
	_, err := fmt.Sscanf(value, "%d", &out)
	if err != nil {
		return 0, err
	}
	return out, nil
}

func resourceDropDefID(resourceDefID string) string {
	switch strings.TrimSpace(resourceDefID) {
	case "resource.ore", "resource.metal":
		return "loot.gear"
	case "resource.paper":
		return "loot.paper"
	default:
		return "loot.parts"
	}
}

func (s *Service) responseMeta(meta BoardMeta) BoardMeta {
	out := meta
	out.Inventory = copyIntMap(meta.Inventory)
	out.Metrics = copyIntMap(meta.Metrics)
	out.DeckOpen = copyIntMap(meta.DeckOpen)
	if meta.StoreReceipts != nil {
		out.StoreReceipts = make(map[string]*StoreReceipt, len(meta.StoreReceipts))
		for key, value := range meta.StoreReceipts {
			out.StoreReceipts[key] = value
		}
	}
	out.Villagers = make(map[string]*VillagerProgress, len(meta.Villagers))
	for villagerID, progress := range meta.Villagers {
		if progress == nil {
			progress = &VillagerProgress{
				Stamina: defaultVillagerStamina,
				Level:   1,
			}
		}
		clone := &VillagerProgress{
			Stamina: progress.Stamina,
			XP:      progress.XP,
			Level:   progress.Level,
		}
		if len(progress.Perks) > 0 {
			clone.Perks = append([]string{}, progress.Perks...)
		}
		s.decorateVillagerProgress(clone)
		out.Villagers[villagerID] = clone
	}
	out.Progression = s.progressionState()
	return out
}

func (s *Service) decorateVillagerProgress(progress *VillagerProgress) {
	if progress == nil {
		return
	}
	progress.MaxStamina = s.villagerMaxStamina(progress)
	nextLevel, nextLevelXP, xpToNext := s.nextLevelProgress(progress)
	progress.NextLevel = nextLevel
	progress.NextLevelXP = nextLevelXP
	progress.XPToNext = xpToNext
}

func (s *Service) progressionState() *ProgressionState {
	maxLevel := s.cfg.Villagers.Defaults.MaxLevel
	if maxLevel <= 0 {
		maxLevel = 10
	}

	thresholds := make(map[string]int, len(s.cfg.Villagers.Leveling.Thresholds))
	for level, threshold := range s.cfg.Villagers.Leveling.Thresholds {
		thresholds[fmt.Sprintf("%d", level)] = threshold
	}

	perksByLevel := map[string][]ProgressionPerk{}
	levels := make([]ProgressionLevel, 0, maxInt(maxLevel-1, 0))
	for level := 2; level <= maxLevel; level++ {
		perkIDs := s.cfg.PerksForLevel(level)
		perks := make([]ProgressionPerk, 0, len(perkIDs))
		for _, perkID := range perkIDs {
			perk := s.cfg.PerkByID(perkID)
			if perk == nil {
				continue
			}
			perks = append(perks, ProgressionPerk{
				ID:      perk.ID,
				Label:   perk.Label,
				Summary: perkSummary(perk),
			})
		}
		if len(perks) > 0 {
			perksByLevel[fmt.Sprintf("%d", level)] = perks
		}
		levels = append(levels, ProgressionLevel{
			Level:     level,
			Threshold: s.cfg.Villagers.Leveling.Thresholds[level],
			Perks:     perks,
		})
	}

	return &ProgressionState{
		MaxLevel:     maxLevel,
		Thresholds:   thresholds,
		PerksByLevel: perksByLevel,
		Levels:       levels,
	}
}

func ensureMeta(state *State) *BoardMeta {
	if state == nil {
		return &BoardMeta{
			Inventory:     map[string]int{},
			Villagers:     map[string]*VillagerProgress{},
			Metrics:       map[string]int{},
			DeckOpen:      map[string]int{},
			StoreReceipts: map[string]*StoreReceipt{},
		}
	}
	state.normalize()
	return &state.Meta
}

func firstVillagerIDFromStack(state *State, stack *Stack) string {
	if state == nil || stack == nil {
		return ""
	}
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil || cardKind(card.DefID) != "villager" {
			continue
		}
		return villagerIDFromCard(card, stack.ID)
	}
	return ""
}

func villagerIDFromCard(card *Card, fallbackID string) string {
	if card == nil || cardKind(card.DefID) != "villager" {
		return ""
	}
	if card.Data == nil {
		card.Data = map[string]any{}
	}
	if id, ok := card.Data["villagerId"].(string); ok {
		normalized := strings.TrimSpace(id)
		if normalized != "" {
			card.Data["villagerId"] = normalized
			return normalized
		}
	}
	normalizedFallback := strings.TrimSpace(fallbackID)
	if normalizedFallback == "" {
		normalizedFallback = strings.TrimSpace(card.ID)
	}
	if normalizedFallback == "" {
		normalizedFallback = "villager_default"
	}
	card.Data["villagerId"] = normalizedFallback
	return normalizedFallback
}

func ensureVillager(meta *BoardMeta, villagerID string) *VillagerProgress {
	if meta == nil {
		return &VillagerProgress{Stamina: defaultVillagerStamina, Level: 1}
	}
	if meta.Villagers == nil {
		meta.Villagers = map[string]*VillagerProgress{}
	}
	villagerID = strings.TrimSpace(villagerID)
	if villagerID == "" {
		villagerID = "villager_default"
	}
	progress := meta.Villagers[villagerID]
	if progress == nil {
		progress = &VillagerProgress{
			Stamina: defaultVillagerStamina,
			Level:   1,
		}
		meta.Villagers[villagerID] = progress
	}
	if progress.Level <= 0 {
		progress.Level = 1
	}
	if progress.Stamina < 0 {
		progress.Stamina = 0
	}
	return progress
}

func villagerHasPerk(progress *VillagerProgress, perkID string) bool {
	if progress == nil {
		return false
	}
	for _, perk := range progress.Perks {
		if strings.EqualFold(strings.TrimSpace(perk), strings.TrimSpace(perkID)) {
			return true
		}
	}
	return false
}

func (s *Service) villagerMaxStamina(progress *VillagerProgress) int {
	maxStamina := s.cfg.Villagers.Defaults.BaseMaxStamina
	if maxStamina <= 0 {
		maxStamina = defaultVillagerStamina
	}
	if progress == nil {
		return maxStamina
	}
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		maxStamina += intFromAny(perk.Apply["max_stamina_add"])
	}
	if maxStamina <= 0 {
		return 1
	}
	return maxStamina
}

func (s *Service) nextLevelProgress(progress *VillagerProgress) (int, int, int) {
	if progress == nil {
		return 1, 0, 0
	}

	maxLevel := s.cfg.Villagers.Defaults.MaxLevel
	if maxLevel <= 0 {
		maxLevel = 10
	}

	currentLevel := progress.Level
	if currentLevel <= 0 {
		currentLevel = 1
	}
	if currentLevel >= maxLevel {
		return maxLevel, progress.XP, 0
	}

	thresholdLevels := s.cfg.LevelThresholdsSorted()
	for _, level := range thresholdLevels {
		threshold := s.cfg.Villagers.Leveling.Thresholds[level]
		if threshold > progress.XP {
			return level, threshold, threshold - progress.XP
		}
	}

	nextLevel := currentLevel + 1
	if nextLevel > maxLevel {
		nextLevel = maxLevel
	}
	nextXP := (nextLevel - 1) * xpPerLevel
	if nextXP < progress.XP {
		nextXP = progress.XP
	}
	return nextLevel, nextXP, maxInt(nextXP-progress.XP, 0)
}

func spendVillagerStamina(progress *VillagerProgress, cost int) (bool, int) {
	if progress == nil {
		return false, 0
	}
	if cost <= 0 {
		return true, progress.Stamina
	}
	if progress.Stamina < cost {
		return false, progress.Stamina
	}
	progress.Stamina -= cost
	if progress.Stamina < 0 {
		progress.Stamina = 0
	}
	return true, progress.Stamina
}

func restoreVillagerStamina(progress *VillagerProgress, amount int, maxStamina int) int {
	if progress == nil {
		return 0
	}
	if amount <= 0 {
		return progress.Stamina
	}
	progress.Stamina += amount
	if maxStamina <= 0 {
		maxStamina = defaultVillagerStamina
	}
	if progress.Stamina > maxStamina {
		progress.Stamina = maxStamina
	}
	return progress.Stamina
}

func (s *Service) zombieClearStaminaCost(progress *VillagerProgress) int {
	cost := s.cfg.Villagers.Actions.ClearZombie.StaminaCost
	if cost <= 0 {
		cost = 2
	}
	if len(s.cfg.Zombies.Types) > 0 && s.cfg.Zombies.Types[0].Cleanup.StaminaCost > 0 {
		cost = s.cfg.Zombies.Types[0].Cleanup.StaminaCost
	}

	minCost := s.cfg.Villagers.Actions.ClearZombie.MinCostAfterPerks
	if minCost <= 0 {
		minCost = 1
	}

	if progress != nil {
		for _, perkID := range progress.Perks {
			perk := s.cfg.PerkByID(perkID)
			if perk == nil || perk.Apply == nil {
				continue
			}
			cost += intFromAny(perk.Apply["zombie_clear_stamina_cost_add"])
			if perkMin := intFromAny(perk.Apply["min_zombie_clear_cost"]); perkMin > minCost {
				minCost = perkMin
			}
		}
	}

	if cost < minCost {
		cost = minCost
	}
	if cost <= 0 {
		cost = 1
	}
	return cost
}

func (s *Service) awardVillagerXP(meta *BoardMeta, villagerID string, xp int) (*VillagerProgress, []string) {
	progress := ensureVillager(meta, villagerID)
	if xp <= 0 {
		return progress, []string{}
	}

	progress.XP += xp
	if progress.Level <= 0 {
		progress.Level = 1
	}

	maxLevel := s.cfg.Villagers.Defaults.MaxLevel
	if maxLevel <= 0 {
		maxLevel = 10
	}
	if progress.Level > maxLevel {
		progress.Level = maxLevel
	}

	newLevel := progress.Level
	thresholdLevels := s.cfg.LevelThresholdsSorted()
	if len(thresholdLevels) > 0 {
		for _, level := range thresholdLevels {
			threshold := s.cfg.Villagers.Leveling.Thresholds[level]
			if progress.XP >= threshold && level > newLevel {
				newLevel = level
			}
		}
	} else {
		newLevel = (progress.XP / xpPerLevel) + 1
	}
	if newLevel < 1 {
		newLevel = 1
	}
	if newLevel > maxLevel {
		newLevel = maxLevel
	}

	newPerks := []string{}
	if len(s.cfg.Villagers.Leveling.PerksByLevel) > 0 {
		for lvl := progress.Level + 1; lvl <= newLevel; lvl++ {
			for _, perkID := range s.cfg.PerksForLevel(lvl) {
				if perkID == "" || villagerHasPerk(progress, perkID) {
					continue
				}
				progress.Perks = append(progress.Perks, perkID)
				newPerks = append(newPerks, perkID)
			}
		}
	} else if len(s.cfg.Villagers.Leveling.PerkPool) > 0 {
		choicesPerLevel := s.cfg.Villagers.Leveling.ChoicesPerLevel
		if choicesPerLevel <= 0 {
			choicesPerLevel = 1
		}
		for lvl := progress.Level + 1; lvl <= newLevel; lvl++ {
			picked := 0
			for _, perk := range s.cfg.Villagers.Leveling.PerkPool {
				perkID := strings.TrimSpace(perk.ID)
				if perkID == "" || villagerHasPerk(progress, perkID) {
					continue
				}
				progress.Perks = append(progress.Perks, perkID)
				newPerks = append(newPerks, perkID)
				picked++
				if picked >= choicesPerLevel {
					break
				}
			}
		}
	}
	progress.Level = newLevel
	maxStamina := s.villagerMaxStamina(progress)
	if progress.Stamina > maxStamina {
		progress.Stamina = maxStamina
	}
	return progress, newPerks
}

func taskCardPriority(card *Card) int {
	if card == nil {
		return 4
	}
	priority := intFromAny(card.Data["priority"])
	if priority < 1 || priority > 4 {
		return 4
	}
	return priority
}

func (s *Service) taskPriorityXPBonus(priority int) int {
	key := "none"
	switch priority {
	case 1:
		key = "high"
	case 2:
		key = "medium"
	case 3:
		key = "low"
	}
	return maxInt(s.cfg.Villagers.Leveling.XPSources.CompleteTask.ByPriority[key], 0)
}

func (s *Service) taskCompleteXPBonus(progress *VillagerProgress) int {
	if progress == nil {
		return 0
	}
	bonus := 0
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		bonus += intFromAny(perk.Apply["task_complete_xp_add"])
	}
	return maxInt(bonus, 0)
}

func (s *Service) taskCompleteCurrencyBonus(progress *VillagerProgress) int {
	if progress == nil {
		return 0
	}
	bonus := 0
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		bonus += intFromAny(perk.Apply["task_complete_currency_add"])
	}
	return maxInt(bonus, 0)
}

func (s *Service) resourceDropAmountBonus(progress *VillagerProgress) int {
	if progress == nil {
		return 0
	}
	bonus := 0
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		bonus += intFromAny(perk.Apply["resource_drop_amount_add"])
	}
	return maxInt(bonus, 0)
}

func (s *Service) foodStaminaRestoreBonus(progress *VillagerProgress) int {
	if progress == nil {
		return 0
	}
	bonus := 0
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		bonus += intFromAny(perk.Apply["food_stamina_restore_add"])
	}
	return maxInt(bonus, 0)
}

func (s *Service) taskCompletionXP(progress *VillagerProgress, cards []*Card) int {
	baseXP := s.cfg.Villagers.Leveling.XPSources.CompleteTask.BaseXP
	if baseXP <= 0 {
		baseXP = 1
	}
	total := 0
	for _, card := range cards {
		total += baseXP + s.taskPriorityXPBonus(taskCardPriority(card)) + s.taskCompleteXPBonus(progress)
	}
	if total == 0 && len(cards) == 0 {
		total = baseXP + s.taskCompleteXPBonus(progress)
	}
	if total < 0 {
		return 0
	}
	return total
}

func normalizeResolvedReward(kind, id string, amount int) (resolvedReward, bool) {
	kind = strings.ToLower(strings.TrimSpace(kind))
	id = strings.TrimSpace(id)
	switch kind {
	case "", "none":
		return resolvedReward{}, false
	case "loot":
		id = normalizeCollectLoot(id)
	case "food":
		id = strings.TrimSpace(strings.TrimPrefix(strings.ToLower(id), "food."))
	default:
		return resolvedReward{}, false
	}
	if id == "" || amount <= 0 {
		return resolvedReward{}, false
	}
	return resolvedReward{Kind: kind, ID: id, Amount: amount}, true
}

func (s *Service) gatherResourceXP() int {
	xp := s.cfg.Villagers.Leveling.XPSources.GatherResourceCycle.BaseXP
	if xp < 0 {
		return 0
	}
	return xp
}

func (s *Service) zombieClearXP() int {
	xp := s.cfg.Villagers.Leveling.XPSources.ClearZombie.BaseXP
	if xp < 0 {
		return 0
	}
	return xp
}

func deterministicRewardSeed(parts ...string) int64 {
	hasher := fnv.New64a()
	for _, part := range parts {
		_, _ = hasher.Write([]byte(part))
		_, _ = hasher.Write([]byte("|"))
	}
	return int64(hasher.Sum64())
}

func weightedRewardRoll(entries []RewardTableEntryConfig, seed int64) (resolvedReward, bool) {
	totalWeight := 0
	for _, entry := range entries {
		if entry.Weight > 0 {
			totalWeight += entry.Weight
		}
	}
	if totalWeight <= 0 {
		return resolvedReward{}, false
	}
	rng := rand.New(rand.NewSource(seed))
	target := rng.Intn(totalWeight)
	running := 0
	for _, entry := range entries {
		if entry.Weight <= 0 {
			continue
		}
		running += entry.Weight
		if target >= running {
			continue
		}
		return normalizeResolvedReward(entry.Type, entry.ID, entry.Amount)
	}
	return resolvedReward{}, false
}

func collapseResolvedRewards(rewards []resolvedReward) []resolvedReward {
	if len(rewards) == 0 {
		return nil
	}
	order := make([]string, 0, len(rewards))
	merged := map[string]resolvedReward{}
	for _, reward := range rewards {
		if reward.Kind == "" || reward.ID == "" || reward.Amount <= 0 {
			continue
		}
		key := reward.Kind + ":" + reward.ID
		if existing, ok := merged[key]; ok {
			existing.Amount += reward.Amount
			merged[key] = existing
			continue
		}
		order = append(order, key)
		merged[key] = reward
	}
	out := make([]resolvedReward, 0, len(order))
	for _, key := range order {
		out = append(out, merged[key])
	}
	return out
}

func resolveRewardTable(table RewardTableConfig, repeats int, seedParts ...string) []resolvedReward {
	if repeats <= 0 {
		return nil
	}
	rewards := make([]resolvedReward, 0, repeats*(len(table.Guaranteed)+maxInt(table.BonusRolls, 0)))
	for repeat := 0; repeat < repeats; repeat++ {
		for _, entry := range table.Guaranteed {
			if reward, ok := normalizeResolvedReward(entry.Type, entry.ID, entry.Amount); ok {
				rewards = append(rewards, reward)
			}
		}
		for roll := 0; roll < table.BonusRolls; roll++ {
			seed := deterministicRewardSeed(append(seedParts, fmt.Sprintf("repeat:%d", repeat), fmt.Sprintf("roll:%d", roll))...)
			if reward, ok := weightedRewardRoll(table.RNGPool, seed); ok {
				rewards = append(rewards, reward)
			}
		}
	}
	return collapseResolvedRewards(rewards)
}

func resolvedRewardDefID(reward resolvedReward) string {
	switch reward.Kind {
	case "loot":
		return "loot." + reward.ID
	case "food":
		return "food." + reward.ID
	default:
		return ""
	}
}

func rewardPatchFromResolvedRewards(rewards []resolvedReward, stacks []*Stack, mode string) map[string]any {
	if len(rewards) == 0 {
		return nil
	}
	primary := rewards[0]
	patch := map[string]any{
		"type":   primary.ID,
		"amount": primary.Amount,
		"mode":   mode,
	}
	if len(stacks) > 0 {
		patch["stackId"] = stacks[0].ID
	}
	if primary.Kind != "" {
		patch["kind"] = primary.Kind
	}
	if len(rewards) > 1 {
		items := make([]map[string]any, 0, len(rewards))
		for _, reward := range rewards {
			items = append(items, map[string]any{
				"kind":   reward.Kind,
				"type":   reward.ID,
				"amount": reward.Amount,
			})
		}
		patch["items"] = items
	}
	return patch
}

func (s *Service) spawnResolvedRewards(state *State, rewards []resolvedReward, pos Point) []*Stack {
	if len(rewards) == 0 {
		return nil
	}
	created := make([]*Stack, 0, len(rewards))
	for index, reward := range rewards {
		defID := resolvedRewardDefID(reward)
		if defID == "" {
			continue
		}
		stack := createSingleCardStack(state, defID, Point{
			X: pos.X + index*18,
			Y: pos.Y + (index%2)*12,
		}, map[string]any{
			"amount": reward.Amount,
		})
		created = append(created, s.finalizeSpawnedStack(state, stack))
	}
	return created
}

func (s *Service) taskCompletionRewards(progress *VillagerProgress, cards []*Card, stackID string, basePos Point) []resolvedReward {
	repeats := len(cards)
	if repeats <= 0 {
		return nil
	}
	table := s.cfg.Villagers.Leveling.TaskCompletionRewards
	rewards := resolveRewardTable(
		table,
		repeats,
		"task.complete",
		stackID,
		fmt.Sprintf("%d:%d", basePos.X, basePos.Y),
	)
	if len(rewards) == 0 {
		rewards = []resolvedReward{{Kind: "loot", ID: "coin", Amount: repeats}}
	}
	if bonusCurrency := s.taskCompleteCurrencyBonus(progress); bonusCurrency > 0 {
		rewards = append(rewards, resolvedReward{
			Kind:   "loot",
			ID:     "coin",
			Amount: bonusCurrency * repeats,
		})
	}
	return collapseResolvedRewards(rewards)
}

func (s *Service) taskCompletionInventoryRewards(completedCount int) []resolvedReward {
	if completedCount <= 0 {
		return nil
	}
	filtered := make([]resolvedReward, 0, completedCount*len(s.cfg.Villagers.Leveling.TaskCompletionRewards.Guaranteed))
	for repeat := 0; repeat < completedCount; repeat++ {
		for _, entry := range s.cfg.Villagers.Leveling.TaskCompletionRewards.Guaranteed {
			if reward, ok := normalizeResolvedReward(entry.Type, entry.ID, entry.Amount); ok && reward.Kind == "loot" {
				filtered = append(filtered, reward)
			}
		}
	}
	if len(filtered) == 0 {
		filtered = append(filtered, resolvedReward{Kind: "loot", ID: "coin", Amount: completedCount})
	}
	return collapseResolvedRewards(filtered)
}

func (s *Service) resourceGatherRewards(progress *VillagerProgress, resourceCard *Card, villagerID string, stackID string, chargesRemaining int) []resolvedReward {
	if resourceCard == nil {
		return nil
	}
	resourceID := strings.TrimSpace(strings.TrimPrefix(resourceCard.DefID, "resource."))
	var rewards []resolvedReward
	if node := s.cfg.ResourceNodeByID(resourceID); node != nil {
		rewards = resolveRewardTable(
			node.Gather.Rewards,
			1,
			"resource.gather",
			resourceCard.ID,
			villagerID,
			stackID,
			resourceID,
			fmt.Sprintf("charges:%d", chargesRemaining),
		)
	}
	if len(rewards) == 0 {
		if fallback, ok := normalizeResolvedReward("loot", strings.TrimPrefix(resourceDropDefID(resourceCard.DefID), "loot."), 1); ok {
			rewards = []resolvedReward{fallback}
		}
	}
	bonus := s.resourceDropAmountBonus(progress)
	if bonus > 0 {
		for index := range rewards {
			if rewards[index].Kind == "loot" {
				rewards[index].Amount += bonus
			}
		}
	}
	return collapseResolvedRewards(rewards)
}

func (s *Service) zombieClearReward(zombieStackID, villagerID string, clearedCount int) (string, int) {
	if len(s.cfg.Zombies.Types) == 0 {
		return "coin", 1
	}
	rewards := resolveRewardTable(
		s.cfg.Zombies.Types[0].Cleanup.RewardOnClear,
		1,
		"zombie.clear",
		zombieStackID,
		villagerID,
		fmt.Sprintf("cleared:%d", clearedCount),
	)
	for _, reward := range rewards {
		if reward.Kind == "loot" {
			return reward.ID, reward.Amount
		}
	}
	return "", 0
}

func (s *Service) taskDueGraceHours() int {
	grace := s.cfg.Tasks.DueDate.GraceHours
	if grace < 0 {
		return 0
	}
	return grace
}

func (s *Service) staminaRestoreForFood(foodDefID string, progress *VillagerProgress) int {
	foodID := strings.TrimSpace(strings.TrimPrefix(foodDefID, "food."))
	if item := s.cfg.FoodByID(foodID); item != nil && item.StaminaRestore > 0 {
		return item.StaminaRestore + s.foodStaminaRestoreBonus(progress)
	}
	switch strings.TrimSpace(foodDefID) {
	case "food.bread":
		return 3 + s.foodStaminaRestoreBonus(progress)
	case "food.berries", "food.berry":
		return 2 + s.foodStaminaRestoreBonus(progress)
	default:
		return 1 + s.foodStaminaRestoreBonus(progress)
	}
}

func perkSummary(perk *PerkConfig) string {
	if perk == nil || perk.Apply == nil {
		return ""
	}
	parts := []string{}
	if value := intFromAny(perk.Apply["max_stamina_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d max stamina", value))
	}
	if value := intFromAny(perk.Apply["task_complete_currency_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d coin on task completion", value))
	}
	if value := intFromAny(perk.Apply["task_complete_xp_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d XP on task completion", value))
	}
	if value := intFromAny(perk.Apply["zombie_clear_stamina_cost_add"]); value != 0 {
		summary := fmt.Sprintf("%+d zombie clear stamina cost", value)
		if minCost := intFromAny(perk.Apply["min_zombie_clear_cost"]); minCost > 0 {
			summary += fmt.Sprintf(" (min %d)", minCost)
		}
		parts = append(parts, summary)
	}
	if value := intFromAny(perk.Apply["resource_drop_amount_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d resource loot", value))
	}
	if value := intFromAny(perk.Apply["food_stamina_restore_add"]); value != 0 {
		parts = append(parts, fmt.Sprintf("%+d stamina from food", value))
	}
	return strings.Join(parts, ", ")
}

func copyIntMap(src map[string]int) map[string]int {
	dst := make(map[string]int, len(src))
	for key, value := range src {
		dst[key] = value
	}
	return dst
}

func maxInt(v, fallback int) int {
	if v < fallback {
		return fallback
	}
	return v
}

func intFromAny(value any) int {
	if value == nil {
		return 0
	}
	if num, ok := asInt(value); ok {
		return num
	}
	return 0
}

func asString(value any) string {
	if value == nil {
		return ""
	}
	switch raw := value.(type) {
	case string:
		return strings.TrimSpace(raw)
	case fmt.Stringer:
		return strings.TrimSpace(raw.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", raw))
	}
}

func asStringOr(value any, fallback string) string {
	out := asString(value)
	if out == "" {
		return fallback
	}
	return out
}

func getObjectOrNil(args map[string]any, key string) (map[string]any, error) {
	value, ok := args[key]
	if !ok || value == nil {
		return map[string]any{}, nil
	}
	obj, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("field %s must be an object", key)
	}
	return obj, nil
}

func getString(args map[string]any, key string) (string, error) {
	value, ok := args[key]
	if !ok {
		return "", fmt.Errorf("missing required field: %s", key)
	}
	s, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("field %s must be a string", key)
	}
	return s, nil
}

func getStringOr(args map[string]any, key string) string {
	value, ok := args[key]
	if !ok || value == nil {
		return ""
	}
	s, ok := value.(string)
	if !ok {
		return ""
	}
	return s
}

func getInt(args map[string]any, key string) (int, error) {
	value, ok := args[key]
	if !ok {
		return 0, fmt.Errorf("missing required field: %s", key)
	}
	num, ok := asInt(value)
	if !ok {
		return 0, fmt.Errorf("field %s must be a number", key)
	}
	return num, nil
}

func getIntOr(args map[string]any, key string, fallback int) int {
	value, ok := args[key]
	if !ok {
		return fallback
	}
	num, ok := asInt(value)
	if !ok {
		return fallback
	}
	return num
}

func getBoolOr(args map[string]any, key string, fallback bool) bool {
	value, ok := args[key]
	if !ok || value == nil {
		return fallback
	}
	switch raw := value.(type) {
	case bool:
		return raw
	case string:
		normalized := strings.TrimSpace(strings.ToLower(raw))
		switch normalized {
		case "true", "t", "1", "yes", "y":
			return true
		case "false", "f", "0", "no", "n":
			return false
		default:
			return fallback
		}
	default:
		if num, ok := asInt(raw); ok {
			return num != 0
		}
	}
	return fallback
}

func getIntPtr(args map[string]any, key string) (*int, error) {
	value, ok := args[key]
	if !ok {
		return nil, nil
	}
	num, ok := asInt(value)
	if !ok {
		return nil, fmt.Errorf("field %s must be a number", key)
	}
	return &num, nil
}

func getPositions(args map[string]any, key string) ([]Point, error) {
	value, ok := args[key]
	if !ok || value == nil {
		return nil, nil
	}

	items, ok := value.([]any)
	if !ok {
		return nil, fmt.Errorf("field %s must be an array", key)
	}

	positions := make([]Point, 0, len(items))
	for i, item := range items {
		pointArgs, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("field %s[%d] must be an object", key, i)
		}
		x := getIntOr(pointArgs, "x", 0)
		y := getIntOr(pointArgs, "y", 0)
		positions = append(positions, Point{X: x, Y: y})
	}
	return positions, nil
}

func asInt(value any) (int, bool) {
	switch v := value.(type) {
	case float64:
		return int(v), true
	case float32:
		return int(v), true
	case int:
		return v, true
	case int8:
		return int(v), true
	case int16:
		return int(v), true
	case int32:
		return int(v), true
	case int64:
		return int(v), true
	case uint:
		return int(v), true
	case uint8:
		return int(v), true
	case uint16:
		return int(v), true
	case uint32:
		return int(v), true
	case uint64:
		return int(v), true
	case json.Number:
		if i, err := v.Int64(); err == nil {
			return int(i), true
		}
		if f, err := v.Float64(); err == nil {
			return int(f), true
		}
	}
	return 0, false
}
