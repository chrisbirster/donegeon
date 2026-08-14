package board

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"donegeon/internal/task"
)

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
