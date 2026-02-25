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
)

const DefaultBoardID = "default"

var boardIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

const (
	defaultVillagerStamina = 6
	xpPerLevel             = 10
)

var defaultLootTypes = []string{"coin", "paper", "ink", "gear", "parts"}

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
	validator *Validator
	mu        sync.Mutex
}

type ServiceOption func(*Service)

func WithGameplayConfig(cfg GameplayConfig) ServiceOption {
	return func(s *Service) {
		s.cfg = cfg
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

type VersionConflictError struct {
	ServerVersion string
}

func (e *VersionConflictError) Error() string {
	return "board version conflict"
}

func NewService(repo *Repository, tasks TaskService, opts ...ServiceOption) *Service {
	svc := &Service{
		repo:  repo,
		tasks: tasks,
		cfg:   DefaultGameplayConfig(),
	}
	for _, opt := range opts {
		if opt != nil {
			opt(svc)
		}
	}
	svc.cfg.Normalize()
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

	return StateResponse{
		Stacks:  state.Stacks,
		Cards:   state.Cards,
		Meta:    state.Meta,
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

	patch, err := s.executeCommand(ctx, state, cmd, req.Args)
	if err != nil {
		var appErr *apperrors.AppError
		if errors.As(err, &appErr) {
			return CommandResult{}, err
		}
		return CommandResult{}, apperrors.New(apperrors.CodeValidationError, err.Error())
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

func (s *Service) executeCommand(ctx context.Context, state *State, cmd string, args map[string]any) (any, error) {
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
		return s.cmdStackMerge(state, args)
	case "stack.split":
		return cmdStackSplit(state, args)
	case "stack.unstack":
		return cmdStackUnstack(state, args)
	case "stack.remove":
		return cmdStackRemove(state, args)
	case "task.create_blank":
		return s.cmdTaskCreateBlank(ctx, state, args)
	case "task.spawn_existing":
		return s.cmdTaskSpawnExisting(ctx, state, args)
	case "task.set_title":
		return s.cmdTaskSetTitle(ctx, state, args)
	case "task.set_description":
		return s.cmdTaskSetDescription(ctx, state, args)
	case "task.set_task_id":
		return cmdTaskSetTaskID(state, args)
	case "task.add_modifier":
		return s.cmdTaskAddModifier(state, args)
	case "task.assign_villager":
		return cmdTaskAssignVillager(state, args)
	case "task.complete_stack":
		return s.cmdTaskCompleteStack(ctx, state, args)
	case "task.complete_by_task_id":
		return s.cmdTaskCompleteByTaskID(ctx, state, args)
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

	if err := state.MoveStack(stackID, Point{X: x, Y: y}); err != nil {
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

func (s *Service) cmdStackMerge(state *State, args map[string]any) (any, error) {
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
	if s.validator != nil {
		if err := s.validator.ValidateStackMerge(state, targetID, sourceID); err != nil {
			return nil, err
		}
	}
	if err := state.MergeStacks(targetID, sourceID); err != nil {
		return nil, err
	}
	if stackHasKind(state, target, "task") {
		ensureTaskFaceCard(state, target)
	}
	if stackHasKind(state, target, "resource") {
		ensureResourceFaceCard(state, target)
	}

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
	if newX != nil && newY != nil {
		newStack.Pos = Point{X: *newX, Y: *newY}
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

func (s *Service) cmdTaskCreateBlank(ctx context.Context, state *State, args map[string]any) (any, error) {
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
		project = "inbox"
	}

	taskID := ""
	if s.tasks != nil {
		content := title
		if content == "" {
			content = "Untitled task"
		}
		created, err := s.tasks.Create(ctx, task.CreateInput{
			Content:     content,
			Description: description,
			Priority:    4,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create task: %w", err)
		}
		taskID = created.ID
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

func cmdTaskSetTaskID(state *State, args map[string]any) (any, error) {
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
	card.Data["taskId"] = strings.TrimSpace(taskID)

	return map[string]any{
		"card":   card,
		"taskId": strings.TrimSpace(taskID),
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
	basePos := stack.Pos
	offset := 18

	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if isTaskCard(card) {
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
	meta.Metrics["tasks_completed"] += len(completedTaskIDs)

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
		xpGained = s.taskCompleteXP(len(completedTaskIDs))
		progress, newPerks := s.awardVillagerXP(meta, villagerID, xpGained)
		villagerProgressPatch["xp"] = progress.XP
		villagerProgressPatch["level"] = progress.Level
		villagerProgressPatch["perks"] = append([]string{}, progress.Perks...)
		villagerProgressPatch["xpGained"] = xpGained
		villagerProgressPatch["newPerks"] = newPerks
	}

	return map[string]any{
		"removedStack":      stackID,
		"removedCards":      removedCards,
		"createdStacks":     createdStacks,
		"completedTaskIds":  completedTaskIDs,
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

	return map[string]any{
		"completedTaskId": taskID,
		"mode":            "repo_only",
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
	decks := append([]string{"deck.first_day"}, s.cfg.ProgressionDeckDefIDs()...)

	created := make([]*Stack, 0, len(decks)+5)
	for i, deckID := range decks {
		x := deckStartX + i*deckSpacing
		created = append(created, createSingleCardStack(state, deckID, Point{X: x, Y: deckY}, nil))
	}

	created = append(created, createSingleCardStack(state, "villager.basic", Point{X: 300, Y: 200}, map[string]any{"name": "Flicker"}))
	created = append(created, createSingleCardStack(state, "villager.basic", Point{X: 420, Y: 200}, map[string]any{"name": "Pip"}))
	created = append(created, createSingleCardStack(state, "resource.tree", Point{X: 260, Y: 340}, map[string]any{"charges": 3}))
	created = append(created, createSingleCardStack(state, "food.apple", Point{X: 440, Y: 340}, map[string]any{"amount": 2}))

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
	if unlocked, reason := s.isDeckUnlocked(ctx, state, deckCfg); !unlocked {
		return nil, fmt.Errorf("deck is locked: %s", reason)
	}
	if packDefID == "" {
		packDefID = packDefIDForDeck(deckCfg.ID)
	}

	stack := createSingleCardStack(state, packDefID, Point{X: x, Y: y}, map[string]any{
		"deckId": deckCfg.ID,
	})
	return map[string]any{
		"stack": stack,
		"card":  topCard(state, stack),
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
			return nil, fmt.Errorf("not enough %s for deck open (need %d)", costCurrency, costCharged)
		}
		meta.Inventory[costCurrency] -= costCharged
	}

	origin := packStack.Pos
	for _, cardID := range packStack.Cards {
		delete(state.Cards, cardID)
	}
	delete(state.Stacks, packStackID)

	rng := s.newDeckRand(state, deckCfg.ID, packStackID, seedArg)
	created := make([]*Stack, 0, count)
	for i := 0; i < count; i++ {
		drawn, err := pickWeightedDeckEntry(deckCfg.DrawPool, rng)
		if err != nil {
			return nil, err
		}
		defID, data, err := s.mapDeckDrawToCard(drawn, rng)
		if err != nil {
			return nil, err
		}
		angle := (-math.Pi / 2) + (float64(i)/float64(count))*(math.Pi*2)
		x := origin.X + int(math.Cos(angle)*float64(radius))
		y := origin.Y + int(math.Sin(angle)*(float64(radius)*0.72))
		created = append(created, createSingleCardStack(state, defID, Point{X: x, Y: y}, data))
	}
	meta.DeckOpen[deckCfg.ID] = deckOpenCount + 1

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
			"deckOpenCount": meta.DeckOpen[deckCfg.ID],
		},
		"inventory": copyIntMap(meta.Inventory),
	}, nil
}

func (s *Service) cmdTaskSpawnExisting(ctx context.Context, state *State, args map[string]any) (any, error) {
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
	if row.Checked || row.IsDeleted {
		return nil, fmt.Errorf("cannot move completed task to board")
	}
	if stackID := findTaskStackIDByTaskID(state, row.ID); stackID != "" {
		return nil, fmt.Errorf("task is already on the board")
	}

	project := ""
	if row.ProjectID != nil {
		project = strings.TrimSpace(*row.ProjectID)
	}
	cardData := map[string]any{
		"taskId":      row.ID,
		"title":       row.Content,
		"description": row.Description,
		"project":     project,
		"priority":    row.Priority,
		"dueText":     row.DueText,
		"dueDeadline": row.DueDeadline,
		"recurrence":  row.Recurrence,
	}

	modifierDefs := buildSpawnModifierDefIDs(row)
	cardIDs := make([]string, 0, len(modifierDefs)+1)
	for _, defID := range modifierDefs {
		modCard := state.CreateCard(defID, nil)
		cardIDs = append(cardIDs, modCard.ID)
	}
	card := state.CreateCard("task.instance", cardData)
	cardIDs = append(cardIDs, card.ID)
	stack := state.CreateStack(Point{X: x, Y: y}, cardIDs)
	ensureTaskFaceCard(state, stack)

	return map[string]any{
		"stack": stack,
		"card":  card,
	}, nil
}

func (s *Service) cmdTaskAddModifier(state *State, args map[string]any) (any, error) {
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
	ensureTaskFaceCard(state, stack)

	return map[string]any{
		"stack":    stack,
		"modifier": modCard,
	}, nil
}

func cmdTaskAssignVillager(state *State, args map[string]any) (any, error) {
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
	if err := state.MergeStacks(taskStackID, villagerStackID); err != nil {
		return nil, err
	}
	ensureTaskFaceCard(state, taskStack)

	assignedVillagerID := taskStackID
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
		ensureTaskFaceCard(state, zombieStack)
	}

	if targetStackID == zombieStackID && zombieStackID != villagerStackID {
		villagerStack.Pos = origin
	}

	rewardType, rewardAmount := s.zombieClearReward()
	meta.Inventory[rewardType] += rewardAmount
	meta.Metrics["zombies_cleared"]++
	meta.Metrics["overrun_level"] = countZombieStacks(state)

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
			"id":       actualVillagerID,
			"xp":       updatedVillager.XP,
			"level":    updatedVillager.Level,
			"perks":    append([]string{}, updatedVillager.Perks...),
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
		ensureResourceFaceCard(state, resourceStack)
	}

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

	dropDefID := resourceDropDefID(resourceCard.DefID)
	dropStack := createSingleCardStack(state, dropDefID, Point{
		X: resourceStack.Pos.X + 98,
		Y: resourceStack.Pos.Y + 28,
	}, map[string]any{"amount": 1})

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
		"createdStacks":            []*Stack{dropStack},
		"villagerProgress": map[string]any{
			"id":       actualVillagerID,
			"xp":       updatedVillager.XP,
			"level":    updatedVillager.Level,
			"perks":    append([]string{}, updatedVillager.Perks...),
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

	restore := s.staminaRestoreForFood(foodCard.DefID)
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
	return state.CreateStack(pos, []string{card.ID})
}

func topCard(state *State, stack *Stack) *Card {
	if state == nil || stack == nil || len(stack.Cards) == 0 {
		return nil
	}
	return state.GetCard(stack.Cards[len(stack.Cards)-1])
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

func ensureTaskFaceCard(state *State, stack *Stack) {
	if state == nil || stack == nil || len(stack.Cards) <= 1 {
		return
	}

	taskIndex := -1
	for i := len(stack.Cards) - 1; i >= 0; i-- {
		card := state.GetCard(stack.Cards[i])
		if card == nil {
			continue
		}
		if cardKind(card.DefID) == "task" {
			taskIndex = i
			break
		}
	}
	if taskIndex < 0 || taskIndex == len(stack.Cards)-1 {
		return
	}

	taskCardID := stack.Cards[taskIndex]
	stack.Cards = append(stack.Cards[:taskIndex], stack.Cards[taskIndex+1:]...)
	stack.Cards = append(stack.Cards, taskCardID)
}

func ensureResourceFaceCard(state *State, stack *Stack) {
	if state == nil || stack == nil || len(stack.Cards) <= 1 {
		return
	}

	resourceIndex := -1
	for i := len(stack.Cards) - 1; i >= 0; i-- {
		card := state.GetCard(stack.Cards[i])
		if card == nil {
			continue
		}
		if cardKind(card.DefID) == "resource" {
			resourceIndex = i
			break
		}
	}
	if resourceIndex < 0 || resourceIndex == len(stack.Cards)-1 {
		return
	}

	resourceCardID := stack.Cards[resourceIndex]
	stack.Cards = append(stack.Cards[:resourceIndex], stack.Cards[resourceIndex+1:]...)
	stack.Cards = append(stack.Cards, resourceCardID)
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
	return mods
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

func ensureMeta(state *State) *BoardMeta {
	if state == nil {
		return &BoardMeta{
			Inventory: map[string]int{},
			Villagers: map[string]*VillagerProgress{},
			Metrics:   map[string]int{},
			DeckOpen:  map[string]int{},
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
		if card.Data != nil {
			if id, ok := card.Data["villagerId"].(string); ok && strings.TrimSpace(id) != "" {
				return strings.TrimSpace(id)
			}
		}
		return stack.ID
	}
	return ""
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
	if len(s.cfg.Villagers.Leveling.PerkPool) > 0 {
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
	} else {
		for lvl := progress.Level + 1; lvl <= newLevel; lvl++ {
			if perkID := perkForLevel(lvl); perkID != "" && !villagerHasPerk(progress, perkID) {
				progress.Perks = append(progress.Perks, perkID)
				newPerks = append(newPerks, perkID)
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

func (s *Service) taskCompleteXP(completedCount int) int {
	baseXP := s.cfg.Villagers.Leveling.XPSources.CompleteTask.BaseXP
	if baseXP <= 0 {
		baseXP = 1
	}
	if completedCount <= 0 {
		completedCount = 1
	}
	total := baseXP * completedCount
	if total < 0 {
		return 0
	}
	return total
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

func (s *Service) zombieClearReward() (string, int) {
	if len(s.cfg.Zombies.Types) > 0 {
		return s.cfg.RewardFromPool(s.cfg.Zombies.Types[0].Cleanup.RewardOnClear.RNGPool, "coin", 1)
	}
	return "coin", 1
}

func (s *Service) taskDueGraceHours() int {
	grace := s.cfg.Tasks.DueDate.GraceHours
	if grace < 0 {
		return 0
	}
	return grace
}

func perkForLevel(level int) string {
	switch level {
	case 2:
		return "perk_stamina_plus_1"
	case 3:
		return "perk_zombie_slayer"
	default:
		return ""
	}
}

func (s *Service) staminaRestoreForFood(foodDefID string) int {
	foodID := strings.TrimSpace(strings.TrimPrefix(foodDefID, "food."))
	if item := s.cfg.FoodByID(foodID); item != nil && item.StaminaRestore > 0 {
		return item.StaminaRestore
	}
	switch strings.TrimSpace(foodDefID) {
	case "food.bread":
		return 3
	case "food.berries", "food.berry":
		return 2
	default:
		return 1
	}
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
