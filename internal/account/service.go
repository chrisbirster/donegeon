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

type TeamMember struct {
	WorkspaceID string `db:"workspace_id" json:"workspaceId"`
	UserID      string `db:"user_id" json:"userId"`
	Email       string `db:"email" json:"email"`
	Name        string `db:"name" json:"name"`
	Role        string `db:"role" json:"role"`
	CreatedAt   string `db:"created_at" json:"createdAt"`
}

type TeamSettings struct {
	Team            Team         `json:"team"`
	Members         []TeamMember `json:"members"`
	Invitations     []TeamInvite `json:"invitations"`
	CurrentUserID   string       `json:"currentUserId"`
	CurrentUserRole string       `json:"currentUserRole"`
	CanManage       bool         `json:"canManage"`
}

type Session struct {
	User User  `json:"user"`
	Team *Team `json:"team,omitempty"`
}

const (
	TeamRoleOwner  = "owner"
	TeamRoleAdmin  = "admin"
	TeamRoleMember = "member"
)

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

	return s.ensureDefaultProjects(ctx, sessionctx.DefaultUserID, sessionctx.DefaultWorkspaceID, "Default Workspace")
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
		if _, err := tx.ExecContext(ctx, `
UPDATE workspaces
SET name = ?, updated_at = ?
WHERE id = ?
`, trimmedTeamName, now, workspaceID); err != nil {
			return Session{}, nil, err
		}
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

	if err := ensureDefaultProjectsTx(ctx, tx, user.ID, workspaceID, trimmedTeamName, now); err != nil {
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

func (s *Service) GetTeamSettings(ctx context.Context, actorUserID string, workspaceID string) (TeamSettings, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	if actorUserID == "" || workspaceID == "" {
		return TeamSettings{}, fmt.Errorf("team context is required")
	}

	role, err := workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamSettings{}, fmt.Errorf("not a member of this team")
		}
		return TeamSettings{}, err
	}

	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamSettings{}, fmt.Errorf("team not found")
		}
		return TeamSettings{}, err
	}

	members := []TeamMember{}
	if err := s.db.SelectContext(ctx, &members, `
SELECT workspace_id, user_id, email, name, role, created_at
FROM workspace_users
WHERE workspace_id = ?
ORDER BY
	CASE role
		WHEN 'owner' THEN 0
		WHEN 'admin' THEN 1
		ELSE 2
	END,
	LOWER(name) ASC,
	LOWER(email) ASC
`, workspaceID); err != nil {
		return TeamSettings{}, err
	}

	invitations := []TeamInvite{}
	if err := s.db.SelectContext(ctx, &invitations, `
SELECT invitation_code, workspace_id, email, status, created_at, updated_at
FROM workspace_invitations
WHERE workspace_id = ?
	AND status = 'pending'
ORDER BY created_at DESC
`, workspaceID); err != nil {
		return TeamSettings{}, err
	}

	return TeamSettings{
		Team:            team,
		Members:         members,
		Invitations:     invitations,
		CurrentUserID:   actorUserID,
		CurrentUserRole: role,
		CanManage:       canManageTeam(role),
	}, nil
}

func (s *Service) UpdateTeamName(ctx context.Context, actorUserID string, workspaceID string, teamName string) (Team, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	teamName = strings.TrimSpace(teamName)
	if actorUserID == "" || workspaceID == "" {
		return Team{}, fmt.Errorf("team context is required")
	}
	if teamName == "" {
		return Team{}, fmt.Errorf("team name is required")
	}

	role, err := workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Team{}, fmt.Errorf("not a member of this team")
		}
		return Team{}, err
	}
	if !canManageTeam(role) {
		return Team{}, fmt.Errorf("only team owners or admins can update team settings")
	}

	now := nowRFC3339()
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Team{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, `
UPDATE workspaces
SET
	name = ?,
	updated_at = ?
WHERE id = ?
`, teamName, now, workspaceID); err != nil {
		return Team{}, err
	}

	if err := ensureDefaultProjectsTx(ctx, tx, actorUserID, workspaceID, teamName, now); err != nil {
		return Team{}, err
	}

	if err := tx.Commit(); err != nil {
		return Team{}, err
	}

	return s.workspaceByID(ctx, workspaceID)
}

func (s *Service) InviteMember(ctx context.Context, actorUserID string, workspaceID string, rawEmail string) (TeamInvite, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	email := strings.ToLower(strings.TrimSpace(rawEmail))
	if actorUserID == "" || workspaceID == "" {
		return TeamInvite{}, fmt.Errorf("team context is required")
	}
	if email == "" || !strings.Contains(email, "@") {
		return TeamInvite{}, fmt.Errorf("valid invite email is required")
	}

	role, err := workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamInvite{}, fmt.Errorf("not a member of this team")
		}
		return TeamInvite{}, err
	}
	if !canManageTeam(role) {
		return TeamInvite{}, fmt.Errorf("only team owners or admins can invite members")
	}

	var memberCount int
	if err := s.db.GetContext(ctx, &memberCount, `
SELECT COUNT(1)
FROM workspace_users
WHERE workspace_id = ?
	AND LOWER(email) = LOWER(?)
`, workspaceID, email); err != nil {
		return TeamInvite{}, err
	}
	if memberCount > 0 {
		return TeamInvite{}, fmt.Errorf("user is already a team member")
	}

	var existing TeamInvite
	if err := s.db.GetContext(ctx, &existing, `
SELECT invitation_code, workspace_id, email, status, created_at, updated_at
FROM workspace_invitations
WHERE workspace_id = ?
	AND LOWER(email) = LOWER(?)
	AND status = 'pending'
ORDER BY created_at DESC
LIMIT 1
`, workspaceID, email); err == nil {
		return existing, nil
	} else if err != sql.ErrNoRows {
		return TeamInvite{}, err
	}

	now := nowRFC3339()
	invite := TeamInvite{
		InvitationCode: uuid.NewString(),
		WorkspaceID:    workspaceID,
		Email:          email,
		Status:         "pending",
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if _, err := s.db.ExecContext(ctx, `
INSERT INTO workspace_invitations (invitation_code, workspace_id, email, status, created_at, updated_at)
VALUES (?, ?, ?, 'pending', ?, ?)
`, invite.InvitationCode, invite.WorkspaceID, invite.Email, invite.CreatedAt, invite.UpdatedAt); err != nil {
		return TeamInvite{}, err
	}

	return invite, nil
}

func (s *Service) UpdateMemberRole(ctx context.Context, actorUserID string, workspaceID string, targetUserID string, role string) (TeamMember, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	targetUserID = strings.TrimSpace(targetUserID)
	nextRole := normalizeTeamRole(role)

	if actorUserID == "" || workspaceID == "" {
		return TeamMember{}, fmt.Errorf("team context is required")
	}
	if targetUserID == "" {
		return TeamMember{}, fmt.Errorf("target user is required")
	}
	if !isSupportedTeamRole(nextRole) {
		return TeamMember{}, fmt.Errorf("role must be one of owner, admin, member")
	}

	actorRole, err := workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamMember{}, fmt.Errorf("not a member of this team")
		}
		return TeamMember{}, err
	}
	if actorRole != TeamRoleOwner {
		return TeamMember{}, fmt.Errorf("only team owners can change roles")
	}

	targetMember, err := workspaceMemberByID(ctx, s.db, workspaceID, targetUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamMember{}, fmt.Errorf("target member not found")
		}
		return TeamMember{}, err
	}

	if targetMember.Role == TeamRoleOwner && targetUserID != actorUserID {
		return TeamMember{}, fmt.Errorf("owner role cannot be reassigned in this build")
	}
	if targetUserID == actorUserID && nextRole != TeamRoleOwner {
		return TeamMember{}, fmt.Errorf("owner cannot demote themselves")
	}
	if nextRole == TeamRoleOwner && targetUserID != actorUserID {
		return TeamMember{}, fmt.Errorf("owner role transfer is not supported yet")
	}

	if _, err := s.db.ExecContext(ctx, `
UPDATE workspace_users
SET role = ?
WHERE workspace_id = ?
	AND user_id = ?
`, nextRole, workspaceID, targetUserID); err != nil {
		return TeamMember{}, err
	}

	return workspaceMemberByID(ctx, s.db, workspaceID, targetUserID)
}

func (s *Service) RemoveMember(ctx context.Context, actorUserID string, workspaceID string, targetUserID string) error {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	targetUserID = strings.TrimSpace(targetUserID)
	if actorUserID == "" || workspaceID == "" {
		return fmt.Errorf("team context is required")
	}
	if targetUserID == "" {
		return fmt.Errorf("target user is required")
	}
	if targetUserID == actorUserID {
		return fmt.Errorf("owner cannot remove themselves")
	}

	actorRole, err := workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("not a member of this team")
		}
		return err
	}
	if actorRole != TeamRoleOwner {
		return fmt.Errorf("only team owners can remove members")
	}

	targetMember, err := workspaceMemberByID(ctx, s.db, workspaceID, targetUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("target member not found")
		}
		return err
	}
	if targetMember.Role == TeamRoleOwner {
		return fmt.Errorf("owner cannot be removed")
	}

	now := nowRFC3339()
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	result, err := tx.ExecContext(ctx, `
DELETE FROM workspace_users
WHERE workspace_id = ?
	AND user_id = ?
`, workspaceID, targetUserID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("target member not found")
	}

	if _, err := tx.ExecContext(ctx, `
UPDATE users
SET
	current_workspace_id = CASE
		WHEN current_workspace_id = ? THEN NULL
		ELSE current_workspace_id
	END,
	show_onboarding = CASE
		WHEN current_workspace_id = ? THEN 1
		ELSE show_onboarding
	END,
	updated_at = CASE
		WHEN current_workspace_id = ? THEN ?
		ELSE updated_at
	END
WHERE id = ?
`, workspaceID, workspaceID, workspaceID, now, targetUserID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func (s *Service) CancelInvitation(ctx context.Context, actorUserID string, workspaceID string, invitationCode string) error {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	invitationCode = strings.TrimSpace(invitationCode)
	if actorUserID == "" || workspaceID == "" {
		return fmt.Errorf("team context is required")
	}
	if invitationCode == "" {
		return fmt.Errorf("invitation code is required")
	}

	role, err := workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("not a member of this team")
		}
		return err
	}
	if !canManageTeam(role) {
		return fmt.Errorf("only team owners or admins can cancel invitations")
	}

	result, err := s.db.ExecContext(ctx, `
DELETE FROM workspace_invitations
WHERE invitation_code = ?
	AND workspace_id = ?
	AND status = 'pending'
`, invitationCode, workspaceID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("invitation not found")
	}
	return nil
}

func (s *Service) ensureDefaultProjects(ctx context.Context, userID string, workspaceID string, teamName string) error {
	now := nowRFC3339()
	boardName := defaultBoardProjectName(teamName)
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, 0, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	updated_at = excluded.updated_at
`, projectStorageID(workspaceID, "board"), boardName, userID, workspaceID, now, now); err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, 1, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	updated_at = excluded.updated_at
`, projectStorageID(workspaceID, "inbox"), "inbox", userID, workspaceID, now, now); err != nil {
		return err
	}
	return nil
}

func ensureDefaultProjectsTx(ctx context.Context, tx *sqlx.Tx, userID string, workspaceID string, teamName string, now string) error {
	boardName := defaultBoardProjectName(teamName)
	if _, err := tx.ExecContext(ctx, `
INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, 0, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	updated_at = excluded.updated_at
`, projectStorageID(workspaceID, "board"), boardName, userID, workspaceID, now, now); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, 1, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	updated_at = excluded.updated_at
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

func workspaceUserRole(ctx context.Context, db sqlx.QueryerContext, workspaceID string, userID string) (string, error) {
	var role string
	err := sqlx.GetContext(ctx, db, &role, `
SELECT role
FROM workspace_users
WHERE workspace_id = ?
	AND user_id = ?
LIMIT 1
`, workspaceID, userID)
	if err != nil {
		return "", err
	}
	return normalizeTeamRole(role), nil
}

func workspaceMemberByID(ctx context.Context, db sqlx.QueryerContext, workspaceID string, userID string) (TeamMember, error) {
	var member TeamMember
	err := sqlx.GetContext(ctx, db, &member, `
SELECT workspace_id, user_id, email, name, role, created_at
FROM workspace_users
WHERE workspace_id = ?
	AND user_id = ?
LIMIT 1
`, workspaceID, userID)
	if err != nil {
		return TeamMember{}, err
	}
	member.Role = normalizeTeamRole(member.Role)
	return member, nil
}

func normalizeTeamRole(role string) string {
	role = strings.ToLower(strings.TrimSpace(role))
	switch role {
	case TeamRoleOwner:
		return TeamRoleOwner
	case TeamRoleAdmin:
		return TeamRoleAdmin
	default:
		return TeamRoleMember
	}
}

func isSupportedTeamRole(role string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case TeamRoleOwner, TeamRoleAdmin, TeamRoleMember:
		return true
	default:
		return false
	}
}

func canManageTeam(role string) bool {
	role = normalizeTeamRole(role)
	return role == TeamRoleOwner || role == TeamRoleAdmin
}

func defaultBoardProjectName(teamName string) string {
	teamName = strings.TrimSpace(teamName)
	if teamName == "" {
		return "board"
	}
	possessive := "'s"
	if strings.HasSuffix(strings.ToLower(teamName), "s") {
		possessive = "'"
	}
	return fmt.Sprintf("%s%s board", teamName, possessive)
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
