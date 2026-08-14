package board

import (
	"testing"
)

func TestTaskCompleteStackSpawnsCoinReward(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     520,
		"y":     240,
		"data": map[string]any{
			"title": "Rewarded completion",
		},
	}), "stack")

	before := env.state(t)
	result := env.command(t, "task.complete_stack", map[string]any{
		"stackId": taskStack.ID,
	})
	patch := patchMap(t, result, "")
	reward := patchAnyMap(t, patch, "reward")
	if got := dataStringPatch(reward["type"]); got != "coin" {
		t.Fatalf("expected task completion reward type coin, got=%q patch=%v", got, reward)
	}
	if got := intFromPatch(reward["amount"]); got != 1 {
		t.Fatalf("expected task completion reward amount 1, got=%d patch=%v", got, reward)
	}
	if got := dataStringPatch(reward["mode"]); got != "spawned" {
		t.Fatalf("expected task completion reward mode spawned, got=%q patch=%v", got, reward)
	}

	createdStacks := patchStacks(t, result, "createdStacks")
	foundLoot := false
	after := env.state(t)
	for _, created := range createdStacks {
		if created == nil {
			continue
		}
		createdState := after.Stacks[created.ID]
		if createdState == nil {
			continue
		}
		if stackContainsDefID(after, createdState, "loot.coin") {
			foundLoot = true
			break
		}
	}
	if !foundLoot {
		t.Fatalf("expected task completion to spawn a loot.coin stack, created=%+v", createdStacks)
	}
	if after.Meta.Metrics["tasks_completed"] <= before.Meta.Metrics["tasks_completed"] {
		t.Fatalf(
			"expected tasks_completed metric to increase after completion, before=%d after=%d",
			before.Meta.Metrics["tasks_completed"],
			after.Meta.Metrics["tasks_completed"],
		)
	}
}

func TestTaskCompletionXPRespectsPriorityMapping(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		priority int
		wantXP   int
	}{
		{name: "P1", priority: 1, wantXP: 18},
		{name: "P2", priority: 2, wantXP: 15},
		{name: "P3", priority: 3, wantXP: 13},
		{name: "P4", priority: 4, wantXP: 12},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			env := newBoardIntegrationEnv(t)
			cfg := DefaultGameplayConfig()
			cfg.Villagers.Leveling.Thresholds = map[int]int{
				1: 0,
				2: 999,
			}
			cfg.Villagers.Leveling.TaskCompletionRewards.BonusRolls = 0
			cfg.Villagers.Leveling.TaskCompletionRewards.RNGPool = nil
			env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

			villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
				"defId": "villager.basic",
				"x":     520,
				"y":     240,
			}), "stack")
			taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
				"defId": "task.blank",
				"x":     580,
				"y":     240,
				"data": map[string]any{
					"title":    "Priority XP task",
					"priority": tc.priority,
				},
			}), "stack")

			env.command(t, "task.assign_villager", map[string]any{
				"taskStackId":     taskStack.ID,
				"villagerStackId": villagerStack.ID,
			})
			result := env.command(t, "task.complete_stack", map[string]any{
				"stackId": taskStack.ID,
			})

			progress := patchAnyMap(t, patchMap(t, result, ""), "villagerProgress")
			if got := intFromPatch(progress["xpGained"]); got != tc.wantXP {
				t.Fatalf("expected xpGained=%d for priority %d, got=%d patch=%v", tc.wantXP, tc.priority, got, progress)
			}
		})
	}
}

func TestTaskCompletionCanGrantMultipleMilestonePerksInSingleAward(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Villagers.Leveling.XPSources.CompleteTask.BaseXP = 48
	cfg.Villagers.Leveling.XPSources.CompleteTask.ByPriority = map[string]int{
		"none":   0,
		"low":    0,
		"medium": 0,
		"high":   0,
	}
	cfg.Villagers.Leveling.Thresholds = map[int]int{
		1: 0,
		2: 10,
		3: 20,
		4: 30,
	}
	cfg.Villagers.Leveling.TaskCompletionRewards.BonusRolls = 0
	cfg.Villagers.Leveling.TaskCompletionRewards.RNGPool = nil
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     280,
	}), "stack")
	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     580,
		"y":     280,
		"data": map[string]any{
			"title":    "Milestone sprint",
			"priority": 4,
		},
	}), "stack")

	env.command(t, "task.assign_villager", map[string]any{
		"taskStackId":     taskStack.ID,
		"villagerStackId": villagerStack.ID,
	})
	result := env.command(t, "task.complete_stack", map[string]any{
		"stackId": taskStack.ID,
	})

	progress := patchAnyMap(t, patchMap(t, result, ""), "villagerProgress")
	if got := intFromPatch(progress["level"]); got != 4 {
		t.Fatalf("expected villager to jump to level 4, got=%d patch=%v", got, progress)
	}
	if got := intFromPatch(progress["maxStamina"]); got != 10 {
		t.Fatalf("expected Heartier to raise max stamina to 10, got=%d patch=%v", got, progress)
	}
	perks := patchStringSlice(t, progress["perks"])
	for _, perkID := range []string{"perk_heartier", "perk_bounty_hunter", "perk_focused_worker"} {
		if !contains(perks, perkID) {
			t.Fatalf("expected perk %s in villager progression, got=%v", perkID, perks)
		}
	}
	newPerks := patchStringSlice(t, progress["newPerks"])
	if len(newPerks) != 3 {
		t.Fatalf("expected three newly granted perks, got=%v", newPerks)
	}
}

func TestTaskCompletionCurrencyPerkAddsCoinReward(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Villagers.Leveling.TaskCompletionRewards.BonusRolls = 0
	cfg.Villagers.Leveling.TaskCompletionRewards.RNGPool = nil
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     320,
	}), "stack")
	setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Perks = []string{"perk_bounty_hunter"}
	})
	taskStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "task.blank",
		"x":     580,
		"y":     320,
		"data": map[string]any{
			"title": "Coin bonus task",
		},
	}), "stack")

	env.command(t, "task.assign_villager", map[string]any{
		"taskStackId":     taskStack.ID,
		"villagerStackId": villagerStack.ID,
	})
	result := env.command(t, "task.complete_stack", map[string]any{
		"stackId": taskStack.ID,
	})

	reward := patchAnyMap(t, patchMap(t, result, ""), "reward")
	if got := intFromPatch(reward["amount"]); got != 2 {
		t.Fatalf("expected guaranteed coin reward plus perk bonus = 2, got=%d patch=%v", got, reward)
	}

	after := env.state(t)
	lootStack := findCreatedStackWithDefID(after, patchStacks(t, result, "createdStacks"), "loot.coin")
	if lootStack == nil {
		t.Fatalf("expected task completion to spawn loot.coin, created=%+v", patchStacks(t, result, "createdStacks"))
	}
	if got := stackCardAmount(after, lootStack, "loot.coin"); got != 2 {
		t.Fatalf("expected loot.coin stack amount=2, got=%d", got)
	}
}

func TestResourceGatherCostsNoStaminaAndBerryBushDropsFood(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Resources.Nodes = []ResourceNodeConfig{
		{
			ID: "berry_bush",
			Charges: ResourceChargesConfig{
				Min: 1,
				Max: 1,
			},
			Gather: ResourceGatherConfig{
				Rewards: RewardTableConfig{
					Guaranteed: []RewardTableEntryConfig{
						{Type: "food", ID: "berries", Amount: 1},
					},
				},
			},
		},
	}
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     360,
	}), "stack")
	villagerID := setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Stamina = 1
	})
	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.berry_bush",
		"x":     580,
		"y":     360,
		"data": map[string]any{
			"charges": 1,
		},
	}), "stack")

	result := env.command(t, "resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": villagerStack.ID,
	})
	patch := patchMap(t, result, "")
	if got := intFromPatch(patch["staminaCost"]); got != 0 {
		t.Fatalf("expected zero gather stamina cost, got=%d patch=%v", got, patch)
	}
	progress := patchAnyMap(t, patch, "villagerProgress")
	if got := intFromPatch(progress["xpGained"]); got != 4 {
		t.Fatalf("expected gather xp=4, got=%d patch=%v", got, progress)
	}

	after := env.state(t)
	rewardStack := findCreatedStackWithDefID(after, patchStacks(t, result, "createdStacks"), "food.berries")
	if rewardStack == nil {
		t.Fatalf("expected berry bush gather to spawn food.berries, created=%+v", patchStacks(t, result, "createdStacks"))
	}
	if stateProgress := after.Meta.Villagers[villagerID]; stateProgress == nil || stateProgress.Stamina != 1 {
		t.Fatalf("expected villager stamina to remain 1 after zero-cost gather, progress=%+v", after.Meta.Villagers[villagerID])
	}
}

func TestSalvagerPerkAddsLootAmountOnResourceGather(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Resources.Nodes = []ResourceNodeConfig{
		{
			ID: "scrap_pile",
			Charges: ResourceChargesConfig{
				Min: 1,
				Max: 1,
			},
			Gather: ResourceGatherConfig{
				Rewards: RewardTableConfig{
					Guaranteed: []RewardTableEntryConfig{
						{Type: "loot", ID: "parts", Amount: 1},
					},
				},
			},
		},
	}
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     400,
	}), "stack")
	setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Perks = []string{"perk_salvager"}
	})
	resourceStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "resource.scrap_pile",
		"x":     580,
		"y":     400,
		"data": map[string]any{
			"charges": 1,
		},
	}), "stack")

	result := env.command(t, "resource.gather", map[string]any{
		"resourceStackId": resourceStack.ID,
		"villagerStackId": villagerStack.ID,
	})

	after := env.state(t)
	rewardStack := findCreatedStackWithDefID(after, patchStacks(t, result, "createdStacks"), "loot.parts")
	if rewardStack == nil {
		t.Fatalf("expected salvage gather to spawn loot.parts, created=%+v", patchStacks(t, result, "createdStacks"))
	}
	if got := stackCardAmount(after, rewardStack, "loot.parts"); got != 2 {
		t.Fatalf("expected salvager perk to raise loot.parts amount to 2, got=%d", got)
	}
}

func TestFoodPerkAddsStaminaRestore(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     440,
	}), "stack")
	setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Stamina = 1
		progress.Perks = []string{"perk_field_snacks"}
	})
	foodStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "food.bread",
		"x":     580,
		"y":     440,
		"data": map[string]any{
			"amount": 1,
		},
	}), "stack")

	result := env.command(t, "food.consume", map[string]any{
		"foodStackId":     foodStack.ID,
		"villagerStackId": villagerStack.ID,
	})

	patch := patchMap(t, result, "")
	if got := intFromPatch(patch["staminaRemaining"]); got != 7 {
		t.Fatalf("expected villager stamina 1 -> 7 after bread + field snacks, got=%d patch=%v", got, patch)
	}
	foodConsumed := patchAnyMap(t, patch, "foodConsumed")
	if got := intFromPatch(foodConsumed["staminaRestore"]); got != 6 {
		t.Fatalf("expected bread restore=6 with field snacks, got=%d patch=%v", got, foodConsumed)
	}
}

func TestZombieSlayerPerkKeepsMinimumClearCostAtOne(t *testing.T) {
	t.Parallel()

	env := newBoardIntegrationEnv(t)
	cfg := DefaultGameplayConfig()
	cfg.Villagers.Actions.ClearZombie.StaminaCost = 1
	if len(cfg.Zombies.Types) > 0 {
		cfg.Zombies.Types[0].Cleanup.StaminaCost = 1
	}
	env.boardSvc = NewService(NewRepository(env.db, env.queries), env.taskService, WithGameplayConfig(cfg))

	villagerStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "villager.basic",
		"x":     520,
		"y":     480,
	}), "stack")
	setVillagerProgressForStack(t, env, villagerStack.ID, func(progress *VillagerProgress) {
		progress.Perks = []string{"perk_zombie_slayer"}
	})
	zombieStack := patchStack(t, env.command(t, "card.spawn", map[string]any{
		"defId": "zombie.default",
		"x":     580,
		"y":     480,
	}), "stack")

	result := env.command(t, "zombie.clear", map[string]any{
		"zombieStackId":   zombieStack.ID,
		"villagerStackId": villagerStack.ID,
	})

	patch := patchMap(t, result, "")
	if got := intFromPatch(patch["staminaCost"]); got != 1 {
		t.Fatalf("expected zombie slayer to respect min clear cost 1, got=%d patch=%v", got, patch)
	}
}
