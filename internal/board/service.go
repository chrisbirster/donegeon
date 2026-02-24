package board

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"sync"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/task"
)

const DefaultBoardID = "default"

var boardIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

type TaskService interface {
	Create(context.Context, task.CreateInput) (task.Task, error)
	Update(context.Context, string, task.UpdateInput) (task.Task, error)
	Close(context.Context, string) error
}

type Service struct {
	repo  *Repository
	tasks TaskService
	mu    sync.Mutex
}

type StateResponse struct {
	Stacks  map[string]*Stack `json:"stacks"`
	Cards   map[string]*Card  `json:"cards"`
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

func NewService(repo *Repository, tasks TaskService) *Service {
	return &Service{
		repo:  repo,
		tasks: tasks,
	}
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

func (s *Service) executeCommand(ctx context.Context, state *State, cmd string, args map[string]any) (any, error) {
	switch cmd {
	case "stack.move":
		return cmdStackMove(state, args)
	case "stack.bringToFront":
		return cmdStackBringToFront(state, args)
	case "stack.merge":
		return cmdStackMerge(state, args)
	case "stack.split":
		return cmdStackSplit(state, args)
	case "stack.unstack":
		return cmdStackUnstack(state, args)
	case "stack.remove":
		return cmdStackRemove(state, args)
	case "task.create_blank":
		return s.cmdTaskCreateBlank(ctx, state, args)
	case "task.set_title":
		return s.cmdTaskSetTitle(ctx, state, args)
	case "task.set_description":
		return s.cmdTaskSetDescription(ctx, state, args)
	case "task.set_task_id":
		return cmdTaskSetTaskID(state, args)
	case "task.complete_stack":
		return s.cmdTaskCompleteStack(ctx, state, args)
	case "task.complete_by_task_id":
		return s.cmdTaskCompleteByTaskID(ctx, state, args)
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

func cmdStackMerge(state *State, args map[string]any) (any, error) {
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
	if err := state.MergeStacks(targetID, sourceID); err != nil {
		return nil, err
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

	return map[string]any{
		"removedStack":      stackID,
		"removedCards":      removedCards,
		"createdStacks":     createdStacks,
		"completedTaskIds":  completedTaskIDs,
		"completionByStack": true,
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

	return map[string]any{
		"completedTaskId": taskID,
		"mode":            "repo_only",
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
