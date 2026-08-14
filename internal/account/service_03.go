package account

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"

	sharedpricing "donegeon/web/shared/pricing"
)

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
