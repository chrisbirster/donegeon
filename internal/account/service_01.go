package account

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	sharedpricing "donegeon/web/shared/pricing"
)

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

	team, err := s.workspaceByID(ctx, workspaceID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Team{}, fmt.Errorf("team not found")
		}
		return Team{}, err
	}
	switch team.BillingState {
	case "trial":
		return team, nil
	case "paid":
		return Team{}, fmt.Errorf("workspace is already on paid Pro")
	case "sales":
		return Team{}, fmt.Errorf("workspace is already on Enterprise")
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
