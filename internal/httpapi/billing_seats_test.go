package httpapi

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"donegeon/internal/account"
	"donegeon/internal/config"
	"donegeon/internal/database"
	"donegeon/internal/project"
	"donegeon/internal/quickadd"
	"donegeon/internal/task"
	"donegeon/internal/taskmanagercompat"
)

func TestBillingCheckoutUsesAcceptedWorkspaceMemberCountAsSeatQuantity(t *testing.T) {
	var checkoutValues url.Values
	stripeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/checkout/sessions" {
			t.Fatalf("unexpected stripe request: %s %s", r.Method, r.URL.Path)
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read stripe request body: %v", err)
		}
		values, err := url.ParseQuery(string(body))
		if err != nil {
			t.Fatalf("parse stripe request body: %v", err)
		}
		checkoutValues = values
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"url":"https://checkout.stripe.test/session"}`)
	}))
	defer stripeServer.Close()

	env := newBillingEnv(t, stripeServer.URL)
	defer env.server.Close()

	ctx := context.Background()
	ownerSessionID, err := seedSessionUserRole(ctx, env, "U1", "owner@example.com", "Owner", "owner")
	if err != nil {
		t.Fatalf("seed owner session: %v", err)
	}
	if err := setWorkspacePlan(ctx, env, "W1", "pro_trial"); err != nil {
		t.Fatalf("set workspace plan: %v", err)
	}
	if err := seedWorkspaceMember(ctx, env, "U2", "member@example.com", "Member", "editor"); err != nil {
		t.Fatalf("seed second member: %v", err)
	}

	req := newSessionJSONRequest(t, env.server.URL, ownerSessionID, http.MethodPost, "/api/billing/checkout", map[string]any{
		"plan": "pro",
	})
	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("checkout request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	if got := checkoutValues.Get("line_items[0][quantity]"); got != "2" {
		t.Fatalf("expected stripe checkout quantity %q, got %q", "2", got)
	}
	if got := checkoutValues.Get("line_items[0][price]"); got != "price_pro_test" {
		t.Fatalf("expected stripe checkout price %q, got %q", "price_pro_test", got)
	}
}

func TestAcceptInvitationSyncsPaidSubscriptionSeatCount(t *testing.T) {
	var updatedQuantity string
	stripeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_test":
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"items":{"data":[{"id":"si_test","quantity":1,"price":{"id":"price_pro_test"}}]}}`)
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_items/si_test":
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatalf("read stripe request body: %v", err)
			}
			values, err := url.ParseQuery(string(body))
			if err != nil {
				t.Fatalf("parse stripe request body: %v", err)
			}
			updatedQuantity = values.Get("quantity")
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"id":"si_test"}`)
		default:
			t.Fatalf("unexpected stripe request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer stripeServer.Close()

	env := newBillingEnv(t, stripeServer.URL)
	defer env.server.Close()

	ctx := context.Background()
	if _, err := seedSessionUserRole(ctx, env, "U1", "owner@example.com", "Owner", "owner"); err != nil {
		t.Fatalf("seed owner session: %v", err)
	}
	if err := setWorkspaceStripeSubscription(ctx, env, "W1", "pro", "cus_test", "sub_test", "price_pro_test"); err != nil {
		t.Fatalf("set workspace billing state: %v", err)
	}

	memberSessionID, err := seedStandaloneSessionUser(ctx, env, "U2", "member@example.com", "Member")
	if err != nil {
		t.Fatalf("seed invited session: %v", err)
	}
	invitationCode, err := seedPendingInvitation(ctx, env, "W1", "member@example.com", "editor")
	if err != nil {
		t.Fatalf("seed invitation: %v", err)
	}

	req := newSessionJSONRequest(t, env.server.URL, memberSessionID, http.MethodPost, "/api/team/invitations/accept", map[string]any{
		"invitationCode": invitationCode,
	})
	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("accept invitation request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected status %d, got %d: %s", http.StatusOK, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	if updatedQuantity != "2" {
		t.Fatalf("expected synced seat quantity %q, got %q", "2", updatedQuantity)
	}
}

func TestRemoveMemberSyncsPaidSubscriptionSeatCount(t *testing.T) {
	var updatedQuantity string
	stripeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/v1/subscriptions/sub_test":
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"items":{"data":[{"id":"si_test","quantity":2,"price":{"id":"price_pro_test"}}]}}`)
		case r.Method == http.MethodPost && r.URL.Path == "/v1/subscription_items/si_test":
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatalf("read stripe request body: %v", err)
			}
			values, err := url.ParseQuery(string(body))
			if err != nil {
				t.Fatalf("parse stripe request body: %v", err)
			}
			updatedQuantity = values.Get("quantity")
			w.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(w, `{"id":"si_test"}`)
		default:
			t.Fatalf("unexpected stripe request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer stripeServer.Close()

	env := newBillingEnv(t, stripeServer.URL)
	defer env.server.Close()

	ctx := context.Background()
	ownerSessionID, err := seedSessionUserRole(ctx, env, "U1", "owner@example.com", "Owner", "owner")
	if err != nil {
		t.Fatalf("seed owner session: %v", err)
	}
	if err := seedWorkspaceMember(ctx, env, "U2", "member@example.com", "Member", "editor"); err != nil {
		t.Fatalf("seed removable member: %v", err)
	}
	if err := setWorkspaceStripeSubscription(ctx, env, "W1", "pro", "cus_test", "sub_test", "price_pro_test"); err != nil {
		t.Fatalf("set workspace billing state: %v", err)
	}

	req := newSessionJSONRequest(t, env.server.URL, ownerSessionID, http.MethodDelete, "/api/team/members/U2", nil)
	resp, err := env.server.Client().Do(req)
	if err != nil {
		t.Fatalf("remove member request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected status %d, got %d: %s", http.StatusNoContent, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	if updatedQuantity != "1" {
		t.Fatalf("expected synced seat quantity %q, got %q", "1", updatedQuantity)
	}
}

func newBillingEnv(t *testing.T, stripeAPIBaseURL string) *parityEnv {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "httpapi-billing.db")
	if err := database.RunMigrations(dbPath); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	db, err := database.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	queries, err := database.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	parser := quickadd.NewParser()
	taskSvc := task.NewService(task.NewRepository(db, queries), parser)
	projectSvc := project.NewService(project.NewRepository(db, queries))
	compatSvc := taskmanagercompat.NewService(db, taskSvc, projectSvc)
	accountSvc := account.NewService(db, queries)

	cfg := config.Config{
		RequireAuth:              true,
		WriteToken:               "TOKEN_VALID",
		ReadOnlyToken:            "TOKEN_READONLY",
		CookieSigningKey:         "test-signing-key",
		RequestTimeout:           5 * time.Second,
		StripeSecretKey:          "sk_test_123",
		StripeAPIBaseURL:         stripeAPIBaseURL,
		StripeProPriceID:         "price_pro_test",
		StripeCheckoutSuccessURL: "https://app.donegeon.test/team/settings?billing=success",
		StripeCheckoutCancelURL:  "https://app.donegeon.test/team/settings?billing=canceled",
		StripePortalReturnURL:    "https://app.donegeon.test/team/settings?billing=portal",
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	staticFS := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<html><body>ok</body></html>")},
	}

	handler := New(logger, cfg, taskSvc, projectSvc, nil, nil, parser, compatSvc, accountSvc, staticFS)
	server := httptest.NewServer(handler)

	return &parityEnv{
		server: server,
		db:     db,
	}
}

func setWorkspaceStripeSubscription(ctx context.Context, env *parityEnv, workspaceID string, plan string, customerID string, subscriptionID string, priceID string) error {
	_, err := env.db.ExecContext(ctx, `
UPDATE workspaces
SET
	plan = ?,
	trial_ends_at = NULL,
	stripe_customer_id = ?,
	stripe_subscription_id = ?,
	stripe_price_id = ?
WHERE id = ?
`, plan, customerID, subscriptionID, priceID, workspaceID)
	return err
}

func seedStandaloneSessionUser(ctx context.Context, env *parityEnv, userID string, email string, name string) (string, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	expires := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	sessionID := "AS_" + userID
	workspaceID := "W_" + userID

	if _, err := env.db.ExecContext(ctx, `
INSERT INTO workspaces (id, name, plan, trial_ends_at, stripe_customer_id, stripe_subscription_id, stripe_price_id, billing_email, is_archived, created_at, updated_at)
VALUES (?, ?, 'personal', NULL, NULL, NULL, NULL, NULL, 0, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	plan = 'personal',
	updated_at = excluded.updated_at
`, workspaceID, name+"-personal", now, now); err != nil {
		return "", err
	}
	if _, err := env.db.ExecContext(ctx, `
INSERT INTO users (id, email, name, show_onboarding, current_workspace_id, created_at, updated_at)
VALUES (?, ?, ?, 0, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	email = excluded.email,
	name = excluded.name,
	show_onboarding = 0,
	current_workspace_id = excluded.current_workspace_id,
	updated_at = excluded.updated_at
`, userID, email, name, workspaceID, now, now); err != nil {
		return "", err
	}

	if _, err := env.db.ExecContext(ctx, `
INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES (?, ?, ?, ?, 'owner', ?)
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
	email = excluded.email,
	name = excluded.name,
	role = 'owner'
`, workspaceID, userID, email, name, now); err != nil {
		return "", err
	}

	if _, err := env.db.ExecContext(ctx, `
INSERT INTO auth_sessions (
	id, user_id, workspace_id, email, created_at, updated_at, expires_at, revoked_at, last_seen_at, user_agent, ip_address
)
VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL)
ON CONFLICT(id) DO UPDATE SET
	user_id = excluded.user_id,
	workspace_id = excluded.workspace_id,
	email = excluded.email,
	expires_at = excluded.expires_at,
	revoked_at = NULL,
	updated_at = excluded.updated_at,
	last_seen_at = excluded.last_seen_at
`, sessionID, userID, workspaceID, email, now, now, expires, now); err != nil {
		return "", err
	}

	return sessionID, nil
}

func seedPendingInvitation(ctx context.Context, env *parityEnv, workspaceID string, email string, role string) (string, error) {
	code := "INV_" + strings.ReplaceAll(strings.ToUpper(email), "@", "_")
	code = strings.ReplaceAll(code, ".", "_")
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := env.db.ExecContext(ctx, `
INSERT INTO workspace_invitations (invitation_code, workspace_id, email, role, status, created_at, updated_at)
VALUES (?, ?, ?, ?, 'pending', ?, ?)
ON CONFLICT(invitation_code) DO UPDATE SET
	workspace_id = excluded.workspace_id,
	email = excluded.email,
	role = excluded.role,
	status = 'pending',
	updated_at = excluded.updated_at
`, code, workspaceID, email, role, now, now)
	return code, err
}
