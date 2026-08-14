package board

import (
	"hash/fnv"
	"strings"
)

func legacyQuestDailyTemplates() []questDefinition {
	return []questDefinition{
		{
			ID:               "DQ_CompleteAny",
			TemplateID:       "DQ_CompleteAny",
			Title:            "Do Something",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "Mark any one open task as done.",
			DefinitionOfDone: "complete_task progress reaches 1 for today's quest window.",
			AcceptanceCriteria: []string{
				"Complete one task after today's daily quests are drawn.",
				"Progress increments from board quest metric quest.complete_task.",
			},
			Objectives: []questObjectiveSpec{
				{Op: "complete_task", Count: 1, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
		{
			ID:               "DQ_ProcessInbox",
			TemplateID:       "DQ_ProcessInbox",
			Title:            "Process the Inbox",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "From Tasks view, activate tasks onto the board using 'Make Live on Board'.",
			DefinitionOfDone: "process_inbox_count progress reaches 3 during today's quest window.",
			AcceptanceCriteria: []string{
				"Each successful board activation (task.activate) increments progress by 1.",
				"Quest completes when process_inbox_count current >= 3.",
			},
			Objectives: []questObjectiveSpec{
				{Op: "process_inbox_count", Count: 3, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
		{
			ID:               "DQ_AssignVillager",
			TemplateID:       "DQ_AssignVillager",
			Title:            "Put Someone to Work",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "Stack a villager card onto a task stack.",
			DefinitionOfDone: "assign_villager progress reaches 1 for today's quest window.",
			AcceptanceCriteria: []string{
				"Any valid villager-to-task assignment increments progress by 1.",
			},
			Objectives: []questObjectiveSpec{
				{Op: "assign_villager", Count: 1, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
		{
			ID:               "DQ_KeepZombiesLow",
			TemplateID:       "DQ_KeepZombiesLow",
			Title:            "Keep the Dead Quiet",
			Type:             questTypeDaily,
			Scope:            "day",
			HowToComplete:    "End the day with no more than one zombie on board.",
			DefinitionOfDone: "keep_zombies_below objective evaluates true (zombies <= 1).",
			AcceptanceCriteria: []string{
				"Objective remains complete while zombie stack count is 0 or 1.",
			},
			Objectives: []questObjectiveSpec{
				{Op: "keep_zombies_below", Value: 1, TimeWindow: "today"},
			},
			Rewards: []questRewardSpec{
				{Kind: "roll_table", TableID: "daily_small"},
			},
		},
	}
}

func questDailyTemplates(catalog QuestCatalog) []questDefinition {
	return copyQuestDefinitions(catalog.DailyTemplates)
}

func normalizeQuestOp(op string) string {
	return strings.ToLower(strings.TrimSpace(op))
}

func normalizeQuestRef(ref string) string {
	normalized := strings.ToLower(strings.TrimSpace(ref))
	normalized = strings.ReplaceAll(normalized, "_", ".")
	return normalized
}

func questMetricBaseKey(op string) string {
	normalized := normalizeQuestOp(op)
	if normalized == "" {
		return ""
	}
	return "quest." + normalized
}

func questMetricKey(op string, ref string) string {
	base := questMetricBaseKey(op)
	ref = normalizeQuestRef(ref)
	if base == "" || ref == "" {
		return base
	}
	return base + "::" + ref
}

func incrementQuestMetric(meta *BoardMeta, op string, ref string, delta int) {
	if meta == nil || delta == 0 {
		return
	}
	if meta.Metrics == nil {
		meta.Metrics = map[string]int{}
	}
	base := questMetricBaseKey(op)
	if base == "" {
		return
	}
	meta.Metrics[base] += delta
	refKey := questMetricKey(op, ref)
	if refKey != "" && refKey != base {
		meta.Metrics[refKey] += delta
	}
}

func questMetricValue(meta *BoardMeta, op string, ref string) int {
	if meta == nil || meta.Metrics == nil {
		return 0
	}
	key := questMetricKey(op, ref)
	if key == "" {
		return 0
	}
	if normalizeQuestRef(ref) != "" {
		return meta.Metrics[key]
	}
	return meta.Metrics[questMetricBaseKey(op)]
}

func isCounterObjective(op string) bool {
	switch normalizeQuestOp(op) {
	case "create_task",
		"complete_task",
		"move_task_to_project",
		"assign_villager",
		"open_deck",
		"attach_modifier",
		"clear_zombie",
		"build_building",
		"schedule_task",
		"process_inbox_count":
		return true
	default:
		return false
	}
}

func deterministicQuestSeed(parts ...string) int64 {
	hasher := fnv.New64a()
	for _, part := range parts {
		_, _ = hasher.Write([]byte(part))
		_, _ = hasher.Write([]byte{'|'})
	}
	return int64(hasher.Sum64())
}

func hasActiveQuest(quests *QuestState, questID string) bool {
	for _, item := range quests.Active {
		if item == nil {
			continue
		}
		if strings.EqualFold(item.ID, questID) {
			return true
		}
	}
	return false
}

func hasQuestHistory(quests *QuestState, questID string) bool {
	for _, item := range quests.History {
		if strings.EqualFold(item.ID, questID) {
			return true
		}
	}
	return false
}

func hasQuest(quests *QuestState, questID string) bool {
	return hasActiveQuest(quests, questID) || hasQuestHistory(quests, questID)
}
