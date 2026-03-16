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
	sharedpricing "donegeon/web/shared/pricing"
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
	ID                   string   `db:"id" json:"id"`
	Name                 string   `db:"name" json:"name"`
	Plan                 string   `db:"plan" json:"plan"`
	PlanFamily           string   `db:"-" json:"planFamily"`
	BillingState         string   `db:"-" json:"billingState"`
	Entitlements         []string `db:"-" json:"entitlements"`
	TrialEndsAt          *string  `db:"trial_ends_at" json:"trialEndsAt,omitempty"`
	StripeCustomerID     *string  `db:"stripe_customer_id" json:"stripeCustomerId,omitempty"`
	StripeSubscriptionID *string  `db:"stripe_subscription_id" json:"stripeSubscriptionId,omitempty"`
	IsArchived           bool     `db:"is_archived" json:"isArchived"`
	CreatedAt            string   `db:"created_at" json:"createdAt"`
	UpdatedAt            string   `db:"updated_at" json:"updatedAt"`
}

type TeamInvite struct {
	InvitationCode string `db:"invitation_code" json:"invitationCode"`
	WorkspaceID    string `db:"workspace_id" json:"workspaceId"`
	Email          string `db:"email" json:"email"`
	Role           string `db:"role" json:"role"`
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

type workspaceInvitation struct {
	InvitationCode string `db:"invitation_code"`
	WorkspaceID    string `db:"workspace_id"`
	Email          string `db:"email"`
	Role           string `db:"role"`
	Status         string `db:"status"`
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

type InvitationForLogin struct {
	InvitationCode string `json:"invitationCode"`
	Email          string `json:"email"`
	TeamName       string `json:"teamName"`
	Status         string `json:"status"`
}

type WaitlistSignup struct {
	ID            string `db:"id" json:"id"`
	Name          string `db:"name" json:"name"`
	Email         string `db:"email" json:"email"`
	Source        string `db:"source" json:"source"`
	RequestedPlan string `db:"requested_plan" json:"requestedPlan"`
	CreatedAt     string `db:"created_at" json:"createdAt"`
	UpdatedAt     string `db:"updated_at" json:"updatedAt"`
}

const (
	TeamRoleOwner  = "owner"
	TeamRoleAdmin  = "admin"
	TeamRoleEditor = "editor"
	TeamRoleReader = "reader"
	defaultBoardID = "default"
	teamBoardID    = "board-team"
	PlanPersonal   = "personal"
	PlanProTrial   = "pro_trial"
	PlanPro        = "pro"
	PlanEnterprise = "enterprise"
)

type Service struct {
	db      *sqlx.DB
	queries map[string]string
}

func NewService(db *sqlx.DB, queries map[string]string) *Service {
	svc := &Service{
		db:      db,
		queries: queries,
	}
	_ = svc.EnsureDefaults(context.Background())
	return svc
}

func (s *Service) EnsureDefaults(ctx context.Context) error {
	now := nowRFC3339()
	if _, err := s.exec(ctx, "account_workspace_default_upsert.sql", sessionctx.DefaultWorkspaceID, "Default Workspace", now, now); err != nil {
		return err
	}

	if _, err := s.exec(ctx, "account_user_default_upsert.sql", sessionctx.DefaultUserID, "owner@example.com", "Owner", sessionctx.DefaultWorkspaceID, now, now); err != nil {
		return err
	}

	if _, err := s.exec(ctx, "account_workspace_user_owner_upsert.sql", sessionctx.DefaultWorkspaceID, sessionctx.DefaultUserID, "owner@example.com", "Owner", now); err != nil {
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
		if _, err := s.exec(ctx, "auth_user_insert.sql", user.ID, user.Email, user.Name, now, now); err != nil {
			return Session{}, err
		}
	} else if strings.TrimSpace(preferredName) != "" && user.Name != name {
		if _, err := s.exec(ctx, "auth_user_update_name.sql", name, now, user.ID); err != nil {
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

func (s *Service) JoinWaitlist(ctx context.Context, name string, email string, source string, requestedPlan string) (WaitlistSignup, bool, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return WaitlistSignup{}, false, fmt.Errorf("name is required")
	}

	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") {
		return WaitlistSignup{}, false, fmt.Errorf("a valid email is required")
	}

	existing, err := s.waitlistSignupByEmail(ctx, email)
	if err == nil {
		return existing, true, nil
	}
	if err != sql.ErrNoRows {
		return WaitlistSignup{}, false, err
	}

	now := nowRFC3339()
	signup := WaitlistSignup{
		ID:            "W_" + uuid.NewString(),
		Name:          name,
		Email:         email,
		Source:        strings.TrimSpace(source),
		RequestedPlan: normalizeWaitlistPlan(requestedPlan),
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if _, err := s.exec(
		ctx,
		"account_waitlist_signup_insert.sql",
		signup.ID,
		signup.Name,
		signup.Email,
		signup.Source,
		signup.RequestedPlan,
		signup.CreatedAt,
		signup.UpdatedAt,
	); err != nil {
		return WaitlistSignup{}, false, err
	}

	return signup, false, nil
}

func (s *Service) CompleteOnboarding(ctx context.Context, userID string, personalBoardName string, teamBoardName string, displayName string, inviteEmails []string, plan string) (Session, []TeamInvite, error) {
	trimmedPersonalBoardName := normalizeExplicitBoardName(personalBoardName)
	trimmedTeamBoardName := normalizeExplicitBoardName(teamBoardName)
	requestedPlan := normalizeWorkspacePlan(plan)

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Session{}, nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var user User
	if err := s.txGet(ctx, tx, &user, "account_user_get_by_id.sql", strings.TrimSpace(userID)); err != nil {
		if err == sql.ErrNoRows {
			return Session{}, nil, fmt.Errorf("user not found")
		}
		return Session{}, nil, err
	}

	now := nowRFC3339()
	displayName = strings.TrimSpace(displayName)
	if displayName != "" && displayName != user.Name {
		if _, err := s.txExec(ctx, tx, "auth_user_update_name.sql", displayName, now, user.ID); err != nil {
			return Session{}, nil, err
		}
		user.Name = displayName
		user.UpdatedAt = now
	}
	resolvedPersonalBoardName := resolvePersonalBoardName(trimmedPersonalBoardName, user.Name, user.Email)
	resolvedTeamBoardName := ""

	workspaceID := ""
	effectivePlan := requestedPlan
	hasExistingWorkspace := false
	if user.CurrentWorkspace != nil && strings.TrimSpace(*user.CurrentWorkspace) != "" {
		hasExistingWorkspace = true
		workspaceID = strings.TrimSpace(*user.CurrentWorkspace)
		existingWorkspace, err := s.workspaceByIDTx(ctx, tx, workspaceID)
		if err != nil {
			if err == sql.ErrNoRows {
				return Session{}, nil, fmt.Errorf("workspace not found")
			}
			return Session{}, nil, err
		}
		if effectivePlan == "" {
			effectivePlan = normalizeWorkspacePlan(existingWorkspace.Plan)
		}
	} else {
		workspaceID = "W_" + uuid.NewString()
		if effectivePlan == "" {
			effectivePlan = PlanPersonal
		}
	}
	if effectivePlan != PlanPersonal {
		resolvedTeamBoardName = resolveTeamBoardName(trimmedTeamBoardName, user.Name, user.Email)
	}
	resolvedWorkspaceName := resolveWorkspaceName(effectivePlan, resolvedPersonalBoardName, resolvedTeamBoardName)
	if hasExistingWorkspace {
		if requestedPlan == "" {
			if _, err := s.txExec(ctx, tx, "account_workspace_update_name.sql", resolvedWorkspaceName, now, workspaceID); err != nil {
				return Session{}, nil, err
			}
		} else {
			trialEndsAt := billingTrialEndsAt(now, effectivePlan)
			if _, err := s.txExec(ctx, tx, "account_workspace_update_name_plan.sql", resolvedWorkspaceName, effectivePlan, nullableString(trialEndsAt), now, workspaceID); err != nil {
				return Session{}, nil, err
			}
		}
	} else {
		trialEndsAt := billingTrialEndsAt(now, effectivePlan)
		if _, err := s.txExec(ctx, tx, "account_workspace_insert.sql", workspaceID, resolvedWorkspaceName, effectivePlan, nullableString(trialEndsAt), now, now); err != nil {
			return Session{}, nil, err
		}
	}

	if _, err := s.txExec(ctx, tx, "account_workspace_user_owner_upsert.sql", workspaceID, user.ID, user.Email, user.Name, now); err != nil {
		return Session{}, nil, err
	}

	normalizedInvites := inviteEmails
	if effectivePlan == PlanPersonal {
		normalizedInvites = nil
	}
	invites := make([]TeamInvite, 0, len(normalizedInvites))
	for _, email := range normalizeInviteEmails(normalizedInvites, user.Email) {
		code := uuid.NewString()
		if _, err := s.txExec(ctx, tx, "account_workspace_invitation_insert_pending.sql", code, workspaceID, email, TeamRoleEditor, now, now); err != nil {
			return Session{}, nil, err
		}
		invites = append(invites, TeamInvite{
			InvitationCode: code,
			WorkspaceID:    workspaceID,
			Email:          email,
			Role:           TeamRoleEditor,
			Status:         "pending",
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}

	if _, err := s.txExec(ctx, tx, "account_user_complete_onboarding_update.sql", workspaceID, now, user.ID); err != nil {
		return Session{}, nil, err
	}

	if err := s.ensureInboxProjectTx(ctx, tx, user.ID, workspaceID, now); err != nil {
		return Session{}, nil, err
	}
	if err := s.ensurePersonalBoardProjectTx(ctx, tx, user.ID, workspaceID, resolvedPersonalBoardName, now); err != nil {
		return Session{}, nil, err
	}
	if effectivePlan != PlanPersonal {
		if err := s.ensureTeamBoardProjectTx(ctx, tx, user.ID, workspaceID, resolvedTeamBoardName, now); err != nil {
			return Session{}, nil, err
		}
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

	role, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
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
	if err := s.selectRows(ctx, &members, "account_team_members_list.sql", workspaceID); err != nil {
		return TeamSettings{}, err
	}
	for i := range members {
		members[i].Role = normalizeTeamRole(members[i].Role)
	}

	invitations := []TeamInvite{}
	if err := s.selectRows(ctx, &invitations, "account_workspace_invitations_pending_list.sql", workspaceID); err != nil {
		return TeamSettings{}, err
	}
	for i := range invitations {
		invitations[i].Role = normalizeTeamRole(invitations[i].Role)
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

	role, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Team{}, fmt.Errorf("not a member of this team")
		}
		return Team{}, err
	}
	if !canManageTeam(role) {
		return Team{}, fmt.Errorf("only team owners or admins can update team settings")
	}
	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Team{}, fmt.Errorf("team not found")
		}
		return Team{}, err
	}
	if err := requireTeamEntitlement(team, sharedpricing.EntitlementTeamAdmin, "Team profile changes"); err != nil {
		return Team{}, err
	}

	now := nowRFC3339()
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Team{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := s.txExec(ctx, tx, "account_workspace_update_name.sql", teamName, now, workspaceID); err != nil {
		return Team{}, err
	}

	if err := s.ensureInboxProjectTx(ctx, tx, actorUserID, workspaceID, now); err != nil {
		return Team{}, err
	}
	if team.Plan == PlanPersonal {
		if err := s.ensurePersonalBoardProjectTx(ctx, tx, actorUserID, workspaceID, teamName, now); err != nil {
			return Team{}, err
		}
	} else {
		if err := s.ensureTeamBoardProjectTx(ctx, tx, actorUserID, workspaceID, teamName, now); err != nil {
			return Team{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return Team{}, err
	}

	return s.workspaceByID(ctx, workspaceID)
}

func (s *Service) InviteMember(ctx context.Context, actorUserID string, workspaceID string, rawEmail string, rawRole string) (TeamInvite, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	email := strings.ToLower(strings.TrimSpace(rawEmail))
	inviteRole := normalizeTeamRole(rawRole)
	if strings.TrimSpace(rawRole) == "" {
		inviteRole = TeamRoleEditor
	}
	if actorUserID == "" || workspaceID == "" {
		return TeamInvite{}, fmt.Errorf("team context is required")
	}
	if email == "" || !strings.Contains(email, "@") {
		return TeamInvite{}, fmt.Errorf("valid invite email is required")
	}
	if !isAssignableInviteRole(inviteRole) {
		return TeamInvite{}, fmt.Errorf("invite role must be one of admin, editor, reader")
	}

	role, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamInvite{}, fmt.Errorf("not a member of this team")
		}
		return TeamInvite{}, err
	}
	if !canManageTeam(role) {
		return TeamInvite{}, fmt.Errorf("only team owners or admins can invite members")
	}
	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamInvite{}, fmt.Errorf("team not found")
		}
		return TeamInvite{}, err
	}
	if err := requireTeamEntitlement(team, sharedpricing.EntitlementWorkspaceInvites, "Inviting members"); err != nil {
		return TeamInvite{}, err
	}

	var memberCount int
	if err := s.get(ctx, &memberCount, "account_workspace_member_count_by_email.sql", workspaceID, email); err != nil {
		return TeamInvite{}, err
	}
	if memberCount > 0 {
		return TeamInvite{}, fmt.Errorf("user is already a team member")
	}

	var existing TeamInvite
	if err := s.get(ctx, &existing, "account_workspace_invitation_pending_latest_by_email.sql", workspaceID, email); err == nil {
		existing.Role = normalizeTeamRole(existing.Role)
		if existing.Role == inviteRole {
			return existing, nil
		}
		now := nowRFC3339()
		if _, updateErr := s.exec(ctx, "account_workspace_invitation_update_role.sql", inviteRole, now, existing.InvitationCode); updateErr != nil {
			return TeamInvite{}, updateErr
		}
		existing.Role = inviteRole
		existing.UpdatedAt = now
		return existing, nil
	} else if err != sql.ErrNoRows {
		return TeamInvite{}, err
	}

	now := nowRFC3339()
	invite := TeamInvite{
		InvitationCode: uuid.NewString(),
		WorkspaceID:    workspaceID,
		Email:          email,
		Role:           inviteRole,
		Status:         "pending",
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	if _, err := s.exec(ctx, "account_workspace_invitation_insert_pending.sql", invite.InvitationCode, invite.WorkspaceID, invite.Email, invite.Role, invite.CreatedAt, invite.UpdatedAt); err != nil {
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
		return TeamMember{}, fmt.Errorf("role must be one of owner, admin, editor, reader")
	}

	actorRole, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamMember{}, fmt.Errorf("not a member of this team")
		}
		return TeamMember{}, err
	}
	if actorRole != TeamRoleOwner {
		return TeamMember{}, fmt.Errorf("only team owners can change roles")
	}
	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamMember{}, fmt.Errorf("team not found")
		}
		return TeamMember{}, err
	}
	if err := requireTeamEntitlement(team, sharedpricing.EntitlementTeamRoles, "Role changes"); err != nil {
		return TeamMember{}, err
	}

	targetMember, err := s.workspaceMemberByID(ctx, s.db, workspaceID, targetUserID)
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

	if _, err := s.exec(ctx, "account_workspace_user_update_role.sql", nextRole, workspaceID, targetUserID); err != nil {
		return TeamMember{}, err
	}

	return s.workspaceMemberByID(ctx, s.db, workspaceID, targetUserID)
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

	actorRole, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("not a member of this team")
		}
		return err
	}
	if actorRole != TeamRoleOwner {
		return fmt.Errorf("only team owners can remove members")
	}
	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("team not found")
		}
		return err
	}
	if err := requireTeamEntitlement(team, sharedpricing.EntitlementTeamRoles, "Member removal"); err != nil {
		return err
	}

	targetMember, err := s.workspaceMemberByID(ctx, s.db, workspaceID, targetUserID)
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

	result, err := s.txExec(ctx, tx, "account_workspace_user_delete.sql", workspaceID, targetUserID)
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

	if _, err := s.txExec(ctx, tx, "account_user_clear_workspace_if_current.sql", workspaceID, workspaceID, workspaceID, now, targetUserID); err != nil {
		return err
	}

	if _, err := s.txExec(ctx, tx, "account_board_memberships_delete_by_workspace_user.sql", workspaceID, targetUserID); err != nil {
		return err
	}

	if _, err := s.txExec(ctx, tx, "account_auth_sessions_revoke_by_user_workspace.sql", now, now, targetUserID, workspaceID); err != nil {
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

	role, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("not a member of this team")
		}
		return err
	}
	if !canManageTeam(role) {
		return fmt.Errorf("only team owners or admins can cancel invitations")
	}
	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("team not found")
		}
		return err
	}
	if err := requireTeamEntitlement(team, sharedpricing.EntitlementWorkspaceInvites, "Invitation cancellation"); err != nil {
		return err
	}

	result, err := s.exec(ctx, "account_workspace_invitation_delete_pending_by_code_workspace.sql", invitationCode, workspaceID)
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

func (s *Service) BeginProTrial(ctx context.Context, workspaceID string) (Team, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	if workspaceID == "" {
		return Team{}, fmt.Errorf("workspace id is required")
	}

	now := time.Now().UTC()
	nowRFC3339 := now.Format(time.RFC3339)
	trialEndsAt := now.Add(14 * 24 * time.Hour).Format(time.RFC3339)
	result, err := s.exec(ctx, "account_workspace_begin_pro_trial.sql", PlanProTrial, trialEndsAt, nowRFC3339, workspaceID)
	if err != nil {
		return Team{}, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return Team{}, err
	}
	if rows == 0 {
		return Team{}, fmt.Errorf("team not found")
	}
	return s.workspaceByID(ctx, workspaceID)
}

func (s *Service) ActivateProFromStripe(ctx context.Context, workspaceID string, customerID string, subscriptionID string, priceID string, billingEmail string) (Team, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	if workspaceID == "" {
		return Team{}, fmt.Errorf("workspace id is required")
	}

	now := nowRFC3339()
	result, err := s.exec(
		ctx,
		"account_workspace_activate_pro_from_stripe.sql",
		PlanPro,
		strings.TrimSpace(customerID),
		strings.TrimSpace(subscriptionID),
		strings.TrimSpace(priceID),
		strings.TrimSpace(billingEmail),
		strings.TrimSpace(billingEmail),
		now,
		workspaceID,
	)
	if err != nil {
		return Team{}, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return Team{}, err
	}
	if rows == 0 {
		return Team{}, fmt.Errorf("team not found")
	}
	return s.workspaceByID(ctx, workspaceID)
}

func (s *Service) DowngradePersonalByStripeSubscription(ctx context.Context, subscriptionID string) error {
	subscriptionID = strings.TrimSpace(subscriptionID)
	if subscriptionID == "" {
		return fmt.Errorf("subscription id is required")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	team, err := s.workspaceBySubscriptionIDTx(ctx, tx, subscriptionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("subscription not found")
		}
		return err
	}

	now := nowRFC3339()
	result, err := s.txExec(ctx, tx, "account_workspace_downgrade_by_subscription.sql", PlanPersonal, now, subscriptionID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("subscription not found")
	}

	if _, err := s.txExec(ctx, tx, "account_workspace_invitations_delete_pending_by_workspace.sql", team.ID); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Service) InvitationForLogin(ctx context.Context, invitationCode string) (InvitationForLogin, error) {
	invitationCode = strings.TrimSpace(invitationCode)
	if invitationCode == "" {
		return InvitationForLogin{}, fmt.Errorf("invitation code is required")
	}

	var row struct {
		InvitationCode string `db:"invitation_code"`
		Email          string `db:"email"`
		Status         string `db:"status"`
		TeamName       string `db:"team_name"`
	}
	if err := s.get(ctx, &row, "account_invitation_for_login_get.sql", invitationCode); err != nil {
		if err == sql.ErrNoRows {
			return InvitationForLogin{}, fmt.Errorf("invitation not found")
		}
		return InvitationForLogin{}, err
	}

	status := strings.ToLower(strings.TrimSpace(row.Status))
	if status != "pending" && status != "accepted" {
		return InvitationForLogin{}, fmt.Errorf("invitation is no longer valid")
	}

	return InvitationForLogin{
		InvitationCode: strings.TrimSpace(row.InvitationCode),
		Email:          strings.TrimSpace(row.Email),
		TeamName:       strings.TrimSpace(row.TeamName),
		Status:         status,
	}, nil
}

func (s *Service) AcceptInvitation(ctx context.Context, userID string, invitationCode string) (Session, error) {
	userID = strings.TrimSpace(userID)
	invitationCode = strings.TrimSpace(invitationCode)
	if userID == "" {
		return Session{}, fmt.Errorf("user is required")
	}
	if invitationCode == "" {
		return Session{}, fmt.Errorf("invitation code is required")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Session{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var user User
	if err := s.txGet(ctx, tx, &user, "account_user_get_by_id.sql", userID); err != nil {
		if err == sql.ErrNoRows {
			return Session{}, fmt.Errorf("user not found")
		}
		return Session{}, err
	}

	var inv workspaceInvitation
	if err := s.txGet(ctx, tx, &inv, "account_workspace_invitation_get_by_code.sql", invitationCode); err != nil {
		if err == sql.ErrNoRows {
			return Session{}, fmt.Errorf("invitation not found")
		}
		return Session{}, err
	}

	if !strings.EqualFold(strings.TrimSpace(inv.Email), strings.TrimSpace(user.Email)) {
		return Session{}, fmt.Errorf("invitation email does not match your account")
	}
	status := strings.ToLower(strings.TrimSpace(inv.Status))
	if status != "pending" && status != "accepted" {
		return Session{}, fmt.Errorf("invitation is no longer valid")
	}
	team, err := s.workspaceByIDTx(ctx, tx, inv.WorkspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Session{}, fmt.Errorf("team not found")
		}
		return Session{}, err
	}
	if status == "pending" && !hasTeamEntitlement(team, sharedpricing.EntitlementWorkspaceInvites) {
		return Session{}, fmt.Errorf("invitation is no longer valid")
	}
	inviteRole := normalizeTeamRole(inv.Role)
	if !isAssignableInviteRole(inviteRole) {
		inviteRole = TeamRoleEditor
	}

	now := nowRFC3339()
	if _, err := s.txExec(ctx, tx, "account_workspace_user_upsert_accept_invite.sql", inv.WorkspaceID, user.ID, user.Email, user.Name, inviteRole, now); err != nil {
		return Session{}, err
	}

	if status == "pending" {
		if _, err := s.txExec(ctx, tx, "account_workspace_invitation_mark_accepted.sql", now, inv.InvitationCode); err != nil {
			return Session{}, err
		}
	}

	if _, err := s.txExec(ctx, tx, "account_user_complete_onboarding_update.sql", inv.WorkspaceID, now, user.ID); err != nil {
		return Session{}, err
	}

	if err := s.ensureInboxProjectTx(ctx, tx, user.ID, inv.WorkspaceID, now); err != nil {
		return Session{}, err
	}
	if err := s.ensureWorkspaceTeamBoardAccessTx(ctx, tx, inv.WorkspaceID, user.ID, now); err != nil {
		return Session{}, err
	}
	if err := tx.Commit(); err != nil {
		return Session{}, err
	}
	return s.GetSession(ctx, user.ID)
}

func (s *Service) ensureDefaultProjects(ctx context.Context, userID string, workspaceID string, teamName string) error {
	now := nowRFC3339()
	boardName := defaultBoardProjectName(teamName)
	if _, err := s.exec(ctx, "account_project_upsert_by_id.sql", projectStorageID(workspaceID, "board"), boardName, 0, userID, workspaceID, now, now); err != nil {
		return err
	}
	if err := s.UpsertBoardMembership(ctx, workspaceID, defaultBoardID, userID); err != nil {
		return err
	}
	if _, err := s.exec(ctx, "account_project_upsert_by_id.sql", projectStorageID(workspaceID, "inbox"), "inbox", 1, userID, workspaceID, now, now); err != nil {
		return err
	}
	return nil
}

func (s *Service) ensureDefaultProjectsTx(ctx context.Context, tx *sqlx.Tx, userID string, workspaceID string, teamName string, now string) error {
	boardName := defaultBoardProjectName(teamName)
	if _, err := s.txExec(ctx, tx, "account_project_upsert_by_id.sql", projectStorageID(workspaceID, "board"), boardName, 0, userID, workspaceID, now, now); err != nil {
		return err
	}
	if err := s.upsertBoardMembershipTx(ctx, tx, workspaceID, defaultBoardID, userID, now); err != nil {
		return err
	}
	if _, err := s.txExec(ctx, tx, "account_project_upsert_by_id.sql", projectStorageID(workspaceID, "inbox"), "inbox", 1, userID, workspaceID, now, now); err != nil {
		return err
	}
	return nil
}

func (s *Service) ensureInboxProjectTx(ctx context.Context, tx *sqlx.Tx, userID string, workspaceID string, now string) error {
	_, err := s.txExec(ctx, tx, "account_project_upsert_by_id.sql", projectStorageID(workspaceID, "inbox"), "inbox", 1, userID, workspaceID, now, now)
	return err
}

func (s *Service) ensurePersonalBoardProjectTx(ctx context.Context, tx *sqlx.Tx, userID string, workspaceID string, boardName string, now string) error {
	if _, err := s.txExec(ctx, tx, "account_project_upsert_by_id.sql", projectStorageID(workspaceID, "board"), boardName, 0, userID, workspaceID, now, now); err != nil {
		return err
	}
	return s.upsertBoardMembershipTx(ctx, tx, workspaceID, defaultBoardID, userID, now)
}

func (s *Service) ensureTeamBoardProjectTx(ctx context.Context, tx *sqlx.Tx, userID string, workspaceID string, boardName string, now string) error {
	if _, err := s.txExec(ctx, tx, "account_project_upsert_by_id.sql", projectStorageID(workspaceID, teamBoardID), boardName, 0, userID, workspaceID, now, now); err != nil {
		return err
	}
	return s.upsertBoardMembershipsForWorkspaceTx(ctx, tx, workspaceID, teamBoardID, now)
}

func (s *Service) ensureWorkspaceTeamBoardAccessTx(ctx context.Context, tx *sqlx.Tx, workspaceID string, userID string, now string) error {
	projectIDs, err := s.teamBoardProjectIDsTx(ctx, tx, workspaceID)
	if err != nil {
		return err
	}
	for _, projectID := range projectIDs {
		boardID := normalizeBoardID(tenant.ProjectSlug(projectID))
		if err := s.upsertBoardMembershipTx(ctx, tx, workspaceID, boardID, userID, now); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) teamBoardProjectIDsTx(ctx context.Context, tx *sqlx.Tx, workspaceID string) ([]string, error) {
	rows := []string{}
	if err := s.txSelectRows(ctx, tx, &rows, "account_team_board_project_ids_list.sql", workspaceID); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *Service) upsertBoardMembershipTx(ctx context.Context, tx *sqlx.Tx, workspaceID string, boardID string, userID string, now string) error {
	workspaceID = strings.TrimSpace(workspaceID)
	userID = strings.TrimSpace(userID)
	boardID = normalizeBoardID(boardID)
	now = strings.TrimSpace(now)
	if now == "" {
		now = nowRFC3339()
	}
	if workspaceID == "" || userID == "" || boardID == "" {
		return fmt.Errorf("board membership context is required")
	}
	_, err := s.txExec(ctx, tx, "account_board_membership_upsert.sql", boardID, workspaceID, userID, now, now)
	return err
}

func (s *Service) upsertBoardMembershipsForWorkspaceTx(ctx context.Context, tx *sqlx.Tx, workspaceID string, boardID string, now string) error {
	workspaceID = strings.TrimSpace(workspaceID)
	boardID = normalizeBoardID(boardID)
	if now == "" {
		now = nowRFC3339()
	}
	if workspaceID == "" || boardID == "" {
		return fmt.Errorf("board membership context is required")
	}
	_, err := s.txExec(ctx, tx, "account_board_membership_upsert_from_workspace_users.sql", boardID, now, now, workspaceID)
	return err
}

func (s *Service) userByID(ctx context.Context, id string) (User, error) {
	var row User
	err := s.get(ctx, &row, "account_user_get_by_id.sql", id)
	return row, err
}

func (s *Service) userByEmail(ctx context.Context, email string) (User, error) {
	var row User
	err := s.get(ctx, &row, "auth_user_get_by_email.sql", email)
	return row, err
}

func (s *Service) GetWorkspace(ctx context.Context, id string) (Team, error) {
	return s.workspaceByID(ctx, id)
}

func (s *Service) UpsertBoardMembership(ctx context.Context, workspaceID string, boardID string, userID string) error {
	workspaceID = strings.TrimSpace(workspaceID)
	userID = strings.TrimSpace(userID)
	boardID = normalizeBoardID(boardID)
	if workspaceID == "" || userID == "" || boardID == "" {
		return fmt.Errorf("board membership context is required")
	}

	now := nowRFC3339()
	_, err := s.exec(ctx, "account_board_membership_upsert.sql", boardID, workspaceID, userID, now, now)
	return err
}

func (s *Service) UpsertBoardMembershipsForWorkspace(ctx context.Context, workspaceID string, boardID string) error {
	workspaceID = strings.TrimSpace(workspaceID)
	boardID = normalizeBoardID(boardID)
	if workspaceID == "" || boardID == "" {
		return fmt.Errorf("board membership context is required")
	}

	now := nowRFC3339()
	_, err := s.exec(ctx, "account_board_membership_upsert_from_workspace_users.sql", boardID, now, now, workspaceID)
	return err
}

func (s *Service) ListBoardMembers(ctx context.Context, actorUserID string, workspaceID string, boardID string) ([]TeamMember, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	boardID = normalizeBoardID(boardID)
	if actorUserID == "" || workspaceID == "" || boardID == "" {
		return nil, fmt.Errorf("board membership context is required")
	}

	if _, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("not a member of this team")
		}
		return nil, err
	}

	allowed, err := s.HasBoardAccess(ctx, actorUserID, workspaceID, boardID)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, fmt.Errorf("no access to this board")
	}

	members := []TeamMember{}
	if err := s.selectRows(ctx, &members, "account_board_members_list.sql", workspaceID, boardID); err != nil {
		return nil, err
	}
	for i := range members {
		members[i].Role = normalizeTeamRole(members[i].Role)
	}
	return members, nil
}

func (s *Service) AddBoardMember(ctx context.Context, actorUserID string, workspaceID string, boardID string, targetUserID string) (TeamMember, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	boardID = normalizeBoardID(boardID)
	targetUserID = strings.TrimSpace(targetUserID)
	if actorUserID == "" || workspaceID == "" || boardID == "" {
		return TeamMember{}, fmt.Errorf("board membership context is required")
	}
	if targetUserID == "" {
		return TeamMember{}, fmt.Errorf("target user is required")
	}

	actorRole, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamMember{}, fmt.Errorf("not a member of this team")
		}
		return TeamMember{}, err
	}
	if !canManageTeam(actorRole) {
		return TeamMember{}, fmt.Errorf("only team owners or admins can manage board members")
	}
	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamMember{}, fmt.Errorf("team not found")
		}
		return TeamMember{}, err
	}
	if err := requireTeamEntitlement(team, sharedpricing.EntitlementBoardMemberManagement, "Board member management"); err != nil {
		return TeamMember{}, err
	}

	allowed, err := s.HasBoardAccess(ctx, actorUserID, workspaceID, boardID)
	if err != nil {
		return TeamMember{}, err
	}
	if !allowed {
		return TeamMember{}, fmt.Errorf("no access to this board")
	}

	targetMember, err := s.workspaceMemberByID(ctx, s.db, workspaceID, targetUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TeamMember{}, fmt.Errorf("target member not found")
		}
		return TeamMember{}, err
	}

	if err := s.UpsertBoardMembership(ctx, workspaceID, boardID, targetUserID); err != nil {
		return TeamMember{}, err
	}
	return targetMember, nil
}

func (s *Service) RemoveBoardMember(ctx context.Context, actorUserID string, workspaceID string, boardID string, targetUserID string) error {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	boardID = normalizeBoardID(boardID)
	targetUserID = strings.TrimSpace(targetUserID)
	if actorUserID == "" || workspaceID == "" || boardID == "" {
		return fmt.Errorf("board membership context is required")
	}
	if targetUserID == "" {
		return fmt.Errorf("target user is required")
	}
	if targetUserID == actorUserID {
		return fmt.Errorf("cannot remove yourself from this board")
	}

	actorRole, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("not a member of this team")
		}
		return err
	}
	if !canManageTeam(actorRole) {
		return fmt.Errorf("only team owners or admins can manage board members")
	}
	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("team not found")
		}
		return err
	}
	if err := requireTeamEntitlement(team, sharedpricing.EntitlementBoardMemberManagement, "Board member management"); err != nil {
		return err
	}

	allowed, err := s.HasBoardAccess(ctx, actorUserID, workspaceID, boardID)
	if err != nil {
		return err
	}
	if !allowed {
		return fmt.Errorf("no access to this board")
	}

	if _, err := s.workspaceMemberByID(ctx, s.db, workspaceID, targetUserID); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("target member not found")
		}
		return err
	}

	result, err := s.exec(ctx, "account_board_membership_delete_one.sql", workspaceID, boardID, targetUserID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("board member not found")
	}
	return nil
}

func (s *Service) HasBoardAccess(ctx context.Context, userID string, workspaceID string, boardID string) (bool, error) {
	userID = strings.TrimSpace(userID)
	workspaceID = strings.TrimSpace(workspaceID)
	boardID = normalizeBoardID(boardID)
	if userID == "" || workspaceID == "" || boardID == "" {
		return false, fmt.Errorf("board access context is required")
	}

	var count int
	if err := s.get(ctx, &count, "account_board_access_count.sql", boardID, workspaceID, userID); err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Service) CanWriteBoard(ctx context.Context, userID string, workspaceID string, boardID string) (bool, error) {
	allowed, err := s.HasBoardAccess(ctx, userID, workspaceID, boardID)
	if err != nil || !allowed {
		return false, err
	}

	role, err := s.workspaceUserRole(ctx, s.db, strings.TrimSpace(workspaceID), strings.TrimSpace(userID))
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return canWriteTeamRole(role), nil
}

func (s *Service) CanWriteWorkspace(ctx context.Context, userID string, workspaceID string) (bool, error) {
	userID = strings.TrimSpace(userID)
	workspaceID = strings.TrimSpace(workspaceID)
	if userID == "" || workspaceID == "" {
		return false, fmt.Errorf("workspace access context is required")
	}

	role, err := s.workspaceUserRole(ctx, s.db, workspaceID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	return canWriteTeamRole(role), nil
}

func (s *Service) DeleteBoardMembershipsForBoard(ctx context.Context, workspaceID string, boardID string) error {
	workspaceID = strings.TrimSpace(workspaceID)
	boardID = normalizeBoardID(boardID)
	if workspaceID == "" || boardID == "" {
		return fmt.Errorf("board membership context is required")
	}
	_, err := s.exec(ctx, "account_board_memberships_delete_for_board.sql", workspaceID, boardID)
	return err
}

func (s *Service) workspaceByID(ctx context.Context, id string) (Team, error) {
	var row Team
	err := s.get(ctx, &row, "account_workspace_get_by_id.sql", id)
	applyWorkspacePricing(&row)
	return row, err
}

func (s *Service) workspaceByIDTx(ctx context.Context, tx *sqlx.Tx, id string) (Team, error) {
	var row Team
	err := s.txGet(ctx, tx, &row, "account_workspace_get_by_id.sql", id)
	applyWorkspacePricing(&row)
	return row, err
}

func (s *Service) workspaceBySubscriptionIDTx(ctx context.Context, tx *sqlx.Tx, subscriptionID string) (Team, error) {
	var row Team
	err := s.txGet(ctx, tx, &row, "account_workspace_get_by_subscription_id.sql", subscriptionID)
	applyWorkspacePricing(&row)
	return row, err
}

func normalizeWorkspacePlan(raw string) string {
	value := strings.ToLower(strings.TrimSpace(raw))
	switch value {
	case "free", PlanPersonal:
		return PlanPersonal
	case PlanProTrial:
		return PlanProTrial
	case PlanPro:
		return PlanPro
	case PlanEnterprise:
		return PlanEnterprise
	default:
		return ""
	}
}

func applyWorkspacePricing(team *Team) {
	if team == nil {
		return
	}
	profile := sharedpricing.LookupWorkspacePlan(team.Plan)
	team.Plan = profile.WorkspacePlan
	team.PlanFamily = profile.PlanFamily
	team.BillingState = profile.BillingState
	team.Entitlements = profile.Entitlements
}

func hasTeamEntitlement(team Team, entitlement string) bool {
	return sharedpricing.HasEntitlement(team.Entitlements, entitlement)
}

func requireTeamEntitlement(team Team, entitlement string, action string) error {
	if hasTeamEntitlement(team, entitlement) {
		return nil
	}
	return fmt.Errorf("%s", teamEntitlementError(team, action))
}

func teamEntitlementError(team Team, action string) string {
	label := sharedpricing.LookupWorkspacePlan(team.Plan).DisplayLabel
	if label == "" {
		label = "current plan"
	}
	if label == "Free" {
		return fmt.Sprintf("%s is unavailable on Free. Upgrade this workspace to Pro to continue.", action)
	}
	return fmt.Sprintf("%s is unavailable on the current plan.", action)
}

func nullableString(raw string) any {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	return value
}

func billingTrialEndsAt(nowRFC3339 string, plan string) string {
	if normalizeWorkspacePlan(plan) != PlanProTrial {
		return ""
	}
	parsed, err := time.Parse(time.RFC3339Nano, nowRFC3339)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, nowRFC3339)
		if err != nil {
			parsed = time.Now().UTC()
		}
	}
	return parsed.Add(14 * 24 * time.Hour).UTC().Format(time.RFC3339)
}

func (s *Service) workspaceUserRole(ctx context.Context, db sqlx.QueryerContext, workspaceID string, userID string) (string, error) {
	var role string
	err := s.getQueryer(ctx, db, &role, "account_workspace_user_role.sql", workspaceID, userID)
	if err != nil {
		return "", err
	}
	return normalizeTeamRole(role), nil
}

func (s *Service) workspaceMemberByID(ctx context.Context, db sqlx.QueryerContext, workspaceID string, userID string) (TeamMember, error) {
	var member TeamMember
	err := s.getQueryer(ctx, db, &member, "account_workspace_member_get_by_id.sql", workspaceID, userID)
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
	case TeamRoleEditor:
		return TeamRoleEditor
	case TeamRoleReader:
		return TeamRoleReader
	default:
		return TeamRoleReader
	}
}

func isSupportedTeamRole(role string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case TeamRoleOwner, TeamRoleAdmin, TeamRoleEditor, TeamRoleReader:
		return true
	default:
		return false
	}
}

func canManageTeam(role string) bool {
	role = normalizeTeamRole(role)
	return role == TeamRoleOwner || role == TeamRoleAdmin
}

func canWriteTeamRole(role string) bool {
	return normalizeTeamRole(role) != TeamRoleReader
}

func isAssignableInviteRole(role string) bool {
	role = normalizeTeamRole(role)
	return role == TeamRoleAdmin || role == TeamRoleEditor || role == TeamRoleReader
}

func defaultBoardProjectName(teamName string) string {
	teamName = strings.TrimSpace(teamName)
	if teamName == "" {
		return "Personal board"
	}
	return teamName
}

func resolvePersonalBoardName(boardName string, userName string, userEmail string) string {
	boardName = strings.TrimSpace(boardName)
	if boardName != "" {
		return boardName
	}
	base := personalBoardBaseName(userName, userEmail)
	return generatedBoardName(base, "board")
}

func resolveTeamBoardName(boardName string, userName string, userEmail string) string {
	boardName = strings.TrimSpace(boardName)
	if boardName != "" {
		return boardName
	}
	base := personalBoardBaseName(userName, userEmail)
	return generatedBoardName(base, "team board")
}

func resolveWorkspaceName(plan string, personalBoardName string, teamBoardName string) string {
	if normalizeWorkspacePlan(plan) == PlanPersonal {
		return resolvePersonalBoardName(personalBoardName, "", "")
	}
	if strings.TrimSpace(teamBoardName) != "" {
		return strings.TrimSpace(teamBoardName)
	}
	if strings.TrimSpace(personalBoardName) != "" {
		return strings.TrimSpace(personalBoardName)
	}
	return "Team board"
}

func normalizeExplicitBoardName(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var b strings.Builder
	lastDash := false
	for _, ch := range trimmed {
		switch {
		case ch >= 'a' && ch <= 'z':
			b.WriteRune(ch)
			lastDash = false
		case ch >= 'A' && ch <= 'Z':
			b.WriteRune(ch)
			lastDash = false
		case ch >= '0' && ch <= '9':
			b.WriteRune(ch)
			lastDash = false
		case ch == '-' || ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r':
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}

	return strings.Trim(b.String(), "-")
}

func generatedBoardName(base string, suffix string) string {
	base = strings.TrimSpace(base)
	suffix = strings.TrimSpace(suffix)
	switch {
	case base == "" && suffix == "":
		return ""
	case base == "":
		return normalizeGeneratedBoardName(suffix)
	case suffix == "":
		return normalizeGeneratedBoardName(base)
	default:
		return normalizeGeneratedBoardName(base + " " + suffix)
	}
}

func normalizeGeneratedBoardName(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var b strings.Builder
	lastDash := false
	for _, ch := range trimmed {
		switch {
		case ch >= 'a' && ch <= 'z':
			b.WriteRune(ch)
			lastDash = false
		case ch >= 'A' && ch <= 'Z':
			b.WriteRune(ch)
			lastDash = false
		case ch >= '0' && ch <= '9':
			b.WriteRune(ch)
			lastDash = false
		default:
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}

	return strings.Trim(b.String(), "-")
}

func personalBoardBaseName(userName string, userEmail string) string {
	displayName := strings.TrimSpace(userName)
	if displayName != "" {
		return displayName
	}
	fromEmail := strings.TrimSpace(defaultNameFromEmail(userEmail))
	if fromEmail != "" {
		return fromEmail
	}
	return "Personal"
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

func normalizeWaitlistPlan(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case PlanPersonal:
		return PlanPersonal
	case PlanProTrial, PlanPro:
		return PlanProTrial
	case PlanEnterprise:
		return PlanEnterprise
	default:
		return ""
	}
}

func (s *Service) waitlistSignupByEmail(ctx context.Context, email string) (WaitlistSignup, error) {
	var signup WaitlistSignup
	err := s.get(ctx, &signup, "account_waitlist_signup_get_by_email.sql", strings.ToLower(strings.TrimSpace(email)))
	return signup, err
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

func normalizeBoardID(raw string) string {
	boardID := strings.ToLower(strings.TrimSpace(raw))
	if boardID == "" || strings.EqualFold(boardID, "board") || strings.EqualFold(boardID, defaultBoardID) {
		return defaultBoardID
	}
	return boardID
}
