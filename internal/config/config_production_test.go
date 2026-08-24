package config

import (
	"strings"
	"testing"
)

func TestLoadRejectsPlaceholderSecretsInProduction(t *testing.T) {
	t.Setenv("DONEGEON_ENV", "production")
	t.Setenv("DONEGEON_REQUIRE_AUTH", "true")
	t.Setenv("DONEGEON_COOKIE_SECURE", "true")
	t.Setenv("DONEGEON_AUTH_DEBUG_CODE", "false")
	t.Setenv("DONEGEON_API_TOKEN", "TOKEN_VALID")
	t.Setenv("DONEGEON_READONLY_API_TOKEN", "TOKEN_READONLY")
	t.Setenv("DONEGEON_COOKIE_SIGNING_KEY", "change-me-in-prod")
	t.Setenv("DONEGEON_AUTH_CODE_PEPPER", "change-me-in-prod")

	_, err := Load()
	if err == nil {
		t.Fatal("expected production config to reject placeholder credentials")
	}
	if !strings.Contains(err.Error(), "DONEGEON_API_TOKEN") {
		t.Fatalf("expected API token validation error, got %v", err)
	}
}

func TestLoadAcceptsExplicitProductionSecrets(t *testing.T) {
	t.Setenv("DONEGEON_ENV", "production")
	t.Setenv("DONEGEON_REQUIRE_AUTH", "true")
	t.Setenv("DONEGEON_COOKIE_SECURE", "true")
	t.Setenv("DONEGEON_AUTH_DEBUG_CODE", "false")
	t.Setenv("DONEGEON_API_TOKEN", "write-"+strings.Repeat("a", 48))
	t.Setenv("DONEGEON_READONLY_API_TOKEN", "read-"+strings.Repeat("b", 48))
	t.Setenv("DONEGEON_COOKIE_SIGNING_KEY", "cookie-"+strings.Repeat("c", 48))
	t.Setenv("DONEGEON_AUTH_CODE_PEPPER", "pepper-"+strings.Repeat("d", 48))
	t.Setenv("DONEGEON_DB_BACKEND", "sqlite")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected explicit production secrets to be accepted: %v", err)
	}
	if cfg.Environment != "production" {
		t.Fatalf("expected production environment, got %q", cfg.Environment)
	}
}

func TestLoadRejectsDebugAuthInProduction(t *testing.T) {
	t.Setenv("DONEGEON_ENV", "production")
	t.Setenv("DONEGEON_REQUIRE_AUTH", "true")
	t.Setenv("DONEGEON_COOKIE_SECURE", "true")
	t.Setenv("DONEGEON_AUTH_DEBUG_CODE", "true")
	t.Setenv("DONEGEON_API_TOKEN", "write-"+strings.Repeat("a", 48))
	t.Setenv("DONEGEON_READONLY_API_TOKEN", "read-"+strings.Repeat("b", 48))
	t.Setenv("DONEGEON_COOKIE_SIGNING_KEY", "cookie-"+strings.Repeat("c", 48))
	t.Setenv("DONEGEON_AUTH_CODE_PEPPER", "pepper-"+strings.Repeat("d", 48))

	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "DONEGEON_AUTH_DEBUG_CODE") {
		t.Fatalf("expected production debug-auth validation error, got %v", err)
	}
}
