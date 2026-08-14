package board

import (
	"context"
	"fmt"
	"math/rand"
	"sort"
	"strings"
)

func instantiateQuest(meta *BoardMeta, def questDefinition, day int, week int) *QuestRuntime {
	questID := strings.TrimSpace(def.ID)
	if questID == "" {
		questID = fmt.Sprintf("quest_day_%d_week_%d", day, week)
	}
	templateID := strings.TrimSpace(def.TemplateID)
	if templateID == "" {
		templateID = questID
	}
	questDay := def.Day
	if questDay <= 0 {
		questDay = day
	}
	questWeek := def.Week
	if questWeek <= 0 {
		questWeek = week
	}
	if normalizeQuestOp(def.Type) == questTypeDaily {
		questID = fmt.Sprintf("%s::day%d", templateID, day)
	}

	objectives := make([]QuestObjectiveState, 0, len(def.Objectives))
	for _, objective := range def.Objectives {
		target := objective.Count
		if target <= 0 {
			target = objective.Value
		}
		if target <= 0 {
			target = 1
		}

		op := normalizeQuestOp(objective.Op)
		ref := normalizeQuestRef(objective.Ref)
		baseline := 0
		if isCounterObjective(op) {
			baseline = questMetricValue(meta, op, ref)
		}

		objectives = append(objectives, QuestObjectiveState{
			Op:         op,
			Count:      objective.Count,
			Value:      objective.Value,
			Ref:        ref,
			TimeWindow: strings.TrimSpace(objective.TimeWindow),
			Baseline:   baseline,
			Target:     target,
		})
	}

	rewards := make([]QuestRewardState, 0, len(def.Rewards))
	for _, reward := range def.Rewards {
		cardCount := reward.CardCount
		if cardCount <= 0 {
			cardCount = 1
		}
		rewards = append(rewards, QuestRewardState{
			Kind:       normalizeQuestOp(reward.Kind),
			Currency:   strings.TrimSpace(strings.ToLower(reward.Currency)),
			Amount:     reward.Amount,
			TableID:    strings.TrimSpace(strings.ToLower(reward.TableID)),
			CardType:   strings.TrimSpace(strings.ToLower(reward.CardType)),
			CardCount:  cardCount,
			CardCharge: reward.CardUsage,
			XP:         reward.XP,
		})
	}

	unlocks := make([]QuestUnlockState, 0, len(def.Unlocks))
	for _, unlock := range def.Unlocks {
		kind := strings.TrimSpace(strings.ToLower(unlock.Kind))
		id := strings.TrimSpace(unlock.ID)
		if kind == "" || id == "" {
			continue
		}
		unlocks = append(unlocks, QuestUnlockState{Kind: kind, ID: id})
	}

	consequences := make([]QuestConsequenceState, 0, len(def.Consequences))
	for _, consequence := range def.Consequences {
		kind := strings.TrimSpace(strings.ToLower(consequence.Kind))
		if kind == "" {
			continue
		}
		consequences = append(consequences, QuestConsequenceState{
			Kind:         kind,
			Amount:       consequence.Amount,
			DurationDays: consequence.DurationDays,
		})
	}

	return &QuestRuntime{
		ID:                 questID,
		TemplateID:         templateID,
		Title:              strings.TrimSpace(def.Title),
		Type:               normalizeQuestOp(def.Type),
		Scope:              strings.TrimSpace(strings.ToLower(def.Scope)),
		Day:                questDay,
		Week:               questWeek,
		HowToComplete:      strings.TrimSpace(def.HowToComplete),
		DefinitionOfDone:   strings.TrimSpace(def.DefinitionOfDone),
		AcceptanceCriteria: append([]string(nil), def.AcceptanceCriteria...),
		Objectives:         objectives,
		Rewards:            rewards,
		Unlocks:            unlocks,
		Consequences:       consequences,
	}
}

func archiveQuest(quests *QuestState, quest *QuestRuntime, failed bool) {
	if quests == nil || quest == nil {
		return
	}
	entry := QuestHistoryEntry{
		ID:                 quest.ID,
		TemplateID:         quest.TemplateID,
		Title:              quest.Title,
		Type:               quest.Type,
		Scope:              quest.Scope,
		Day:                quest.Day,
		Week:               quest.Week,
		HowToComplete:      quest.HowToComplete,
		DefinitionOfDone:   quest.DefinitionOfDone,
		AcceptanceCriteria: append([]string(nil), quest.AcceptanceCriteria...),
		Completed:          quest.Completed,
		Claimed:            quest.Claimed,
		Failed:             failed || quest.Failed,
		CompletedDay:       quest.CompletedDay,
		ClaimedDay:         quest.ClaimedDay,
	}
	quests.History = append(quests.History, entry)
}

func removeActiveQuestAt(quests *QuestState, index int) *QuestRuntime {
	if quests == nil || index < 0 || index >= len(quests.Active) {
		return nil
	}
	item := quests.Active[index]
	quests.Active = append(quests.Active[:index], quests.Active[index+1:]...)
	return item
}

func sortActiveQuests(quests *QuestState) {
	if quests == nil || len(quests.Active) <= 1 {
		return
	}
	weight := func(value string) int {
		switch normalizeQuestOp(value) {
		case questTypeFailure:
			return 0
		case questTypeBoss:
			return 1
		case questTypeSeasonal:
			return 2
		case questTypeStory:
			return 3
		case questTypeDaily:
			return 4
		default:
			return 10
		}
	}
	sort.SliceStable(quests.Active, func(i, j int) bool {
		left := quests.Active[i]
		right := quests.Active[j]
		if left == nil || right == nil {
			return left != nil
		}
		lw := weight(left.Type)
		rw := weight(right.Type)
		if lw != rw {
			return lw < rw
		}
		if left.Week != right.Week {
			return left.Week < right.Week
		}
		if left.Day != right.Day {
			return left.Day < right.Day
		}
		return left.ID < right.ID
	})
}

func drawDailyQuestTemplates(quests *QuestState, day int, catalog QuestCatalog) []questDefinition {
	pool := questDailyTemplates(catalog)
	if len(pool) == 0 {
		return nil
	}

	rng := rand.New(rand.NewSource(deterministicQuestSeed(
		fmt.Sprintf("daily:%d", day),
		fmt.Sprintf("history:%d", len(quests.History)),
	)))

	blocked := map[string]struct{}{}
	for _, id := range quests.RecentDailyTemplateIDs {
		if id == "" {
			continue
		}
		blocked[id] = struct{}{}
	}

	candidates := make([]questDefinition, 0, len(pool))
	for _, item := range pool {
		if _, ok := blocked[item.TemplateID]; ok {
			continue
		}
		candidates = append(candidates, item)
	}
	if len(candidates) < maxInt(catalog.DailyDrawCount, 1) {
		candidates = append([]questDefinition(nil), pool...)
	}

	rng.Shuffle(len(candidates), func(i int, j int) {
		candidates[i], candidates[j] = candidates[j], candidates[i]
	})

	selected := make([]questDefinition, 0, maxInt(catalog.DailyDrawCount, 1))
	seen := map[string]struct{}{}
	for _, item := range candidates {
		if _, ok := seen[item.TemplateID]; ok {
			continue
		}
		seen[item.TemplateID] = struct{}{}
		selected = append(selected, item)
		if len(selected) >= maxInt(catalog.DailyDrawCount, 1) {
			break
		}
	}

	if len(selected) == 0 && len(pool) > 0 {
		selected = append(selected, pool[0])
	}
	return selected
}

func (s *Service) countOpenBacklogTasks(ctx context.Context) (int, error) {
	if s == nil || s.tasks == nil {
		return 0, nil
	}
	items, err := listAllTasks(ctx, s.tasks)
	if err != nil {
		return 0, err
	}
	open := 0
	for _, item := range items {
		if item.Checked || item.IsDeleted {
			continue
		}
		open++
	}
	return open, nil
}

func (s *Service) refreshQuestState(ctx context.Context, state *State) error {
	meta := ensureMeta(state)
	quests := ensureQuestState(meta)
	catalog := s.quests
	dailyDrawCount := maxInt(catalog.DailyDrawCount, 1)
	dailyFailureWindow := maxInt(catalog.DailyNoRepeatDays, 1) * dailyDrawCount

	day := questCurrentDay(meta)
	week := questCurrentWeek(day)
	quests.CurrentDay = day
	quests.CurrentWeek = week

	if quests.LastDailyRefreshDay != day {
		remaining := make([]*QuestRuntime, 0, len(quests.Active))
		for _, item := range quests.Active {
			if item == nil {
				continue
			}
			if item.Type == questTypeDaily && item.Day != day {
				archiveQuest(quests, item, !item.Claimed)
				continue
			}
			remaining = append(remaining, item)
		}
		quests.Active = remaining

		selected := drawDailyQuestTemplates(quests, day, catalog)
		drawnTemplateIDs := make([]string, 0, len(selected))
		for _, daily := range selected {
			instance := instantiateQuest(meta, daily, day, week)
			if instance == nil {
				continue
			}
			if hasQuest(quests, instance.ID) {
				continue
			}
			drawnTemplateIDs = append(drawnTemplateIDs, instance.TemplateID)
			quests.Active = append(quests.Active, instance)
		}
		if len(drawnTemplateIDs) > 0 {
			next := append([]string{}, drawnTemplateIDs...)
			next = append(next, quests.RecentDailyTemplateIDs...)
			if len(next) > dailyFailureWindow {
				next = next[:dailyFailureWindow]
			}
			quests.RecentDailyTemplateIDs = next
		}
		quests.LastDailyRefreshDay = day
	}

	story := questStoryDefinitionForWeek(week, catalog)
	if !hasQuest(quests, story.ID) {
		quests.Active = append(quests.Active, instantiateQuest(meta, story, day, week))
	}

	if boss, ok := catalog.BossesByWeek[week]; ok && !hasQuest(quests, boss.ID) {
		quests.Active = append(quests.Active, instantiateQuest(meta, boss, day, week))
	}

	zombieCount := countZombieStacks(state)
	if zombieCount >= 3 {
		failureID := fmt.Sprintf("FQ_DeadRise_W%02d", week)
		if !hasQuest(quests, failureID) {
			failure := questDefinition{
				ID:    failureID,
				Title: "Failure Quest: The Dead Rise",
				Type:  questTypeFailure,
				Scope: "dynamic",
				Week:  week,
				Day:   day,
				Objectives: []questObjectiveSpec{
					{Op: "clear_zombie", Count: 3, TimeWindow: "this_week"},
				},
				Rewards: []questRewardSpec{
					{Kind: "currency", Currency: "coin", Amount: 25},
				},
			}
			quests.Active = append(quests.Active, instantiateQuest(meta, failure, day, week))
		}
	}

	needBacklog := false
	for _, quest := range quests.Active {
		if quest == nil {
			continue
		}
		for _, objective := range quest.Objectives {
			if normalizeQuestOp(objective.Op) == "reduce_backlog_to" {
				needBacklog = true
				break
			}
		}
	}

	backlog := 0
	if needBacklog {
		value, err := s.countOpenBacklogTasks(ctx)
		if err != nil {
			return err
		}
		backlog = value
	}

	for _, quest := range quests.Active {
		if quest == nil || quest.Claimed {
			continue
		}
		allComplete := true
		for idx := range quest.Objectives {
			objective := &quest.Objectives[idx]
			op := normalizeQuestOp(objective.Op)
			if objective.Target <= 0 {
				target := objective.Count
				if target <= 0 {
					target = objective.Value
				}
				if target <= 0 {
					target = 1
				}
				objective.Target = target
			}
			switch op {
			case "reduce_backlog_to":
				objective.Current = backlog
				objective.Complete = backlog <= maxInt(objective.Target, 0)
			case "keep_zombies_below":
				objective.Current = zombieCount
				objective.Complete = zombieCount <= maxInt(objective.Target, 0)
			default:
				total := questMetricValue(meta, op, objective.Ref)
				if total < objective.Baseline {
					objective.Baseline = total
				}
				objective.Current = maxInt(total-objective.Baseline, 0)
				objective.Complete = objective.Current >= objective.Target
			}
			if !objective.Complete {
				allComplete = false
			}
		}
		if allComplete && !quest.Completed {
			quest.Completed = true
			quest.Claimable = true
			quest.CompletedDay = day
		}
	}

	sortActiveQuests(quests)
	return nil
}
