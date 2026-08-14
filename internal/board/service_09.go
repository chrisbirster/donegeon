package board

import (
	"fmt"
	"hash/fnv"
	"math/rand"
	"sort"
	"strings"
	"time"
)

func (s *Service) spawnOverdueZombies(state *State, overdueTaskIDs []string, dayTickCount int, tickDate time.Time) []string {
	if state == nil || len(overdueTaskIDs) == 0 {
		return nil
	}
	spawnCfg := s.cfg.World.DayTick.OverdueRules.ZombieSpawn
	spawnEnabled := spawnCfg.Enabled
	if !spawnEnabled {
		return nil
	}

	perOverdueTask := spawnCfg.PerOverdueTask
	if perOverdueTask <= 0 {
		perOverdueTask = 1
	}
	desired := len(overdueTaskIDs) * perOverdueTask
	if desired <= 0 {
		return nil
	}

	spawnCap := spawnCfg.CapPerDay
	if maxSpawn := s.cfg.World.DayTick.MaxZombiesSpawnPerDay; maxSpawn > 0 && (spawnCap <= 0 || maxSpawn < spawnCap) {
		spawnCap = maxSpawn
	}
	if spawnCap > 0 && desired > spawnCap {
		desired = spawnCap
	}

	spawnChance := 1.0
	if spawnCfg.SpawnChance != nil {
		spawnChance = *spawnCfg.SpawnChance
	}
	if spawnChance < 0 {
		spawnChance = 0
	}
	if spawnChance > 1 {
		spawnChance = 1
	}

	layout := s.cfg.UIHints.Board.DefaultSpawnLayout.Zombies
	startX := layout.StartX
	startY := layout.StartY
	dx := layout.DX
	if dx == 0 {
		dx = 120
	}
	zombieDefID := "zombie.default_zombie"
	if len(s.cfg.Zombies.Types) > 0 && strings.TrimSpace(s.cfg.Zombies.Types[0].ID) != "" {
		zombieDefID = "zombie." + strings.TrimSpace(s.cfg.Zombies.Types[0].ID)
	}

	alreadyByTaskID := map[string]struct{}{}
	for _, stack := range state.Stacks {
		if stack == nil || !stackHasKind(state, stack, "zombie") {
			continue
		}
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil || cardKind(card.DefID) != "zombie" || card.Data == nil {
				continue
			}
			if taskID, ok := card.Data["taskId"].(string); ok && strings.TrimSpace(taskID) != "" {
				alreadyByTaskID[strings.TrimSpace(taskID)] = struct{}{}
			}
		}
	}

	sort.Strings(overdueTaskIDs)
	seed := deterministicOverdueSpawnSeed(overdueTaskIDs, countZombieStacks(state), desired, dayTickCount, tickDate)
	rng := rand.New(rand.NewSource(seed))

	spawned := make([]string, 0, desired)
	for i := 0; i < desired; i++ {
		if len(spawned) >= desired {
			break
		}
		if spawnChance < 1 && rng.Float64() > spawnChance {
			continue
		}
		taskID := overdueTaskIDs[i%len(overdueTaskIDs)]
		if _, exists := alreadyByTaskID[taskID]; exists {
			continue
		}
		stack := createSingleCardStack(state, zombieDefID, Point{
			X: startX + (countZombieStacks(state)+i)*dx,
			Y: startY,
		}, map[string]any{
			"reason": "overdue_task",
			"taskId": taskID,
		})
		spawned = append(spawned, stack.ID)
	}
	return spawned
}

func deterministicOverdueSpawnSeed(overdueTaskIDs []string, existing int, desired int, dayTickCount int, tickDate time.Time) int64 {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(fmt.Sprintf(
		"%d:%d:%d:%d:%s",
		len(overdueTaskIDs),
		existing,
		desired,
		dayTickCount,
		tickDate.Format("2006-01-02"),
	)))
	for _, taskID := range overdueTaskIDs {
		_, _ = hasher.Write([]byte("|"))
		_, _ = hasher.Write([]byte(taskID))
	}
	return int64(hasher.Sum64())
}

func atoi(value string) (int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return 0, fmt.Errorf("empty integer")
	}
	var out int
	_, err := fmt.Sscanf(value, "%d", &out)
	if err != nil {
		return 0, err
	}
	return out, nil
}

func resourceDropDefID(resourceDefID string) string {
	switch strings.TrimSpace(resourceDefID) {
	case "resource.ore", "resource.metal":
		return "loot.gear"
	case "resource.paper":
		return "loot.paper"
	default:
		return "loot.parts"
	}
}

func (s *Service) responseMeta(meta BoardMeta) BoardMeta {
	out := meta
	out.Inventory = copyIntMap(meta.Inventory)
	out.Metrics = copyIntMap(meta.Metrics)
	out.DeckOpen = copyIntMap(meta.DeckOpen)
	if meta.StoreReceipts != nil {
		out.StoreReceipts = make(map[string]*StoreReceipt, len(meta.StoreReceipts))
		for key, value := range meta.StoreReceipts {
			out.StoreReceipts[key] = value
		}
	}
	out.Villagers = make(map[string]*VillagerProgress, len(meta.Villagers))
	for villagerID, progress := range meta.Villagers {
		if progress == nil {
			progress = &VillagerProgress{
				Stamina: defaultVillagerStamina,
				Level:   1,
			}
		}
		clone := &VillagerProgress{
			Stamina: progress.Stamina,
			XP:      progress.XP,
			Level:   progress.Level,
		}
		if len(progress.Perks) > 0 {
			clone.Perks = append([]string{}, progress.Perks...)
		}
		s.decorateVillagerProgress(clone)
		out.Villagers[villagerID] = clone
	}
	out.Progression = s.progressionState()
	return out
}

func (s *Service) decorateVillagerProgress(progress *VillagerProgress) {
	if progress == nil {
		return
	}
	progress.MaxStamina = s.villagerMaxStamina(progress)
	nextLevel, nextLevelXP, xpToNext := s.nextLevelProgress(progress)
	progress.NextLevel = nextLevel
	progress.NextLevelXP = nextLevelXP
	progress.XPToNext = xpToNext
}

func (s *Service) progressionState() *ProgressionState {
	maxLevel := s.cfg.Villagers.Defaults.MaxLevel
	if maxLevel <= 0 {
		maxLevel = 10
	}

	thresholds := make(map[string]int, len(s.cfg.Villagers.Leveling.Thresholds))
	for level, threshold := range s.cfg.Villagers.Leveling.Thresholds {
		thresholds[fmt.Sprintf("%d", level)] = threshold
	}

	perksByLevel := map[string][]ProgressionPerk{}
	levels := make([]ProgressionLevel, 0, maxInt(maxLevel-1, 0))
	for level := 2; level <= maxLevel; level++ {
		perkIDs := s.cfg.PerksForLevel(level)
		perks := make([]ProgressionPerk, 0, len(perkIDs))
		for _, perkID := range perkIDs {
			perk := s.cfg.PerkByID(perkID)
			if perk == nil {
				continue
			}
			perks = append(perks, ProgressionPerk{
				ID:      perk.ID,
				Label:   perk.Label,
				Summary: perkSummary(perk),
			})
		}
		if len(perks) > 0 {
			perksByLevel[fmt.Sprintf("%d", level)] = perks
		}
		levels = append(levels, ProgressionLevel{
			Level:     level,
			Threshold: s.cfg.Villagers.Leveling.Thresholds[level],
			Perks:     perks,
		})
	}

	return &ProgressionState{
		MaxLevel:     maxLevel,
		Thresholds:   thresholds,
		PerksByLevel: perksByLevel,
		Levels:       levels,
	}
}

func ensureMeta(state *State) *BoardMeta {
	if state == nil {
		return &BoardMeta{
			Inventory:     map[string]int{},
			Villagers:     map[string]*VillagerProgress{},
			Metrics:       map[string]int{},
			DeckOpen:      map[string]int{},
			StoreReceipts: map[string]*StoreReceipt{},
		}
	}
	state.normalize()
	return &state.Meta
}

func firstVillagerIDFromStack(state *State, stack *Stack) string {
	if state == nil || stack == nil {
		return ""
	}
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil || cardKind(card.DefID) != "villager" {
			continue
		}
		return villagerIDFromCard(card, stack.ID)
	}
	return ""
}

func villagerIDFromCard(card *Card, fallbackID string) string {
	if card == nil || cardKind(card.DefID) != "villager" {
		return ""
	}
	if card.Data == nil {
		card.Data = map[string]any{}
	}
	if id, ok := card.Data["villagerId"].(string); ok {
		normalized := strings.TrimSpace(id)
		if normalized != "" {
			card.Data["villagerId"] = normalized
			return normalized
		}
	}
	normalizedFallback := strings.TrimSpace(fallbackID)
	if normalizedFallback == "" {
		normalizedFallback = strings.TrimSpace(card.ID)
	}
	if normalizedFallback == "" {
		normalizedFallback = "villager_default"
	}
	card.Data["villagerId"] = normalizedFallback
	return normalizedFallback
}

func ensureVillager(meta *BoardMeta, villagerID string) *VillagerProgress {
	if meta == nil {
		return &VillagerProgress{Stamina: defaultVillagerStamina, Level: 1}
	}
	if meta.Villagers == nil {
		meta.Villagers = map[string]*VillagerProgress{}
	}
	villagerID = strings.TrimSpace(villagerID)
	if villagerID == "" {
		villagerID = "villager_default"
	}
	progress := meta.Villagers[villagerID]
	if progress == nil {
		progress = &VillagerProgress{
			Stamina: defaultVillagerStamina,
			Level:   1,
		}
		meta.Villagers[villagerID] = progress
	}
	if progress.Level <= 0 {
		progress.Level = 1
	}
	if progress.Stamina < 0 {
		progress.Stamina = 0
	}
	return progress
}

func villagerHasPerk(progress *VillagerProgress, perkID string) bool {
	if progress == nil {
		return false
	}
	for _, perk := range progress.Perks {
		if strings.EqualFold(strings.TrimSpace(perk), strings.TrimSpace(perkID)) {
			return true
		}
	}
	return false
}

func (s *Service) villagerMaxStamina(progress *VillagerProgress) int {
	maxStamina := s.cfg.Villagers.Defaults.BaseMaxStamina
	if maxStamina <= 0 {
		maxStamina = defaultVillagerStamina
	}
	if progress == nil {
		return maxStamina
	}
	for _, perkID := range progress.Perks {
		perk := s.cfg.PerkByID(perkID)
		if perk == nil || perk.Apply == nil {
			continue
		}
		maxStamina += intFromAny(perk.Apply["max_stamina_add"])
	}
	if maxStamina <= 0 {
		return 1
	}
	return maxStamina
}

func (s *Service) nextLevelProgress(progress *VillagerProgress) (int, int, int) {
	if progress == nil {
		return 1, 0, 0
	}

	maxLevel := s.cfg.Villagers.Defaults.MaxLevel
	if maxLevel <= 0 {
		maxLevel = 10
	}

	currentLevel := progress.Level
	if currentLevel <= 0 {
		currentLevel = 1
	}
	if currentLevel >= maxLevel {
		return maxLevel, progress.XP, 0
	}

	thresholdLevels := s.cfg.LevelThresholdsSorted()
	for _, level := range thresholdLevels {
		threshold := s.cfg.Villagers.Leveling.Thresholds[level]
		if threshold > progress.XP {
			return level, threshold, threshold - progress.XP
		}
	}

	nextLevel := currentLevel + 1
	if nextLevel > maxLevel {
		nextLevel = maxLevel
	}
	nextXP := (nextLevel - 1) * xpPerLevel
	if nextXP < progress.XP {
		nextXP = progress.XP
	}
	return nextLevel, nextXP, maxInt(nextXP-progress.XP, 0)
}

func spendVillagerStamina(progress *VillagerProgress, cost int) (bool, int) {
	if progress == nil {
		return false, 0
	}
	if cost <= 0 {
		return true, progress.Stamina
	}
	if progress.Stamina < cost {
		return false, progress.Stamina
	}
	progress.Stamina -= cost
	if progress.Stamina < 0 {
		progress.Stamina = 0
	}
	return true, progress.Stamina
}

func restoreVillagerStamina(progress *VillagerProgress, amount int, maxStamina int) int {
	if progress == nil {
		return 0
	}
	if amount <= 0 {
		return progress.Stamina
	}
	progress.Stamina += amount
	if maxStamina <= 0 {
		maxStamina = defaultVillagerStamina
	}
	if progress.Stamina > maxStamina {
		progress.Stamina = maxStamina
	}
	return progress.Stamina
}
