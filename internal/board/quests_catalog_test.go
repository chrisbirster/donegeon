package board

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadQuestCatalogEmptyPathUsesDefaults(t *testing.T) {
	t.Parallel()

	catalog, err := LoadQuestCatalog("   ")
	if err != nil {
		t.Fatalf("load default quest catalog: %v", err)
	}
	if catalog.DailyDrawCount <= 0 {
		t.Fatalf("expected positive daily draw count, got %d", catalog.DailyDrawCount)
	}
	if len(catalog.DailyTemplates) == 0 {
		t.Fatal("expected default daily templates to be present")
	}
	if _, ok := catalog.BossesByWeek[1]; !ok {
		t.Fatal("expected default week 1 boss quest to be present")
	}
}

func TestLoadQuestCatalogFromYAMLOverridesData(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "quests.yaml")
	raw := `
meta:
  daily_draw_count: 1
  daily_no_repeat_days: 1
story_labels_by_week:
  2: { id: W02_CustomStory, title: "Week 2 Custom Story" }
daily_templates:
  - id: DQ_Custom
    template_id: DQ_Custom
    title: "Custom Daily"
    type: daily
    scope: day
    how_to_complete: "Complete one task."
    definition_of_done: "complete_task reaches 1."
    acceptance_criteria:
      - "complete_task current >= 1"
    objectives:
      - op: complete_task
        count: 1
        time_window: today
    rewards:
      - kind: roll_table
        table_id: daily_small
reward_tables:
  daily_small:
    id: daily_small
    rolls: 1
    entries:
      - weight: 1
        reward:
          kind: currency
          currency: coin
          amount: 99
`
	if err := os.WriteFile(path, []byte(raw), 0o600); err != nil {
		t.Fatalf("write temp quest yaml: %v", err)
	}

	catalog, err := LoadQuestCatalog(path)
	if err != nil {
		t.Fatalf("load quest catalog from yaml: %v", err)
	}

	if catalog.DailyDrawCount != 1 {
		t.Fatalf("expected daily_draw_count=1, got %d", catalog.DailyDrawCount)
	}
	if catalog.DailyNoRepeatDays != 1 {
		t.Fatalf("expected daily_no_repeat_days=1, got %d", catalog.DailyNoRepeatDays)
	}
	if got := catalog.StoryLabelsByWeek[2]; got.ID != "W02_CustomStory" {
		t.Fatalf("expected custom story label ID, got %+v", got)
	}
	if len(catalog.DailyTemplates) != 1 {
		t.Fatalf("expected exactly one custom daily template, got %d", len(catalog.DailyTemplates))
	}
	if got := catalog.DailyTemplates[0]; got.ID != "DQ_Custom" || got.HowToComplete == "" {
		t.Fatalf("expected custom daily template fields, got %+v", got)
	}

	table, ok := catalog.RewardTables["daily_small"]
	if !ok {
		t.Fatal("expected daily_small reward table to be present")
	}
	if len(table.Entries) != 1 || table.Entries[0].Reward.Amount != 99 {
		t.Fatalf("expected overridden daily_small reward entry amount=99, got %+v", table.Entries)
	}
	if _, ok := catalog.BossesByWeek[1]; !ok {
		t.Fatal("expected default week 1 boss quest to remain when bosses are not overridden")
	}
}
