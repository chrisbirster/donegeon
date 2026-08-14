package account

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"donegeon/internal/sessionctx"
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

func (s *Service) BillingWorkspace(ctx context.Context, actorUserID string, workspaceID string) (Team, error) {
	actorUserID = strings.TrimSpace(actorUserID)
	workspaceID = strings.TrimSpace(workspaceID)
	if actorUserID == "" || workspaceID == "" {
		return Team{}, fmt.Errorf("team context is required")
	}

	role, err := s.workspaceUserRole(ctx, s.db, workspaceID, actorUserID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Team{}, fmt.Errorf("not a member of this team")
		}
		return Team{}, err
	}
	if !canManageTeam(role) {
		return Team{}, fmt.Errorf("only team owners or admins can manage billing")
	}

	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Team{}, fmt.Errorf("team not found")
		}
		return Team{}, err
	}
	return team, nil
}

func (s *Service) WorkspaceSeatCount(ctx context.Context, workspaceID string) (int, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	if workspaceID == "" {
		return 0, fmt.Errorf("workspace id is required")
	}

	var count int
	if err := s.get(ctx, &count, "account_workspace_user_count.sql", workspaceID); err != nil {
		return 0, err
	}
	if count < 1 {
		count = 1
	}
	return count, nil
}
