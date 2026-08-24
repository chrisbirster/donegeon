package taskmanagercompat

import (
	"testing"

	"donegeon/internal/task"
)

func TestTaskFilterSemanticContract(t *testing.T) {
	t.Parallel()

	service, tasks := newOrganizationTestService(t)
	ownerCtx := organizationPrincipalContext("filter-owner", "filter-workspace")
	foreignCtx := organizationPrincipalContext("filter-foreign", "other-workspace")

	contentMatch, err := tasks.Create(ownerCtx, task.CreateInput{
		Content:     "Write Launch Notes",
		Description: "prepare the release",
		Priority:    4,
	})
	if err != nil {
		t.Fatalf("create content match: %v", err)
	}
	descriptionMatch, err := tasks.Create(ownerCtx, task.CreateInput{
		Content:     "Call vendor",
		Description: "LAUNCH coordination",
		Priority:    4,
	})
	if err != nil {
		t.Fatalf("create description match: %v", err)
	}
	checkedMatch, err := tasks.Create(ownerCtx, task.CreateInput{Content: "launch completed", Priority: 4})
	if err != nil {
		t.Fatalf("create checked match: %v", err)
	}
	if err := tasks.Close(ownerCtx, checkedMatch.ID); err != nil {
		t.Fatalf("close checked match: %v", err)
	}
	deletedMatch, err := tasks.Create(ownerCtx, task.CreateInput{Content: "launch deleted", Priority: 4})
	if err != nil {
		t.Fatalf("create deleted match: %v", err)
	}
	if err := tasks.Delete(ownerCtx, deletedMatch.ID); err != nil {
		t.Fatalf("delete match: %v", err)
	}
	if _, err := tasks.Create(foreignCtx, task.CreateInput{Content: "launch foreign", Priority: 4}); err != nil {
		t.Fatalf("create foreign match: %v", err)
	}

	result, err := service.Dispatch(ownerCtx, "getTasksByFilter", map[string]any{"filter": "LaUnCh"})
	if err != nil {
		t.Fatalf("filter tasks: %v", err)
	}
	payload := mustFilterPayload(t, result)
	items := mustFilterItems(t, payload)
	if payload["total"] != 2 || len(items) != 2 {
		t.Fatalf("unexpected filter result: total=%v items=%v", payload["total"], items)
	}
	ids := map[string]bool{}
	for _, item := range items {
		ids[item.ID] = true
		if item.Checked || item.IsDeleted {
			t.Fatalf("filter returned non-open task: %+v", item)
		}
	}
	if !ids[contentMatch.ID] || !ids[descriptionMatch.ID] {
		t.Fatalf("filter missed content/description matches: ids=%v", ids)
	}
	if ids[checkedMatch.ID] || ids[deletedMatch.ID] {
		t.Fatalf("filter leaked completed/deleted task: ids=%v", ids)
	}

	page1Raw, err := service.Dispatch(ownerCtx, "getTasksByFilter", map[string]any{"filter": "launch", "limit": 1, "cursor": 0})
	if err != nil {
		t.Fatalf("filter page 1: %v", err)
	}
	page1 := mustFilterPayload(t, page1Raw)
	page1Next, ok := page1["nextCursor"].(*int)
	if page1["total"] != 2 || len(mustFilterItems(t, page1)) != 1 || !ok || page1Next == nil || *page1Next != 1 {
		t.Fatalf("unexpected page 1: %+v", page1)
	}

	page2Raw, err := service.Dispatch(ownerCtx, "getTasksByFilter", map[string]any{"query": "launch", "limit": 1, "cursor": 1})
	if err != nil {
		t.Fatalf("filter page 2 through query alias: %v", err)
	}
	page2 := mustFilterPayload(t, page2Raw)
	page2Next, ok := page2["nextCursor"].(*int)
	if page2["total"] != 2 || len(mustFilterItems(t, page2)) != 1 || !ok || page2Next != nil {
		t.Fatalf("unexpected page 2: %+v", page2)
	}
}

func mustFilterPayload(t *testing.T, value any) map[string]any {
	t.Helper()
	payload, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("filter returned %T", value)
	}
	return payload
}

func mustFilterItems(t *testing.T, payload map[string]any) []task.Task {
	t.Helper()
	items, ok := payload["items"].([]task.Task)
	if !ok {
		t.Fatalf("filter items returned %T", payload["items"])
	}
	return items
}
