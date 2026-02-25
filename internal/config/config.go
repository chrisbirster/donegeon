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
	HTTPPort         string
	DBPath           string
	BoardConfigPath  string
	RequireAuth      bool
	WriteToken       string
	ReadOnlyToken    string
	RequestTimeout   time.Duration
	ShutdownTimeout  time.Duration
	LogLevel         slog.Level
	CookieSigningKey string
}

func Load() (Config, error) {
	cfg := Config{
		HTTPPort:         envOr("DONEGEON_HTTP_PORT", "42069"),
		DBPath:           envOr("DONEGEON_DB_PATH", "donegeon.db"),
		BoardConfigPath:  firstNonEmptyEnv("DONEGEON_BOARD_CONFIG_PATH", "DONEGEON_CONFIG_PATH"),
		WriteToken:       envOr("DONEGEON_API_TOKEN", "TOKEN_VALID"),
		ReadOnlyToken:    envOr("DONEGEON_READONLY_API_TOKEN", "TOKEN_READONLY"),
		RequestTimeout:   envDurationOr("DONEGEON_REQUEST_TIMEOUT", 15*time.Second),
		ShutdownTimeout:  envDurationOr("DONEGEON_SHUTDOWN_TIMEOUT", 10*time.Second),
		CookieSigningKey: envOr("DONEGEON_COOKIE_SIGNING_KEY", "change-me-in-prod"),
	}

	requireAuth, err := envBoolOr("DONEGEON_REQUIRE_AUTH", true)
	if err != nil {
		return Config{}, fmt.Errorf("parse DONEGEON_REQUIRE_AUTH: %w", err)
	}
	cfg.RequireAuth = requireAuth

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

	return cfg, nil
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

func envBoolOr(key string, fallback bool) (bool, error) {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback, nil
	}
	return strconv.ParseBool(val)
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
