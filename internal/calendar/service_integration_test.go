package calendar

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"donegeon/internal/database"
	"donegeon/internal/sessionctx"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestCalendarOAuthSyncAndTenantIsolationContract(t *testing.T) {
	t.Parallel()

	dbPath := filepath.Join(t.TempDir(), "calendar-contract.db")
	if err := database.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	db, err := database.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	queries, err := database.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	svc := NewService(db, queries, Config{
		AppBaseURL:         "https://donegeon.example",
		GoogleClientID:     "client-id",
		GoogleClientSecret: "client-secret",
	})
	requestCounts := map[string]int{}
	svc.httpClient = &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		requestCounts[req.URL.Host+req.URL.Path]++
		switch {
		case req.URL.Host == "oauth2.googleapis.com" && req.URL.Path == "/token":
			body, _ := io.ReadAll(req.Body)
			values, _ := url.ParseQuery(string(body))
			if values.Get("code") != "authorization-code" || values.Get("code_verifier") == "" {
				return nil, fmt.Errorf("unexpected token exchange body: %s", body)
			}
			return jsonResponse(http.StatusOK, `{"access_token":"access-1","refresh_token":"refresh-1","token_type":"Bearer","scope":"calendar.readonly","expires_in":3600}`), nil
		case req.URL.Host == "www.googleapis.com" && req.URL.Path == "/oauth2/v3/userinfo":
			if req.Header.Get("Authorization") != "Bearer access-1" {
				return nil, fmt.Errorf("unexpected profile authorization: %q", req.Header.Get("Authorization"))
			}
			return jsonResponse(http.StatusOK, `{"sub":"google-account-1","email":"USER@EXAMPLE.COM"}`), nil
		case req.URL.Host == "www.googleapis.com" && strings.Contains(req.URL.Path, "/calendar/v3/calendars/primary/events"):
			if req.Header.Get("Authorization") != "Bearer access-1" {
				return nil, fmt.Errorf("unexpected calendar authorization: %q", req.Header.Get("Authorization"))
			}
			if req.URL.Query().Get("singleEvents") != "true" || req.URL.Query().Get("orderBy") != "startTime" {
				return nil, fmt.Errorf("unexpected calendar query: %s", req.URL.RawQuery)
			}
			return jsonResponse(http.StatusOK, `{"items":[{},{},{}]}`), nil
		default:
			return nil, fmt.Errorf("unexpected provider request: %s %s", req.Method, req.URL.String())
		}
	})}

	owner := sessionctx.Principal{UserID: "calendar-owner", WorkspaceID: "calendar-workspace", Email: "owner@example.com"}
	foreign := sessionctx.Principal{UserID: "calendar-foreign", WorkspaceID: "other-workspace", Email: "foreign@example.com"}
	ownerCtx := sessionctx.WithPrincipal(context.Background(), owner)
	foreignCtx := sessionctx.WithPrincipal(context.Background(), foreign)

	authURL, err := svc.BeginConnect(ownerCtx, "GoOgLe")
	if err != nil {
		t.Fatalf("begin connect: %v", err)
	}
	parsedAuth, err := url.Parse(authURL)
	if err != nil {
		t.Fatalf("parse auth url: %v", err)
	}
	state := parsedAuth.Query().Get("state")
	if state == "" || parsedAuth.Query().Get("code_challenge") == "" || parsedAuth.Query().Get("code_challenge_method") != "S256" {
		t.Fatalf("missing oauth state/pkce values: %s", authURL)
	}
	if parsedAuth.Query().Get("redirect_uri") != "https://donegeon.example/api/calendar/callback/google" {
		t.Fatalf("unexpected redirect uri: %q", parsedAuth.Query().Get("redirect_uri"))
	}

	if _, err := svc.CompleteConnect(foreignCtx, "google", state, "authorization-code"); err == nil {
		t.Fatal("expected foreign principal to be unable to consume oauth state")
	}

	connection, err := svc.CompleteConnect(ownerCtx, "google", state, "authorization-code")
	if err != nil {
		t.Fatalf("complete connect: %v", err)
	}
	if connection.Provider != "google" || connection.ExternalAccountID != "google-account-1" || connection.Email != "user@example.com" || !connection.HasRefreshToken {
		t.Fatalf("unexpected connection: %+v", connection)
	}

	if _, err := svc.CompleteConnect(ownerCtx, "google", state, "authorization-code"); err == nil {
		t.Fatal("expected oauth state to be one-time use")
	}

	ownerConnections, err := svc.ListConnections(ownerCtx)
	if err != nil {
		t.Fatalf("list owner connections: %v", err)
	}
	if len(ownerConnections) != 1 || ownerConnections[0].ID != connection.ID {
		t.Fatalf("unexpected owner connections: %+v", ownerConnections)
	}
	foreignConnections, err := svc.ListConnections(foreignCtx)
	if err != nil {
		t.Fatalf("list foreign connections: %v", err)
	}
	if len(foreignConnections) != 0 {
		t.Fatalf("foreign principal saw owner connection: %+v", foreignConnections)
	}
	if _, err := svc.repo.GetConnectionByID(foreignCtx, connection.ID); err == nil {
		t.Fatal("expected foreign get to fail")
	}
	if err := svc.DeleteConnection(foreignCtx, connection.ID); err == nil {
		t.Fatal("expected foreign delete to fail")
	}

	syncResult, err := svc.SyncConnections(ownerCtx, connection.ID)
	if err != nil {
		t.Fatalf("sync connection: %v", err)
	}
	if len(syncResult.Results) != 1 || syncResult.Results[0].ConnectionID != connection.ID || syncResult.Results[0].Pulled != 3 || syncResult.Results[0].Error != "" {
		t.Fatalf("unexpected sync result: %+v", syncResult)
	}
	postSync, err := svc.ListConnections(ownerCtx)
	if err != nil {
		t.Fatalf("list post-sync connection: %v", err)
	}
	if len(postSync) != 1 || postSync[0].LastSyncAt == nil {
		t.Fatalf("sync timestamp was not persisted: %+v", postSync)
	}

	if requestCounts["oauth2.googleapis.com/token"] != 1 {
		t.Fatalf("unexpected token exchange count: %v", requestCounts)
	}
	if requestCounts["www.googleapis.com/oauth2/v3/userinfo"] != 1 {
		t.Fatalf("unexpected profile request count: %v", requestCounts)
	}
	if requestCounts["www.googleapis.com/calendar/v3/calendars/primary/events"] != 1 {
		t.Fatalf("unexpected event request count: %v", requestCounts)
	}

	if err := svc.DeleteConnection(ownerCtx, connection.ID); err != nil {
		t.Fatalf("delete connection: %v", err)
	}
	remaining, err := svc.ListConnections(ownerCtx)
	if err != nil {
		t.Fatalf("list after delete: %v", err)
	}
	if len(remaining) != 0 {
		t.Fatalf("connection survived delete: %+v", remaining)
	}
}

func jsonResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}
