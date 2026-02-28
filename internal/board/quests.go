package board

import (
	"context"
	"fmt"
	"hash/fnv"
	"math/rand"
	"sort"
	"strings"
)

const (
	questTypeDaily    = "daily"
	questTypeStory    = "story"
	questTypeSeasonal = "seasonal"
	questTypeBoss     = "boss"
	questTypeFailure  = "failure"
)

type questObjectiveSpec struct {
	Op         string `yaml:"op"`
	Count      int    `yaml:"count,omitempty"`
	Value      int    `yaml:"value,omitempty"`
	Ref        string `yaml:"ref,omitempty"`
	TimeWindow string `yaml:"time_window,omitempty"`
}

type questRewardSpec struct {
	Kind      string `yaml:"kind"`
	Currency  string `yaml:"currency,omitempty"`
	Amount    int    `yaml:"amount,omitempty"`
	TableID   string `yaml:"table_id,omitempty"`
	CardType  string `yaml:"card_type,omitempty"`
	CardCount int    `yaml:"card_count,omitempty"`
	CardUsage int    `yaml:"card_usage,omitempty"`
	XP        int    `yaml:"xp,omitempty"`
}

type questUnlockSpec struct {
	Kind string `yaml:"kind"`
	ID   string `yaml:"id"`
}

type questConsequenceSpec struct {
	Kind         string `yaml:"kind"`
	Amount       int    `yaml:"amount,omitempty"`
	DurationDays int    `yaml:"duration_days,omitempty"`
}

type questDefinition struct {
	ID                 string                 `yaml:"id"`
	TemplateID         string                 `yaml:"template_id,omitempty"`
	Title              string                 `yaml:"title"`
	Type               string                 `yaml:"type"`
	Scope              string                 `yaml:"scope"`
	Week               int                    `yaml:"week,omitempty"`
	Day                int                    `yaml:"day,omitempty"`
	HowToComplete      string                 `yaml:"how_to_complete,omitempty"`
	DefinitionOfDone   string                 `yaml:"definition_of_done,omitempty"`
	AcceptanceCriteria []string               `yaml:"acceptance_criteria,omitempty"`
	Objectives         []questObjectiveSpec   `yaml:"objectives,omitempty"`
	Rewards            []questRewardSpec      `yaml:"rewards,omitempty"`
	Unlocks            []questUnlockSpec      `yaml:"unlocks,omitempty"`
	Consequences       []questConsequenceSpec `yaml:"consequences,omitempty"`
}

type questRewardTable struct {
	ID      string                  `yaml:"id"`
	Rolls   int                     `yaml:"rolls"`
	Entries []questRewardTableEntry `yaml:"entries"`
}

type questRewardTableEntry struct {
	Weight int             `yaml:"weight"`
	Reward questRewardSpec `yaml:"reward"`
}

type questDefinitionLabel struct {
	ID    string `yaml:"id"`
	Title string `yaml:"title"`
}

const (
	questDailyDrawCount    = 2
	questDailyNoRepeatDays = 2
)

var questStoryLabelsByWeek = map[int]questDefinitionLabel{
	1:  {ID: "W01_Awakening", Title: "Awakening"},
	2:  {ID: "W02_InboxToProject", Title: "Inbox to Project"},
	3:  {ID: "W03_ModifiersAppear", Title: "Modifiers Appear"},
	4:  {ID: "W04_RecurringBasics", Title: "Recurring Basics"},
	5:  {ID: "W05_Deadlines", Title: "Deadlines"},
	8:  {ID: "W08_StaminaMatters", Title: "Stamina Matters"},
	13: {ID: "W13_SpringFinale", Title: "Spring Finale"},
	14: {ID: "W14_SummerKickoff", Title: "Summer Kickoff: Momentum"},
	26: {ID: "W26_SummerFinale", Title: "Summer Finale: Momentum Bank"},
	27: {ID: "W27_AutumnKickoff", Title: "Autumn Kickoff: Systems"},
	39: {ID: "W39_AutumnFinale", Title: "Autumn Finale: Complexity Tamed"},
	40: {ID: "W40_WinterKickoff", Title: "Winter Kickoff: Mastery"},
	43: {ID: "W43_AutomationFirstRule", Title: "Automation: First Rule"},
	52: {ID: "W52_YearEnd", Title: "Year End: The Eternal Backlog"},
}

var questBossByWeek = map[int]questDefinition{
	1: {
		ID:    "B01_BacklogSeed",
		Title: "Boss: The Backlog Seed",
		Type:  questTypeBoss,
		Scope: "week",
		Week:  1,
		Objectives: []questObjectiveSpec{
			{Op: "complete_task", Count: 3, TimeWindow: "this_week"},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "boss_big"},
		},
		Consequences: []questConsequenceSpec{
			{Kind: "spawn_zombie", Amount: 1},
		},
	},
	4: {
		ID:    "B02_FirstCleanup",
		Title: "Boss: First Cleanup",
		Type:  questTypeBoss,
		Scope: "week",
		Week:  4,
		Objectives: []questObjectiveSpec{
			{Op: "keep_zombies_below", Value: 1, TimeWindow: "this_week"},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "boss_big"},
		},
		Consequences: []questConsequenceSpec{
			{Kind: "spawn_zombie", Amount: 1},
		},
	},
	8: {
		ID:    "B03_StaminaCheck",
		Title: "Boss: Stamina Check",
		Type:  questTypeBoss,
		Scope: "week",
		Week:  8,
		Objectives: []questObjectiveSpec{
			{Op: "complete_task", Count: 10, TimeWindow: "this_week"},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "boss_big"},
		},
		Consequences: []questConsequenceSpec{
			{Kind: "apply_villager_tired", Amount: 1, DurationDays: 2},
		},
	},
	13: {
		ID:    "B04_Overgrowth",
		Title: "Season Boss: The Overgrowth",
		Type:  questTypeBoss,
		Scope: "week",
		Week:  13,
		Objectives: []questObjectiveSpec{
			{Op: "keep_zombies_below", Value: 2, TimeWindow: "this_week"},
			{Op: "reduce_backlog_to", Value: 3, TimeWindow: "this_week"},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "boss_big"},
		},
		Consequences: []questConsequenceSpec{
			{Kind: "spawn_zombie", Amount: 2},
			{Kind: "increase_pack_cost", Amount: 1, DurationDays: 7},
		},
	},
	17: {
		ID:    "B05_BurnoutHydra",
		Title: "Boss: The Burnout Hydra",
		Type:  questTypeBoss,
		Scope: "week",
		Week:  17,
		Objectives: []questObjectiveSpec{
			{Op: "complete_task", Count: 12, TimeWindow: "this_week"},
			{Op: "keep_zombies_below", Value: 2, TimeWindow: "this_week"},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "boss_big"},
		},
		Consequences: []questConsequenceSpec{
			{Kind: "apply_villager_tired", Amount: 1, DurationDays: 3},
		},
	},
	26: {
		ID:    "B06_MomentumBoss",
		Title: "Season Boss: Momentum Bank",
		Type:  questTypeBoss,
		Scope: "week",
		Week:  26,
		Objectives: []questObjectiveSpec{
			{Op: "keep_zombies_below", Value: 2, TimeWindow: "this_week"},
			{Op: "complete_task", Count: 15, TimeWindow: "this_week"},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "boss_big"},
		},
		Consequences: []questConsequenceSpec{
			{Kind: "spawn_zombie", Amount: 2},
		},
	},
	39: {
		ID:    "B07_EntropyEngine",
		Title: "Season Boss: The Entropy Engine",
		Type:  questTypeBoss,
		Scope: "week",
		Week:  39,
		Objectives: []questObjectiveSpec{
			{Op: "complete_task", Count: 12, TimeWindow: "this_week"},
			{Op: "keep_zombies_below", Value: 2, TimeWindow: "this_week"},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "boss_big"},
		},
		Consequences: []questConsequenceSpec{
			{Kind: "disable_blueprint_drops_temporarily", DurationDays: 7},
		},
	},
	52: {
		ID:    "B08_EternalBacklog",
		Title: "Final Boss: The Eternal Backlog",
		Type:  questTypeBoss,
		Scope: "week",
		Week:  52,
		Objectives: []questObjectiveSpec{
			{Op: "complete_task", Count: 20, TimeWindow: "this_week"},
			{Op: "keep_zombies_below", Value: 2, TimeWindow: "this_week"},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "boss_big"},
		},
		Consequences: []questConsequenceSpec{
			{Kind: "spawn_zombie", Amount: 2},
			{Kind: "increase_pack_cost", Amount: 1, DurationDays: 7},
		},
	},
}

var questRewardTables = map[string]questRewardTable{
	"daily_small": {
		ID:    "daily_small",
		Rolls: 1,
		Entries: []questRewardTableEntry{
			{Weight: 40, Reward: questRewardSpec{Kind: "currency", Currency: "coin", Amount: 10}},
			{Weight: 20, Reward: questRewardSpec{Kind: "card", CardType: "paper_card", CardCount: 1}},
			{Weight: 20, Reward: questRewardSpec{Kind: "card", CardType: "ink_card", CardCount: 1}},
			{Weight: 15, Reward: questRewardSpec{Kind: "card", CardType: "coin_card", CardCount: 1}},
			{Weight: 5, Reward: questRewardSpec{Kind: "card", CardType: "blank_task", CardCount: 1}},
		},
	},
	"weekly_story": {
		ID:    "weekly_story",
		Rolls: 1,
		Entries: []questRewardTableEntry{
			{Weight: 30, Reward: questRewardSpec{Kind: "currency", Currency: "coin", Amount: 50}},
			{Weight: 20, Reward: questRewardSpec{Kind: "card", CardType: "recurring_contract", CardCount: 1, CardUsage: 4}},
			{Weight: 15, Reward: questRewardSpec{Kind: "card", CardType: "deadline_pin", CardCount: 1}},
			{Weight: 15, Reward: questRewardSpec{Kind: "card", CardType: "schedule_token", CardCount: 1, CardUsage: 2}},
			{Weight: 10, Reward: questRewardSpec{Kind: "card", CardType: "villager", CardCount: 1}},
			{Weight: 10, Reward: questRewardSpec{Kind: "card", CardType: "blueprint_shard", CardCount: 1}},
		},
	},
	"boss_big": {
		ID:    "boss_big",
		Rolls: 2,
		Entries: []questRewardTableEntry{
			{Weight: 35, Reward: questRewardSpec{Kind: "currency", Currency: "coin", Amount: 150}},
			{Weight: 20, Reward: questRewardSpec{Kind: "card", CardType: "villager", CardCount: 1}},
			{Weight: 20, Reward: questRewardSpec{Kind: "card", CardType: "blueprint_shard", CardCount: 2}},
			{Weight: 15, Reward: questRewardSpec{Kind: "card", CardType: "recurring_contract", CardCount: 2, CardUsage: 4}},
			{Weight: 10, Reward: questRewardSpec{Kind: "card", CardType: "integration_core_part", CardCount: 1}},
		},
	},
}

func ensureQuestState(meta *BoardMeta) *QuestState {
	if meta == nil {
		return &QuestState{
			RecentDailyTemplateIDs: []string{},
			Active:                 []*QuestRuntime{},
			History:                []QuestHistoryEntry{},
			Unlocked:               []QuestUnlockState{},
		}
	}
	if meta.Quests == nil {
		meta.Quests = &QuestState{
			RecentDailyTemplateIDs: []string{},
			Active:                 []*QuestRuntime{},
			History:                []QuestHistoryEntry{},
			Unlocked:               []QuestUnlockState{},
		}
	}
	if meta.Quests.RecentDailyTemplateIDs == nil {
		meta.Quests.RecentDailyTemplateIDs = []string{}
	}
	if meta.Quests.Active == nil {
		meta.Quests.Active = []*QuestRuntime{}
	}
	if meta.Quests.History == nil {
		meta.Quests.History = []QuestHistoryEntry{}
	}
	if meta.Quests.Unlocked == nil {
		meta.Quests.Unlocked = []QuestUnlockState{}
	}
	return meta.Quests
}

func questCurrentDay(meta *BoardMeta) int {
	if meta == nil {
		return 1
	}
	day := meta.DayTickCount + 1
	if day < 1 {
		day = 1
	}
	return day
}

func questCurrentWeek(day int) int {
	if day <= 0 {
		return 1
	}
	return ((day - 1) / 7) + 1
}

func questSeasonForWeek(week int) string {
	switch {
	case week <= 13:
		return "spring"
	case week <= 26:
		return "summer"
	case week <= 39:
		return "autumn"
	default:
		return "winter"
	}
}

func questStoryDefinitionForWeek(week int, catalog QuestCatalog) questDefinition {
	label := questDefinitionLabel{
		ID:    fmt.Sprintf("W%02d_Story", week),
		Title: fmt.Sprintf("Week %02d Story Quest", week),
	}
	if provided, ok := catalog.StoryLabelsByWeek[week]; ok {
		label = provided
	}

	questType := questTypeStory
	if week == 1 || week == 14 || week == 27 || week == 40 || week == 13 || week == 26 || week == 39 || week == 52 {
		questType = questTypeSeasonal
	}

	def := questDefinition{
		ID:    label.ID,
		Title: label.Title,
		Type:  questType,
		Scope: "week",
		Week:  week,
		Objectives: []questObjectiveSpec{
			{
				Op:         "complete_task",
				Count:      maxInt(3+(week/2), 1),
				TimeWindow: "this_week",
			},
		},
		Rewards: []questRewardSpec{
			{Kind: "roll_table", TableID: "weekly_story"},
		},
		HowToComplete:    "Complete the listed weekly objective(s) on your board.",
		DefinitionOfDone: "All story quest objectives reach their target this week.",
	}

	if override, ok := catalog.StoryOverridesByWeek[week]; ok {
		def = mergeQuestDefinition(def, override)
	}

	return def
}

func mergeQuestDefinition(base questDefinition, override questDefinition) questDefinition {
	merged := copyQuestDefinition(base)
	if strings.TrimSpace(override.ID) != "" {
		merged.ID = strings.TrimSpace(override.ID)
	}
	if strings.TrimSpace(override.TemplateID) != "" {
		merged.TemplateID = strings.TrimSpace(override.TemplateID)
	}
	if strings.TrimSpace(override.Title) != "" {
		merged.Title = strings.TrimSpace(override.Title)
	}
	if strings.TrimSpace(override.Type) != "" {
		merged.Type = strings.TrimSpace(override.Type)
	}
	if strings.TrimSpace(override.Scope) != "" {
		merged.Scope = strings.TrimSpace(override.Scope)
	}
	if override.Week > 0 {
		merged.Week = override.Week
	}
	if override.Day > 0 {
		merged.Day = override.Day
	}
	if strings.TrimSpace(override.HowToComplete) != "" {
		merged.HowToComplete = strings.TrimSpace(override.HowToComplete)
	}
	if strings.TrimSpace(override.DefinitionOfDone) != "" {
		merged.DefinitionOfDone = strings.TrimSpace(override.DefinitionOfDone)
	}
	if len(override.AcceptanceCriteria) > 0 {
		merged.AcceptanceCriteria = append([]string(nil), override.AcceptanceCriteria...)
	}
	if len(override.Objectives) > 0 {
		merged.Objectives = append([]questObjectiveSpec(nil), override.Objectives...)
	}
	if len(override.Rewards) > 0 {
		merged.Rewards = append([]questRewardSpec(nil), override.Rewards...)
	}
	if len(override.Unlocks) > 0 {
		merged.Unlocks = append([]questUnlockSpec(nil), override.Unlocks...)
	}
	if len(override.Consequences) > 0 {
		merged.Consequences = append([]questConsequenceSpec(nil), override.Consequences...)
	}
	return merged
}

func legacyQuestDailyTemplates() []questDefinition {
	return []questDefinition{
		{
			ID:               "DQ_CompleteAny",
			TemplateID:       "DQ_CompleteAny",
			Title:            "Do Something",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "Mark any one open task as done.",
			DefinitionOfDone: "complete_task progress reaches 1 for today's quest window.",
			AcceptanceCriteria: []string{
				"Complete one task after today's daily quests are drawn.",
				"Progress increments from board quest metric quest.complete_task.",
			},
			Objectives: []questObjectiveSpec{
				{Op: "complete_task", Count: 1, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
		{
			ID:               "DQ_ProcessInbox",
			TemplateID:       "DQ_ProcessInbox",
			Title:            "Process the Inbox",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "From Tasks view, activate tasks onto the board using 'Make Live on Board'.",
			DefinitionOfDone: "process_inbox_count progress reaches 3 during today's quest window.",
			AcceptanceCriteria: []string{
				"Each successful board activation (task.activate) increments progress by 1.",
				"Quest completes when process_inbox_count current >= 3.",
			},
			Objectives: []questObjectiveSpec{
				{Op: "process_inbox_count", Count: 3, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
		{
			ID:               "DQ_AssignVillager",
			TemplateID:       "DQ_AssignVillager",
			Title:            "Put Someone to Work",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "Stack a villager card onto a task stack.",
			DefinitionOfDone: "assign_villager progress reaches 1 for today's quest window.",
			AcceptanceCriteria: []string{
				"Any valid villager-to-task assignment increments progress by 1.",
			},
			Objectives: []questObjectiveSpec{
				{Op: "assign_villager", Count: 1, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
		{
			ID:               "DQ_KeepZombiesLow",
			TemplateID:       "DQ_KeepZombiesLow",
			Title:            "Keep the Dead Quiet",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "End the day with no more than one zombie on board.",
			DefinitionOfDone: "keep_zombies_below objective evaluates true (zombies <= 1).",
			AcceptanceCriteria: []string{
				"Objective remains complete while zombie stack count is 0 or 1.",
			},
			Objectives: []questObjectiveSpec{
				{Op: "keep_zombies_below", Value: 1, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
	}
}

func questDailyTemplates(catalog QuestCatalog) []questDefinition {
	return copyQuestDefinitions(catalog.DailyTemplates)
}

func normalizeQuestOp(op string) string {
	return strings.ToLower(strings.TrimSpace(op))
}

func normalizeQuestRef(ref string) string {
	normalized := strings.ToLower(strings.TrimSpace(ref))
	normalized = strings.ReplaceAll(normalized, "_", ".")
	return normalized
}

func questMetricBaseKey(op string) string {
	normalized := normalizeQuestOp(op)
	if normalized == "" {
		return ""
	}
	return "quest." + normalized
}

func questMetricKey(op string, ref string) string {
	base := questMetricBaseKey(op)
	ref = normalizeQuestRef(ref)
	if base == "" || ref == "" {
		return base
	}
	return base + "::" + ref
}

func incrementQuestMetric(meta *BoardMeta, op string, ref string, delta int) {
	if meta == nil || delta == 0 {
		return
	}
	if meta.Metrics == nil {
		meta.Metrics = map[string]int{}
	}
	base := questMetricBaseKey(op)
	if base == "" {
		return
	}
	meta.Metrics[base] += delta
	refKey := questMetricKey(op, ref)
	if refKey != "" && refKey != base {
		meta.Metrics[refKey] += delta
	}
}

func questMetricValue(meta *BoardMeta, op string, ref string) int {
	if meta == nil || meta.Metrics == nil {
		return 0
	}
	key := questMetricKey(op, ref)
	if key == "" {
		return 0
	}
	if normalizeQuestRef(ref) != "" {
		return meta.Metrics[key]
	}
	return meta.Metrics[questMetricBaseKey(op)]
}

func isCounterObjective(op string) bool {
	switch normalizeQuestOp(op) {
	case "create_task",
		"complete_task",
		"move_task_to_project",
		"assign_villager",
		"open_deck",
		"attach_modifier",
		"clear_zombie",
		"build_building",
		"schedule_task",
		"process_inbox_count":
		return true
	default:
		return false
	}
}

func deterministicQuestSeed(parts ...string) int64 {
	hasher := fnv.New64a()
	for _, part := range parts {
		_, _ = hasher.Write([]byte(part))
		_, _ = hasher.Write([]byte{'|'})
	}
	return int64(hasher.Sum64())
}

func hasActiveQuest(quests *QuestState, questID string) bool {
	for _, item := range quests.Active {
		if item == nil {
			continue
		}
		if strings.EqualFold(item.ID, questID) {
			return true
		}
	}
	return false
}

func hasQuestHistory(quests *QuestState, questID string) bool {
	for _, item := range quests.History {
		if strings.EqualFold(item.ID, questID) {
			return true
		}
	}
	return false
}

func hasQuest(quests *QuestState, questID string) bool {
	return hasActiveQuest(quests, questID) || hasQuestHistory(quests, questID)
}

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

func (s *Service) cmdQuestClaimReward(ctx context.Context, state *State, args map[string]any) (any, error) {
	questID, err := getString(args, "questId")
	if err != nil {
		return nil, err
	}
	questID = strings.TrimSpace(questID)
	if questID == "" {
		return nil, fmt.Errorf("questId is required")
	}

	if err := s.refreshQuestState(ctx, state); err != nil {
		return nil, err
	}

	meta := ensureMeta(state)
	quests := ensureQuestState(meta)

	index := -1
	var quest *QuestRuntime
	for i, item := range quests.Active {
		if item == nil {
			continue
		}
		if strings.EqualFold(item.ID, questID) {
			index = i
			quest = item
			break
		}
	}
	if quest == nil {
		return nil, fmt.Errorf("quest not found: %s", questID)
	}
	if quest.Claimed {
		return nil, fmt.Errorf("quest already claimed: %s", questID)
	}
	if !quest.Claimable {
		return nil, fmt.Errorf("quest is not complete: %s", questID)
	}

	rewardSeed := deterministicQuestSeed(
		"claim:"+quest.ID,
		fmt.Sprintf("day:%d", quests.CurrentDay),
		fmt.Sprintf("history:%d", len(quests.History)),
	)
	rng := rand.New(rand.NewSource(rewardSeed))

	grantedRewards := make([]QuestRewardState, 0, len(quest.Rewards))
	createdStacks := make([]*Stack, 0, 4)
	for _, reward := range quest.Rewards {
		resolved, stacks, err := s.applyQuestReward(state, reward, rng)
		if err != nil {
			return nil, err
		}
		grantedRewards = append(grantedRewards, resolved...)
		createdStacks = append(createdStacks, stacks...)
	}

	appliedUnlocks := make([]QuestUnlockState, 0, len(quest.Unlocks))
	unlockedSet := map[string]struct{}{}
	for _, existing := range quests.Unlocked {
		key := existing.Kind + "::" + existing.ID
		unlockedSet[key] = struct{}{}
	}
	for _, unlock := range quest.Unlocks {
		key := unlock.Kind + "::" + unlock.ID
		if _, ok := unlockedSet[key]; ok {
			continue
		}
		unlockedSet[key] = struct{}{}
		quests.Unlocked = append(quests.Unlocked, unlock)
		appliedUnlocks = append(appliedUnlocks, unlock)
	}

	quest.Claimed = true
	quest.Claimable = false
	quest.ClaimedDay = quests.CurrentDay

	if quest.Type == questTypeDaily {
		switch {
		case quests.LastDailyClaimDay == quests.CurrentDay:
			// Already counted for this day.
		case quests.LastDailyClaimDay+1 == quests.CurrentDay:
			quests.DailyStreak++
			quests.LastDailyClaimDay = quests.CurrentDay
		default:
			quests.DailyStreak = 1
			quests.LastDailyClaimDay = quests.CurrentDay
		}
	}

	archived := removeActiveQuestAt(quests, index)
	archiveQuest(quests, archived, false)
	sortActiveQuests(quests)

	return map[string]any{
		"questId":          questID,
		"grantedRewards":   grantedRewards,
		"createdStacks":    createdStacks,
		"appliedUnlocks":   appliedUnlocks,
		"dailyStreak":      quests.DailyStreak,
		"inventory":        copyIntMap(meta.Inventory),
		"activeQuestCount": len(quests.Active),
	}, nil
}

func questRewardTableEntryPick(table questRewardTable, rng *rand.Rand) (questRewardSpec, bool) {
	totalWeight := 0
	for _, entry := range table.Entries {
		if entry.Weight <= 0 {
			continue
		}
		totalWeight += entry.Weight
	}
	if totalWeight <= 0 {
		return questRewardSpec{}, false
	}
	roll := rng.Intn(totalWeight)
	cursor := 0
	for _, entry := range table.Entries {
		if entry.Weight <= 0 {
			continue
		}
		cursor += entry.Weight
		if roll < cursor {
			return entry.Reward, true
		}
	}
	return questRewardSpec{}, false
}

func questRewardFromSpec(spec questRewardSpec) QuestRewardState {
	cardCount := spec.CardCount
	if cardCount <= 0 {
		cardCount = 1
	}
	return QuestRewardState{
		Kind:       normalizeQuestOp(spec.Kind),
		Currency:   strings.TrimSpace(strings.ToLower(spec.Currency)),
		Amount:     spec.Amount,
		TableID:    strings.TrimSpace(strings.ToLower(spec.TableID)),
		CardType:   strings.TrimSpace(strings.ToLower(spec.CardType)),
		CardCount:  cardCount,
		CardCharge: spec.CardUsage,
		XP:         spec.XP,
	}
}

func questCardToBoardDef(cardType string) (string, map[string]any, bool) {
	switch strings.TrimSpace(strings.ToLower(cardType)) {
	case "blank_task":
		return "task.blank", map[string]any{"title": "Quest reward task"}, true
	case "villager":
		return "villager.basic", map[string]any{}, true
	case "recurring_contract":
		return "mod.recurring_contract", map[string]any{}, true
	case "deadline_pin":
		return "mod.deadline_pin", map[string]any{}, true
	case "schedule_token":
		return "mod.schedule_token", map[string]any{}, true
	case "importance_seal":
		return "mod.importance_seal", map[string]any{}, true
	case "cleanup_tool":
		return "mod.cleanup_tool", map[string]any{}, true
	case "coin_card":
		return "loot.coin", map[string]any{"amount": 1}, true
	case "paper_card":
		return "loot.paper", map[string]any{"amount": 1}, true
	case "ink_card":
		return "loot.ink", map[string]any{"amount": 1}, true
	case "gear_card":
		return "loot.gear", map[string]any{"amount": 1}, true
	case "parts_card":
		return "loot.parts", map[string]any{"amount": 1}, true
	case "integration_core_part":
		return "loot.parts", map[string]any{"amount": 2}, true
	case "blueprint_shard":
		return "loot.parts", map[string]any{"amount": 1}, true
	default:
		return "", nil, false
	}
}

func questRewardSpawnBase(state *State) Point {
	if state != nil {
		for _, stack := range state.Stacks {
			if stack == nil {
				continue
			}
			card := topCard(state, stack)
			if card == nil {
				continue
			}
			if strings.EqualFold(strings.TrimSpace(card.DefID), "deck.collect") {
				return Point{X: stack.Pos.X + 110, Y: stack.Pos.Y - 26}
			}
		}
		for _, stack := range state.Stacks {
			if stack == nil {
				continue
			}
			card := topCard(state, stack)
			if card == nil {
				continue
			}
			if strings.HasPrefix(strings.TrimSpace(card.DefID), "deck.") {
				return Point{X: stack.Pos.X + 90, Y: stack.Pos.Y - 20}
			}
		}
	}
	return Point{X: 210, Y: 220}
}

func (s *Service) applyQuestReward(state *State, reward QuestRewardState, rng *rand.Rand) ([]QuestRewardState, []*Stack, error) {
	meta := ensureMeta(state)
	kind := normalizeQuestOp(reward.Kind)
	switch kind {
	case "currency":
		currency := strings.TrimSpace(strings.ToLower(reward.Currency))
		if currency == "" {
			currency = "coin"
		}
		amount := maxInt(reward.Amount, 0)
		if amount <= 0 {
			return nil, nil, nil
		}
		meta.Inventory[currency] += amount
		return []QuestRewardState{{
			Kind:     "currency",
			Currency: currency,
			Amount:   amount,
		}}, nil, nil
	case "xp":
		xp := maxInt(reward.XP, reward.Amount)
		if xp <= 0 {
			return nil, nil, nil
		}
		meta.Metrics["quest_xp"] += xp
		return []QuestRewardState{{
			Kind: "xp",
			XP:   xp,
		}}, nil, nil
	case "card":
		defID, data, ok := questCardToBoardDef(reward.CardType)
		if !ok {
			return nil, nil, fmt.Errorf("unsupported quest reward card type: %s", reward.CardType)
		}
		count := maxInt(reward.CardCount, 1)
		base := questRewardSpawnBase(state)
		created := make([]*Stack, 0, count)
		for index := 0; index < count; index++ {
			payload := map[string]any{}
			for key, value := range data {
				payload[key] = value
			}
			if reward.CardCharge > 0 {
				payload["charges"] = reward.CardCharge
			}
			x := base.X + (index%5)*20
			y := base.Y + (index/5)*24
			stack := createSingleCardStack(state, defID, Point{X: x, Y: y}, payload)
			created = append(created, stack)
		}
		return []QuestRewardState{{
			Kind:       "card",
			CardType:   strings.TrimSpace(strings.ToLower(reward.CardType)),
			CardCount:  count,
			CardCharge: reward.CardCharge,
		}}, created, nil
	case "roll_table":
		tableID := strings.TrimSpace(strings.ToLower(reward.TableID))
		table, ok := s.quests.RewardTables[tableID]
		if !ok {
			return nil, nil, fmt.Errorf("unknown reward table: %s", tableID)
		}
		rolls := maxInt(table.Rolls, 1)
		applied := make([]QuestRewardState, 0, rolls)
		created := make([]*Stack, 0, rolls)
		for i := 0; i < rolls; i++ {
			pick, ok := questRewardTableEntryPick(table, rng)
			if !ok {
				continue
			}
			resolved, stacks, err := s.applyQuestReward(state, questRewardFromSpec(pick), rng)
			if err != nil {
				return nil, nil, err
			}
			applied = append(applied, resolved...)
			created = append(created, stacks...)
		}
		return applied, created, nil
	case "cosmetic":
		meta.Metrics["quest_cosmetics"]++
		return []QuestRewardState{{
			Kind: "cosmetic",
		}}, nil, nil
	default:
		return nil, nil, fmt.Errorf("unsupported quest reward kind: %s", reward.Kind)
	}
}
