package board

import (
	"fmt"
	"math/rand"
	"strings"
)

func topCard(state *State, stack *Stack) *Card {
	if state == nil || stack == nil || len(stack.Cards) == 0 {
		return nil
	}
	return state.GetCard(stack.Cards[len(stack.Cards)-1])
}

func isCollectDeckStack(state *State, stack *Stack) bool {
	card := topCard(state, stack)
	if card == nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(card.DefID), "deck.collect")
}

func cardKind(defID string) string {
	defID = strings.TrimSpace(defID)
	if defID == "" {
		return ""
	}
	if idx := strings.Index(defID, "."); idx > 0 {
		return defID[:idx]
	}
	return defID
}

func stackHasKind(state *State, stack *Stack, kind string) bool {
	if state == nil || stack == nil {
		return false
	}
	kind = strings.TrimSpace(kind)
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if cardKind(card.DefID) == kind {
			return true
		}
	}
	return false
}

func stackHasCardDefID(state *State, stack *Stack, defID string) bool {
	if state == nil || stack == nil {
		return false
	}
	normalized := strings.TrimSpace(strings.ToLower(defID))
	if normalized == "" {
		return false
	}
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if strings.TrimSpace(strings.ToLower(card.DefID)) == normalized {
			return true
		}
	}
	return false
}

func findStackByCardID(state *State, cardID string) *Stack {
	if state == nil {
		return nil
	}
	cardID = strings.TrimSpace(cardID)
	if cardID == "" {
		return nil
	}
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		for _, current := range stack.Cards {
			if current == cardID {
				return stack
			}
		}
	}
	return nil
}

func firstCardByKind(state *State, stack *Stack, kind string) *Card {
	if state == nil || stack == nil {
		return nil
	}
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if cardKind(card.DefID) == kind {
			return card
		}
	}
	return nil
}

func ensurePriorityFaceCard(state *State, stack *Stack) {
	if state == nil || stack == nil || len(stack.Cards) <= 1 {
		return
	}

	priorityKinds := []string{"task", "resource", "food"}
	targetIndex := -1
	for _, kind := range priorityKinds {
		for i := len(stack.Cards) - 1; i >= 0; i-- {
			card := state.GetCard(stack.Cards[i])
			if card == nil {
				continue
			}
			if cardKind(card.DefID) == kind {
				targetIndex = i
				break
			}
		}
		if targetIndex >= 0 {
			break
		}
	}

	if targetIndex < 0 || targetIndex == len(stack.Cards)-1 {
		return
	}

	faceCardID := stack.Cards[targetIndex]
	stack.Cards = append(stack.Cards[:targetIndex], stack.Cards[targetIndex+1:]...)
	stack.Cards = append(stack.Cards, faceCardID)
}

func ensureVillagerLeadsResourceStack(state *State, stack *Stack) {
	if state == nil || stack == nil || len(stack.Cards) <= 1 {
		return
	}

	faceResourceIndex := -1
	hasVillager := false
	hasResource := false
	for i, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		switch cardKind(card.DefID) {
		case "villager":
			hasVillager = true
		case "resource":
			hasResource = true
			faceResourceIndex = i
		}
	}

	if !hasVillager || !hasResource || faceResourceIndex < 0 {
		return
	}

	ordered := make([]string, 0, len(stack.Cards))
	middle := make([]string, 0, len(stack.Cards))

	for i, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if i == faceResourceIndex {
			continue
		}
		if cardKind(card.DefID) == "villager" {
			ordered = append(ordered, cardID)
			continue
		}
		middle = append(middle, cardID)
	}

	if len(ordered) == 0 {
		return
	}

	ordered = append(ordered, middle...)
	ordered = append(ordered, stack.Cards[faceResourceIndex])
	if len(ordered) != len(stack.Cards) {
		return
	}
	stack.Cards = ordered
}

func removeCardFromStack(state *State, stackID string, cardID string) {
	stack := state.GetStack(stackID)
	if stack == nil {
		return
	}
	next := make([]string, 0, len(stack.Cards))
	for _, current := range stack.Cards {
		if current == cardID {
			continue
		}
		next = append(next, current)
	}
	stack.Cards = next
	delete(state.Cards, cardID)
	if len(stack.Cards) == 0 {
		delete(state.Stacks, stackID)
	}
}

type deckUnlock struct {
	Type  string
	Value int
}

type weightedDeckDraw struct {
	CardType   string
	DefID      string
	VillagerID string
	ModifierID string
	LootID     string
	ResourceID string
	FoodID     string
	Amount     int
	Weight     int
	Data       map[string]any
}

type deckConfig struct {
	ID        string
	BaseCost  int
	FreeOpens int
	DrawCount int
	Unlock    deckUnlock
	DrawPool  []weightedDeckDraw
}

func (s *Service) deckConfigByID(deckID string) (deckConfig, bool) {
	entry := s.cfg.DeckByID(deckID)
	if entry == nil {
		return deckConfig{}, false
	}
	cfg := deckConfig{
		ID:        strings.TrimSpace(entry.ID),
		BaseCost:  entry.BaseCost,
		FreeOpens: entry.FreeOpens,
		DrawCount: entry.Draws.Count,
		Unlock: deckUnlock{
			Type:  strings.ToLower(strings.TrimSpace(asString(entry.UnlockCondition["type"]))),
			Value: intFromAny(entry.UnlockCondition["value"]),
		},
		DrawPool: make([]weightedDeckDraw, 0, len(entry.Draws.RNGPool)),
	}
	if cfg.Unlock.Type == "" {
		cfg.Unlock.Type = strings.ToLower(strings.TrimSpace(entry.Status))
	}
	if cfg.DrawCount <= 0 {
		cfg.DrawCount = 3
	}
	for _, draw := range entry.Draws.RNGPool {
		cfg.DrawPool = append(cfg.DrawPool, weightedDeckDraw{
			CardType:   strings.ToLower(strings.TrimSpace(draw.CardType)),
			VillagerID: strings.TrimSpace(draw.VillagerID),
			ModifierID: strings.TrimSpace(draw.ModifierID),
			LootID:     strings.TrimSpace(draw.LootID),
			ResourceID: strings.TrimSpace(draw.ResourceID),
			FoodID:     strings.TrimSpace(draw.FoodID),
			Amount:     draw.Amount,
			Weight:     draw.Weight,
			Data:       map[string]any{},
		})
	}
	if len(cfg.DrawPool) == 0 {
		cfg.DrawPool = []weightedDeckDraw{{CardType: "blank", Weight: 1}}
	}
	return cfg, true
}

func (s *Service) mapDeckDrawToCard(entry weightedDeckDraw, rng *rand.Rand) (string, map[string]any, error) {
	data := map[string]any{}
	for key, value := range entry.Data {
		data[key] = value
	}

	switch strings.ToLower(strings.TrimSpace(entry.CardType)) {
	case "", "blank", "task":
		defID := "task.blank"
		if strings.TrimSpace(entry.DefID) != "" {
			defID = strings.TrimSpace(entry.DefID)
		}
		data["title"] = asStringOr(data["title"], "")
		data["description"] = asStringOr(data["description"], "")
		if strings.TrimSpace(asString(data["project"])) == "" {
			data["project"] = "inbox"
		}
		return defID, data, nil
	case "villager":
		defID := "villager.basic"
		if strings.TrimSpace(entry.DefID) != "" {
			defID = strings.TrimSpace(entry.DefID)
		}
		if entry.VillagerID != "" {
			data["villagerId"] = entry.VillagerID
		}
		return defID, data, nil
	case "modifier":
		defID := normalizeModifierDefID(entry.ModifierID)
		if defID == "" {
			defID = normalizeModifierDefID(entry.DefID)
		}
		if defID == "" {
			return "", nil, fmt.Errorf("modifier entry missing modifier id")
		}
		return defID, data, nil
	case "loot":
		lootID := strings.TrimSpace(entry.LootID)
		if lootID == "" {
			if strings.TrimSpace(entry.DefID) != "" && strings.HasPrefix(strings.TrimSpace(entry.DefID), "loot.") {
				lootID = strings.TrimPrefix(strings.TrimSpace(entry.DefID), "loot.")
			}
		}
		if lootID == "" {
			return "", nil, fmt.Errorf("loot entry missing loot id")
		}
		defID := "loot." + lootID
		if entry.Amount > 0 {
			data["amount"] = entry.Amount
		} else if _, ok := data["amount"]; !ok {
			data["amount"] = 1
		}
		return defID, data, nil
	case "resource":
		resourceID := strings.TrimSpace(entry.ResourceID)
		if resourceID == "" {
			if strings.TrimSpace(entry.DefID) != "" && strings.HasPrefix(strings.TrimSpace(entry.DefID), "resource.") {
				resourceID = strings.TrimPrefix(strings.TrimSpace(entry.DefID), "resource.")
			}
		}
		if resourceID == "" {
			return "", nil, fmt.Errorf("resource entry missing resource id")
		}
		if node := s.cfg.ResourceNodeByID(resourceID); node != nil {
			charges := randomResourceCharges(node.Charges.Min, node.Charges.Max, rng)
			data["charges"] = charges
			if node.Gather.BaseTimeS > 0 {
				data["gatherTimeS"] = node.Gather.BaseTimeS
			}
		} else if _, ok := data["charges"]; !ok {
			data["charges"] = 3
		}
		return "resource." + resourceID, data, nil
	case "food":
		foodID := strings.TrimSpace(entry.FoodID)
		if foodID == "" {
			if strings.TrimSpace(entry.DefID) != "" && strings.HasPrefix(strings.TrimSpace(entry.DefID), "food.") {
				foodID = strings.TrimPrefix(strings.TrimSpace(entry.DefID), "food.")
			}
		}
		if foodID == "" {
			return "", nil, fmt.Errorf("food entry missing food id")
		}
		if entry.Amount > 0 {
			data["amount"] = entry.Amount
		} else if _, ok := data["amount"]; !ok {
			data["amount"] = 1
		}
		return "food." + foodID, data, nil
	case "zombie":
		zombieID := "default_zombie"
		if len(s.cfg.Zombies.Types) > 0 && strings.TrimSpace(s.cfg.Zombies.Types[0].ID) != "" {
			zombieID = strings.TrimSpace(s.cfg.Zombies.Types[0].ID)
		}
		if strings.TrimSpace(entry.DefID) != "" {
			if strings.HasPrefix(strings.TrimSpace(entry.DefID), "zombie.") {
				return strings.TrimSpace(entry.DefID), data, nil
			}
			zombieID = strings.TrimSpace(entry.DefID)
		}
		return "zombie." + zombieID, data, nil
	default:
		if strings.TrimSpace(entry.DefID) != "" {
			return strings.TrimSpace(entry.DefID), data, nil
		}
		return "", nil, fmt.Errorf("unsupported deck card_type: %s", entry.CardType)
	}
}

func pickWeightedDeckEntry(pool []weightedDeckDraw, rng *rand.Rand) (weightedDeckDraw, error) {
	total := 0
	for _, entry := range pool {
		if entry.Weight > 0 {
			total += entry.Weight
		}
	}
	if total <= 0 {
		return weightedDeckDraw{}, fmt.Errorf("deck rng_pool has no positive weights")
	}
	pick := rng.Intn(total)
	running := 0
	for _, entry := range pool {
		if entry.Weight <= 0 {
			continue
		}
		running += entry.Weight
		if pick < running {
			return entry, nil
		}
	}
	return weightedDeckDraw{}, fmt.Errorf("failed to draw deck entry")
}
