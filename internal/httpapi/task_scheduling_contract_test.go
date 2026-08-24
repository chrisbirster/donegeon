package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"donegeon/internal/sessionctx"
	"donegeon/internal/task"
)

func TestTaskHTTPSchedulingClearContract(t *testing.T) {
	t.Parallel()

	api := newTaskLifecycleAPI(t)
	principal := sessionctx.Principal{UserID: "schedule-user", WorkspaceID: "schedule-workspace"}

	createReq := taskLifecycleRequest(t, http.MethodPost, "/api/tasks", map[string]any{
		"content":        "HTTP scheduled task",
		"priority":       4,
		"recurrenceRule": "FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0",
		"dueText":        "2026-09-01T09:00:00-04:00",
		"dueDeadline":    "2026-09-01T08:00:00-04:00",
		"scheduleInput":  "every day at 9am {8am}",
	}, principal, true)
	createRec := httptest.NewRecorder()
	api.handleCreateTask(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create scheduled task status: got=%d body=%s", createRec.Code, createRec.Body.String())
	}
	var created task.Task
	decodeLifecycleResponse(t, createRec, &created)
	if created.Recurrence == nil || created.DueText == nil || created.DueDeadline == nil || created.ScheduleInput == nil {
		t.Fatalf("create scheduled task response: %+v", created)
	}

	patchReq := taskLifecycleRequest(t, http.MethodPatch, "/api/tasks/"+created.ID, map[string]any{
		"recurrenceRule": "",
		"dueText":        "",
		"dueDeadline":    "",
		"scheduleInput":  "",
	}, principal, true)
	patchReq.SetPathValue("id", created.ID)
	patchRec := httptest.NewRecorder()
	api.handlePatchTask(patchRec, patchReq)
	if patchRec.Code != http.StatusOK {
		t.Fatalf("clear schedule status: got=%d body=%s", patchRec.Code, patchRec.Body.String())
	}
	var cleared task.Task
	decodeLifecycleResponse(t, patchRec, &cleared)
	if cleared.Recurrence != nil || cleared.DueText != nil || cleared.DueDeadline != nil || cleared.ScheduleInput != nil {
		t.Fatalf("HTTP schedule clear did not persist: %+v", cleared)
	}

	closeReq := taskLifecycleRequest(t, http.MethodPost, "/api/tasks/"+created.ID+"/close", nil, principal, true)
	closeReq.SetPathValue("id", created.ID)
	closeRec := httptest.NewRecorder()
	api.handleCloseTask(closeRec, closeReq)
	if closeRec.Code != http.StatusNoContent {
		t.Fatalf("close cleared schedule status: got=%d body=%s", closeRec.Code, closeRec.Body.String())
	}

	listReq := taskLifecycleRequest(t, http.MethodGet, "/api/tasks", nil, principal, false)
	listRec := httptest.NewRecorder()
	api.handleListTasks(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list after cleared close status: got=%d body=%s", listRec.Code, listRec.Body.String())
	}
	var list task.ListResult
	decodeLifecycleResponse(t, listRec, &list)
	if list.Total != 1 || len(list.Items) != 1 {
		t.Fatalf("cleared recurrence spawned an HTTP task: %+v", list)
	}
}
