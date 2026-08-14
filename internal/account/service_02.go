package account

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/jmoiron/sqlx"

	"donegeon/internal/tenant"
	sharedpricing "donegeon/web/shared/pricing"
)

func (s *Service) EndProTrial(ctx context.Context, actorUserID string, workspaceID string) (Team, error) {
	team, err := s.BillingWorkspace(ctx, actorUserID, workspaceID)
	if err != nil {
		return Team{}, err
	}
	if team.BillingState != "trial" {
		return Team{}, fmt.Errorf("workspace is not on an active Pro trial")
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Team{}, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	now := nowRFC3339()
	result, err := s.txExec(ctx, tx, "account_workspace_downgrade_by_id.sql", PlanPersonal, now, strings.TrimSpace(workspaceID))
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

	if _, err := s.txExec(ctx, tx, "account_workspace_invitations_delete_pending_by_workspace.sql", team.ID); err != nil {
		return Team{}, err
	}

	if err := tx.Commit(); err != nil {
		return Team{}, err
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
