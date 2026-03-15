package board

import (
	"errors"
	"fmt"
	"strings"
)

var (
	ErrTooManyModifiers      = errors.New("too many modifiers on task")
	ErrDuplicateModifier     = errors.New("duplicate modifier type not allowed")
	ErrGlobalUniqueViolation = errors.New("modifier is globally unique and already exists")
	ErrInvalidStackPair      = errors.New("these card types cannot be stacked together")
)

type ValidationRules struct {
	MaxModifiersPerTask    int
	AllowDuplicateTypes    bool
	DuplicateTypeAllowlist map[string]struct{}
	GlobalUniqueModifiers  map[string]struct{}
	DisallowedPairs        [][2]string
	AllowedPairs           [][2]string
}

type Validator struct {
	rules ValidationRules
}

func DefaultValidationRules() ValidationRules {
	return ValidationRules{
		MaxModifiersPerTask: 6,
		AllowDuplicateTypes: false,
		DuplicateTypeAllowlist: map[string]struct{}{
			"mod.next_action": {},
		},
		GlobalUniqueModifiers: map[string]struct{}{
			"mod.deadline_pin": {},
		},
		DisallowedPairs: [][2]string{
			{"task", "zombie"},
			{"villager", "zombie"},
			{"resource", "zombie"},
			{"food", "zombie"},
		},
	}
}

func ValidationRulesFromGameplay(cfg GameplayConfig) ValidationRules {
	defaults := DefaultValidationRules()

	rules := ValidationRules{
		MaxModifiersPerTask:    cfg.Modifiers.GlobalRules.MaxModifiersPerTask,
		AllowDuplicateTypes:    cfg.Modifiers.GlobalRules.AllowDuplicateTypes,
		DuplicateTypeAllowlist: map[string]struct{}{},
		GlobalUniqueModifiers:  map[string]struct{}{},
		DisallowedPairs:        make([][2]string, 0, len(cfg.Rules.Stacking.Disallowed)),
		AllowedPairs:           make([][2]string, 0, len(cfg.Rules.Stacking.AllowedPairs)),
	}

	for _, value := range cfg.Modifiers.GlobalRules.DuplicateTypeAllowlist {
		value = normalizeModifierDefID(value)
		if value == "" {
			continue
		}
		rules.DuplicateTypeAllowlist[value] = struct{}{}
	}
	for _, value := range cfg.Rules.Uniqueness.GlobalUniqueModifiers {
		value = normalizeModifierDefID(value)
		if value == "" {
			continue
		}
		rules.GlobalUniqueModifiers[value] = struct{}{}
	}
	for _, pair := range cfg.Rules.Stacking.Disallowed {
		if len(pair) != 2 {
			continue
		}
		rules.DisallowedPairs = append(rules.DisallowedPairs, [2]string{
			strings.TrimSpace(strings.ToLower(pair[0])),
			strings.TrimSpace(strings.ToLower(pair[1])),
		})
	}
	for _, pair := range cfg.Rules.Stacking.AllowedPairs {
		if len(pair) != 2 {
			continue
		}
		rules.AllowedPairs = append(rules.AllowedPairs, [2]string{
			strings.TrimSpace(strings.ToLower(pair[0])),
			strings.TrimSpace(strings.ToLower(pair[1])),
		})
	}

	if rules.MaxModifiersPerTask <= 0 {
		rules.MaxModifiersPerTask = defaults.MaxModifiersPerTask
	}
	if len(rules.DuplicateTypeAllowlist) == 0 {
		rules.DuplicateTypeAllowlist = defaults.DuplicateTypeAllowlist
	}
	if len(rules.GlobalUniqueModifiers) == 0 {
		rules.GlobalUniqueModifiers = defaults.GlobalUniqueModifiers
	}
	if len(rules.DisallowedPairs) == 0 {
		rules.DisallowedPairs = defaults.DisallowedPairs
	}

	return rules
}

func NewValidator(rules ValidationRules) *Validator {
	if rules.DuplicateTypeAllowlist == nil {
		rules.DuplicateTypeAllowlist = map[string]struct{}{}
	}
	if rules.GlobalUniqueModifiers == nil {
		rules.GlobalUniqueModifiers = map[string]struct{}{}
	}
	return &Validator{rules: rules}
}

func (v *Validator) ValidateModifierAdd(state *State, taskStackID string, modifierDefID string) error {
	stack := state.GetStack(taskStackID)
	if stack == nil {
		return fmt.Errorf("stack not found: %s", taskStackID)
	}

	modifierDefID = normalizeModifierDefID(modifierDefID)
	modifierCount := 0
	modifierTypes := map[string]bool{}
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if validationKind(card.DefID) == "modifier" {
			modifierCount++
			modifierTypes[strings.TrimSpace(card.DefID)] = true
		}
	}

	if v.rules.MaxModifiersPerTask > 0 && modifierCount >= v.rules.MaxModifiersPerTask {
		return ErrTooManyModifiers
	}
	if modifierTypes[modifierDefID] && !v.rules.AllowDuplicateTypes {
		if _, allowed := v.rules.DuplicateTypeAllowlist[modifierDefID]; !allowed {
			return ErrDuplicateModifier
		}
	}

	if _, globallyUnique := v.rules.GlobalUniqueModifiers[modifierDefID]; globallyUnique {
		for _, card := range state.Cards {
			if card == nil {
				continue
			}
			if strings.EqualFold(strings.TrimSpace(card.DefID), modifierDefID) {
				return ErrGlobalUniqueViolation
			}
		}
	}

	return nil
}

func (v *Validator) ValidateStackMerge(state *State, targetID, sourceID string) error {
	target := state.GetStack(targetID)
	source := state.GetStack(sourceID)
	if target == nil || source == nil {
		return nil
	}

	targetKinds := v.stackCardKinds(state, target)
	sourceKinds := v.stackCardKinds(state, source)

	// Deck stacks are immutable anchors; collection is handled via loot.collect_stack.
	if targetKinds["deck"] || sourceKinds["deck"] {
		return ErrInvalidStackPair
	}

	// Loot cards should always be stackable with loot cards, even when
	// allowed_pairs is configured and omits loot.
	if isPureKindStack(targetKinds, "loot") && isPureKindStack(sourceKinds, "loot") {
		return nil
	}

	hasTaskAcrossMerge := targetKinds["task"] || sourceKinds["task"]

	if isPureModifierStack(targetKinds) && isPureModifierStack(sourceKinds) {
		targetDef, targetOK := singleModifierDefID(state, target)
		sourceDef, sourceOK := singleModifierDefID(state, source)
		if targetOK && sourceOK && targetDef == sourceDef {
			return nil
		}
	}

	// Resource stacks model a single worker assignment. Adding a second villager
	// would create ambiguous gather ownership and a visually nonsensical stack.
	if resourceMergeWouldCreateMultipleVillagers(state, target, source) {
		return ErrInvalidStackPair
	}

	for _, pair := range v.rules.DisallowedPairs {
		if hasTaskAcrossMerge &&
			((pair[0] == "modifier" && pair[1] == "villager") || (pair[0] == "villager" && pair[1] == "modifier")) {
			continue
		}
		if pairMatchesKinds(pair, targetKinds, sourceKinds) {
			return ErrInvalidStackPair
		}
	}

	if len(v.rules.AllowedPairs) > 0 {
		allowed := false
		for _, pair := range v.rules.AllowedPairs {
			if pairMatchesKinds(pair, targetKinds, sourceKinds) {
				allowed = true
				break
			}
		}
		if !allowed {
			return ErrInvalidStackPair
		}
	}

	return nil
}

func resourceMergeWouldCreateMultipleVillagers(state *State, target *Stack, source *Stack) bool {
	if state == nil || target == nil || source == nil {
		return false
	}

	hasResource := false
	villagerCount := 0
	seenStacks := map[string]struct{}{}

	for _, stack := range []*Stack{target, source} {
		if stack == nil {
			continue
		}
		if _, seen := seenStacks[stack.ID]; seen {
			continue
		}
		seenStacks[stack.ID] = struct{}{}
		for _, cardID := range stack.Cards {
			card := state.GetCard(cardID)
			if card == nil {
				continue
			}
			switch validationKind(card.DefID) {
			case "resource":
				hasResource = true
			case "villager":
				villagerCount++
			}
		}
	}

	return hasResource && villagerCount > 1
}

func (v *Validator) stackCardKinds(state *State, stack *Stack) map[string]bool {
	kinds := map[string]bool{}
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		kinds[validationKind(card.DefID)] = true
	}
	return kinds
}

func validationKind(defID string) string {
	kind := cardKind(defID)
	if kind == "mod" {
		return "modifier"
	}
	return kind
}

func isPureModifierStack(kinds map[string]bool) bool {
	return len(kinds) == 1 && kinds["modifier"]
}

func isPureKindStack(kinds map[string]bool, kind string) bool {
	kind = strings.TrimSpace(strings.ToLower(kind))
	if kind == "" {
		return false
	}
	return len(kinds) == 1 && kinds[kind]
}

func singleModifierDefID(state *State, stack *Stack) (string, bool) {
	modDef := ""
	for _, cardID := range stack.Cards {
		card := state.GetCard(cardID)
		if card == nil {
			continue
		}
		if validationKind(card.DefID) != "modifier" {
			return "", false
		}
		defID := strings.TrimSpace(card.DefID)
		if modDef == "" {
			modDef = defID
			continue
		}
		if modDef != defID {
			return "", false
		}
	}
	return modDef, modDef != ""
}

func pairMatchesKinds(pair [2]string, targetKinds map[string]bool, sourceKinds map[string]bool) bool {
	for targetKind := range targetKinds {
		for sourceKind := range sourceKinds {
			if (targetKind == pair[0] && sourceKind == pair[1]) || (targetKind == pair[1] && sourceKind == pair[0]) {
				return true
			}
		}
	}
	return false
}
