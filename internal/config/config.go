package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment              string
	HTTPPort                 string
	DBBackend                string
	DBPath                   string
	DBURL                    string
	DBAuthToken              string
	BoardConfigPath          string
	QuestConfigPath          string
	RequireAuth              bool
	WriteToken               string
	ReadOnlyToken            string
	RequestTimeout           time.Duration
	ShutdownTimeout          time.Duration
	LogLevel                 slog.Level
	CookieSigningKey         string
	CookieSecure             bool
	CookieSameSite           string
	CookieDomain             string
	AuthSessionTTL           time.Duration
	AuthCodeTTL              time.Duration
	AuthCodeLength           int
	AuthMaxCodeAttempts      int
	AuthCodePepper           string
	AuthDebugCode            bool
	OpenBeta                 bool
	AppBaseURL               string
	EmailSendURL             string
	EmailSendAuthHeader      string
	EmailSendAuthValue       string
	StripeSecretKey          string
	StripeAPIBaseURL         string
	StripeWebhookSecret      string
	StripeProPriceID         string
	StripeCheckoutSuccessURL string
	StripeCheckoutCancelURL  string
	StripePortalReturnURL    string
	GoogleCalendarClientID   string
	GoogleCalendarSecret     string
	CalendarOAuthStateTTL    time.Duration
	CalendarProviderTimeout  time.Duration
	CorsAllowedOrigins       []string
}

func Load() (Config, error) {
	boardConfigPath := firstNonEmptyEnv("DONEGEON_BOARD_CONFIG_PATH", "DONEGEON_CONFIG_PATH")
	if boardConfigPath == "" {
		boardConfigPath = defaultBoardConfigPath()
	}
	questConfigPath := firstNonEmptyEnv("DONEGEON_QUEST_CONFIG_PATH", "DONEGEON_QUESTS_PATH")
	if questConfigPath == "" {
		questConfigPath = defaultQuestConfigPath()
	}

	cfg := Config{
		Environment:         strings.ToLower(envOr("DONEGEON_ENV", "development")),
		HTTPPort:            envOr("DONEGEON_HTTP_PORT", "42069"),
		DBBackend:           strings.ToLower(envOr("DONEGEON_DB_BACKEND", "sqlite")),
		DBPath:              envOr("DONEGEON_DB_PATH", "donegeon.db"),
		DBURL:               envOr("DONEGEON_DB_URL", ""),
		DBAuthToken:         envOr("DONEGEON_DB_AUTH_TOKEN", ""),
		BoardConfigPath:     boardConfigPath,
		QuestConfigPath:     questConfigPath,
		WriteToken:          envOr("DONEGEON_API_TOKEN", "TOKEN_VALID"),
		ReadOnlyToken:       envOr("DONEGEON_READONLY_API_TOKEN", "TOKEN_READONLY"),
		RequestTimeout:      envDurationOr("DONEGEON_REQUEST_TIMEOUT", 15*time.Second),
		ShutdownTimeout:     envDurationOr("DONEGEON_SHUTDOWN_TIMEOUT", 10*time.Second),
		CookieSigningKey:    envOr("DONEGEON_COOKIE_SIGNING_KEY", "change-me-in-prod"),
		CookieSameSite:      strings.ToLower(envOr("DONEGEON_COOKIE_SAMESITE", "lax")),
		CookieDomain:        envOr("DONEGEON_COOKIE_DOMAIN", ""),
		AuthSessionTTL:      envDurationOr("DONEGEON_AUTH_SESSION_TTL", 30*24*time.Hour),
		AuthCodeTTL:         envDurationOr("DONEGEON_AUTH_CODE_TTL", 10*time.Minute),
		AuthCodeLength:      envIntOr("DONEGEON_AUTH_CODE_LENGTH", 6),
		AuthMaxCodeAttempts: envIntOr("DONEGEON_AUTH_MAX_CODE_ATTEMPTS", 5),
		AuthCodePepper:      envOr("DONEGEON_AUTH_CODE_PEPPER", ""),
		AuthDebugCode:       false,
		AppBaseURL:          strings.TrimRight(envOr("DONEGEON_APP_BASE_URL", "https://app.donegeon.com"), "/"),
		EmailSendURL:        envOr("DONEGEON_EMAIL_SEND_URL", ""),
		EmailSendAuthHeader: envOr("DONEGEON_EMAIL_SEND_AUTH_HEADER", "Authorization"),
		EmailSendAuthValue:  envOr("DONEGEON_EMAIL_SEND_AUTH_VALUE", ""),
		StripeSecretKey:     envOr("DONEGEON_STRIPE_SECRET_KEY", ""),
		StripeAPIBaseURL:    envOr("DONEGEON_STRIPE_API_BASE_URL", "https://api.stripe.com"),
		StripeWebhookSecret: envOr("DONEGEON_STRIPE_WEBHOOK_SECRET", ""),
		StripeProPriceID:    envOr("DONEGEON_STRIPE_PRICE_PRO", ""),
		StripeCheckoutSuccessURL: envOr(
			"DONEGEON_STRIPE_CHECKOUT_SUCCESS_URL",
			"https://app.donegeon.com/team/settings?billing=success",
		),
		StripeCheckoutCancelURL: envOr(
			"DONEGEON_STRIPE_CHECKOUT_CANCEL_URL",
			"https://app.donegeon.com/team/settings?billing=canceled",
		),
		StripePortalReturnURL: envOr(
			"DONEGEON_STRIPE_PORTAL_RETURN_URL",
			"https://app.donegeon.com/team/settings?billing=portal",
		),
		GoogleCalendarClientID:  envOr("DONEGEON_GOOGLE_CALENDAR_CLIENT_ID", ""),
		GoogleCalendarSecret:    envOr("DONEGEON_GOOGLE_CALENDAR_CLIENT_SECRET", ""),
		CalendarOAuthStateTTL:   envDurationOr("DONEGEON_CALENDAR_OAUTH_STATE_TTL", 15*time.Minute),
		CalendarProviderTimeout: envDurationOr("DONEGEON_CALENDAR_PROVIDER_TIMEOUT", 15*time.Second),
		CorsAllowedOrigins:      parseCorsOrigins(envOr("DONEGEON_CORS_ALLOWED_ORIGINS", "")),
	}

	requireAuth, err := envBoolOr("DONEGEON_REQUIRE_AUTH", true)
	if err != nil {
		return Config{}, fmt.Errorf("parse DONEGEON_REQUIRE_AUTH: %w", err)
	}
	cfg.RequireAuth = requireAuth

	cookieSecure, err := envBoolOr("DONEGEON_COOKIE_SECURE", false)
	if err != nil {
		return Config{}, fmt.Errorf("parse DONEGEON_COOKIE_SECURE: %w", err)
	}
	cfg.CookieSecure = cookieSecure

	authDebugCode, err := envBoolOr("DONEGEON_AUTH_DEBUG_CODE", false)
	if err != nil {
		return Config{}, fmt.Errorf("parse DONEGEON_AUTH_DEBUG_CODE: %w", err)
	}
	cfg.AuthDebugCode = authDebugCode

	openBeta, err := envBoolFirst([]string{"DONEGEON_OPEN_BETA", "DONEGEON_OPTN_BETA"}, false)
	if err != nil {
		return Config{}, fmt.Errorf("parse DONEGEON_OPEN_BETA: %w", err)
	}
	cfg.OpenBeta = openBeta

	logLevel := strings.ToLower(strings.TrimSpace(envOr("DONEGEON_LOG_LEVEL", "info")))
	switch logLevel {
	case "debug":
		cfg.LogLevel = slog.LevelDebug
	case "warn":
		cfg.LogLevel = slog.LevelWarn
	case "error":
		cfg.LogLevel = slog.LevelError
	default:
		cfg.LogLevel = slog.LevelInfo
	}

	if cfg.RequireAuth && strings.TrimSpace(cfg.WriteToken) == "" {
		return Config{}, fmt.Errorf("DONEGEON_API_TOKEN is required when auth is enabled")
	}
	if cfg.AuthCodePepper == "" {
		cfg.AuthCodePepper = cfg.CookieSigningKey
	}
	if cfg.AuthCodeLength < 4 || cfg.AuthCodeLength > 10 {
		return Config{}, fmt.Errorf("DONEGEON_AUTH_CODE_LENGTH must be between 4 and 10")
	}
	if cfg.AuthMaxCodeAttempts < 1 || cfg.AuthMaxCodeAttempts > 10 {
		return Config{}, fmt.Errorf("DONEGEON_AUTH_MAX_CODE_ATTEMPTS must be between 1 and 10")
	}
	if cfg.AuthCodeTTL < time.Minute {
		return Config{}, fmt.Errorf("DONEGEON_AUTH_CODE_TTL must be at least 1m")
	}
	if cfg.AuthSessionTTL < time.Hour {
		return Config{}, fmt.Errorf("DONEGEON_AUTH_SESSION_TTL must be at least 1h")
	}
	switch cfg.DBBackend {
	case "sqlite", "turso":
	default:
		return Config{}, fmt.Errorf("DONEGEON_DB_BACKEND must be one of sqlite, turso")
	}
	if cfg.DBBackend == "turso" && strings.TrimSpace(cfg.DBURL) == "" {
		return Config{}, fmt.Errorf("DONEGEON_DB_URL is required when DONEGEON_DB_BACKEND=turso")
	}
	switch cfg.CookieSameSite {
	case "lax", "strict", "none":
	default:
		return Config{}, fmt.Errorf("DONEGEON_COOKIE_SAMESITE must be one of lax, strict, none")
	}
	if cfg.CookieSameSite == "none" && !cfg.CookieSecure {
		return Config{}, fmt.Errorf("DONEGEON_COOKIE_SECURE must be true when DONEGEON_COOKIE_SAMESITE=none")
	}
	if cfg.EmailSendURL != "" && strings.TrimSpace(cfg.EmailSendAuthHeader) == "" {
		return Config{}, fmt.Errorf("DONEGEON_EMAIL_SEND_AUTH_HEADER is required when DONEGEON_EMAIL_SEND_URL is set")
	}
	if cfg.EmailSendURL != "" && strings.TrimSpace(cfg.EmailSendAuthValue) == "" {
		return Config{}, fmt.Errorf("DONEGEON_EMAIL_SEND_AUTH_VALUE is required when DONEGEON_EMAIL_SEND_URL is set")
	}
	if strings.TrimSpace(cfg.AppBaseURL) == "" {
		return Config{}, fmt.Errorf("DONEGEON_APP_BASE_URL is required")
	}
	if (cfg.GoogleCalendarClientID == "") != (cfg.GoogleCalendarSecret == "") {
		return Config{}, fmt.Errorf("both DONEGEON_GOOGLE_CALENDAR_CLIENT_ID and DONEGEON_GOOGLE_CALENDAR_CLIENT_SECRET must be set together")
	}
	if cfg.CalendarOAuthStateTTL < time.Minute {
		return Config{}, fmt.Errorf("DONEGEON_CALENDAR_OAUTH_STATE_TTL must be at least 1m")
	}
	if cfg.CalendarProviderTimeout < time.Second {
		return Config{}, fmt.Errorf("DONEGEON_CALENDAR_PROVIDER_TIMEOUT must be at least 1s")
	}
	if err := validateProductionConfig(cfg); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func validateProductionConfig(cfg Config) error {
	if !strings.EqualFold(strings.TrimSpace(cfg.Environment), "production") {
		return nil
	}
	if !cfg.RequireAuth {
		return fmt.Errorf("DONEGEON_REQUIRE_AUTH must be true in production")
	}
	if !cfg.CookieSecure {
		return fmt.Errorf("DONEGEON_COOKIE_SECURE must be true in production")
	}
	if cfg.AuthDebugCode {
		return fmt.Errorf("DONEGEON_AUTH_DEBUG_CODE must be false in production")
	}
	if cfg.DBBackend == "turso" && strings.TrimSpace(cfg.DBAuthToken) == "" {
		return fmt.Errorf("DONEGEON_DB_AUTH_TOKEN is required in production when DONEGEON_DB_BACKEND=turso")
	}

	secrets := []struct {
		name  string
		value string
	}{
		{name: "DONEGEON_API_TOKEN", value: cfg.WriteToken},
		{name: "DONEGEON_READONLY_API_TOKEN", value: cfg.ReadOnlyToken},
		{name: "DONEGEON_COOKIE_SIGNING_KEY", value: cfg.CookieSigningKey},
		{name: "DONEGEON_AUTH_CODE_PEPPER", value: cfg.AuthCodePepper},
	}
	for _, secret := range secrets {
		if isPlaceholderSecret(secret.value) {
			return fmt.Errorf("%s must be set to a non-placeholder value in production", secret.name)
		}
	}
	return nil
}

func isPlaceholderSecret(raw string) bool {
	value := strings.TrimSpace(raw)
	if value == "" {
		return true
	}

	switch value {
	case "TOKEN_VALID",
		"TOKEN_READONLY",
		"change-me-in-prod",
		"change-me-in-prod-write-token",
		"change-me-in-prod-read-token",
		"secret-key-at-least-32-chars-long",
		"another-secret-pepper-string",
		"change-me",
		"replace-me":
		return true
	}

	lower := strings.ToLower(value)
	return strings.HasPrefix(lower, "change-me") ||
		strings.HasPrefix(lower, "replace-me") ||
		strings.HasPrefix(lower, "your-") ||
		strings.HasPrefix(lower, "placeholder") ||
		lower == "example"
}

func envOr(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return val
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func defaultBoardConfigPath() string {
	candidates := []string{
		"donegeon_config.yml",
		"donegeon_config.yaml",
	}
	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err != nil || info.IsDir() {
			continue
		}
		return candidate
	}
	return ""
}

func defaultQuestConfigPath() string {
	candidates := []string{
		"docs/quests.yaml",
		"docs/quests.yml",
		"quests.yaml",
		"quests.yml",
	}
	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err != nil || info.IsDir() {
			continue
		}
		return candidate
	}
	return ""
}

func envBoolOr(key string, fallback bool) (bool, error) {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback, nil
	}
	return strconv.ParseBool(val)
}

func envBoolFirst(keys []string, fallback bool) (bool, error) {
	for _, key := range keys {
		val := strings.TrimSpace(os.Getenv(key))
		if val == "" {
			continue
		}
		return strconv.ParseBool(val)
	}
	return fallback, nil
}

func envDurationOr(key string, fallback time.Duration) time.Duration {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	d, err := time.ParseDuration(val)
	if err != nil {
		return fallback
	}
	return d
}

func envIntOr(key string, fallback int) int {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

func parseCorsOrigins(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	var origins []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			origins = append(origins, p)
		}
	}
	return origins
}
