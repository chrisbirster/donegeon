package calendar

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	apperrors "donegeon/internal/errors"
)

func (s *Service) pullUpcomingEventCount(ctx context.Context, provider string, accessToken string) (int, error) {
	p, err := s.normalizeProvider(provider)
	if err != nil {
		return 0, err
	}
	now := time.Now().UTC()
	switch p {
	case ProviderGoogle:
		values := url.Values{}
		values.Set("singleEvents", "true")
		values.Set("orderBy", "startTime")
		values.Set("timeMin", now.Format(time.RFC3339))
		values.Set("maxResults", "30")
		endpoint := "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + values.Encode()
		var payload struct {
			Items []json.RawMessage `json:"items"`
		}
		if err := s.fetchJSONWithBearer(ctx, endpoint, accessToken, &payload); err != nil {
			return 0, err
		}
		return len(payload.Items), nil
	default:
		return 0, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "unsupported calendar provider"), "provider")
	}
}

func (s *Service) redirectURI(provider Provider) string {
	return strings.TrimRight(s.cfg.AppBaseURL, "/") + "/api/calendar/callback/" + string(provider)
}

func (s *Service) clientIDForProvider(provider Provider) string {
	switch provider {
	case ProviderGoogle:
		return strings.TrimSpace(s.cfg.GoogleClientID)
	default:
		return ""
	}
}

func (s *Service) clientSecretForProvider(provider Provider) string {
	switch provider {
	case ProviderGoogle:
		return strings.TrimSpace(s.cfg.GoogleClientSecret)
	default:
		return ""
	}
}

func (s *Service) ensureProviderConfigured(provider Provider) error {
	if strings.TrimSpace(s.cfg.AppBaseURL) == "" {
		return apperrors.New(apperrors.CodeValidationError, "DONEGEON_APP_BASE_URL must be configured for calendar connect")
	}
	clientID := s.clientIDForProvider(provider)
	clientSecret := s.clientSecretForProvider(provider)
	if clientID == "" || clientSecret == "" {
		return apperrors.New(apperrors.CodeValidationError, fmt.Sprintf("%s calendar oauth is not configured on this server", provider))
	}
	return nil
}

func (s *Service) normalizeProvider(raw string) (Provider, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(ProviderGoogle):
		return ProviderGoogle, nil
	default:
		return "", apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "provider must be google"), "provider")
	}
}

func randomURLToken(byteLen int) (string, error) {
	buf := make([]byte, byteLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func pkceCodeChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
