package board

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

type GameplayConfig struct {
	SeededRNG SeededRNGConfig `yaml:"seeded_rng" json:"seeded_rng"`
	World     WorldConfig     `yaml:"world" json:"world"`
	Villagers VillagersConfig `yaml:"villagers" json:"villagers"`
	Tasks     TasksConfig     `yaml:"tasks" json:"tasks"`
	Modifiers ModifiersConfig `yaml:"modifiers" json:"modifiers"`
	Rules     RulesConfig     `yaml:"rules" json:"rules"`
	Resources ResourcesConfig `yaml:"resources" json:"resources"`
	Food      FoodConfig      `yaml:"food" json:"food"`
	Decks     DecksConfig     `yaml:"decks" json:"decks"`
	Zombies   ZombiesConfig   `yaml:"zombies" json:"zombies"`
	UIHints   UIHintsConfig   `yaml:"ui_hints" json:"ui_hints"`
}

type SeededRNGConfig struct {
	Enabled                bool `yaml:"enabled" json:"enabled"`
	DeterministicDeckDraws bool `yaml:"deterministic_deck_draws" json:"deterministic_deck_draws"`
}

type WorldConfig struct {
	DayTick DayTickConfig `yaml:"day_tick" json:"day_tick"`
}

type DayTickConfig struct {
	MaxZombiesSpawnPerDay int                   `yaml:"max_zombies_spawn_per_day" json:"max_zombies_spawn_per_day"`
	StaminaReset          StaminaResetConfig    `yaml:"stamina_reset" json:"stamina_reset"`
	OverdueRules          OverdueRulesConfig    `yaml:"overdue_rules" json:"overdue_rules"`
	RecurrenceRules       RecurrenceRulesConfig `yaml:"recurrence_rules" json:"recurrence_rules"`
}

type StaminaResetConfig struct {
	Enabled bool   `yaml:"enabled" json:"enabled"`
	Mode    string `yaml:"mode" json:"mode"`
}

type OverdueRulesConfig struct {
	ZombieSpawn ZombieSpawnConfig `yaml:"zombie_spawn" json:"zombie_spawn"`
}

type ZombieSpawnConfig struct {
	Enabled        bool     `yaml:"enabled" json:"enabled"`
	PerOverdueTask int      `yaml:"per_overdue_task" json:"per_overdue_task"`
	CapPerDay      int      `yaml:"cap_per_day" json:"cap_per_day"`
	SpawnChance    *float64 `yaml:"spawn_chance" json:"spawn_chance,omitempty"`
}

type RecurrenceRulesConfig struct {
	SpawnIfDue bool `yaml:"spawn_if_due" json:"spawn_if_due"`
}

type VillagersConfig struct {
	Defaults VillagerDefaultsConfig `yaml:"defaults" json:"defaults"`
	Leveling VillagerLevelingConfig `yaml:"leveling" json:"leveling"`
	Actions  VillagerActionsConfig  `yaml:"actions" json:"actions"`
}

type VillagerDefaultsConfig struct {
	MaxLevel       int `yaml:"max_level" json:"max_level"`
	BaseMaxStamina int `yaml:"base_max_stamina" json:"base_max_stamina"`
}

type VillagerLevelingConfig struct {
	XPSources             VillagerXPSourcesConfig `yaml:"xp_sources" json:"xp_sources"`
	Thresholds            map[int]int             `yaml:"thresholds" json:"thresholds"`
	ChoicesPerLevel       int                     `yaml:"choices_per_level" json:"choices_per_level"`
	PerkPool              []PerkConfig            `yaml:"perk_pool" json:"perk_pool"`
	PerksByLevel          map[int][]string        `yaml:"perks_by_level" json:"perks_by_level"`
	TaskCompletionRewards RewardTableConfig       `yaml:"task_completion_rewards" json:"task_completion_rewards"`
}

type VillagerXPSourcesConfig struct {
	CompleteTask        CompleteTaskXPConfig `yaml:"complete_task" json:"complete_task"`
	ClearZombie         BaseXPConfig         `yaml:"clear_zombie" json:"clear_zombie"`
	GatherResourceCycle BaseXPConfig         `yaml:"gather_resource_cycle" json:"gather_resource_cycle"`
}

type CompleteTaskXPConfig struct {
	BaseXP     int            `yaml:"base_xp" json:"base_xp"`
	ByPriority map[string]int `yaml:"by_priority" json:"by_priority"`
}

type BaseXPConfig struct {
	BaseXP int `yaml:"base_xp" json:"base_xp"`
}

type PerkConfig struct {
	ID    string         `yaml:"id" json:"id"`
	Label string         `yaml:"label" json:"label"`
	Apply map[string]any `yaml:"apply" json:"apply"`
}

type VillagerActionsConfig struct {
	ClearZombie ClearZombieActionConfig `yaml:"clear_zombie" json:"clear_zombie"`
	GatherStart ActionCostConfig        `yaml:"gather_start" json:"gather_start"`
	EatFood     ActionCostConfig        `yaml:"eat_food" json:"eat_food"`
}

type ActionCostConfig struct {
	StaminaCost int `yaml:"stamina_cost" json:"stamina_cost"`
}

type ClearZombieActionConfig struct {
	StaminaCost       int `yaml:"stamina_cost" json:"stamina_cost"`
	MinCostAfterPerks int `yaml:"min_cost_after_perks" json:"min_cost_after_perks"`
}

type TasksConfig struct {
	DueDate TaskDueDateConfig `yaml:"due_date" json:"due_date"`
}

type TaskDueDateConfig struct {
	GraceHours int `yaml:"grace_hours" json:"grace_hours"`
}

type ModifiersConfig struct {
	GlobalRules GlobalModifierRulesConfig `yaml:"global_rules" json:"global_rules"`
}

type GlobalModifierRulesConfig struct {
	MaxModifiersPerTask    int      `yaml:"max_modifiers_per_task" json:"max_modifiers_per_task"`
	AllowDuplicateTypes    bool     `yaml:"allow_duplicate_types" json:"allow_duplicate_types"`
	DuplicateTypeAllowlist []string `yaml:"duplicate_type_allowlist" json:"duplicate_type_allowlist"`
}

type RulesConfig struct {
	Stacking   StackingRulesConfig   `yaml:"stacking" json:"stacking"`
	Uniqueness UniquenessRulesConfig `yaml:"uniqueness" json:"uniqueness"`
}

type StackingRulesConfig struct {
	AllowedPairs [][]string `yaml:"allowed_pairs" json:"allowed_pairs"`
	Disallowed   [][]string `yaml:"disallowed" json:"disallowed"`
}

type UniquenessRulesConfig struct {
	GlobalUniqueModifiers []string `yaml:"global_unique_modifiers" json:"global_unique_modifiers"`
}

type ResourcesConfig struct {
	Nodes []ResourceNodeConfig `yaml:"nodes" json:"nodes"`
}

type ResourceNodeConfig struct {
	ID      string                `yaml:"id" json:"id"`
	Charges ResourceChargesConfig `yaml:"charges" json:"charges"`
	Gather  ResourceGatherConfig  `yaml:"gather" json:"gather"`
}

type ResourceChargesConfig struct {
	Min int `yaml:"min" json:"min"`
	Max int `yaml:"max" json:"max"`
}

type ResourceGatherConfig struct {
	BaseTimeS int               `yaml:"base_time_s" json:"base_time_s"`
	Rewards   RewardTableConfig `yaml:"rewards" json:"rewards"`
}

type FoodConfig struct {
	Items []FoodItemConfig `yaml:"items" json:"items"`
}

type FoodItemConfig struct {
	ID             string `yaml:"id" json:"id"`
	StaminaRestore int    `yaml:"stamina_restore" json:"stamina_restore"`
}

type DecksConfig struct {
	Economy DeckEconomyConfig `yaml:"economy" json:"economy"`
	List    []DeckConfig      `yaml:"list" json:"list"`
}

type DeckEconomyConfig struct {
	BaseCostCurrency              string  `yaml:"base_cost_currency" json:"base_cost_currency"`
	ZombieCostMultiplierPerZombie float64 `yaml:"zombie_cost_multiplier_per_zombie" json:"zombie_cost_multiplier_per_zombie"`
	OverrunCostMultiplierPerLevel float64 `yaml:"overrun_cost_multiplier_per_level" json:"overrun_cost_multiplier_per_level"`
}

type DeckConfig struct {
	ID              string         `yaml:"id" json:"id"`
	Status          string         `yaml:"status" json:"status"`
	BaseCost        int            `yaml:"base_cost" json:"base_cost"`
	FreeOpens       int            `yaml:"free_opens" json:"free_opens"`
	UnlockCondition map[string]any `yaml:"unlock_condition" json:"unlock_condition"`
	Draws           DeckDrawConfig `yaml:"draws" json:"draws"`
}

type DeckDrawConfig struct {
	Count   int            `yaml:"count" json:"count"`
	RNGPool []DeckRNGEntry `yaml:"rng_pool" json:"rng_pool"`
}

type DeckRNGEntry struct {
	CardType   string `yaml:"card_type" json:"card_type"`
	VillagerID string `yaml:"villager_id,omitempty" json:"villager_id,omitempty"`
	ModifierID string `yaml:"modifier_id,omitempty" json:"modifier_id,omitempty"`
	LootID     string `yaml:"loot_id,omitempty" json:"loot_id,omitempty"`
	ResourceID string `yaml:"resource_id,omitempty" json:"resource_id,omitempty"`
	FoodID     string `yaml:"food_id,omitempty" json:"food_id,omitempty"`
	Amount     int    `yaml:"amount,omitempty" json:"amount,omitempty"`
	Weight     int    `yaml:"weight" json:"weight"`
}

type ZombiesConfig struct {
	Types []ZombieTypeConfig `yaml:"types" json:"types"`
}

type ZombieTypeConfig struct {
	ID      string              `yaml:"id" json:"id"`
	Cleanup ZombieCleanupConfig `yaml:"cleanup" json:"cleanup"`
}

type ZombieCleanupConfig struct {
	StaminaCost   int               `yaml:"stamina_cost" json:"stamina_cost"`
	RewardOnClear RewardTableConfig `yaml:"reward_on_clear" json:"reward_on_clear"`
}

type RewardTableConfig struct {
	Guaranteed []RewardTableEntryConfig `yaml:"guaranteed" json:"guaranteed"`
	BonusRolls int                      `yaml:"bonus_rolls" json:"bonus_rolls"`
	RNGPool    []RewardTableEntryConfig `yaml:"rng_pool" json:"rng_pool"`
}

type RewardTableEntryConfig struct {
	ID     string `yaml:"id,omitempty" json:"id,omitempty"`
	Type   string `yaml:"type" json:"type"`
	Amount int    `yaml:"amount,omitempty" json:"amount,omitempty"`
	Weight int    `yaml:"weight" json:"weight"`
}

type RNGPoolConfig = RewardTableConfig
type RNGPoolEntryConfig = RewardTableEntryConfig

type UIHintsConfig struct {
	Board UIBoardConfig `yaml:"board" json:"board"`
}

type UIBoardConfig struct {
	DefaultSpawnLayout DefaultSpawnLayoutConfig `yaml:"default_spawn_layout" json:"default_spawn_layout"`
}

type DefaultSpawnLayoutConfig struct {
	Zombies UIZombiesLayoutConfig `yaml:"zombies" json:"zombies"`
}

type UIZombiesLayoutConfig struct {
	StartX int `yaml:"start_x" json:"start_x"`
	StartY int `yaml:"start_y" json:"start_y"`
	DX     int `yaml:"dx" json:"dx"`
}

func LoadGameplayConfig(path string) (GameplayConfig, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		cfg := DefaultGameplayConfig()
		cfg.Normalize()
		return cfg, nil
	}

	var cfg GameplayConfig

	raw, err := os.ReadFile(path)
	if err != nil {
		return GameplayConfig{}, err
	}
	if err := yaml.Unmarshal(raw, &cfg); err != nil {
		return GameplayConfig{}, fmt.Errorf("parse gameplay config: %w", err)
	}
	cfg.Normalize()
	return cfg, nil
}
