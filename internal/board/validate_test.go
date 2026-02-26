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
