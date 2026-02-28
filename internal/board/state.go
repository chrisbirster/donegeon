package board

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type Point struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type Pan struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type VillagerProgress struct {
	Stamina int      `json:"stamina"`
	XP      int      `json:"xp"`
	Level   int      `json:"level"`
	Perks   []string `json:"perks,omitempty"`
}

type QuestObjectiveState struct {
	Op         string `json:"op"`
	Count      int    `json:"count,omitempty"`
	Value      int    `json:"value,omitempty"`
	Ref        string `json:"ref,omitempty"`
	TimeWindow string `json:"timeWindow,omitempty"`
	Baseline   int    `json:"baseline,omitempty"`
	Current    int    `json:"current"`
	Target     int    `json:"target"`
	Complete   bool   `json:"complete"`
}

type QuestRewardState struct {
	Kind       string `json:"kind"`
	Currency   string `json:"currency,omitempty"`
	Amount     int    `json:"amount,omitempty"`
	TableID    string `json:"tableId,omitempty"`
	CardType   string `json:"cardType,omitempty"`
	CardCount  int    `json:"cardCount,omitempty"`
	CardCharge int    `json:"cardCharge,omitempty"`
	XP         int    `json:"xp,omitempty"`
}

type QuestUnlockState struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

type QuestConsequenceState struct {
	Kind         string `json:"kind"`
	Amount       int    `json:"amount,omitempty"`
	DurationDays int    `json:"durationDays,omitempty"`
}

type QuestRuntime struct {
	ID                 string                  `json:"id"`
	TemplateID         string                  `json:"templateId,omitempty"`
	Title              string                  `json:"title"`
	Type               string                  `json:"type"`
	Scope              string                  `json:"scope"`
	Day                int                     `json:"day,omitempty"`
	Week               int                     `json:"week,omitempty"`
	HowToComplete      string                  `json:"howToComplete,omitempty"`
	DefinitionOfDone   string                  `json:"definitionOfDone,omitempty"`
	AcceptanceCriteria []string                `json:"acceptanceCriteria,omitempty"`
	Objectives         []QuestObjectiveState   `json:"objectives,omitempty"`
	Rewards            []QuestRewardState      `json:"rewards,omitempty"`
	Unlocks            []QuestUnlockState      `json:"unlocks,omitempty"`
	Consequences       []QuestConsequenceState `json:"consequences,omitempty"`
	Completed          bool                    `json:"completed"`
	Claimable          bool                    `json:"claimable"`
	Claimed            bool                    `json:"claimed"`
	Failed             bool                    `json:"failed,omitempty"`
	CompletedDay       int                     `json:"completedDay,omitempty"`
	ClaimedDay         int                     `json:"claimedDay,omitempty"`
}

type QuestHistoryEntry struct {
	ID                 string   `json:"id"`
	TemplateID         string   `json:"templateId,omitempty"`
	Title              string   `json:"title"`
	Type               string   `json:"type"`
	Scope              string   `json:"scope"`
	Day                int      `json:"day,omitempty"`
	Week               int      `json:"week,omitempty"`
	HowToComplete      string   `json:"howToComplete,omitempty"`
	DefinitionOfDone   string   `json:"definitionOfDone,omitempty"`
	AcceptanceCriteria []string `json:"acceptanceCriteria,omitempty"`
	Completed          bool     `json:"completed"`
	Claimed            bool     `json:"claimed"`
	Failed             bool     `json:"failed,omitempty"`
	CompletedDay       int      `json:"completedDay,omitempty"`
	ClaimedDay         int      `json:"claimedDay,omitempty"`
}

type QuestState struct {
	CurrentDay             int                 `json:"currentDay,omitempty"`
	CurrentWeek            int                 `json:"currentWeek,omitempty"`
	DailyStreak            int                 `json:"dailyStreak,omitempty"`
	LastDailyRefreshDay    int                 `json:"lastDailyRefreshDay,omitempty"`
	LastDailyClaimDay      int                 `json:"lastDailyClaimDay,omitempty"`
	RecentDailyTemplateIDs []string            `json:"recentDailyTemplateIds,omitempty"`
	Active                 []*QuestRuntime     `json:"active,omitempty"`
	History                []QuestHistoryEntry `json:"history,omitempty"`
	Unlocked               []QuestUnlockState  `json:"unlocked,omitempty"`
}

type BoardMeta struct {
	Inventory    map[string]int               `json:"inventory,omitempty"`
	Villagers    map[string]*VillagerProgress `json:"villagers,omitempty"`
	Metrics      map[string]int               `json:"metrics,omitempty"`
	DeckOpen     map[string]int               `json:"deckOpen,omitempty"`
	DayTickCount int                          `json:"dayTickCount,omitempty"`
	Quests       *QuestState                  `json:"quests,omitempty"`
}

type Stack struct {
	ID    string   `json:"id"`
	Pos   Point    `json:"pos"`
	Z     int      `json:"z"`
	Cards []string `json:"cards"`
}

type Card struct {
	ID    string         `json:"id"`
	DefID string         `json:"defId"`
	Data  map[string]any `json:"data,omitempty"`
}

type State struct {
	Stacks map[string]*Stack `json:"stacks"`
	Cards  map[string]*Card  `json:"cards"`
	NextZ  int               `json:"nextZ"`
	Pan    Pan               `json:"pan"`
	Meta   BoardMeta         `json:"meta,omitempty"`
}

func NewState() *State {
	return &State{
		Stacks: map[string]*Stack{},
		Cards:  map[string]*Card{},
		NextZ:  10,
		Pan:    Pan{},
	}
}

func (s *State) normalize() {
	if s.Stacks == nil {
		s.Stacks = map[string]*Stack{}
	}
	if s.Cards == nil {
		s.Cards = map[string]*Card{}
	}
	if s.Meta.Inventory == nil {
		s.Meta.Inventory = map[string]int{
			"coin":  0,
			"paper": 0,
			"ink":   0,
			"gear":  0,
			"parts": 0,
		}
	}
	if s.Meta.Villagers == nil {
		s.Meta.Villagers = map[string]*VillagerProgress{}
	}
	if s.Meta.Metrics == nil {
		s.Meta.Metrics = map[string]int{
			"zombies_seen":    0,
			"overrun_level":   0,
			"tasks_completed": 0,
			"zombies_cleared": 0,
			"day_ticks":       0,
		}
	}
	if s.Meta.DeckOpen == nil {
		s.Meta.DeckOpen = map[string]int{}
	}
	if s.Meta.Quests == nil {
		s.Meta.Quests = &QuestState{
			RecentDailyTemplateIDs: []string{},
			Active:                 []*QuestRuntime{},
			History:                []QuestHistoryEntry{},
			Unlocked:               []QuestUnlockState{},
		}
	} else {
		if s.Meta.Quests.RecentDailyTemplateIDs == nil {
			s.Meta.Quests.RecentDailyTemplateIDs = []string{}
		}
		if s.Meta.Quests.Active == nil {
			s.Meta.Quests.Active = []*QuestRuntime{}
		}
		if s.Meta.Quests.History == nil {
			s.Meta.Quests.History = []QuestHistoryEntry{}
		}
		if s.Meta.Quests.Unlocked == nil {
			s.Meta.Quests.Unlocked = []QuestUnlockState{}
		}
	}
	for villagerID, progress := range s.Meta.Villagers {
		if progress == nil {
			s.Meta.Villagers[villagerID] = &VillagerProgress{
				Stamina: 6,
				Level:   1,
			}
			continue
		}
		if progress.Level <= 0 {
			progress.Level = 1
		}
		if progress.Stamina < 0 {
			progress.Stamina = 0
		}
	}

	maxZ := 0
	for _, stack := range s.Stacks {
		if stack == nil {
			continue
		}
		if stack.Cards == nil {
			stack.Cards = []string{}
		}
		if stack.Z > maxZ {
			maxZ = stack.Z
		}
	}

	if s.NextZ < 10 {
		s.NextZ = 10
	}
	if s.NextZ < maxZ {
		s.NextZ = maxZ
	}
}

func (s *State) Version() string {
	s.normalize()
	return fmt.Sprintf("%d", s.NextZ)
}

func (s *State) nextZ() int {
	s.normalize()
	s.NextZ++
	return s.NextZ
}

func (s *State) GetStack(id string) *Stack {
	s.normalize()
	return s.Stacks[id]
}

func (s *State) GetCard(id string) *Card {
	s.normalize()
	return s.Cards[id]
}

func (s *State) CreateCard(defID string, data map[string]any) *Card {
	s.normalize()
	if data == nil {
		data = map[string]any{}
	}
	card := &Card{
		ID:    generateID("card"),
		DefID: defID,
		Data:  data,
	}
	s.Cards[card.ID] = card
	return card
}

func (s *State) CreateStack(pos Point, cards []string) *Stack {
	s.normalize()
	if cards == nil {
		cards = []string{}
	}
	stack := &Stack{
		ID:    generateID("stack"),
		Pos:   pos,
		Z:     s.nextZ(),
		Cards: append([]string(nil), cards...),
	}
	s.Stacks[stack.ID] = stack
	return stack
}

func (s *State) MoveStack(stackID string, pos Point) error {
	stack := s.GetStack(stackID)
	if stack == nil {
		return fmt.Errorf("stack not found: %s", stackID)
	}
	stack.Pos = pos
	return nil
}

func (s *State) BringToFront(stackID string) error {
	stack := s.GetStack(stackID)
	if stack == nil {
		return fmt.Errorf("stack not found: %s", stackID)
	}
	stack.Z = s.nextZ()
	return nil
}

func (s *State) MergeStacks(targetID, sourceID string) error {
	if targetID == sourceID {
		return nil
	}
	target := s.GetStack(targetID)
	if target == nil {
		return fmt.Errorf("target stack not found: %s", targetID)
	}
	source := s.GetStack(sourceID)
	if source == nil {
		return fmt.Errorf("source stack not found: %s", sourceID)
	}

	target.Cards = append(target.Cards, source.Cards...)
	delete(s.Stacks, sourceID)
	target.Z = s.nextZ()
	return nil
}

func (s *State) SplitStack(stackID string, index int, offset Point) (*Stack, error) {
	if index == 0 {
		return s.PopBottom(stackID, offset)
	}

	stack := s.GetStack(stackID)
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	if index <= 0 || index >= len(stack.Cards) {
		return nil, fmt.Errorf("could not split stack at index %d", index)
	}

	pulled := append([]string(nil), stack.Cards[index:]...)
	stack.Cards = append([]string(nil), stack.Cards[:index]...)

	newPos := Point{
		X: stack.Pos.X + offset.X,
		Y: stack.Pos.Y + offset.Y,
	}
	return s.CreateStack(newPos, pulled), nil
}

func (s *State) PopBottom(stackID string, offset Point) (*Stack, error) {
	stack := s.GetStack(stackID)
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	if len(stack.Cards) == 0 {
		return nil, fmt.Errorf("stack has no cards: %s", stackID)
	}

	cardID := stack.Cards[0]
	stack.Cards = stack.Cards[1:]

	newPos := Point{
		X: stack.Pos.X + offset.X,
		Y: stack.Pos.Y + offset.Y,
	}
	newStack := s.CreateStack(newPos, []string{cardID})

	if len(stack.Cards) == 0 {
		delete(s.Stacks, stackID)
	}

	return newStack, nil
}

func (s *State) Unstack(stackID string, positions []Point) ([]*Stack, error) {
	stack := s.GetStack(stackID)
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}
	if len(stack.Cards) <= 1 {
		return []*Stack{}, nil
	}

	cards := append([]string(nil), stack.Cards...)
	basePos := stack.Pos
	delete(s.Stacks, stackID)

	created := make([]*Stack, 0, len(cards))
	for i, cardID := range cards {
		pos := basePos
		if i < len(positions) {
			pos = positions[i]
		}
		created = append(created, s.CreateStack(pos, []string{cardID}))
	}

	return created, nil
}

func (s *State) RemoveStackAndCards(stackID string) ([]string, error) {
	stack := s.GetStack(stackID)
	if stack == nil {
		return nil, fmt.Errorf("stack not found: %s", stackID)
	}

	removedCards := make([]string, 0, len(stack.Cards))
	for _, cardID := range stack.Cards {
		delete(s.Cards, cardID)
		removedCards = append(removedCards, cardID)
	}
	delete(s.Stacks, stackID)

	return removedCards, nil
}

func generateID(prefix string) string {
	raw := strings.ReplaceAll(uuid.NewString(), "-", "")
	if len(raw) > 12 {
		raw = raw[:12]
	}
	return fmt.Sprintf("%s_%s", prefix, raw)
}
