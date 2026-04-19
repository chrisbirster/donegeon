package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
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

func TestPublicConfigReflectsOpenBetaFlag(t *testing.T) {
	env := newOpenBetaEnv(t, func(cfg *config.Config) {
		cfg.OpenBeta = false
	})
	defer env.server.Close()

	resp, err := env.server.Client().Get(env.server.URL + "/api/public/config")
	if err != nil {
		t.Fatalf("get public config: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var payload struct {
		Config struct {
			OpenBeta            bool   `json:"openBeta"`
			OpenBetaStartsAt    string `json:"openBetaStartsAt"`
			OpenBetaStartsLabel string `json:"openBetaStartsLabel"`
		} `json:"config"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode payload: %v", err)
	}

	if payload.Config.OpenBeta {
		t.Fatal("expected open beta to be false")
	}
	if payload.Config.OpenBetaStartsAt != "2026-06-01" {
		t.Fatalf("unexpected open beta start date: %q", payload.Config.OpenBetaStartsAt)
	}
	if payload.Config.OpenBetaStartsLabel != "June 1, 2026" {
		t.Fatalf("unexpected open beta label: %q", payload.Config.OpenBetaStartsLabel)
	}
}

func TestPublicWaitlistSignupPersistsAndSendsConfirmation(t *testing.T) {
	var deliveries []map[string]string
	emailServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode email payload: %v", err)
		}
		deliveries = append(deliveries, payload)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}))
	defer emailServer.Close()

	env := newOpenBetaEnv(t, func(cfg *config.Config) {
		cfg.OpenBeta = false
		cfg.EmailSendURL = emailServer.URL
		cfg.RequestTimeout = time.Second
	})
	defer env.server.Close()

	requestBody := `{"name":"Local Tester","email":"tester@example.com","source":"marketing-banner","requestedPlan":"pro_trial"}`
	resp, err := env.server.Client().Post(env.server.URL+"/api/public/waitlist", "application/json", strings.NewReader(requestBody))
	if err != nil {
		t.Fatalf("post waitlist: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var payload struct {
		Signup struct {
			Name          string `json:"name"`
			Email         string `json:"email"`
			Source        string `json:"source"`
			RequestedPlan string `json:"requestedPlan"`
		} `json:"signup"`
		AlreadyJoined   bool   `json:"alreadyJoined"`
		DeliveryWarning string `json:"deliveryWarning"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode waitlist payload: %v", err)
	}

	if payload.AlreadyJoined {
		t.Fatal("expected first waitlist signup to be new")
	}
	if payload.DeliveryWarning != "" {
		t.Fatalf("expected no delivery warning, got %q", payload.DeliveryWarning)
	}
	if payload.Signup.Email != "tester@example.com" {
		t.Fatalf("unexpected signup email: %q", payload.Signup.Email)
	}

	if len(deliveries) != 1 {
		t.Fatalf("expected 1 email delivery, got %d", len(deliveries))
	}
	if deliveries[0]["to"] != "tester@example.com" {
		t.Fatalf("unexpected delivery target: %q", deliveries[0]["to"])
	}
	if !strings.Contains(deliveries[0]["subject"], "waitlist") {
		t.Fatalf("expected waitlist subject, got %q", deliveries[0]["subject"])
	}

	var count int
	if err := env.db.GetContext(context.Background(), &count, "SELECT COUNT(*) FROM waitlist_signups WHERE email = ?", "tester@example.com"); err != nil {
		t.Fatalf("count waitlist rows: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 waitlist row, got %d", count)
	}

	secondResp, err := env.server.Client().Post(env.server.URL+"/api/public/waitlist", "application/json", strings.NewReader(requestBody))
	if err != nil {
		t.Fatalf("post waitlist second time: %v", err)
	}
	defer secondResp.Body.Close()

	if secondResp.StatusCode != http.StatusOK {
		t.Fatalf("expected status %d on duplicate signup, got %d", http.StatusOK, secondResp.StatusCode)
	}

	var secondPayload struct {
		AlreadyJoined bool `json:"alreadyJoined"`
	}
	if err := json.NewDecoder(secondResp.Body).Decode(&secondPayload); err != nil {
		t.Fatalf("decode duplicate payload: %v", err)
	}
	if !secondPayload.AlreadyJoined {
		t.Fatal("expected duplicate waitlist signup to report alreadyJoined=true")
	}
	if len(deliveries) != 1 {
		t.Fatalf("expected duplicate signup not to send another email, got %d deliveries", len(deliveries))
	}
}

func TestPublicWaitlistSignupReturnsGenericWarningWhenConfirmationFails(t *testing.T) {
	var attempts int
	emailServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"missing or invalid Authorization header"}`))
	}))
	defer emailServer.Close()

	env := newOpenBetaEnv(t, func(cfg *config.Config) {
		cfg.OpenBeta = false
		cfg.EmailSendURL = emailServer.URL
		cfg.RequestTimeout = time.Second
	})
	defer env.server.Close()

	requestBody := `{"name":"Local Tester","email":"warning@example.com","source":"marketing-banner","requestedPlan":"pro_trial"}`
	resp, err := env.server.Client().Post(env.server.URL+"/api/public/waitlist", "application/json", strings.NewReader(requestBody))
	if err != nil {
		t.Fatalf("post waitlist: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, resp.StatusCode)
	}

	var payload struct {
		AlreadyJoined   bool   `json:"alreadyJoined"`
		DeliveryWarning string `json:"deliveryWarning"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode waitlist payload: %v", err)
	}

	if payload.AlreadyJoined {
		t.Fatal("expected first waitlist signup to be new")
	}
	if payload.DeliveryWarning != waitlistDeliveryWarningMessage {
		t.Fatalf("expected generic delivery warning, got %q", payload.DeliveryWarning)
	}
	if attempts != 1 {
		t.Fatalf("expected 1 email attempt, got %d", attempts)
	}

	var count int
	if err := env.db.GetContext(context.Background(), &count, "SELECT COUNT(*) FROM waitlist_signups WHERE email = ?", "warning@example.com"); err != nil {
		t.Fatalf("count waitlist rows: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 waitlist row, got %d", count)
	}
}

func newOpenBetaEnv(t *testing.T, mutate func(*config.Config)) *parityEnv {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "open-beta.db")
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
		OpenBeta:         false,
		RequireAuth:      true,
		WriteToken:       "TOKEN_VALID",
		ReadOnlyToken:    "TOKEN_READONLY",
		CookieSigningKey: "test-signing-key",
		RequestTimeout:   time.Second,
	}
	if mutate != nil {
		mutate(&cfg)
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
