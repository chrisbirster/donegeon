package account

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"donegeon/internal/sessionctx"
	"donegeon/internal/tenant"
)

type User struct {
	ID               string  `db:"id" json:"id"`
	Email            string  `db:"email" json:"email"`
	Name             string  `db:"name" json:"name"`
	ShowOnboarding   bool    `db:"show_onboarding" json:"showOnboarding"`
	CurrentWorkspace *string `db:"current_workspace_id" json:"currentWorkspaceId,omitempty"`
	CreatedAt        string  `db:"created_at" json:"createdAt"`
	UpdatedAt        string  `db:"updated_at" json:"updatedAt"`
}

type Team struct {
	ID         string `db:"id" json:"id"`
	Name       string `db:"name" json:"name"`
	Plan       string `db:"plan" json:"plan"`
	IsArchived bool   `db:"is_archived" json:"isArchived"`
	CreatedAt  string `db:"created_at" json:"createdAt"`
	UpdatedAt  string `db:"updated_at" json:"updatedAt"`
}

type TeamInvite struct {
	InvitationCode string `db:"invitation_code" json:"invitationCode"`
	WorkspaceID    string `db:"workspace_id" json:"workspaceId"`
	Email          string `db:"email" json:"email"`
	Status         string `db:"status" json:"status"`
	CreatedAt      string `db:"created_at" json:"createdAt"`
	UpdatedAt      string `db:"updated_at" json:"updatedAt"`
}

type Session struct {
	User User  `json:"user"`
	Team *Team `json:"team,omitempty"`
}

type Service struct {
	db *sqlx.DB
}

func NewService(db *sqlx.DB) *Service {
	svc := &Service{db: db}
	_ = svc.EnsureDefaults(context.Background())
	return svc
}

func (s *Service) EnsureDefaults(ctx context.Context) error {
	now := nowRFC3339()
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO workspaces (id, name, plan, is_archived, created_at, updated_at)
VALUES (?, ?, 'free', 0, ?, ?)
ON CONFLICT(id) DO NOTHING
`, sessionctx.DefaultWorkspaceID, "Default Workspace", now, now); err != nil {
		return err
	}

	if _, err := s.db.ExecContext(ctx, `
INSERT INTO users (id, email, name, show_onboarding, current_workspace_id, created_at, updated_at)
VALUES (?, ?, ?, 0, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    show_onboarding = 0,
    current_workspace_id = excluded.current_workspace_id,
    updated_at = excluded.updated_at
`, sessionctx.DefaultUserID, "owner@example.com", "Owner", sessionctx.DefaultWorkspaceID, now, now); err != nil {
		return err
	}

	if _, err := s.db.ExecContext(ctx, `
INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES (?, ?, ?, ?, 'owner', ?)
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    role = excluded.role
`, sessionctx.DefaultWorkspaceID, sessionctx.DefaultUserID, "owner@example.com", "Owner", now); err != nil {
		return err
	}

	return s.ensureDefaultProjects(ctx, sessionctx.DefaultUserID, sessionctx.DefaultWorkspaceID)
}

func (s *Service) Login(ctx context.Context, email string, preferredName string) (Session, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") {
		return Session{}, fmt.Errorf("a valid email is required")
	}

	name := strings.TrimSpace(preferredName)
	if name == "" {
		name = defaultNameFromEmail(email)
	}

	now := nowRFC3339()
	user, err := s.userByEmail(ctx, email)
	if err != nil && err != sql.ErrNoRows {
		return Session{}, err
	}
	if err == sql.ErrNoRows {
		user = User{
			ID:             "U_" + uuid.NewString(),
			Email:          email,
			Name:           name,
			ShowOnboarding: true,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if _, err := s.db.ExecContext(ctx, `
INSERT INTO users (id, email, name, show_onboarding, current_workspace_id, created_at, updated_at)
VALUES (?, ?, ?, 1, NULL, ?, ?)
`, user.ID, user.Email, user.Name, now, now); err != nil {
			return Session{}, err
		}
	} else if strings.TrimSpace(preferredName) != "" && user.Name != name {
		if _, err := s.db.ExecContext(ctx, "UPDATE users SET name = ?, updated_at = ? WHERE id = ?", name, now, user.ID); err != nil {
			return Session{}, err
		}
		user.Name = name
		user.UpdatedAt = now
	}

	return s.GetSession(ctx, user.ID)
}

func (s *Service) GetSession(ctx context.Context, userID string) (Session, error) {
	user, err := s.userByID(ctx, strings.TrimSpace(userID))
	if err != nil {
		return Session{}, err
	}

	var team *Team
	if user.CurrentWorkspace != nil && strings.TrimSpace(*user.CurrentWorkspace) != "" {
		found, err := s.workspaceByID(ctx, *user.CurrentWorkspace)
		if err == nil {
			team = &found
		} else if err != sql.ErrNoRows {
			return Session{}, err
		}
	}

	return Session{
		User: user,
		Team: team,
	}, nil
}

func (s *Service) CompleteOnboarding(ctx context.Context, userID string, teamName string, inviteEmails []string) (Session, []TeamInvite, error) {
	trimmedTeamName := strings.TrimSpace(teamName)
	if trimmedTeamName == "" {
		return Session{}, nil, fmt.Errorf("team name is required")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Session{}, nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var user User
	if err := tx.GetContext(ctx, &user, `
SELECT id, email, name, show_onboarding, current_workspace_id, created_at, updated_at
FROM users
WHERE id = ?
LIMIT 1
`, strings.TrimSpace(userID)); err != nil {
		if err == sql.ErrNoRows {
			return Session{}, nil, fmt.Errorf("user not found")
		}
		return Session{}, nil, err
	}

	now := nowRFC3339()
	workspaceID := ""
	if user.CurrentWorkspace != nil && strings.TrimSpace(*user.CurrentWorkspace) != "" {
		workspaceID = strings.TrimSpace(*user.CurrentWorkspace)
	} else {
		workspaceID = "W_" + uuid.NewString()
		if _, err := tx.ExecContext(ctx, `
INSERT INTO workspaces (id, name, plan, is_archived, created_at, updated_at)
VALUES (?, ?, 'free', 0, ?, ?)
`, workspaceID, trimmedTeamName, now, now); err != nil {
			return Session{}, nil, err
		}
	}

	if _, err := tx.ExecContext(ctx, `
INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES (?, ?, ?, ?, 'owner', ?)
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    role = excluded.role
`, workspaceID, user.ID, user.Email, user.Name, now); err != nil {
		return Session{}, nil, err
	}

	invites := make([]TeamInvite, 0, len(inviteEmails))
	for _, email := range normalizeInviteEmails(inviteEmails, user.Email) {
		code := uuid.NewString()
		if _, err := tx.ExecContext(ctx, `
INSERT INTO workspace_invitations (invitation_code, workspace_id, email, status, created_at, updated_at)
VALUES (?, ?, ?, 'pending', ?, ?)
`, code, workspaceID, email, now, now); err != nil {
			return Session{}, nil, err
		}
		invites = append(invites, TeamInvite{
			InvitationCode: code,
			WorkspaceID:    workspaceID,
			Email:          email,
			Status:         "pending",
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}

	if _, err := tx.ExecContext(ctx, `
UPDATE users
SET
    show_onboarding = 0,
    current_workspace_id = ?,
    updated_at = ?
WHERE id = ?
`, workspaceID, now, user.ID); err != nil {
		return Session{}, nil, err
	}

	if err := ensureDefaultProjectsTx(ctx, tx, user.ID, workspaceID, now); err != nil {
		return Session{}, nil, err
	}

	if err := tx.Commit(); err != nil {
		return Session{}, nil, err
	}

	session, err := s.GetSession(ctx, user.ID)
	if err != nil {
		return Session{}, nil, err
	}
	return session, invites, nil
}

func (s *Service) ensureDefaultProjects(ctx context.Context, userID string, workspaceID string) error {
	now := nowRFC3339()
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, 0, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING
`, projectStorageID(workspaceID, "board"), "board", userID, workspaceID, now, now); err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, 1, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING
`, projectStorageID(workspaceID, "inbox"), "inbox", userID, workspaceID, now, now); err != nil {
		return err
	}
	return nil
}

func ensureDefaultProjectsTx(ctx context.Context, tx *sqlx.Tx, userID string, workspaceID string, now string) error {
	if _, err := tx.ExecContext(ctx, `
INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, 0, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING
`, projectStorageID(workspaceID, "board"), "board", userID, workspaceID, now, now); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, 1, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO NOTHING
`, projectStorageID(workspaceID, "inbox"), "inbox", userID, workspaceID, now, now); err != nil {
		return err
	}
	return nil
}

func (s *Service) userByID(ctx context.Context, id string) (User, error) {
	var row User
	err := s.db.GetContext(ctx, &row, `
SELECT id, email, name, show_onboarding, current_workspace_id, created_at, updated_at
FROM users
WHERE id = ?
LIMIT 1
`, id)
	return row, err
}

func (s *Service) userByEmail(ctx context.Context, email string) (User, error) {
	var row User
	err := s.db.GetContext(ctx, &row, `
SELECT id, email, name, show_onboarding, current_workspace_id, created_at, updated_at
FROM users
WHERE LOWER(email) = LOWER(?)
LIMIT 1
`, email)
	return row, err
}

func (s *Service) workspaceByID(ctx context.Context, id string) (Team, error) {
	var row Team
	err := s.db.GetContext(ctx, &row, `
SELECT id, name, plan, is_archived, created_at, updated_at
FROM workspaces
WHERE id = ?
LIMIT 1
`, id)
	return row, err
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func defaultNameFromEmail(email string) string {
	parts := strings.SplitN(strings.TrimSpace(email), "@", 2)
	if len(parts) == 0 || strings.TrimSpace(parts[0]) == "" {
		return "New User"
	}
	return strings.TrimSpace(parts[0])
}

func normalizeInviteEmails(raw []string, ownerEmail string) []string {
	owner := strings.ToLower(strings.TrimSpace(ownerEmail))
	seen := make(map[string]struct{}, len(raw))
	result := make([]string, 0, len(raw))
	for _, item := range raw {
		email := strings.ToLower(strings.TrimSpace(item))
		if email == "" || !strings.Contains(email, "@") || email == owner {
			continue
		}
		if _, ok := seen[email]; ok {
			continue
		}
		seen[email] = struct{}{}
		result = append(result, email)
	}
	return result
}

func projectStorageID(workspaceID, slug string) string {
	if strings.TrimSpace(workspaceID) == sessionctx.DefaultWorkspaceID {
		return strings.TrimSpace(slug)
	}
	return tenant.CanonicalProjectID(workspaceID, slug)
}
