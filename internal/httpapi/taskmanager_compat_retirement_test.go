package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

func TestRetiredTaskManagerActionIsBlockedAtHTTPBoundary(t *testing.T) {
	env := newParityEnv(t)
	defer env.server.Close()

	body := []byte(`{"action":"getWorkspaceInvitations","payload":{"workspaceId":"W1"}}`)
	req, err := http.NewRequest(http.MethodPost, env.server.URL+"/api/taskmanager/action", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer TOKEN_VALID")

	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("execute request: %v", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected retired action to return 404, got %d body=%s", resp.StatusCode, raw)
	}

	var payload struct {
		Error struct {
			Code  string `json:"code"`
			Field string `json:"field"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("decode response: %v body=%s", err, raw)
	}
	if payload.Error.Code != "NOT_FOUND" || payload.Error.Field != "action" {
		t.Fatalf("unexpected retirement error: %+v body=%s", payload.Error, raw)
	}
}

func TestCoreTaskManagerActionStillDispatchesAtHTTPBoundary(t *testing.T) {
	env := newParityEnv(t)
	defer env.server.Close()

	body := []byte(`{"action":"getTasks","payload":{}}`)
	req, err := http.NewRequest(http.MethodPost, env.server.URL+"/api/taskmanager/action", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer TOKEN_VALID")

	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("execute request: %v", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected core action to dispatch, got %d body=%s", resp.StatusCode, raw)
	}
}
