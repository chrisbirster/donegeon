package board

import (
	"sort"
	"strings"
)

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
