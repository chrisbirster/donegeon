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

func TestBoardMemberCRUDByOwner(t *testing.T) {
	env := newParityEnv(t)
	defer env.server.Close()

	ctx := context.Background()
	ownerSessionID, err := seedSessionUserRole(ctx, env, "U1", "owner@example.com", "Owner", "owner")
	if err != nil {
		t.Fatalf("seed owner session: %v", err)
	}
	if err := setWorkspacePlan(ctx, env, "W1", "pro"); err != nil {
		t.Fatalf("set workspace plan: %v", err)
	}
	if err := seedWorkspaceMember(ctx, env, "U_MEMBER", "member@example.com", "Member", "editor"); err != nil {
		t.Fatalf("seed board target member: %v", err)
	}

	addReq := newSessionJSONRequest(t, env.server.URL, ownerSessionID, http.MethodPost, "/api/board/members?board=default", map[string]any{
		"userId": "U_MEMBER",
	})
	addResp, err := env.server.Client().Do(addReq)
	if err != nil {
		t.Fatalf("add board member request: %v", err)
	}
	defer addResp.Body.Close()
	if addResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected add status %d, got %d", http.StatusCreated, addResp.StatusCode)
	}

	membersAfterAdd := fetchBoardMembers(t, env, ownerSessionID)
	if !hasBoardMember(membersAfterAdd, "U_MEMBER") {
		t.Fatalf("expected U_MEMBER in board members after add")
	}

	deleteReq := newSessionJSONRequest(
		t,
		env.server.URL,
		ownerSessionID,
		http.MethodDelete,
		"/api/board/members/U_MEMBER?board=default",
		nil,
	)
	deleteResp, err := env.server.Client().Do(deleteReq)
	if err != nil {
		t.Fatalf("delete board member request: %v", err)
	}
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected delete status %d, got %d", http.StatusNoContent, deleteResp.StatusCode)
	}

	membersAfterDelete := fetchBoardMembers(t, env, ownerSessionID)
	if hasBoardMember(membersAfterDelete, "U_MEMBER") {
		t.Fatalf("expected U_MEMBER removed from board members")
	}
}

func TestBoardMemberAddRequiresManagePermission(t *testing.T) {
	env := newParityEnv(t)
	defer env.server.Close()

	ctx := context.Background()
	editorSessionID, err := seedSessionUserRole(ctx, env, "U_EDITOR", "editor@example.com", "Editor", "editor")
	if err != nil {
		t.Fatalf("seed editor session: %v", err)
	}
	if err := setWorkspacePlan(ctx, env, "W1", "pro"); err != nil {
		t.Fatalf("set workspace plan: %v", err)
	}
	if err := seedWorkspaceMember(ctx, env, "U_TARGET", "target@example.com", "Target", "editor"); err != nil {
		t.Fatalf("seed board target member: %v", err)
	}
	if err := seedBoardMembership(ctx, env, "default", "U_EDITOR"); err != nil {
		t.Fatalf("seed editor board membership: %v", err)
	}

	req := newSessionJSONRequest(t, env.server.URL, editorSessionID, http.MethodPost, "/api/board/members?board=default", map[string]any{
		"userId": "U_TARGET",
	})
	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("add board member request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.StatusCode)
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
		t.Fatalf("expected FORBIDDEN code, got %q", payload.Error.Code)
	}
}

func TestBoardMemberListRequiresBoardAccess(t *testing.T) {
	env := newParityEnv(t)
	defer env.server.Close()

	ctx := context.Background()
	sessionID, err := seedSessionUserRole(ctx, env, "U_VIEWER", "viewer@example.com", "Viewer", "editor")
	if err != nil {
		t.Fatalf("seed viewer session: %v", err)
	}

	req := newSessionJSONRequest(t, env.server.URL, sessionID, http.MethodGet, "/api/board/members?board=default", nil)
	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("list board members request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.StatusCode)
	}
}

func fetchBoardMembers(t *testing.T, env *parityEnv, sessionID string) []struct {
	UserID string `json:"userId"`
} {
	t.Helper()
	req := newSessionJSONRequest(t, env.server.URL, sessionID, http.MethodGet, "/api/board/members?board=default", nil)
	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("list board members request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected list status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var payload struct {
		Members []struct {
			UserID string `json:"userId"`
		} `json:"members"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	return payload.Members
}

func hasBoardMember(members []struct {
	UserID string `json:"userId"`
}, userID string) bool {
	for _, member := range members {
		if member.UserID == userID {
			return true
		}
	}
	return false
}

func newSessionJSONRequest(t *testing.T, baseURL string, sessionID string, method string, path string, body any) *http.Request {
	t.Helper()

	var payload *bytes.Reader
	if body == nil {
		payload = bytes.NewReader(nil)
	} else {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		payload = bytes.NewReader(raw)
	}

	req, err := http.NewRequest(method, baseURL+path, payload)
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

func seedWorkspaceMember(ctx context.Context, env *parityEnv, userID string, email string, name string, role string) error {
	now := time.Now().UTC().Format(time.RFC3339)
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
		return err
	}

	if _, err := env.db.ExecContext(ctx, `
INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES ('W1', ?, ?, ?, ?, ?)
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
	email = excluded.email,
	name = excluded.name,
	role = excluded.role
`, userID, email, name, role, now); err != nil {
		return err
	}
	return nil
}

func setWorkspacePlan(ctx context.Context, env *parityEnv, workspaceID string, plan string) error {
	_, err := env.db.ExecContext(ctx, `UPDATE workspaces SET plan = ? WHERE id = ?`, plan, workspaceID)
	return err
}

func seedBoardMembership(ctx context.Context, env *parityEnv, boardID string, userID string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := env.db.ExecContext(ctx, `
INSERT INTO board_memberships (board_id, workspace_id, user_id, created_at, updated_at)
VALUES (?, 'W1', ?, ?, ?)
ON CONFLICT(board_id, workspace_id, user_id) DO UPDATE SET
	updated_at = excluded.updated_at
`, boardID, userID, now, now)
	return err
}
