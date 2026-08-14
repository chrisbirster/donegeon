package board

import (
	"context"
	"fmt"
	"math"
	"strings"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/task"
)

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
