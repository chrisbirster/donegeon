package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"donegeon/internal/database"
	"donegeon/internal/quickadd"
	"donegeon/internal/sessionctx"
	"donegeon/internal/task"
)

func TestTaskHTTPLifecycleContract(t *testing.T) {
	t.Parallel()

	api := newTaskLifecycleAPI(t)
	principal := sessionctx.Principal{UserID: "api-user", WorkspaceID: "api-workspace", Email: "api@example.com"}

	createReq := taskLifecycleRequest(t, http.MethodPost, "/api/tasks", map[string]any{
		"content":     "API lifecycle",
		"description": "created over HTTP",
		"priority":    2,
		"sortOrder":   100,
		"dueText":     "2026-09-03T09:00:00-04:00",
		"labels":      []string{"HTTP", "Contract"},
	}, principal, true)
	createRec := httptest.NewRecorder()
	api.handleCreateTask(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create status: got=%d body=%s", createRec.Code, createRec.Body.String())
	}
	var created task.Task
	decodeLifecycleResponse(t, createRec, &created)
	if created.ID == "" || created.Content != "API lifecycle" || created.Description != "created over HTTP" || created.Priority != 2 || created.SortOrder != 100 {
		t.Fatalf("create response semantics: %+v", created)
	}
	if created.DueText == nil || *created.DueText != "2026-09-03T09:00:00-04:00" {
		t.Fatalf("create due text: %v", created.DueText)
	}
	if len(created.Labels) != 2 || created.Labels[0] != "http" || created.Labels[1] != "contract" {
		t.Fatalf("create labels: %v", created.Labels)
	}

	getReq := taskLifecycleRequest(t, http.MethodGet, "/api/tasks/"+created.ID, nil, principal, false)
	getReq.SetPathValue("id", created.ID)
	getRec := httptest.NewRecorder()
	api.handleGetTask(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("get status: got=%d body=%s", getRec.Code, getRec.Body.String())
	}
	var got task.Task
	decodeLifecycleResponse(t, getRec, &got)
	if got.ID != created.ID || got.Content != created.Content || got.Checked {
		t.Fatalf("get response semantics: %+v", got)
	}

	listReq := taskLifecycleRequest(t, http.MethodGet, "/api/tasks?limit=10", nil, principal, false)
	listRec := httptest.NewRecorder()
	api.handleListTasks(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list status: got=%d body=%s", listRec.Code, listRec.Body.String())
	}
	var list task.ListResult
	decodeLifecycleResponse(t, listRec, &list)
	if list.Total != 1 || len(list.Items) != 1 || list.Items[0].ID != created.ID {
		t.Fatalf("list response semantics: total=%d items=%v", list.Total, list.Items)
	}

	patchReq := taskLifecycleRequest(t, http.MethodPatch, "/api/tasks/"+created.ID, map[string]any{
		"content":     "API lifecycle updated",
		"description": "updated over HTTP",
		"priority":    1,
		"dueText":     "",
		"labels":      []string{"Updated"},
	}, principal, true)
	patchReq.SetPathValue("id", created.ID)
	patchRec := httptest.NewRecorder()
	api.handlePatchTask(patchRec, patchReq)
	if patchRec.Code != http.StatusOK {
		t.Fatalf("patch status: got=%d body=%s", patchRec.Code, patchRec.Body.String())
	}
	var updated task.Task
	decodeLifecycleResponse(t, patchRec, &updated)
	if updated.Content != "API lifecycle updated" || updated.Description != "updated over HTTP" || updated.Priority != 1 || updated.DueText != nil {
		t.Fatalf("patch response semantics: %+v", updated)
	}
	if len(updated.Labels) != 1 || updated.Labels[0] != "updated" {
		t.Fatalf("patch labels: %v", updated.Labels)
	}

	closeReq := taskLifecycleRequest(t, http.MethodPost, "/api/tasks/"+created.ID+"/close", nil, principal, true)
	closeReq.SetPathValue("id", created.ID)
	closeRec := httptest.NewRecorder()
	api.handleCloseTask(closeRec, closeReq)
	if closeRec.Code != http.StatusNoContent {
		t.Fatalf("close status: got=%d body=%s", closeRec.Code, closeRec.Body.String())
	}

	closed := getTaskThroughHandler(t, api, principal, created.ID)
	if !closed.Checked || closed.ProcessedCount != 1 {
		t.Fatalf("closed state: checked=%v processed=%d", closed.Checked, closed.ProcessedCount)
	}

	reopenReq := taskLifecycleRequest(t, http.MethodPost, "/api/tasks/"+created.ID+"/reopen", nil, principal, true)
	reopenReq.SetPathValue("id", created.ID)
	reopenRec := httptest.NewRecorder()
	api.handleReopenTask(reopenRec, reopenReq)
	if reopenRec.Code != http.StatusNoContent {
		t.Fatalf("reopen status: got=%d body=%s", reopenRec.Code, reopenRec.Body.String())
	}

	reopened := getTaskThroughHandler(t, api, principal, created.ID)
	if reopened.Checked || reopened.ProcessedCount != 1 {
		t.Fatalf("reopened state: checked=%v processed=%d", reopened.Checked, reopened.ProcessedCount)
	}

	deleteReq := taskLifecycleRequest(t, http.MethodDelete, "/api/tasks/"+created.ID, nil, principal, true)
	deleteReq.SetPathValue("id", created.ID)
	deleteRec := httptest.NewRecorder()
	api.handleDeleteTask(deleteRec, deleteReq)
	if deleteRec.Code != http.StatusNoContent {
		t.Fatalf("delete status: got=%d body=%s", deleteRec.Code, deleteRec.Body.String())
	}

	missingReq := taskLifecycleRequest(t, http.MethodGet, "/api/tasks/"+created.ID, nil, principal, false)
	missingReq.SetPathValue("id", created.ID)
	missingRec := httptest.NewRecorder()
	api.handleGetTask(missingRec, missingReq)
	if missingRec.Code != http.StatusNotFound {
		t.Fatalf("get deleted task status: got=%d body=%s", missingRec.Code, missingRec.Body.String())
	}

	emptyListReq := taskLifecycleRequest(t, http.MethodGet, "/api/tasks?limit=10", nil, principal, false)
	emptyListRec := httptest.NewRecorder()
	api.handleListTasks(emptyListRec, emptyListReq)
	if emptyListRec.Code != http.StatusOK {
		t.Fatalf("list after delete status: got=%d body=%s", emptyListRec.Code, emptyListRec.Body.String())
	}
	var empty task.ListResult
	decodeLifecycleResponse(t, emptyListRec, &empty)
	if empty.Total != 0 || len(empty.Items) != 0 {
		t.Fatalf("deleted task leaked through HTTP list: total=%d items=%v", empty.Total, empty.Items)
	}
}

func TestTaskHTTPTenantIsolationContract(t *testing.T) {
	t.Parallel()

	api := newTaskLifecycleAPI(t)
	owner := sessionctx.Principal{UserID: "owner", WorkspaceID: "workspace-a"}
	foreign := []sessionctx.Principal{
		{UserID: "other-user", WorkspaceID: "workspace-a"},
		{UserID: "owner", WorkspaceID: "workspace-b"},
	}

	createReq := taskLifecycleRequest(t, http.MethodPost, "/api/tasks", map[string]any{
		"content":  "private API task",
		"priority": 4,
	}, owner, true)
	createRec := httptest.NewRecorder()
	api.handleCreateTask(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create owner task status: got=%d body=%s", createRec.Code, createRec.Body.String())
	}
	var created task.Task
	decodeLifecycleResponse(t, createRec, &created)

	for _, principal := range foreign {
		getReq := taskLifecycleRequest(t, http.MethodGet, "/api/tasks/"+created.ID, nil, principal, false)
		getReq.SetPathValue("id", created.ID)
		getRec := httptest.NewRecorder()
		api.handleGetTask(getRec, getReq)
		if getRec.Code != http.StatusNotFound {
			t.Fatalf("foreign get leaked task for %+v: status=%d body=%s", principal, getRec.Code, getRec.Body.String())
		}

		listReq := taskLifecycleRequest(t, http.MethodGet, "/api/tasks", nil, principal, false)
		listRec := httptest.NewRecorder()
		api.handleListTasks(listRec, listReq)
		if listRec.Code != http.StatusOK {
			t.Fatalf("foreign list status for %+v: %d", principal, listRec.Code)
		}
		var list task.ListResult
		decodeLifecycleResponse(t, listRec, &list)
		if list.Total != 0 || len(list.Items) != 0 {
			t.Fatalf("foreign list leaked task for %+v: %+v", principal, list)
		}
	}
}

func newTaskLifecycleAPI(t *testing.T) *API {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "http-task-lifecycle.db")
	if err := database.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	db, err := database.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	queries, err := database.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	return &API{
		logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
		tasks:  task.NewService(task.NewRepository(db, queries), quickadd.NewParser()),
	}
}

func taskLifecycleRequest(t *testing.T, method, target string, body any, principal sessionctx.Principal, write bool) *http.Request {
	t.Helper()

	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body: %v", err)
		}
		reader = bytes.NewReader(encoded)
	}
	req := httptest.NewRequest(method, target, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("X-Timezone", "America/New_York")
	ctx := sessionctx.WithPrincipal(req.Context(), principal)
	if write {
		ctx = context.WithValue(ctx, ctxKeyScope, ScopeWrite)
	}
	return req.WithContext(ctx)
}

func getTaskThroughHandler(t *testing.T, api *API, principal sessionctx.Principal, id string) task.Task {
	t.Helper()
	req := taskLifecycleRequest(t, http.MethodGet, "/api/tasks/"+id, nil, principal, false)
	req.SetPathValue("id", id)
	rec := httptest.NewRecorder()
	api.handleGetTask(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("get task status: got=%d body=%s", rec.Code, rec.Body.String())
	}
	var item task.Task
	decodeLifecycleResponse(t, rec, &item)
	return item
}

func decodeLifecycleResponse(t *testing.T, rec *httptest.ResponseRecorder, target any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), target); err != nil {
		t.Fatalf("decode response body %q: %v", rec.Body.String(), err)
	}
}
