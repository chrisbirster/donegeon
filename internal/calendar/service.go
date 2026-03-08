package calendar

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
)

type Provider string

const (
	ProviderGoogle Provider = "google"
)

type Config struct {
	AppBaseURL             string
	GoogleClientID         string
	GoogleClientSecret     string
	OAuthStateTTL          time.Duration
	ProviderRequestTimeout time.Duration
	GoogleCalendarScope    string
}

type Service struct {
	repo       *Repository
	httpClient *http.Client
	cfg        Config
}

func NewService(db *sqlx.DB, queries map[string]string, cfg Config) *Service {
	if cfg.OAuthStateTTL <= 0 {
		cfg.OAuthStateTTL = 15 * time.Minute
	}
	if cfg.ProviderRequestTimeout <= 0 {
		cfg.ProviderRequestTimeout = 15 * time.Second
	}
	if strings.TrimSpace(cfg.GoogleCalendarScope) == "" {
		cfg.GoogleCalendarScope = "openid email profile https://www.googleapis.com/auth/calendar.events.readonly"
	}
	cfg.AppBaseURL = strings.TrimRight(strings.TrimSpace(cfg.AppBaseURL), "/")
	return &Service{
		repo: NewRepository(db, queries),
		httpClient: &http.Client{
			Timeout: cfg.ProviderRequestTimeout,
		},
		cfg: cfg,
	}
}

func (s *Service) ListConnections(ctx context.Context) ([]Connection, error) {
	return s.repo.ListConnections(ctx)
}

func (s *Service) BeginConnect(ctx context.Context, provider string) (string, error) {
	p, err := s.normalizeProvider(provider)
	if err != nil {
		return "", err
	}
	if err := s.ensureProviderConfigured(p); err != nil {
		return "", err
	}

	principal := sessionctx.PrincipalFromContext(ctx)
	if strings.TrimSpace(principal.UserID) == "" || strings.TrimSpace(principal.WorkspaceID) == "" {
		return "", apperrors.New(apperrors.CodeUnauthorized, "missing authenticated user context")
	}

	redirectURI := s.redirectURI(p)
	state, err := randomURLToken(24)
	if err != nil {
		return "", apperrors.Wrap(apperrors.CodeInternal, "failed to create oauth state", err)
	}
	codeVerifier, err := randomURLToken(48)
	if err != nil {
		return "", apperrors.Wrap(apperrors.CodeInternal, "failed to create oauth verifier", err)
	}
	now := time.Now().UTC()
	if err := s.repo.InsertOAuthState(ctx, OAuthState{
		State:        state,
		UserID:       principal.UserID,
		WorkspaceID:  principal.WorkspaceID,
		Provider:     string(p),
		CodeVerifier: codeVerifier,
		RedirectURI:  redirectURI,
		ExpiresAt:    now.Add(s.cfg.OAuthStateTTL).Format(time.RFC3339),
		CreatedAt:    now.Format(time.RFC3339),
	}); err != nil {
		return "", apperrors.Wrap(apperrors.CodeInternal, "failed to persist oauth state", err)
	}

	challenge := pkceCodeChallenge(codeVerifier)
	values := url.Values{}
	values.Set("client_id", s.clientIDForProvider(p))
	values.Set("redirect_uri", redirectURI)
	values.Set("response_type", "code")
	values.Set("state", state)
	values.Set("code_challenge", challenge)
	values.Set("code_challenge_method", "S256")

	switch p {
	case ProviderGoogle:
		values.Set("scope", s.cfg.GoogleCalendarScope)
		values.Set("access_type", "offline")
		values.Set("include_granted_scopes", "true")
		values.Set("prompt", "consent")
		return "https://accounts.google.com/o/oauth2/v2/auth?" + values.Encode(), nil
	default:
		return "", apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "unsupported calendar provider"), "provider")
	}
}

func (s *Service) CompleteConnect(ctx context.Context, provider string, state string, code string) (Connection, error) {
	p, err := s.normalizeProvider(provider)
	if err != nil {
		return Connection{}, err
	}
	if err := s.ensureProviderConfigured(p); err != nil {
		return Connection{}, err
	}

	state = strings.TrimSpace(state)
	code = strings.TrimSpace(code)
	if state == "" {
		return Connection{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "oauth state is required"), "state")
	}
	if code == "" {
		return Connection{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "authorization code is required"), "code")
	}

	oauthState, err := s.repo.ConsumeOAuthState(ctx, string(p), state)
	if err != nil {
		return Connection{}, err
	}
	token, err := s.exchangeAuthCode(ctx, p, code, oauthState.RedirectURI, oauthState.CodeVerifier)
	if err != nil {
		return Connection{}, err
	}
	profile, err := s.fetchProfile(ctx, p, token.AccessToken)
	if err != nil {
		return Connection{}, err
	}
	now := time.Now().UTC()
	var expiresAt *string
	if token.ExpiresIn > 0 {
		parsed := now.Add(time.Duration(token.ExpiresIn) * time.Second).Format(time.RFC3339)
		expiresAt = &parsed
	}

	return s.repo.UpsertConnection(ctx, UpsertConnectionInput{
		ID:                "CC_" + uuid.NewString(),
		Provider:          string(p),
		ExternalAccountID: profile.ExternalAccountID,
		Email:             profile.Email,
		AccessToken:       token.AccessToken,
		RefreshToken:      token.RefreshToken,
		TokenType:         nonEmptyOr(token.TokenType, "Bearer"),
		Scope:             token.Scope,
		ExpiresAt:         expiresAt,
		CalendarID:        "primary",
		CreatedAt:         now.Format(time.RFC3339),
		UpdatedAt:         now.Format(time.RFC3339),
	})
}

func (s *Service) DeleteConnection(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "connection id is required"), "connectionId")
	}
	return s.repo.DeleteConnection(ctx, id)
}

type SyncResult struct {
	ConnectionID string `json:"connectionId"`
	Provider     string `json:"provider"`
	Pulled       int    `json:"pulled"`
	Error        string `json:"error,omitempty"`
}

type SyncResponse struct {
	Results []SyncResult `json:"results"`
}

func (s *Service) SyncConnections(ctx context.Context, connectionID string) (SyncResponse, error) {
	connectionID = strings.TrimSpace(connectionID)
	var targets []ConnectionWithSecrets
	if connectionID != "" {
		conn, err := s.repo.GetConnectionByID(ctx, connectionID)
		if err != nil {
			return SyncResponse{}, err
		}
		targets = []ConnectionWithSecrets{conn}
	} else {
		list, err := s.repo.ListConnections(ctx)
		if err != nil {
			return SyncResponse{}, err
		}
		for _, c := range list {
			conn, err := s.repo.GetConnectionByID(ctx, c.ID)
			if err != nil {
				return SyncResponse{}, err
			}
			targets = append(targets, conn)
		}
	}
	if len(targets) == 0 {
		return SyncResponse{}, apperrors.New(apperrors.CodeValidationError, "no connected calendars to sync")
	}

	results := make([]SyncResult, 0, len(targets))
	for _, conn := range targets {
		result := SyncResult{
			ConnectionID: conn.ID,
			Provider:     conn.Provider,
		}
		token, err := s.ensureAccessToken(ctx, conn)
		if err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}
		pulled, err := s.pullUpcomingEventCount(ctx, conn.Provider, token)
		if err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}
		result.Pulled = pulled
		_ = s.repo.MarkConnectionSynced(ctx, conn.ID, time.Now().UTC().Format(time.RFC3339))
		results = append(results, result)
	}

	return SyncResponse{Results: results}, nil
}

type tokenPayload struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
	ExpiresIn    int    `json:"expires_in"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

type accountProfile struct {
	ExternalAccountID string
	Email             string
}

func (s *Service) exchangeAuthCode(ctx context.Context, provider Provider, code string, redirectURI string, codeVerifier string) (tokenPayload, error) {
	values := url.Values{}
	values.Set("grant_type", "authorization_code")
	values.Set("code", strings.TrimSpace(code))
	values.Set("redirect_uri", strings.TrimSpace(redirectURI))
	values.Set("code_verifier", strings.TrimSpace(codeVerifier))
	values.Set("client_id", s.clientIDForProvider(provider))
	values.Set("client_secret", s.clientSecretForProvider(provider))

	endpoint := ""
	switch provider {
	case ProviderGoogle:
		endpoint = "https://oauth2.googleapis.com/token"
	default:
		return tokenPayload{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "unsupported calendar provider"), "provider")
	}
	token, err := s.exchangeTokenRequest(ctx, endpoint, values)
	if err != nil {
		return tokenPayload{}, err
	}
	if strings.TrimSpace(token.AccessToken) == "" {
		return tokenPayload{}, apperrors.New(apperrors.CodeValidationError, "calendar provider did not return an access token")
	}
	return token, nil
}

func (s *Service) refreshAccessToken(ctx context.Context, provider Provider, refreshToken string) (tokenPayload, error) {
	values := url.Values{}
	values.Set("grant_type", "refresh_token")
	values.Set("refresh_token", strings.TrimSpace(refreshToken))
	values.Set("client_id", s.clientIDForProvider(provider))
	values.Set("client_secret", s.clientSecretForProvider(provider))

	endpoint := ""
	switch provider {
	case ProviderGoogle:
		endpoint = "https://oauth2.googleapis.com/token"
	case "":
		return tokenPayload{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "provider is required"), "provider")
	default:
		return tokenPayload{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "unsupported calendar provider"), "provider")
	}
	token, err := s.exchangeTokenRequest(ctx, endpoint, values)
	if err != nil {
		return tokenPayload{}, err
	}
	if strings.TrimSpace(token.AccessToken) == "" {
		return tokenPayload{}, apperrors.New(apperrors.CodeValidationError, "calendar provider did not return a refreshed access token")
	}
	return token, nil
}

func (s *Service) exchangeTokenRequest(ctx context.Context, endpoint string, values url.Values) (tokenPayload, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return tokenPayload{}, apperrors.Wrap(apperrors.CodeInternal, "create provider token request", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	res, err := s.httpClient.Do(req)
	if err != nil {
		return tokenPayload{}, apperrors.Wrap(apperrors.CodeInternal, "calendar token request failed", err)
	}
	defer func() {
		_ = res.Body.Close()
	}()

	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return tokenPayload{}, apperrors.Wrap(apperrors.CodeInternal, "read calendar token response", err)
	}
	var token tokenPayload
	if err := json.Unmarshal(body, &token); err != nil {
		return tokenPayload{}, apperrors.Wrap(apperrors.CodeInternal, "decode calendar token response", err)
	}
	if res.StatusCode >= 400 {
		msg := strings.TrimSpace(token.ErrorDesc)
		if msg == "" {
			msg = strings.TrimSpace(token.Error)
		}
		if msg == "" {
			msg = fmt.Sprintf("calendar provider token exchange failed (%d)", res.StatusCode)
		}
		return tokenPayload{}, apperrors.New(apperrors.CodeValidationError, msg)
	}
	return token, nil
}

func (s *Service) fetchProfile(ctx context.Context, provider Provider, accessToken string) (accountProfile, error) {
	switch provider {
	case ProviderGoogle:
		var payload struct {
			Sub   string `json:"sub"`
			Email string `json:"email"`
		}
		if err := s.fetchJSONWithBearer(ctx, "https://www.googleapis.com/oauth2/v3/userinfo", accessToken, &payload); err != nil {
			return accountProfile{}, err
		}
		if strings.TrimSpace(payload.Sub) == "" {
			return accountProfile{}, apperrors.New(apperrors.CodeValidationError, "google account profile missing id")
		}
		return accountProfile{
			ExternalAccountID: strings.TrimSpace(payload.Sub),
			Email:             strings.ToLower(strings.TrimSpace(payload.Email)),
		}, nil
	default:
		return accountProfile{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "unsupported calendar provider"), "provider")
	}
}

func (s *Service) fetchJSONWithBearer(ctx context.Context, endpoint string, accessToken string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return apperrors.Wrap(apperrors.CodeInternal, "create provider request", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(accessToken))

	res, err := s.httpClient.Do(req)
	if err != nil {
		return apperrors.Wrap(apperrors.CodeInternal, "calendar provider request failed", err)
	}
	defer func() {
		_ = res.Body.Close()
	}()
	body, err := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	if err != nil {
		return apperrors.Wrap(apperrors.CodeInternal, "read calendar provider response", err)
	}
	if res.StatusCode >= 400 {
		return apperrors.New(apperrors.CodeValidationError, fmt.Sprintf("calendar provider request failed (%d)", res.StatusCode))
	}
	if err := json.Unmarshal(body, out); err != nil {
		return apperrors.Wrap(apperrors.CodeInternal, "decode calendar provider response", err)
	}
	return nil
}

func (s *Service) ensureAccessToken(ctx context.Context, conn ConnectionWithSecrets) (string, error) {
	accessToken := strings.TrimSpace(conn.AccessToken)
	refreshToken := strings.TrimSpace(conn.RefreshToken)
	if accessToken != "" {
		expiresAt := conn.ExpiresAt
		if expiresAt == nil {
			return accessToken, nil
		}
		parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(*expiresAt))
		if err == nil && parsed.After(time.Now().UTC().Add(45*time.Second)) {
			return accessToken, nil
		}
	}
	if refreshToken == "" {
		return "", apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "calendar token expired and refresh token is unavailable"), "connectionId")
	}
	p, err := s.normalizeProvider(conn.Provider)
	if err != nil {
		return "", err
	}
	token, err := s.refreshAccessToken(ctx, p, refreshToken)
	if err != nil {
		return "", err
	}
	var expiresAt *string
	if token.ExpiresIn > 0 {
		value := time.Now().UTC().Add(time.Duration(token.ExpiresIn) * time.Second).Format(time.RFC3339)
		expiresAt = &value
	}
	if err := s.repo.UpdateConnectionTokens(
		ctx,
		conn.ID,
		token.AccessToken,
		token.RefreshToken,
		nonEmptyOr(token.TokenType, conn.TokenType),
		nonEmptyOr(token.Scope, conn.Scope),
		expiresAt,
	); err != nil {
		return "", err
	}
	return token.AccessToken, nil
}

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
