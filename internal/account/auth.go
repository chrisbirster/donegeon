package account

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"donegeon/internal/sessionctx"
)

type LoginChallenge struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	ExpiresAt string `json:"expiresAt"`
}

type WebSession struct {
	ID        string               `json:"id"`
	Principal sessionctx.Principal `json:"principal"`
	ExpiresAt string               `json:"expiresAt"`
}

type loginChallengeRow struct {
	ID           string         `db:"id"`
	Email        string         `db:"email"`
	NameHint     sql.NullString `db:"name_hint"`
	CodeHash     string         `db:"code_hash"`
	CodeLength   int            `db:"code_length"`
	ExpiresAt    string         `db:"expires_at"`
	ConsumedAt   sql.NullString `db:"consumed_at"`
	AttemptCount int            `db:"attempt_count"`
}

type authSessionRow struct {
	ID          string         `db:"id"`
	UserID      string         `db:"user_id"`
	WorkspaceID string         `db:"workspace_id"`
	Email       string         `db:"email"`
	ExpiresAt   string         `db:"expires_at"`
	RevokedAt   sql.NullString `db:"revoked_at"`
}

func (s *Service) BeginEmailLogin(
	ctx context.Context,
	email string,
	preferredName string,
	codePepper string,
	codeTTL time.Duration,
	codeLength int,
	ipAddress string,
	userAgent string,
) (LoginChallenge, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") {
		return LoginChallenge{}, "", fmt.Errorf("a valid email is required")
	}
	if codeTTL <= 0 {
		return LoginChallenge{}, "", fmt.Errorf("code ttl is required")
	}
	if codeLength < 4 || codeLength > 10 {
		return LoginChallenge{}, "", fmt.Errorf("code length must be between 4 and 10")
	}

	code, err := generateNumericCode(codeLength)
	if err != nil {
		return LoginChallenge{}, "", fmt.Errorf("generate login code: %w", err)
	}

	now := time.Now().UTC()
	challenge := LoginChallenge{
		ID:        "ALC_" + uuid.NewString(),
		Email:     email,
		ExpiresAt: now.Add(codeTTL).Format(time.RFC3339),
	}
	preferredName = strings.TrimSpace(preferredName)

	if _, err := s.db.ExecContext(ctx, `
INSERT INTO auth_login_challenges (
	id, email, name_hint, code_hash, code_length, expires_at, created_at, consumed_at,
	attempt_count, last_attempt_at, requested_ip, requested_user_agent
)
VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)
`, challenge.ID, challenge.Email, nullableText(preferredName), hashAuthCode(code, codePepper), codeLength, challenge.ExpiresAt, now.Format(time.RFC3339), nullableText(ipAddress), nullableText(userAgent)); err != nil {
		return LoginChallenge{}, "", err
	}

	return challenge, code, nil
}

func (s *Service) VerifyEmailLogin(
	ctx context.Context,
	challengeID string,
	code string,
	codePepper string,
	maxAttempts int,
) (Session, error) {
	challengeID = strings.TrimSpace(challengeID)
	code = strings.TrimSpace(code)
	if challengeID == "" {
		return Session{}, fmt.Errorf("challenge id is required")
	}
	if code == "" {
		return Session{}, fmt.Errorf("code is required")
	}
	if maxAttempts < 1 {
		maxAttempts = 1
	}

	row, err := s.loginChallengeByID(ctx, challengeID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Session{}, fmt.Errorf("invalid or expired code")
		}
		return Session{}, err
	}

	if row.ConsumedAt.Valid {
		return Session{}, fmt.Errorf("invalid or expired code")
	}
	expiresAt, err := time.Parse(time.RFC3339, strings.TrimSpace(row.ExpiresAt))
	if err != nil {
		return Session{}, fmt.Errorf("invalid or expired code")
	}
	now := time.Now().UTC()
	if now.After(expiresAt) {
		return Session{}, fmt.Errorf("invalid or expired code")
	}
	if row.AttemptCount >= maxAttempts {
		return Session{}, fmt.Errorf("too many attempts, request a new code")
	}

	if !verifyAuthCode(row.CodeHash, code, codePepper) {
		if _, err := s.db.ExecContext(ctx, `
UPDATE auth_login_challenges
SET
	attempt_count = attempt_count + 1,
	last_attempt_at = ?
WHERE id = ?
`, now.Format(time.RFC3339), row.ID); err != nil {
			return Session{}, err
		}
		return Session{}, fmt.Errorf("invalid or expired code")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Session{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	consumeAt := now.Format(time.RFC3339)
	result, err := tx.ExecContext(ctx, `
UPDATE auth_login_challenges
SET
	consumed_at = ?,
	attempt_count = attempt_count + 1,
	last_attempt_at = ?
WHERE id = ?
	AND consumed_at IS NULL
	AND expires_at >= ?
`, consumeAt, consumeAt, row.ID, now.Format(time.RFC3339))
	if err != nil {
		return Session{}, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Session{}, err
	}
	if rowsAffected == 0 {
		return Session{}, fmt.Errorf("invalid or expired code")
	}

	user, err := userByEmailTx(ctx, tx, row.Email)
	if err != nil && err != sql.ErrNoRows {
		return Session{}, err
	}

	nameHint := strings.TrimSpace(row.NameHint.String)
	if err == sql.ErrNoRows {
		name := nameHint
		if name == "" {
			name = defaultNameFromEmail(row.Email)
		}
		user = User{
			ID:             "U_" + uuid.NewString(),
			Email:          row.Email,
			Name:           name,
			ShowOnboarding: true,
			CreatedAt:      now.Format(time.RFC3339),
			UpdatedAt:      now.Format(time.RFC3339),
		}
		if _, err := tx.ExecContext(ctx, `
INSERT INTO users (id, email, name, show_onboarding, current_workspace_id, created_at, updated_at)
VALUES (?, ?, ?, 1, NULL, ?, ?)
`, user.ID, user.Email, user.Name, user.CreatedAt, user.UpdatedAt); err != nil {
			return Session{}, err
		}
	} else if nameHint != "" && user.Name != nameHint {
		if _, err := tx.ExecContext(ctx, `
UPDATE users
SET
	name = ?,
	updated_at = ?
WHERE id = ?
`, nameHint, now.Format(time.RFC3339), user.ID); err != nil {
			return Session{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return Session{}, err
	}

	return s.GetSession(ctx, user.ID)
}

func (s *Service) CreateAuthSession(
	ctx context.Context,
	principal sessionctx.Principal,
	ttl time.Duration,
	userAgent string,
	ipAddress string,
) (WebSession, error) {
	principal.UserID = strings.TrimSpace(principal.UserID)
	principal.Email = strings.ToLower(strings.TrimSpace(principal.Email))
	principal.WorkspaceID = strings.TrimSpace(principal.WorkspaceID)
	if principal.UserID == "" {
		return WebSession{}, fmt.Errorf("user id is required")
	}
	if principal.WorkspaceID == "" {
		principal.WorkspaceID = sessionctx.DefaultWorkspaceID
	}
	if ttl <= 0 {
		return WebSession{}, fmt.Errorf("session ttl is required")
	}

	now := time.Now().UTC()
	record := WebSession{
		ID: "AS_" + uuid.NewString(),
		Principal: sessionctx.Principal{
			UserID:      principal.UserID,
			WorkspaceID: principal.WorkspaceID,
			Email:       principal.Email,
		},
		ExpiresAt: now.Add(ttl).Format(time.RFC3339),
	}

	if _, err := s.db.ExecContext(ctx, `
INSERT INTO auth_sessions (
	id, user_id, workspace_id, email, created_at, updated_at, expires_at, revoked_at, last_seen_at, user_agent, ip_address
)
VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
`, record.ID, record.Principal.UserID, record.Principal.WorkspaceID, record.Principal.Email, now.Format(time.RFC3339), now.Format(time.RFC3339), record.ExpiresAt, now.Format(time.RFC3339), nullableText(userAgent), nullableText(ipAddress)); err != nil {
		return WebSession{}, err
	}

	return record, nil
}

func (s *Service) AuthSessionPrincipal(ctx context.Context, sessionID string) (sessionctx.Principal, bool, error) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return sessionctx.Principal{}, false, nil
	}

	var row authSessionRow
	if err := s.db.GetContext(ctx, &row, `
SELECT id, user_id, workspace_id, email, expires_at, revoked_at
FROM auth_sessions
WHERE id = ?
LIMIT 1
`, sessionID); err != nil {
		if err == sql.ErrNoRows {
			return sessionctx.Principal{}, false, nil
		}
		return sessionctx.Principal{}, false, err
	}

	if row.RevokedAt.Valid {
		return sessionctx.Principal{}, false, nil
	}
	expiresAt, err := time.Parse(time.RFC3339, strings.TrimSpace(row.ExpiresAt))
	if err != nil {
		return sessionctx.Principal{}, false, nil
	}
	now := time.Now().UTC()
	if now.After(expiresAt) {
		return sessionctx.Principal{}, false, nil
	}

	if _, err := s.db.ExecContext(ctx, `
UPDATE auth_sessions
SET
	last_seen_at = ?,
	updated_at = ?
WHERE id = ?
`, now.Format(time.RFC3339), now.Format(time.RFC3339), row.ID); err != nil {
		return sessionctx.Principal{}, false, err
	}

	principal := sessionctx.Principal{
		UserID:      strings.TrimSpace(row.UserID),
		WorkspaceID: strings.TrimSpace(row.WorkspaceID),
		Email:       strings.TrimSpace(row.Email),
	}
	if principal.UserID == "" {
		return sessionctx.Principal{}, false, nil
	}
	if principal.WorkspaceID == "" {
		principal.WorkspaceID = sessionctx.DefaultWorkspaceID
	}
	return principal, true, nil
}

func (s *Service) RevokeAuthSession(ctx context.Context, sessionID string) error {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil
	}
	now := nowRFC3339()
	_, err := s.db.ExecContext(ctx, `
UPDATE auth_sessions
SET
	revoked_at = COALESCE(revoked_at, ?),
	updated_at = ?
WHERE id = ?
`, now, now, sessionID)
	return err
}

func (s *Service) UpdateAuthSessionPrincipal(ctx context.Context, sessionID string, principal sessionctx.Principal) error {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil
	}
	principal.WorkspaceID = strings.TrimSpace(principal.WorkspaceID)
	if principal.WorkspaceID == "" {
		principal.WorkspaceID = sessionctx.DefaultWorkspaceID
	}

	now := nowRFC3339()
	_, err := s.db.ExecContext(ctx, `
UPDATE auth_sessions
SET
	workspace_id = ?,
	email = ?,
	updated_at = ?
WHERE id = ?
	AND revoked_at IS NULL
`, principal.WorkspaceID, strings.TrimSpace(principal.Email), now, sessionID)
	return err
}

func (s *Service) loginChallengeByID(ctx context.Context, challengeID string) (loginChallengeRow, error) {
	var row loginChallengeRow
	err := s.db.GetContext(ctx, &row, `
SELECT id, email, name_hint, code_hash, code_length, expires_at, consumed_at, attempt_count
FROM auth_login_challenges
WHERE id = ?
LIMIT 1
`, challengeID)
	return row, err
}

func userByEmailTx(ctx context.Context, tx *sqlx.Tx, email string) (User, error) {
	var row User
	err := tx.GetContext(ctx, &row, `
SELECT id, email, name, show_onboarding, current_workspace_id, created_at, updated_at
FROM users
WHERE LOWER(email) = LOWER(?)
LIMIT 1
`, email)
	return row, err
}

func generateNumericCode(length int) (string, error) {
	if length < 1 {
		return "", fmt.Errorf("length must be at least 1")
	}
	var builder strings.Builder
	builder.Grow(length)
	max := big.NewInt(10)
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		builder.WriteByte(byte('0' + n.Int64()))
	}
	return builder.String(), nil
}

func hashAuthCode(code string, pepper string) string {
	mac := hmac.New(sha256.New, []byte(strings.TrimSpace(pepper)))
	_, _ = mac.Write([]byte(code))
	return hex.EncodeToString(mac.Sum(nil))
}

func verifyAuthCode(expectedHash string, code string, pepper string) bool {
	gotHash := hashAuthCode(code, pepper)
	expected := []byte(strings.TrimSpace(expectedHash))
	got := []byte(strings.TrimSpace(gotHash))
	if len(expected) != len(got) {
		return false
	}
	return subtle.ConstantTimeCompare(expected, got) == 1
}

func nullableText(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}
