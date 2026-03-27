package board

import (
	"errors"
	"testing"
)

func TestValidateStackMergeAllowsPureLootStacksWhenAllowedPairsConfigured(t *testing.T) {
	t.Parallel()

	state := NewState()
	leftCard := state.CreateCard("loot.coin", nil)
	rightCard := state.CreateCard("loot.coin", nil)
	leftStack := state.CreateStack(Point{X: 100, Y: 100}, []string{leftCard.ID})
	rightStack := state.CreateStack(Point{X: 200, Y: 100}, []string{rightCard.ID})

	validator := NewValidator(ValidationRules{
		AllowedPairs: [][2]string{
			{"task", "task"},
		},
	})

	if err := validator.ValidateStackMerge(state, leftStack.ID, rightStack.ID); err != nil {
		t.Fatalf("expected loot+loot merge to be allowed, got error: %v", err)
	}
}

func TestValidateStackMergeDoesNotBypassForNonPureLootStacks(t *testing.T) {
	t.Parallel()

	state := NewState()
	taskCard := state.CreateCard("task.blank", nil)
	lootCardA := state.CreateCard("loot.coin", nil)
	lootCardB := state.CreateCard("loot.parts", nil)
	mixedStack := state.CreateStack(Point{X: 100, Y: 100}, []string{taskCard.ID, lootCardA.ID})
	lootStack := state.CreateStack(Point{X: 200, Y: 100}, []string{lootCardB.ID})

	validator := NewValidator(ValidationRules{
		AllowedPairs: [][2]string{
			{"task", "task"},
		},
	})

	err := validator.ValidateStackMerge(state, mixedStack.ID, lootStack.ID)
	if !errors.Is(err, ErrInvalidStackPair) {
		t.Fatalf("expected non-pure loot merge to remain blocked by allowed_pairs, got: %v", err)
	}
}

func TestValidateStackMergeRejectsVillagerOntoLootParts(t *testing.T) {
	t.Parallel()

	state := NewState()
	villagerCard := state.CreateCard("villager.basic", nil)
	partsCard := state.CreateCard("loot.parts", nil)
	villagerStack := state.CreateStack(Point{X: 100, Y: 100}, []string{villagerCard.ID})
	partsStack := state.CreateStack(Point{X: 200, Y: 100}, []string{partsCard.ID})

	validator := NewValidator(ValidationRules{
		AllowedPairs: [][2]string{
			{"villager", "loot"},
		},
	})

	err := validator.ValidateStackMerge(state, villagerStack.ID, partsStack.ID)
	if !errors.Is(err, ErrInvalidStackPair) {
		t.Fatalf("expected villager+loot.parts merge to be rejected, got: %v", err)
	}
}

func TestValidateStackMergeRejectsModifierOnVillagerWithoutTask(t *testing.T) {
	t.Parallel()

	state := NewState()
	villagerCard := state.CreateCard("villager.basic", nil)
	modifierCard := state.CreateCard("mod.next_action", nil)
	villagerStack := state.CreateStack(Point{X: 100, Y: 100}, []string{villagerCard.ID})
	modifierStack := state.CreateStack(Point{X: 200, Y: 100}, []string{modifierCard.ID})

	validator := NewValidator(DefaultValidationRules())

	err := validator.ValidateStackMerge(state, villagerStack.ID, modifierStack.ID)
	if !errors.Is(err, ErrInvalidStackPair) {
		t.Fatalf("expected villager+modifier merge without task to be rejected, got: %v", err)
	}
}

func TestValidateStackMergeRejectsResourceOnUnlinkedBlankTask(t *testing.T) {
	t.Parallel()

	state := NewState()
	taskCard := state.CreateCard("task.blank", map[string]any{
		"title": "Blank Task",
	})
	resourceCard := state.CreateCard("resource.tree", nil)
	taskStack := state.CreateStack(Point{X: 100, Y: 100}, []string{taskCard.ID})
	resourceStack := state.CreateStack(Point{X: 200, Y: 100}, []string{resourceCard.ID})

	validator := NewValidator(DefaultValidationRules())

	err := validator.ValidateStackMerge(state, taskStack.ID, resourceStack.ID)
	if !errors.Is(err, ErrInvalidStackPair) {
		t.Fatalf("expected blank-task+resource merge to be rejected, got: %v", err)
	}
}

func TestValidateStackMergeAllowsResourceOnLinkedTask(t *testing.T) {
	t.Parallel()

	state := NewState()
	taskCard := state.CreateCard("task.blank", map[string]any{
		"title":  "Real Task",
		"taskId": "task-123",
	})
	resourceCard := state.CreateCard("resource.tree", nil)
	taskStack := state.CreateStack(Point{X: 100, Y: 100}, []string{taskCard.ID})
	resourceStack := state.CreateStack(Point{X: 200, Y: 100}, []string{resourceCard.ID})

	validator := NewValidator(DefaultValidationRules())

	if err := validator.ValidateStackMerge(state, taskStack.ID, resourceStack.ID); err != nil {
		t.Fatalf("expected linked-task+resource merge to remain allowed, got: %v", err)
	}
}

func TestValidateStackMergeAllowsModifierOnVillagerWhenTaskPresent(t *testing.T) {
	t.Parallel()

	state := NewState()
	taskCard := state.CreateCard("task.blank", nil)
	villagerCard := state.CreateCard("villager.basic", nil)
	modifierCard := state.CreateCard("mod.next_action", nil)
	taskVillagerStack := state.CreateStack(Point{X: 100, Y: 100}, []string{taskCard.ID, villagerCard.ID})
	modifierStack := state.CreateStack(Point{X: 200, Y: 100}, []string{modifierCard.ID})

	validator := NewValidator(DefaultValidationRules())

	if err := validator.ValidateStackMerge(state, taskVillagerStack.ID, modifierStack.ID); err != nil {
		t.Fatalf("expected modifier merge to remain allowed when task is present, got: %v", err)
	}
}
