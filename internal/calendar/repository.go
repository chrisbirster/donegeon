package calendar

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
)

type Repository struct {
	db      *sqlx.DB
	queries map[string]string
}

func NewRepository(db *sqlx.DB, queries map[string]string) *Repository {
	return &Repository{db: db, queries: queries}
}

func (r *Repository) query(name string) (string, error) {
	q, ok := r.queries[name]
	if !ok {
		return "", fmt.Errorf("missing embedded query: %s", name)
	}
	return q, nil
}

type connectionRow struct {
	ID                string         `db:"id"`
	Provider          string         `db:"provider"`
	ExternalAccountID string         `db:"external_account_id"`
	Email             string         `db:"email"`
	AccessToken       sql.NullString `db:"access_token"`
	RefreshToken      sql.NullString `db:"refresh_token"`
	TokenType         sql.NullString `db:"token_type"`
	Scope             sql.NullString `db:"scope"`
	ExpiresAt         sql.NullString `db:"expires_at"`
	CalendarID        string         `db:"calendar_id"`
	CreatedAt         string         `db:"created_at"`
	UpdatedAt         string         `db:"updated_at"`
	LastSyncAt        sql.NullString `db:"last_sync_at"`
}

func (row connectionRow) toConnection() Connection {
	return Connection{
		ID:                row.ID,
		Provider:          row.Provider,
		ExternalAccountID: row.ExternalAccountID,
		Email:             row.Email,
		Scope:             strings.TrimSpace(row.Scope.String),
		CalendarID:        row.CalendarID,
		ExpiresAt:         nullableStringPointer(row.ExpiresAt),
		LastSyncAt:        nullableStringPointer(row.LastSyncAt),
		CreatedAt:         row.CreatedAt,
		UpdatedAt:         row.UpdatedAt,
		HasRefreshToken:   strings.TrimSpace(row.RefreshToken.String) != "",
	}
}

func (row connectionRow) toConnectionWithSecrets() ConnectionWithSecrets {
	return ConnectionWithSecrets{
		Connection:   row.toConnection(),
		AccessToken:  strings.TrimSpace(row.AccessToken.String),
		RefreshToken: strings.TrimSpace(row.RefreshToken.String),
		TokenType:    strings.TrimSpace(row.TokenType.String),
	}
}

func nullableStringPointer(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	trimmed := strings.TrimSpace(value.String)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

type Connection struct {
	ID                string  `json:"id"`
	Provider          string  `json:"provider"`
	ExternalAccountID string  `json:"externalAccountId,omitempty"`
	Email             string  `json:"email"`
	Scope             string  `json:"scope,omitempty"`
	CalendarID        string  `json:"calendarId"`
	ExpiresAt         *string `json:"expiresAt,omitempty"`
	LastSyncAt        *string `json:"lastSyncAt,omitempty"`
	CreatedAt         string  `json:"createdAt"`
	UpdatedAt         string  `json:"updatedAt"`
	HasRefreshToken   bool    `json:"hasRefreshToken"`
}

type ConnectionWithSecrets struct {
	Connection
	AccessToken  string
	RefreshToken string
	TokenType    string
}

type UpsertConnectionInput struct {
	ID                string
	Provider          string
	ExternalAccountID string
	Email             string
	AccessToken       string
	RefreshToken      string
	TokenType         string
	Scope             string
	ExpiresAt         *string
	CalendarID        string
	CreatedAt         string
	UpdatedAt         string
}

func (r *Repository) ListConnections(ctx context.Context) ([]Connection, error) {
	q, err := r.query("calendar_connection_list.sql")
	if err != nil {
		return nil, err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
	}

	rows := []connectionRow{}
	named, bindArgs, err := sqlx.Named(q, args)
	if err != nil {
		return nil, err
	}
	named = r.db.Rebind(named)
	if err := r.db.SelectContext(ctx, &rows, named, bindArgs...); err != nil {
		return nil, err
	}

	out := make([]Connection, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.toConnection())
	}
	return out, nil
}

func (r *Repository) GetConnectionByID(ctx context.Context, id string) (ConnectionWithSecrets, error) {
	q, err := r.query("calendar_connection_get_by_id.sql")
	if err != nil {
		return ConnectionWithSecrets{}, err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"id":           strings.TrimSpace(id),
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
	}

	var row connectionRow
	named, bindArgs, err := sqlx.Named(q, args)
	if err != nil {
		return ConnectionWithSecrets{}, err
	}
	named = r.db.Rebind(named)
	if err := r.db.GetContext(ctx, &row, named, bindArgs...); err != nil {
		if err == sql.ErrNoRows {
			return ConnectionWithSecrets{}, apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "calendar connection not found"), "connectionId")
		}
		return ConnectionWithSecrets{}, err
	}
	return row.toConnectionWithSecrets(), nil
}

func (r *Repository) getByProviderExternal(ctx context.Context, provider string, externalAccountID string) (ConnectionWithSecrets, error) {
	q, err := r.query("calendar_connection_get_by_provider_external.sql")
	if err != nil {
		return ConnectionWithSecrets{}, err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"user_id":             principal.UserID,
		"workspace_id":        principal.WorkspaceID,
		"provider":            strings.TrimSpace(provider),
		"external_account_id": strings.TrimSpace(externalAccountID),
	}

	var row connectionRow
	named, bindArgs, err := sqlx.Named(q, args)
	if err != nil {
		return ConnectionWithSecrets{}, err
	}
	named = r.db.Rebind(named)
	if err := r.db.GetContext(ctx, &row, named, bindArgs...); err != nil {
		if err == sql.ErrNoRows {
			return ConnectionWithSecrets{}, apperrors.New(apperrors.CodeNotFound, "calendar connection not found")
		}
		return ConnectionWithSecrets{}, err
	}
	return row.toConnectionWithSecrets(), nil
}

func (r *Repository) UpsertConnection(ctx context.Context, in UpsertConnectionInput) (Connection, error) {
	q, err := r.query("calendar_connection_upsert.sql")
	if err != nil {
		return Connection{}, err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	expiresAt := ""
	if in.ExpiresAt != nil {
		expiresAt = strings.TrimSpace(*in.ExpiresAt)
	}
	args := map[string]any{
		"id":                  strings.TrimSpace(in.ID),
		"user_id":             principal.UserID,
		"workspace_id":        principal.WorkspaceID,
		"provider":            strings.TrimSpace(in.Provider),
		"external_account_id": strings.TrimSpace(in.ExternalAccountID),
		"email":               strings.TrimSpace(in.Email),
		"access_token":        strings.TrimSpace(in.AccessToken),
		"refresh_token":       strings.TrimSpace(in.RefreshToken),
		"token_type":          strings.TrimSpace(in.TokenType),
		"scope":               strings.TrimSpace(in.Scope),
		"expires_at":          nullableString(expiresAt),
		"calendar_id":         nonEmptyOr(strings.TrimSpace(in.CalendarID), "primary"),
		"created_at":          strings.TrimSpace(in.CreatedAt),
		"updated_at":          strings.TrimSpace(in.UpdatedAt),
	}

	if _, err := r.db.NamedExecContext(ctx, q, args); err != nil {
		return Connection{}, err
	}
	updated, err := r.getByProviderExternal(ctx, in.Provider, in.ExternalAccountID)
	if err != nil {
		return Connection{}, err
	}
	return updated.Connection, nil
}

func (r *Repository) UpdateConnectionTokens(ctx context.Context, id string, accessToken string, refreshToken string, tokenType string, scope string, expiresAt *string) error {
	q, err := r.query("calendar_connection_update_tokens.sql")
	if err != nil {
		return err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	expires := ""
	if expiresAt != nil {
		expires = strings.TrimSpace(*expiresAt)
	}
	args := map[string]any{
		"id":           strings.TrimSpace(id),
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
		"access_token": strings.TrimSpace(accessToken),
		"refresh_token": nullableString(
			strings.TrimSpace(refreshToken),
		),
		"token_type": strings.TrimSpace(tokenType),
		"scope":      strings.TrimSpace(scope),
		"expires_at": nullableString(expires),
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}
	res, err := r.db.NamedExecContext(ctx, q, args)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "calendar connection not found"), "connectionId")
	}
	return nil
}

func (r *Repository) MarkConnectionSynced(ctx context.Context, id string, at string) error {
	q, err := r.query("calendar_connection_mark_sync.sql")
	if err != nil {
		return err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"id":           strings.TrimSpace(id),
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
		"last_sync_at": strings.TrimSpace(at),
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	}
	res, err := r.db.NamedExecContext(ctx, q, args)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "calendar connection not found"), "connectionId")
	}
	return nil
}

func (r *Repository) DeleteConnection(ctx context.Context, id string) error {
	q, err := r.query("calendar_connection_delete.sql")
	if err != nil {
		return err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"id":           strings.TrimSpace(id),
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	}
	res, err := r.db.NamedExecContext(ctx, q, args)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "calendar connection not found"), "connectionId")
	}
	return nil
}

type OAuthState struct {
	State        string
	UserID       string
	WorkspaceID  string
	Provider     string
	CodeVerifier string
	RedirectURI  string
	ExpiresAt    string
	CreatedAt    string
	ConsumedAt   *string
}

type oauthStateRow struct {
	State        string         `db:"state"`
	UserID       string         `db:"user_id"`
	WorkspaceID  string         `db:"workspace_id"`
	Provider     string         `db:"provider"`
	CodeVerifier string         `db:"code_verifier"`
	RedirectURI  string         `db:"redirect_uri"`
	ExpiresAt    string         `db:"expires_at"`
	CreatedAt    string         `db:"created_at"`
	ConsumedAt   sql.NullString `db:"consumed_at"`
}

func (row oauthStateRow) toState() OAuthState {
	return OAuthState{
		State:        row.State,
		UserID:       row.UserID,
		WorkspaceID:  row.WorkspaceID,
		Provider:     row.Provider,
		CodeVerifier: row.CodeVerifier,
		RedirectURI:  row.RedirectURI,
		ExpiresAt:    row.ExpiresAt,
		CreatedAt:    row.CreatedAt,
		ConsumedAt:   nullableStringPointer(row.ConsumedAt),
	}
}

func (r *Repository) InsertOAuthState(ctx context.Context, state OAuthState) error {
	q, err := r.query("calendar_oauth_state_insert.sql")
	if err != nil {
		return err
	}
	args := map[string]any{
		"state":         strings.TrimSpace(state.State),
		"user_id":       strings.TrimSpace(state.UserID),
		"workspace_id":  strings.TrimSpace(state.WorkspaceID),
		"provider":      strings.TrimSpace(state.Provider),
		"code_verifier": strings.TrimSpace(state.CodeVerifier),
		"redirect_uri":  strings.TrimSpace(state.RedirectURI),
		"expires_at":    strings.TrimSpace(state.ExpiresAt),
		"created_at":    strings.TrimSpace(state.CreatedAt),
	}
	_, err = r.db.NamedExecContext(ctx, q, args)
	return err
}

func (r *Repository) ConsumeOAuthState(ctx context.Context, provider string, state string) (OAuthState, error) {
	getQuery, err := r.query("calendar_oauth_state_get.sql")
	if err != nil {
		return OAuthState{}, err
	}
	consumeQuery, err := r.query("calendar_oauth_state_consume.sql")
	if err != nil {
		return OAuthState{}, err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return OAuthState{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	args := map[string]any{
		"state":        strings.TrimSpace(state),
		"provider":     strings.TrimSpace(provider),
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
	}
	var row oauthStateRow
	named, bindArgs, err := sqlx.Named(getQuery, args)
	if err != nil {
		return OAuthState{}, err
	}
	named = tx.Rebind(named)
	if err := tx.GetContext(ctx, &row, named, bindArgs...); err != nil {
		if err == sql.ErrNoRows {
			return OAuthState{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invalid calendar authorization state"), "state")
		}
		return OAuthState{}, err
	}
	if row.ConsumedAt.Valid && strings.TrimSpace(row.ConsumedAt.String) != "" {
		return OAuthState{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "calendar authorization state already used"), "state")
	}

	expiresAt, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(row.ExpiresAt))
	if parseErr != nil || time.Now().UTC().After(expiresAt) {
		return OAuthState{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "calendar authorization state expired"), "state")
	}

	res, err := tx.NamedExecContext(ctx, consumeQuery, map[string]any{
		"state":       strings.TrimSpace(state),
		"consumed_at": time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		return OAuthState{}, err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return OAuthState{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invalid calendar authorization state"), "state")
	}

	if err := tx.Commit(); err != nil {
		return OAuthState{}, err
	}
	return row.toState(), nil
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return strings.TrimSpace(value)
}

func nonEmptyOr(value string, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}
