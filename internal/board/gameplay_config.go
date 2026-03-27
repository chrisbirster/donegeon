package board

import (
	"fmt"
	"os"
	"sort"
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

func DefaultGameplayConfig() GameplayConfig {
	spawnChance := 1.0
	return GameplayConfig{
		SeededRNG: SeededRNGConfig{
			Enabled:                true,
			DeterministicDeckDraws: true,
		},
		World: WorldConfig{
			DayTick: DayTickConfig{
				MaxZombiesSpawnPerDay: 6,
				StaminaReset: StaminaResetConfig{
					Enabled: true,
					Mode:    "full",
				},
				OverdueRules: OverdueRulesConfig{
					ZombieSpawn: ZombieSpawnConfig{
						Enabled:        true,
						PerOverdueTask: 1,
						CapPerDay:      6,
						SpawnChance:    &spawnChance,
					},
				},
				RecurrenceRules: RecurrenceRulesConfig{
					SpawnIfDue: true,
				},
			},
		},
		Villagers: VillagersConfig{
			Defaults: VillagerDefaultsConfig{
				MaxLevel:       10,
				BaseMaxStamina: 8,
			},
			Leveling: VillagerLevelingConfig{
				XPSources: VillagerXPSourcesConfig{
					CompleteTask: CompleteTaskXPConfig{
						BaseXP: 12,
						ByPriority: map[string]int{
							"none":   0,
							"low":    1,
							"medium": 3,
							"high":   6,
						},
					},
					ClearZombie:         BaseXPConfig{BaseXP: 8},
					GatherResourceCycle: BaseXPConfig{BaseXP: 4},
				},
				Thresholds: map[int]int{
					1:  0,
					2:  20,
					3:  45,
					4:  75,
					5:  110,
					6:  150,
					7:  195,
					8:  245,
					9:  300,
					10: 360,
				},
				ChoicesPerLevel: 1,
				PerkPool: []PerkConfig{
					{
						ID:    "perk_heartier",
						Label: "Heartier",
						Apply: map[string]any{"max_stamina_add": 2},
					},
					{
						ID:    "perk_bounty_hunter",
						Label: "Bounty Hunter",
						Apply: map[string]any{"task_complete_currency_add": 1},
					},
					{
						ID:    "perk_focused_worker",
						Label: "Focused Worker",
						Apply: map[string]any{"task_complete_xp_add": 2},
					},
					{
						ID:    "perk_endurance_1",
						Label: "Endurance I",
						Apply: map[string]any{"max_stamina_add": 1},
					},
					{
						ID:    "perk_zombie_slayer",
						Label: "Zombie Slayer",
						Apply: map[string]any{"zombie_clear_stamina_cost_add": -1, "min_zombie_clear_cost": 1},
					},
					{
						ID:    "perk_salvager",
						Label: "Salvager",
						Apply: map[string]any{"resource_drop_amount_add": 1},
					},
					{
						ID:    "perk_endurance_2",
						Label: "Endurance II",
						Apply: map[string]any{"max_stamina_add": 1},
					},
					{
						ID:    "perk_field_snacks",
						Label: "Field Snacks",
						Apply: map[string]any{"food_stamina_restore_add": 1},
					},
					{
						ID:    "perk_closer",
						Label: "Closer",
						Apply: map[string]any{"task_complete_currency_add": 1, "task_complete_xp_add": 2},
					},
				},
				PerksByLevel: map[int][]string{
					2:  {"perk_heartier"},
					3:  {"perk_bounty_hunter"},
					4:  {"perk_focused_worker"},
					5:  {"perk_endurance_1"},
					6:  {"perk_zombie_slayer"},
					7:  {"perk_salvager"},
					8:  {"perk_endurance_2"},
					9:  {"perk_field_snacks"},
					10: {"perk_closer"},
				},
				TaskCompletionRewards: RewardTableConfig{
					Guaranteed: []RewardTableEntryConfig{
						{Type: "loot", ID: "coin", Amount: 1},
					},
					BonusRolls: 1,
					RNGPool: []RewardTableEntryConfig{
						{Type: "none", Amount: 0, Weight: 45},
						{Type: "loot", ID: "parts", Amount: 1, Weight: 20},
						{Type: "food", ID: "berries", Amount: 1, Weight: 20},
						{Type: "loot", ID: "paper", Amount: 1, Weight: 10},
						{Type: "loot", ID: "coin", Amount: 2, Weight: 5},
					},
				},
			},
			Actions: VillagerActionsConfig{
				ClearZombie: ClearZombieActionConfig{StaminaCost: 2, MinCostAfterPerks: 1},
				GatherStart: ActionCostConfig{StaminaCost: 0},
				EatFood:     ActionCostConfig{StaminaCost: 0},
			},
		},
		Tasks: TasksConfig{
			DueDate: TaskDueDateConfig{GraceHours: 0},
		},
		Modifiers: ModifiersConfig{
			GlobalRules: GlobalModifierRulesConfig{
				MaxModifiersPerTask:    6,
				AllowDuplicateTypes:    false,
				DuplicateTypeAllowlist: []string{"mod.next_action"},
			},
		},
		Rules: RulesConfig{
			Stacking: StackingRulesConfig{
				Disallowed: [][]string{{"task", "zombie"}, {"villager", "zombie"}, {"resource", "zombie"}, {"food", "zombie"}},
			},
			Uniqueness: UniquenessRulesConfig{
				GlobalUniqueModifiers: []string{"mod.deadline_pin"},
			},
		},
		Resources: ResourcesConfig{
			Nodes: []ResourceNodeConfig{
				{
					ID:      "tree",
					Charges: ResourceChargesConfig{Min: 3, Max: 3},
					Gather: ResourceGatherConfig{
						Rewards: RewardTableConfig{
							Guaranteed: []RewardTableEntryConfig{{Type: "loot", ID: "parts", Amount: 1}},
							BonusRolls: 1,
							RNGPool: []RewardTableEntryConfig{
								{Type: "none", Amount: 0, Weight: 40},
								{Type: "loot", ID: "coin", Amount: 1, Weight: 30},
								{Type: "food", ID: "berries", Amount: 1, Weight: 30},
							},
						},
					},
				},
				{
					ID:      "ore",
					Charges: ResourceChargesConfig{Min: 3, Max: 3},
					Gather: ResourceGatherConfig{
						Rewards: RewardTableConfig{
							Guaranteed: []RewardTableEntryConfig{{Type: "loot", ID: "gear", Amount: 1}},
							BonusRolls: 1,
							RNGPool: []RewardTableEntryConfig{
								{Type: "none", Amount: 0, Weight: 40},
								{Type: "loot", ID: "parts", Amount: 1, Weight: 35},
								{Type: "loot", ID: "coin", Amount: 1, Weight: 25},
							},
						},
					},
				},
				{
					ID:      "paper",
					Charges: ResourceChargesConfig{Min: 3, Max: 3},
					Gather: ResourceGatherConfig{
						Rewards: RewardTableConfig{
							Guaranteed: []RewardTableEntryConfig{{Type: "loot", ID: "paper", Amount: 1}},
							BonusRolls: 1,
							RNGPool: []RewardTableEntryConfig{
								{Type: "none", Amount: 0, Weight: 40},
								{Type: "food", ID: "berries", Amount: 1, Weight: 30},
								{Type: "loot", ID: "coin", Amount: 1, Weight: 30},
							},
						},
					},
				},
			},
		},
		Food: FoodConfig{
			Items: []FoodItemConfig{
				{ID: "apple", StaminaRestore: 3},
				{ID: "bread", StaminaRestore: 5},
				{ID: "berries", StaminaRestore: 3},
				{ID: "berry", StaminaRestore: 3},
				{ID: "mushroom", StaminaRestore: 4},
			},
		},
		Decks: DecksConfig{
			Economy: DeckEconomyConfig{
				BaseCostCurrency:              "coin",
				ZombieCostMultiplierPerZombie: 0.08,
				OverrunCostMultiplierPerLevel: 0.05,
			},
			List: defaultDeckList(),
		},
		Zombies: ZombiesConfig{
			Types: []ZombieTypeConfig{
				{
					ID: "default_zombie",
					Cleanup: ZombieCleanupConfig{
						StaminaCost: 2,
						RewardOnClear: RewardTableConfig{RNGPool: []RewardTableEntryConfig{
							{Type: "loot", ID: "coin", Amount: 1, Weight: 100},
						}},
					},
				},
			},
		},
		UIHints: UIHintsConfig{
			Board: UIBoardConfig{
				DefaultSpawnLayout: DefaultSpawnLayoutConfig{
					Zombies: UIZombiesLayoutConfig{StartX: 1500, StartY: 150, DX: 150},
				},
			},
		},
	}
}

func defaultDeckList() []DeckConfig {
	return []DeckConfig{
		{
			ID:              "deck.first_day",
			Status:          "unlocked",
			BaseCost:        0,
			FreeOpens:       9999,
			UnlockCondition: map[string]any{"type": "always"},
			Draws: DeckDrawConfig{Count: 3, RNGPool: []DeckRNGEntry{
				{CardType: "blank", Weight: 40},
				{CardType: "resource", ResourceID: "tree", Weight: 20},
				{CardType: "food", FoodID: "apple", Amount: 1, Weight: 20},
				{CardType: "loot", LootID: "coin", Amount: 1, Weight: 20},
			}},
		},
		{
			ID:              "deck.collect",
			Status:          "locked",
			BaseCost:        2,
			FreeOpens:       1,
			UnlockCondition: map[string]any{"type": "day_ticks_gte", "value": 1},
			Draws: DeckDrawConfig{Count: 3, RNGPool: []DeckRNGEntry{
				{CardType: "resource", ResourceID: "tree", Weight: 25},
				{CardType: "resource", ResourceID: "ore", Weight: 25},
				{CardType: "resource", ResourceID: "paper", Weight: 15},
				{CardType: "food", FoodID: "apple", Amount: 1, Weight: 15},
				{CardType: "blank", Weight: 10},
				{CardType: "loot", LootID: "parts", Amount: 1, Weight: 10},
			}},
		},
		{
			ID:              "deck.organization",
			Status:          "locked",
			BaseCost:        3,
			FreeOpens:       1,
			UnlockCondition: map[string]any{"type": "processed_tasks_gte", "value": 3},
			Draws: DeckDrawConfig{Count: 3, RNGPool: []DeckRNGEntry{
				{CardType: "blank", Weight: 35},
				{CardType: "modifier", ModifierID: "next_action", Weight: 20},
				{CardType: "modifier", ModifierID: "deadline_pin", Weight: 10},
				{CardType: "modifier", ModifierID: "recurring", Weight: 8},
				{CardType: "loot", LootID: "paper", Amount: 1, Weight: 15},
				{CardType: "loot", LootID: "ink", Amount: 1, Weight: 12},
			}},
		},
		{
			ID:              "deck.survival",
			Status:          "locked",
			BaseCost:        4,
			FreeOpens:       0,
			UnlockCondition: map[string]any{"type": "zombies_seen_gte", "value": 1},
			Draws: DeckDrawConfig{Count: 3, RNGPool: []DeckRNGEntry{
				{CardType: "food", FoodID: "bread", Amount: 1, Weight: 25},
				{CardType: "food", FoodID: "apple", Amount: 1, Weight: 20},
				{CardType: "resource", ResourceID: "ore", Weight: 20},
				{CardType: "zombie", Weight: 15},
				{CardType: "loot", LootID: "gear", Amount: 1, Weight: 10},
				{CardType: "loot", LootID: "coin", Amount: 1, Weight: 10},
			}},
		},
		{
			ID:              "deck.daily",
			Status:          "unlocked",
			BaseCost:        2,
			FreeOpens:       0,
			UnlockCondition: map[string]any{"type": "always"},
			Draws: DeckDrawConfig{Count: 3, RNGPool: []DeckRNGEntry{
				{CardType: "blank", Weight: 35},
				{CardType: "resource", ResourceID: "ore", Weight: 20},
				{CardType: "food", FoodID: "bread", Amount: 1, Weight: 20},
				{CardType: "loot", LootID: "coin", Amount: 1, Weight: 15},
				{CardType: "loot", LootID: "parts", Amount: 1, Weight: 10},
			}},
		},
		{
			ID:              "deck.loot",
			Status:          "unlocked",
			BaseCost:        1,
			FreeOpens:       0,
			UnlockCondition: map[string]any{"type": "always"},
			Draws: DeckDrawConfig{Count: 3, RNGPool: []DeckRNGEntry{
				{CardType: "loot", LootID: "coin", Amount: 1, Weight: 25},
				{CardType: "loot", LootID: "parts", Amount: 1, Weight: 25},
				{CardType: "loot", LootID: "gear", Amount: 1, Weight: 20},
				{CardType: "loot", LootID: "paper", Amount: 1, Weight: 15},
				{CardType: "loot", LootID: "ink", Amount: 1, Weight: 15},
			}},
		},
	}
}

func (c *GameplayConfig) Normalize() {
	if c.World.DayTick.MaxZombiesSpawnPerDay <= 0 {
		c.World.DayTick.MaxZombiesSpawnPerDay = 6
	}
	if c.World.DayTick.StaminaReset.Mode == "" {
		c.World.DayTick.StaminaReset.Mode = "full"
	}
	if c.World.DayTick.OverdueRules.ZombieSpawn.PerOverdueTask <= 0 {
		c.World.DayTick.OverdueRules.ZombieSpawn.PerOverdueTask = 1
	}
	if c.World.DayTick.OverdueRules.ZombieSpawn.CapPerDay <= 0 {
		c.World.DayTick.OverdueRules.ZombieSpawn.CapPerDay = c.World.DayTick.MaxZombiesSpawnPerDay
	}
	if c.World.DayTick.OverdueRules.ZombieSpawn.SpawnChance == nil {
		chance := 1.0
		c.World.DayTick.OverdueRules.ZombieSpawn.SpawnChance = &chance
	}
	if c.Villagers.Defaults.BaseMaxStamina <= 0 {
		c.Villagers.Defaults.BaseMaxStamina = 8
	}
	if c.Villagers.Defaults.MaxLevel <= 0 {
		c.Villagers.Defaults.MaxLevel = 10
	}
	if c.Villagers.Leveling.XPSources.CompleteTask.BaseXP <= 0 {
		c.Villagers.Leveling.XPSources.CompleteTask.BaseXP = 12
	}
	if c.Villagers.Leveling.XPSources.CompleteTask.ByPriority == nil {
		c.Villagers.Leveling.XPSources.CompleteTask.ByPriority = map[string]int{}
	}
	defaultPriorityXP := map[string]int{"none": 0, "low": 1, "medium": 3, "high": 6}
	for key, value := range defaultPriorityXP {
		if _, ok := c.Villagers.Leveling.XPSources.CompleteTask.ByPriority[key]; !ok {
			c.Villagers.Leveling.XPSources.CompleteTask.ByPriority[key] = value
		}
	}
	if c.Villagers.Leveling.XPSources.ClearZombie.BaseXP <= 0 {
		c.Villagers.Leveling.XPSources.ClearZombie.BaseXP = 8
	}
	if c.Villagers.Leveling.XPSources.GatherResourceCycle.BaseXP <= 0 {
		c.Villagers.Leveling.XPSources.GatherResourceCycle.BaseXP = 4
	}
	if len(c.Villagers.Leveling.Thresholds) == 0 {
		c.Villagers.Leveling.Thresholds = map[int]int{
			1:  0,
			2:  20,
			3:  45,
			4:  75,
			5:  110,
			6:  150,
			7:  195,
			8:  245,
			9:  300,
			10: 360,
		}
	}
	if len(c.Villagers.Leveling.PerkPool) == 0 {
		c.Villagers.Leveling.PerkPool = DefaultGameplayConfig().Villagers.Leveling.PerkPool
	}
	normalizeRewardTable(&c.Villagers.Leveling.TaskCompletionRewards)
	if c.Villagers.Actions.ClearZombie.StaminaCost <= 0 {
		c.Villagers.Actions.ClearZombie.StaminaCost = 2
	}
	if c.Villagers.Actions.ClearZombie.MinCostAfterPerks <= 0 {
		c.Villagers.Actions.ClearZombie.MinCostAfterPerks = 1
	}
	if c.Villagers.Actions.GatherStart.StaminaCost < 0 {
		c.Villagers.Actions.GatherStart.StaminaCost = 0
	}
	if c.Villagers.Actions.EatFood.StaminaCost < 0 {
		c.Villagers.Actions.EatFood.StaminaCost = 0
	}
	if c.Modifiers.GlobalRules.MaxModifiersPerTask <= 0 {
		c.Modifiers.GlobalRules.MaxModifiersPerTask = 6
	}
	if strings.TrimSpace(c.Decks.Economy.BaseCostCurrency) == "" {
		c.Decks.Economy.BaseCostCurrency = "coin"
	}
	if len(c.Decks.List) == 0 {
		c.Decks.List = defaultDeckList()
	}
	for i := range c.Decks.List {
		deck := &c.Decks.List[i]
		if deck.Draws.Count <= 0 {
			deck.Draws.Count = 3
		}
		if deck.UnlockCondition == nil {
			deck.UnlockCondition = map[string]any{"type": "always"}
		}
		if len(deck.Draws.RNGPool) == 0 {
			deck.Draws.RNGPool = []DeckRNGEntry{{CardType: "blank", Weight: 1}}
		}
		for j := range deck.Draws.RNGPool {
			if deck.Draws.RNGPool[j].Weight <= 0 {
				deck.Draws.RNGPool[j].Weight = 1
			}
		}
	}
	if len(c.Resources.Nodes) == 0 {
		c.Resources.Nodes = DefaultGameplayConfig().Resources.Nodes
	}
	for i := range c.Resources.Nodes {
		node := &c.Resources.Nodes[i]
		normalizeRewardTable(&node.Gather.Rewards)
	}
	if len(c.Food.Items) == 0 {
		c.Food.Items = DefaultGameplayConfig().Food.Items
	}
	for i := range c.Food.Items {
		if c.Food.Items[i].StaminaRestore <= 0 {
			if item := DefaultGameplayConfig().FoodByID(c.Food.Items[i].ID); item != nil {
				c.Food.Items[i].StaminaRestore = item.StaminaRestore
			}
		}
	}
	if len(c.Zombies.Types) == 0 {
		c.Zombies.Types = DefaultGameplayConfig().Zombies.Types
	}
	for i := range c.Zombies.Types {
		normalizeRewardTable(&c.Zombies.Types[i].Cleanup.RewardOnClear)
	}
	if c.UIHints.Board.DefaultSpawnLayout.Zombies.DX == 0 {
		c.UIHints.Board.DefaultSpawnLayout.Zombies.DX = 150
	}
	if c.UIHints.Board.DefaultSpawnLayout.Zombies.StartX == 0 {
		c.UIHints.Board.DefaultSpawnLayout.Zombies.StartX = 1500
	}
	if c.UIHints.Board.DefaultSpawnLayout.Zombies.StartY == 0 {
		c.UIHints.Board.DefaultSpawnLayout.Zombies.StartY = 150
	}
}

func (c GameplayConfig) DeckByID(deckID string) *DeckConfig {
	deckID = strings.TrimSpace(deckID)
	for i := range c.Decks.List {
		if strings.EqualFold(strings.TrimSpace(c.Decks.List[i].ID), deckID) {
			return &c.Decks.List[i]
		}
	}
	return nil
}

func (c GameplayConfig) ResourceNodeByID(resourceID string) *ResourceNodeConfig {
	resourceID = strings.TrimSpace(resourceID)
	for i := range c.Resources.Nodes {
		if strings.EqualFold(strings.TrimSpace(c.Resources.Nodes[i].ID), resourceID) {
			return &c.Resources.Nodes[i]
		}
	}
	return nil
}

func (c GameplayConfig) FoodByID(foodID string) *FoodItemConfig {
	foodID = strings.TrimSpace(foodID)
	for i := range c.Food.Items {
		if strings.EqualFold(strings.TrimSpace(c.Food.Items[i].ID), foodID) {
			return &c.Food.Items[i]
		}
	}
	return nil
}

func (c GameplayConfig) PerkByID(perkID string) *PerkConfig {
	perkID = strings.TrimSpace(perkID)
	for i := range c.Villagers.Leveling.PerkPool {
		if strings.EqualFold(strings.TrimSpace(c.Villagers.Leveling.PerkPool[i].ID), perkID) {
			return &c.Villagers.Leveling.PerkPool[i]
		}
	}
	return nil
}

func (c GameplayConfig) PerksForLevel(level int) []string {
	if len(c.Villagers.Leveling.PerksByLevel) == 0 {
		return nil
	}
	perks := c.Villagers.Leveling.PerksByLevel[level]
	if len(perks) == 0 {
		return nil
	}
	out := make([]string, 0, len(perks))
	for _, perkID := range perks {
		perkID = strings.TrimSpace(perkID)
		if perkID == "" {
			continue
		}
		out = append(out, perkID)
	}
	return out
}

func (c GameplayConfig) ProgressionDeckDefIDs() []string {
	seen := map[string]struct{}{}
	ordered := make([]string, 0, len(c.Decks.List))
	for _, deck := range c.Decks.List {
		id := strings.TrimSpace(deck.ID)
		if id == "" || id == "deck.first_day" {
			continue
		}
		if !strings.HasPrefix(id, "deck.") {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ordered = append(ordered, id)
	}
	if len(ordered) == 0 {
		ordered = []string{"deck.collect", "deck.organization", "deck.survival"}
	}
	return ordered
}

func (c GameplayConfig) RewardFromPool(pool []RNGPoolEntryConfig, fallbackType string, fallbackAmount int) (string, int) {
	bestType := ""
	bestAmount := 0
	bestWeight := -1
	for _, entry := range pool {
		if !strings.EqualFold(strings.TrimSpace(entry.Type), "loot") {
			continue
		}
		lootType := normalizeCollectLoot(strings.TrimSpace(entry.ID))
		if lootType == "" {
			continue
		}
		if entry.Weight > bestWeight {
			bestWeight = entry.Weight
			bestType = lootType
			if entry.Amount > 0 {
				bestAmount = entry.Amount
			} else {
				bestAmount = 1
			}
		}
	}
	if bestType != "" && bestAmount > 0 {
		return bestType, bestAmount
	}
	if strings.TrimSpace(fallbackType) == "" || fallbackAmount <= 0 {
		return "", 0
	}
	return strings.TrimSpace(fallbackType), fallbackAmount
}

func normalizeRewardTable(table *RewardTableConfig) {
	if table == nil {
		return
	}
	if table.BonusRolls < 0 {
		table.BonusRolls = 0
	}
	for i := range table.Guaranteed {
		if table.Guaranteed[i].Amount <= 0 && !strings.EqualFold(strings.TrimSpace(table.Guaranteed[i].Type), "none") {
			table.Guaranteed[i].Amount = 1
		}
	}
	for i := range table.RNGPool {
		entry := &table.RNGPool[i]
		if entry.Weight <= 0 {
			entry.Weight = 1
		}
		if entry.Amount <= 0 && !strings.EqualFold(strings.TrimSpace(entry.Type), "none") {
			entry.Amount = 1
		}
	}
}

func normalizeCollectLoot(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "coin", "coins":
		return "coin"
	case "parts", "part":
		return "parts"
	case "gear":
		return "gear"
	case "paper":
		return "paper"
	case "ink":
		return "ink"
	default:
		return strings.TrimSpace(raw)
	}
}

func (c GameplayConfig) LevelThresholdsSorted() []int {
	levels := make([]int, 0, len(c.Villagers.Leveling.Thresholds))
	for level, threshold := range c.Villagers.Leveling.Thresholds {
		if level <= 1 || threshold < 0 {
			continue
		}
		levels = append(levels, level)
	}
	sort.Ints(levels)
	return levels
}
