package httpapi

import (
	"context"
	"net/http/httptest"
	"testing"
	"time"

	"donegeon/internal/sessionctx"
)

func TestTokenBucketLimiterAllowsBurstAndRefill(t *testing.T) {
	t.Parallel()

	limiter := newTokenBucketLimiter(2, 3, time.Minute)
	now := time.Date(2026, time.March, 9, 12, 0, 0, 0, time.UTC)

	if !limiter.Allow("user:1", now) {
		t.Fatal("expected first request to pass")
	}
	if !limiter.Allow("user:1", now) {
		t.Fatal("expected second request to pass")
	}
	if !limiter.Allow("user:1", now) {
		t.Fatal("expected third request to pass")
	}
	if limiter.Allow("user:1", now) {
		t.Fatal("expected limiter to block after burst capacity is exhausted")
	}
	if !limiter.Allow("user:1", now.Add(500*time.Millisecond)) {
		t.Fatal("expected limiter to refill over time")
	}
}

func TestQuickAddParseLimiterKeyUsesAuthenticatedUser(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest("POST", "/api/quick-add/parse", nil)
	ctx := sessionctx.WithPrincipal(context.Background(), sessionctx.Principal{
		UserID:      "U_123",
		WorkspaceID: "W_123",
		Email:       "user@example.com",
	})
	ctx = context.WithValue(ctx, ctxKeyLogState, &requestLogState{
		Authenticated: true,
		Principal: sessionctx.Principal{
			UserID:      "U_123",
			WorkspaceID: "W_123",
			Email:       "user@example.com",
		},
	})
	req = req.WithContext(ctx)

	if got := quickAddParseLimiterKey(req); got != "user:U_123" {
		t.Fatalf("unexpected limiter key: got=%q want=%q", got, "user:U_123")
	}
}
