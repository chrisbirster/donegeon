package board

import (
	"fmt"
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
