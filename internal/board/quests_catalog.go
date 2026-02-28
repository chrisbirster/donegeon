package board

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type QuestCatalog struct {
	DailyDrawCount       int
	DailyNoRepeatDays    int
	StoryLabelsByWeek    map[int]questDefinitionLabel
	StoryOverridesByWeek map[int]questDefinition
	BossesByWeek         map[int]questDefinition
	DailyTemplates       []questDefinition
	RewardTables         map[string]questRewardTable
}

type questCatalogYAML struct {
	Meta                 questCatalogMeta             `yaml:"meta"`
	StoryLabelsByWeek    map[int]questDefinitionLabel `yaml:"story_labels_by_week"`
	StoryOverridesByWeek map[int]questDefinition      `yaml:"weekly_story_overrides_by_week"`
	BossesByWeek         map[int]questDefinition      `yaml:"bosses_by_week"`
	DailyTemplates       []questDefinition            `yaml:"daily_templates"`
	RewardTables         map[string]questRewardTable  `yaml:"reward_tables"`
}

type questCatalogMeta struct {
	DailyDrawCount    int `yaml:"daily_draw_count"`
	DailyNoRepeatDays int `yaml:"daily_no_repeat_days"`
}

func DefaultQuestCatalog() QuestCatalog {
	catalog := QuestCatalog{
		DailyDrawCount:       questDailyDrawCount,
		DailyNoRepeatDays:    questDailyNoRepeatDays,
		StoryLabelsByWeek:    copyQuestDefinitionLabelsByWeek(questStoryLabelsByWeek),
		StoryOverridesByWeek: defaultStoryOverridesByWeek(),
		BossesByWeek:         copyQuestDefinitionsByWeek(questBossByWeek),
		DailyTemplates:       legacyQuestDailyTemplates(),
		RewardTables:         copyQuestRewardTables(questRewardTables),
	}
	catalog.Normalize()
	return catalog
}

func LoadQuestCatalog(path string) (QuestCatalog, error) {
	catalog := DefaultQuestCatalog()

	trimmedPath := strings.TrimSpace(path)
	if trimmedPath == "" {
		return catalog, nil
	}

	raw, err := os.ReadFile(trimmedPath)
	if err != nil {
		return QuestCatalog{}, err
	}

	var parsed questCatalogYAML
	if err := yaml.Unmarshal(raw, &parsed); err != nil {
		return QuestCatalog{}, fmt.Errorf("parse quest catalog: %w", err)
	}

	if parsed.Meta.DailyDrawCount > 0 {
		catalog.DailyDrawCount = parsed.Meta.DailyDrawCount
	}
	if parsed.Meta.DailyNoRepeatDays > 0 {
		catalog.DailyNoRepeatDays = parsed.Meta.DailyNoRepeatDays
	}
	if len(parsed.StoryLabelsByWeek) > 0 {
		catalog.StoryLabelsByWeek = copyQuestDefinitionLabelsByWeek(parsed.StoryLabelsByWeek)
	}
	if len(parsed.StoryOverridesByWeek) > 0 {
		catalog.StoryOverridesByWeek = copyQuestDefinitionsByWeek(parsed.StoryOverridesByWeek)
	}
	if len(parsed.BossesByWeek) > 0 {
		catalog.BossesByWeek = copyQuestDefinitionsByWeek(parsed.BossesByWeek)
	}
	if len(parsed.DailyTemplates) > 0 {
		catalog.DailyTemplates = copyQuestDefinitions(parsed.DailyTemplates)
	}
	if len(parsed.RewardTables) > 0 {
		catalog.RewardTables = copyQuestRewardTables(parsed.RewardTables)
	}

	catalog.Normalize()
	return catalog, nil
}

func (c *QuestCatalog) Normalize() {
	if c.DailyDrawCount <= 0 {
		c.DailyDrawCount = questDailyDrawCount
	}
	if c.DailyNoRepeatDays <= 0 {
		c.DailyNoRepeatDays = questDailyNoRepeatDays
	}
	if c.StoryLabelsByWeek == nil {
		c.StoryLabelsByWeek = map[int]questDefinitionLabel{}
	}
	if c.StoryOverridesByWeek == nil {
		c.StoryOverridesByWeek = map[int]questDefinition{}
	}
	if c.BossesByWeek == nil {
		c.BossesByWeek = map[int]questDefinition{}
	}
	if c.DailyTemplates == nil {
		c.DailyTemplates = []questDefinition{}
	}
	if c.RewardTables == nil {
		c.RewardTables = map[string]questRewardTable{}
	}
}

func defaultStoryOverridesByWeek() map[int]questDefinition {
	return map[int]questDefinition{
		1: {
			Objectives: []questObjectiveSpec{
				{Op: "create_task", Count: 1, TimeWindow: "this_week"},
				{Op: "open_deck", Count: 1, Ref: "deck.first_day", TimeWindow: "this_week"},
				{Op: "assign_villager", Count: 1, TimeWindow: "this_week"},
			},
			Unlocks: []questUnlockSpec{
				{Kind: "deck", ID: "deck.first_day"},
				{Kind: "system_feature", ID: "board_view"},
			},
			HowToComplete:    "Create a task, open the First Day deck once, then assign one villager.",
			DefinitionOfDone: "All three onboarding actions are completed during the same week.",
			AcceptanceCriteria: []string{
				"create_task current >= 1",
				"open_deck (ref deck.first_day) current >= 1",
				"assign_villager current >= 1",
			},
		},
		5: {
			Unlocks: []questUnlockSpec{{Kind: "system_feature", ID: "due_dates"}},
		},
		13: {
			Unlocks: []questUnlockSpec{{Kind: "deck", ID: "deck.maintenance"}},
		},
		26: {
			Unlocks: []questUnlockSpec{{Kind: "building", ID: "routine_farm"}},
		},
		39: {
			Unlocks: []questUnlockSpec{{Kind: "system_feature", ID: "calendar_integration"}},
		},
		43: {
			Unlocks: []questUnlockSpec{{Kind: "system_feature", ID: "automations"}},
		},
	}
}

func copyQuestDefinitionLabelsByWeek(source map[int]questDefinitionLabel) map[int]questDefinitionLabel {
	target := make(map[int]questDefinitionLabel, len(source))
	for key, value := range source {
		target[key] = value
	}
	return target
}

func copyQuestDefinitionsByWeek(source map[int]questDefinition) map[int]questDefinition {
	target := make(map[int]questDefinition, len(source))
	for key, value := range source {
		target[key] = copyQuestDefinition(value)
	}
	return target
}

func copyQuestDefinitions(source []questDefinition) []questDefinition {
	target := make([]questDefinition, 0, len(source))
	for _, value := range source {
		target = append(target, copyQuestDefinition(value))
	}
	return target
}

func copyQuestDefinition(source questDefinition) questDefinition {
	target := source
	target.AcceptanceCriteria = append([]string(nil), source.AcceptanceCriteria...)
	target.Objectives = append([]questObjectiveSpec(nil), source.Objectives...)
	target.Rewards = append([]questRewardSpec(nil), source.Rewards...)
	target.Unlocks = append([]questUnlockSpec(nil), source.Unlocks...)
	target.Consequences = append([]questConsequenceSpec(nil), source.Consequences...)
	return target
}

func copyQuestRewardTables(source map[string]questRewardTable) map[string]questRewardTable {
	target := make(map[string]questRewardTable, len(source))
	for key, value := range source {
		copyTable := value
		copyTable.Entries = append([]questRewardTableEntry(nil), value.Entries...)
		target[strings.TrimSpace(strings.ToLower(key))] = copyTable
	}
	return target
}
