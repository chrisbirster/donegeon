package board

import (
	"testing"

	"gopkg.in/yaml.v3"
)

func TestGameplayConfigParsesPerksByLevelAndRewardTables(t *testing.T) {
	t.Parallel()

	raw := `
villagers:
  defaults:
    max_level: 10
    base_max_stamina: 8
  leveling:
    xp_sources:
      complete_task:
        base_xp: 12
    perk_pool:
      - id: perk_heartier
        label: Heartier
        apply:
          max_stamina_add: 2
    perks_by_level:
      2: [perk_heartier]
    task_completion_rewards:
      guaranteed:
        - type: loot
          id: coin
          amount: 1
      bonus_rolls: 1
      rng_pool:
        - type: food
          id: berries
          amount: 1
          weight: 2
        - type: none
          amount: 0
          weight: 1
resources:
  nodes:
    - id: berry_bush
      charges: { min: 2, max: 4 }
      gather:
        rewards:
          guaranteed:
            - type: food
              id: berries
              amount: 1
          bonus_rolls: 1
          rng_pool:
            - type: loot
              id: coin
              amount: 1
              weight: 1
zombies:
  types:
    - id: default_zombie
      cleanup:
        reward_on_clear:
          rng_pool:
            - type: loot
              id: coin
              amount: 2
              weight: 1
food:
  items:
    - id: berries
      stamina_restore: 3
`

	var cfg GameplayConfig
	if err := yaml.Unmarshal([]byte(raw), &cfg); err != nil {
		t.Fatalf("unmarshal config: %v", err)
	}
	cfg.Normalize()

	perks := cfg.Villagers.Leveling.PerksByLevel[2]
	if len(perks) != 1 || perks[0] != "perk_heartier" {
		t.Fatalf("expected perks_by_level[2] to include perk_heartier, got=%v", perks)
	}
	if got := cfg.Villagers.Leveling.TaskCompletionRewards.BonusRolls; got != 1 {
		t.Fatalf("expected task completion bonus rolls=1, got=%d", got)
	}
	if got := len(cfg.Villagers.Leveling.TaskCompletionRewards.Guaranteed); got != 1 {
		t.Fatalf("expected one guaranteed task reward, got=%d", got)
	}
	if got := cfg.Resources.Nodes[0].Gather.Rewards.Guaranteed[0].Type; got != "food" {
		t.Fatalf("expected resource guaranteed reward type food, got=%q", got)
	}
	if got := cfg.Zombies.Types[0].Cleanup.RewardOnClear.RNGPool[0].Amount; got != 2 {
		t.Fatalf("expected zombie reward amount 2, got=%d", got)
	}
}

func TestGameplayConfigNormalizeLegacyPerkPoolFallback(t *testing.T) {
	t.Parallel()

	raw := `
villagers:
  defaults:
    base_max_stamina: 6
  leveling:
    xp_sources:
      complete_task:
        base_xp: 10
    perk_pool:
      - id: perk_stamina_plus_1
        label: Legacy Stamina
        apply:
          max_stamina_add: 1
resources:
  nodes:
    - id: tree
      charges: { min: 3, max: 3 }
`

	var cfg GameplayConfig
	if err := yaml.Unmarshal([]byte(raw), &cfg); err != nil {
		t.Fatalf("unmarshal legacy config: %v", err)
	}
	cfg.Normalize()

	if got := len(cfg.Villagers.Leveling.PerksByLevel); got != 0 {
		t.Fatalf("expected no perks_by_level defaults for legacy config, got=%v", cfg.Villagers.Leveling.PerksByLevel)
	}
	if got := len(cfg.Villagers.Leveling.TaskCompletionRewards.Guaranteed) + len(cfg.Villagers.Leveling.TaskCompletionRewards.RNGPool); got != 0 {
		t.Fatalf("expected no task completion reward table defaults for legacy config, got guaranteed=%d pool=%d", len(cfg.Villagers.Leveling.TaskCompletionRewards.Guaranteed), len(cfg.Villagers.Leveling.TaskCompletionRewards.RNGPool))
	}
	if got := len(cfg.Resources.Nodes[0].Gather.Rewards.Guaranteed) + len(cfg.Resources.Nodes[0].Gather.Rewards.RNGPool); got != 0 {
		t.Fatalf("expected legacy resource node to keep empty reward table, got guaranteed=%d pool=%d", len(cfg.Resources.Nodes[0].Gather.Rewards.Guaranteed), len(cfg.Resources.Nodes[0].Gather.Rewards.RNGPool))
	}
	if perk := cfg.PerkByID("perk_stamina_plus_1"); perk == nil {
		t.Fatal("expected legacy perk_pool entry to remain available")
	}
}
