package board

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
