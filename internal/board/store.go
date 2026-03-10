package board

import (
	"context"
	"fmt"
	"strings"
	"time"
)

const (
	storeItemCoinStash        = "coin_stash"
	storeItemOrganizationPack = "organization_pack"
	storeItemSurvivalPack     = "survival_pack"
	storeItemModifierBundle   = "modifier_bundle"
	storeItemVillagerContract = "villager_contract"
)

type StoreCatalogItem struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Badge       string   `json:"badge,omitempty"`
	PriceCents  int      `json:"priceCents"`
	Currency    string   `json:"currency"`
	Contents    []string `json:"contents,omitempty"`
}

type StoreReceipt struct {
	SessionID       string `json:"sessionId"`
	ItemID          string `json:"itemId"`
	PaymentIntentID string `json:"paymentIntentId,omitempty"`
	CustomerID      string `json:"customerId,omitempty"`
	GrantedAt       string `json:"grantedAt"`
}

type StorePurchaseGrant struct {
	SessionID       string
	ItemID          string
	PaymentIntentID string
	CustomerID      string
	GrantedAt       time.Time
}

type StoreFulfillmentResult struct {
	Item           StoreCatalogItem
	AlreadyApplied bool
	Created        []*Stack
	Inventory      map[string]int
}

var defaultStoreCatalog = []StoreCatalogItem{
	{
		ID:          storeItemOrganizationPack,
		Name:        "Organization Pack",
		Description: "A fresh tactics pack for task structure, triage, and planning moves.",
		Category:    "Packs",
		Badge:       "Task Flow",
		PriceCents:  500,
		Currency:    "usd",
		Contents: []string{
			"1 Organization pack delivered to your board",
			"Open it on the board to reveal new cards",
		},
	},
	{
		ID:          storeItemSurvivalPack,
		Name:        "Survival Pack",
		Description: "A board-ready pack aimed at stamina, sustain, and day-to-day resilience.",
		Category:    "Packs",
		Badge:       "Sustain",
		PriceCents:  500,
		Currency:    "usd",
		Contents: []string{
			"1 Survival pack delivered to your board",
			"Useful for keeping runs stable across longer sessions",
		},
	},
	{
		ID:          storeItemCoinStash,
		Name:        "Quartermaster Coin Stash",
		Description: "Instantly credits extra coin to the selected board inventory.",
		Category:    "Currency",
		Badge:       "Best Value",
		PriceCents:  300,
		Currency:    "usd",
		Contents: []string{
			"25 coin added directly to board inventory",
			"Available immediately after Stripe confirms payment",
		},
	},
	{
		ID:          storeItemModifierBundle,
		Name:        "Modifier Bundle",
		Description: "A ready-to-play set of board modifiers for deadline, recurrence, and next-action control.",
		Category:    "Modifiers",
		Badge:       "Utility",
		PriceCents:  400,
		Currency:    "usd",
		Contents: []string{
			"2 Next Action cards",
			"1 Deadline Pin card",
			"1 Recurring card",
		},
	},
	{
		ID:          storeItemVillagerContract,
		Name:        "Field Recruit Contract",
		Description: "Hire another villager and drop them straight onto the target board.",
		Category:    "Crew",
		Badge:       "Expansion",
		PriceCents:  600,
		Currency:    "usd",
		Contents: []string{
			"1 new villager delivered to your board",
			"Useful when current villagers are over-allocated",
		},
	},
}

func StoreCatalog() []StoreCatalogItem {
	items := make([]StoreCatalogItem, 0, len(defaultStoreCatalog))
	for _, item := range defaultStoreCatalog {
		cloned := item
		if len(item.Contents) > 0 {
			cloned.Contents = append([]string{}, item.Contents...)
		}
		items = append(items, cloned)
	}
	return items
}

func StoreItemByID(raw string) (StoreCatalogItem, bool) {
	itemID := strings.TrimSpace(raw)
	for _, item := range defaultStoreCatalog {
		if strings.EqualFold(item.ID, itemID) {
			cloned := item
			if len(item.Contents) > 0 {
				cloned.Contents = append([]string{}, item.Contents...)
			}
			return cloned, true
		}
	}
	return StoreCatalogItem{}, false
}

func (s *Service) GrantStorePurchase(ctx context.Context, boardID string, grant StorePurchaseGrant) (StoreFulfillmentResult, error) {
	boardID, err := NormalizeBoardID(boardID)
	if err != nil {
		return StoreFulfillmentResult{}, err
	}

	sessionID := strings.TrimSpace(grant.SessionID)
	if sessionID == "" {
		return StoreFulfillmentResult{}, fmt.Errorf("store session id is required")
	}
	itemID := strings.TrimSpace(grant.ItemID)
	if itemID == "" {
		return StoreFulfillmentResult{}, fmt.Errorf("store item id is required")
	}
	item, ok := StoreItemByID(itemID)
	if !ok {
		return StoreFulfillmentResult{}, fmt.Errorf("unsupported store item: %s", itemID)
	}
	if grant.GrantedAt.IsZero() {
		grant.GrantedAt = time.Now().UTC()
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.repo.Load(ctx, boardID)
	if err != nil {
		return StoreFulfillmentResult{}, err
	}

	if len(state.Stacks) == 0 {
		if _, err := s.cmdBoardSeedDefault(state, map[string]any{"deckRowY": 500}); err != nil {
			return StoreFulfillmentResult{}, err
		}
	}

	meta := ensureMeta(state)
	if _, exists := meta.StoreReceipts[sessionID]; exists {
		return StoreFulfillmentResult{
			Item:           item,
			AlreadyApplied: true,
			Inventory:      copyIntMap(meta.Inventory),
		}, nil
	}

	created, err := s.applyStoreItemGrant(state, item)
	if err != nil {
		return StoreFulfillmentResult{}, err
	}
	meta.StoreReceipts[sessionID] = &StoreReceipt{
		SessionID:       sessionID,
		ItemID:          item.ID,
		PaymentIntentID: strings.TrimSpace(grant.PaymentIntentID),
		CustomerID:      strings.TrimSpace(grant.CustomerID),
		GrantedAt:       grant.GrantedAt.UTC().Format(time.RFC3339),
	}

	if err := s.repo.Save(ctx, boardID, state); err != nil {
		return StoreFulfillmentResult{}, err
	}

	return StoreFulfillmentResult{
		Item:      item,
		Created:   created,
		Inventory: copyIntMap(meta.Inventory),
	}, nil
}

func (s *Service) applyStoreItemGrant(state *State, item StoreCatalogItem) ([]*Stack, error) {
	meta := ensureMeta(state)
	origin := storeDeliveryOrigin(state)
	created := []*Stack{}
	spawn := func(defID string, index int, data map[string]any) {
		created = append(created, createSingleCardStack(state, defID, storeDeliveryPoint(origin, index), data))
	}

	switch item.ID {
	case storeItemCoinStash:
		meta.Inventory["coin"] += 25
	case storeItemOrganizationPack:
		spawn("deck.organization_pack", 0, map[string]any{
			"deckId":      "deck.organization",
			"storeItemId": item.ID,
		})
	case storeItemSurvivalPack:
		spawn("deck.survival_pack", 0, map[string]any{
			"deckId":      "deck.survival",
			"storeItemId": item.ID,
		})
	case storeItemModifierBundle:
		modifiers := []string{"mod.next_action", "mod.next_action", "mod.deadline_pin", "mod.recurring"}
		for index, defID := range modifiers {
			spawn(defID, index, map[string]any{"storeItemId": item.ID})
		}
	case storeItemVillagerContract:
		spawn("villager.basic", 0, map[string]any{
			"name":        "Field Recruit",
			"title":       "Field Recruit",
			"storeItemId": item.ID,
		})
	default:
		return nil, fmt.Errorf("unsupported store item: %s", item.ID)
	}

	return created, nil
}

func storeDeliveryOrigin(state *State) Point {
	if state == nil || len(state.Stacks) == 0 {
		return Point{X: 620, Y: 180}
	}

	maxX := 0
	minY := 180
	initialized := false
	for _, stack := range state.Stacks {
		if stack == nil {
			continue
		}
		if !initialized || stack.Pos.X > maxX {
			maxX = stack.Pos.X
		}
		if !initialized || stack.Pos.Y < minY {
			minY = stack.Pos.Y
		}
		initialized = true
	}
	if !initialized {
		return Point{X: 620, Y: 180}
	}
	if minY < 140 {
		minY = 140
	}
	return Point{X: maxX + 150, Y: minY}
}

func storeDeliveryPoint(origin Point, index int) Point {
	if index < 0 {
		index = 0
	}
	col := index % 3
	row := index / 3
	return Point{
		X: origin.X + (col * 118),
		Y: origin.Y + (row * 148),
	}
}
