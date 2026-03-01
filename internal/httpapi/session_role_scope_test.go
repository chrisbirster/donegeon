package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/gorilla/securecookie"
)

func TestSessionReaderRoleIsReadOnlyForWriteEndpoints(t *testing.T) {
	env := newParityEnv(t)
	defer env.server.Close()

	ctx := context.Background()
	sessionID, err := seedSessionUserRole(ctx, env, "U_READER", "reader@example.com", "Reader", "reader")
	if err != nil {
		t.Fatalf("seed reader user: %v", err)
	}

	req := newSessionProjectCreateRequest(t, env.server.URL, sessionID, "Reader Write")
	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("perform request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected status %d got %d", http.StatusForbidden, resp.StatusCode)
	}

	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Error.Code != "FORBIDDEN" {
		t.Fatalf("expected error code FORBIDDEN, got %q", payload.Error.Code)
	}
}

func TestSessionEditorRoleCanWriteEndpoints(t *testing.T) {
	env := newParityEnv(t)
	defer env.server.Close()

	ctx := context.Background()
	sessionID, err := seedSessionUserRole(ctx, env, "U_EDITOR", "editor@example.com", "Editor", "editor")
	if err != nil {
		t.Fatalf("seed editor user: %v", err)
	}

	req := newSessionProjectCreateRequest(t, env.server.URL, sessionID, "Editor Write")
	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("perform request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status %d got %d", http.StatusCreated, resp.StatusCode)
	}
}

func seedSessionUserRole(ctx context.Context, env *parityEnv, userID string, email string, name string, role string) (string, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	expires := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	sessionID := "AS_" + userID

	if _, err := env.db.ExecContext(ctx, `
INSERT INTO users (id, email, name, show_onboarding, current_workspace_id, created_at, updated_at)
VALUES (?, ?, ?, 0, 'W1', ?, ?)
ON CONFLICT(id) DO UPDATE SET
	email = excluded.email,
	name = excluded.name,
	show_onboarding = 0,
	current_workspace_id = 'W1',
	updated_at = excluded.updated_at
`, userID, email, name, now, now); err != nil {
		return "", err
	}

	if _, err := env.db.ExecContext(ctx, `
INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES ('W1', ?, ?, ?, ?, ?)
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
	email = excluded.email,
	name = excluded.name,
	role = excluded.role
`, userID, email, name, role, now); err != nil {
		return "", err
	}

	if _, err := env.db.ExecContext(ctx, `
INSERT INTO auth_sessions (
	id, user_id, workspace_id, email, created_at, updated_at, expires_at, revoked_at, last_seen_at, user_agent, ip_address
)
VALUES (?, ?, 'W1', ?, ?, ?, ?, NULL, ?, NULL, NULL)
ON CONFLICT(id) DO UPDATE SET
	user_id = excluded.user_id,
	workspace_id = excluded.workspace_id,
	email = excluded.email,
	expires_at = excluded.expires_at,
	revoked_at = NULL,
	updated_at = excluded.updated_at,
	last_seen_at = excluded.last_seen_at
`, sessionID, userID, email, now, now, expires, now); err != nil {
		return "", err
	}

	return sessionID, nil
}

func newSessionProjectCreateRequest(t *testing.T, baseURL string, sessionID string, projectName string) *http.Request {
	t.Helper()

	body := map[string]any{"name": projectName}
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/api/projects", bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Timezone", "UTC")

	sc := securecookie.New([]byte("test-signing-key"), nil)
	encoded, err := sc.Encode(authSessionCookieName, map[string]string{"sid": sessionID})
	if err != nil {
		t.Fatalf("encode cookie: %v", err)
	}
	req.AddCookie(&http.Cookie{Name: authSessionCookieName, Value: encoded, Path: "/"})
	return req
}
