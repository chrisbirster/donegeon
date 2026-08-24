package taskmanagercompat

import (
	"context"
	"database/sql"
	"strings"

	"github.com/google/uuid"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/project"
	"donegeon/internal/sessionctx"
)

func (s *Service) deleteLabel(ctx context.Context, payload map[string]any) (any, error) {
	labelID, ok := getString(payload, "labelId")
	if !ok || strings.TrimSpace(labelID) == "" {
		return nil, validationField("label id is required", "labelId")
	}
	labelID = strings.TrimSpace(labelID)
	if _, err := s.labelByID(ctx, labelID); err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "DELETE FROM task_labels WHERE label_id = ?", labelID); err != nil {
		return nil, err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	result, err := s.db.ExecContext(ctx, "DELETE FROM labels WHERE id = ? AND user_id = ? AND workspace_id = ?", labelID, principal.UserID, principal.WorkspaceID)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, notFoundField("label not found", "labelId")
	}
	return map[string]any{"deleted": true}, nil
}

func (s *Service) searchLabels(ctx context.Context, payload map[string]any) (any, error) {
	limit, cursor := limitCursor(payload)
	queryText := strings.ToLower(strings.TrimSpace(getStringOr(payload, "query")))
	principal := sessionctx.PrincipalFromContext(ctx)
	rows := []labelRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT id, name, color, created_at, updated_at FROM labels WHERE user_id = ? AND workspace_id = ? ORDER BY LOWER(name) ASC, created_at ASC, id ASC", principal.UserID, principal.WorkspaceID); err != nil {
		return nil, err
	}
	filtered := make([]labelRow, 0, len(rows))
	for _, row := range rows {
		if queryText == "" || strings.Contains(strings.ToLower(row.Name), queryText) {
			filtered = append(filtered, row)
		}
	}
	items, next, total := paginate(filtered, limit, cursor)
	return map[string]any{"items": items, "nextCursor": next, "total": total}, nil
}

func (s *Service) renameSharedLabel(ctx context.Context, payload map[string]any) (any, error) {
	current := strings.TrimSpace(getStringOr(payload, "name"))
	next := strings.TrimSpace(getStringOr(payload, "newName"))
	if current == "" {
		return nil, validationField("name is required", "name")
	}
	if next == "" {
		return nil, validationField("newName is required", "newName")
	}
	color := optionalString(payload, "color")

	row, err := s.labelByName(ctx, current)
	if err != nil {
		var appErr *apperrors.AppError
		if asAppError(err, &appErr) && appErr.Code == apperrors.CodeNotFound {
			id := "L_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
			now := nowRFC3339()
			principal := sessionctx.PrincipalFromContext(ctx)
			if _, insertErr := s.db.ExecContext(ctx, "INSERT INTO labels (id, name, color, created_at, updated_at, user_id, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)", id, next, stringOrNil(color), now, now, principal.UserID, principal.WorkspaceID); insertErr != nil {
				return nil, insertErr
			}
			return s.labelByID(ctx, id)
		}
		return nil, err
	}

	now := nowRFC3339()
	if _, err := s.db.ExecContext(ctx, "UPDATE labels SET name = ?, updated_at = ? WHERE id = ?", next, now, row.ID); err != nil {
		return nil, err
	}
	if _, ok := payload["color"]; ok {
		if _, err := s.db.ExecContext(ctx, "UPDATE labels SET color = ?, updated_at = ? WHERE id = ?", stringOrNil(color), nowRFC3339(), row.ID); err != nil {
			return nil, err
		}
	}
	return s.labelByID(ctx, row.ID)
}

func (s *Service) removeSharedLabel(ctx context.Context, payload map[string]any) (any, error) {
	name := strings.TrimSpace(getStringOr(payload, "name"))
	if name == "" {
		return nil, validationField("name is required", "name")
	}
	row, err := s.labelByName(ctx, name)
	if err != nil {
		var appErr *apperrors.AppError
		if asAppError(err, &appErr) && appErr.Code == apperrors.CodeNotFound {
			return map[string]any{"removed": true}, nil
		}
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "DELETE FROM task_labels WHERE label_id = ?", row.ID); err != nil {
		return nil, err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	if _, err := s.db.ExecContext(ctx, "DELETE FROM labels WHERE id = ? AND user_id = ? AND workspace_id = ?", row.ID, principal.UserID, principal.WorkspaceID); err != nil {
		return nil, err
	}
	return map[string]any{"removed": true}, nil
}

func (s *Service) addComment(ctx context.Context, payload map[string]any) (any, error) {
	content := strings.TrimSpace(getStringOr(payload, "content"))
	if content == "" {
		content = strings.TrimSpace(getStringOr(payload, "description"))
	}
	if content == "" {
		return nil, validationField("content is required", "content")
	}

	taskID := optionalString(payload, "taskId")
	projectID := optionalString(payload, "projectId")
	if taskID != nil {
		item, err := s.tasks.Get(ctx, *taskID)
		if err != nil {
			return nil, err
		}
		if projectID == nil && item.ProjectID != nil && strings.TrimSpace(*item.ProjectID) != "" {
			projectID = item.ProjectID
		}
	}

	now := nowRFC3339()
	id := "C_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	if _, err := s.db.ExecContext(ctx, "INSERT INTO comments (id, task_id, project_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", id, stringOrNil(taskID), stringOrNil(projectID), content, now, now); err != nil {
		return nil, err
	}
	return s.commentByID(ctx, id)
}

func (s *Service) getComment(ctx context.Context, payload map[string]any) (any, error) {
	commentID, ok := getString(payload, "commentId")
	if !ok || strings.TrimSpace(commentID) == "" {
		return nil, validationField("comment id is required", "commentId")
	}
	return s.commentByID(ctx, strings.TrimSpace(commentID))
}

func (s *Service) getComments(ctx context.Context, payload map[string]any) (any, error) {
	limit, cursor := limitCursor(payload)
	taskID := strings.TrimSpace(getStringOr(payload, "taskId"))
	if taskID != "" {
		if _, err := s.tasks.Get(ctx, taskID); err != nil {
			return nil, err
		}
	}
	rows := []commentRow{}
	query := "SELECT id, task_id, project_id, content, created_at, updated_at FROM comments"
	args := []any{}
	if taskID != "" {
		query += " WHERE task_id = ?"
		args = append(args, taskID)
	}
	query += " ORDER BY created_at ASC, id ASC"
	if err := s.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	items, next, total := paginate(rows, limit, cursor)
	return map[string]any{"items": items, "nextCursor": next, "total": total}, nil
}

func (s *Service) updateComment(ctx context.Context, payload map[string]any) (any, error) {
	commentID, ok := getString(payload, "commentId")
	if !ok || strings.TrimSpace(commentID) == "" {
		return nil, validationField("comment id is required", "commentId")
	}
	commentID = strings.TrimSpace(commentID)
	if _, err := s.commentByID(ctx, commentID); err != nil {
		return nil, err
	}
	content := strings.TrimSpace(getStringOr(payload, "content"))
	if content == "" {
		content = strings.TrimSpace(getStringOr(payload, "description"))
	}
	if content == "" {
		return nil, validationField("content is required", "content")
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE comments SET content = ?, updated_at = ? WHERE id = ?", content, nowRFC3339(), commentID); err != nil {
		return nil, err
	}
	return s.commentByID(ctx, commentID)
}

func (s *Service) deleteComment(ctx context.Context, payload map[string]any) (any, error) {
	commentID, ok := getString(payload, "commentId")
	if !ok || strings.TrimSpace(commentID) == "" {
		return nil, validationField("comment id is required", "commentId")
	}
	commentID = strings.TrimSpace(commentID)
	if _, err := s.commentByID(ctx, commentID); err != nil {
		return nil, err
	}
	result, err := s.db.ExecContext(ctx, "DELETE FROM comments WHERE id = ?", commentID)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, notFoundField("comment not found", "commentId")
	}
	return map[string]any{"deleted": true}, nil
}

func (s *Service) getWorkspaces(ctx context.Context) (any, error) {
	rows := []workspaceRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT id, name, plan, is_archived, created_at, updated_at FROM workspaces ORDER BY created_at ASC, id ASC"); err != nil {
		return nil, err
	}
	return map[string]any{"items": rows}, nil
}

func (s *Service) getWorkspaceUsers(ctx context.Context, payload map[string]any) (any, error) {
	workspaceID, ok := getString(payload, "workspaceId")
	if !ok || strings.TrimSpace(workspaceID) == "" {
		return nil, validationField("workspace id is required", "workspaceId")
	}
	workspaceID = strings.TrimSpace(workspaceID)
	if _, err := s.workspaceByID(ctx, workspaceID); err != nil {
		return nil, err
	}
	rows, err := s.workspaceUsersByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"items": rows}, nil
}

func (s *Service) getWorkspaceInvitations(ctx context.Context, payload map[string]any) (any, error) {
	workspaceID, ok := getString(payload, "workspaceId")
	if !ok || strings.TrimSpace(workspaceID) == "" {
		return nil, validationField("workspace id is required", "workspaceId")
	}
	workspaceID = strings.TrimSpace(workspaceID)
	if _, err := s.workspaceByID(ctx, workspaceID); err != nil {
		return nil, err
	}
	rows := []workspaceInvitationRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT invitation_code, workspace_id, email, status, created_at, updated_at FROM workspace_invitations WHERE workspace_id = ? ORDER BY created_at ASC", workspaceID); err != nil {
		return nil, err
	}
	return map[string]any{"items": rows}, nil
}

func (s *Service) getAllWorkspaceInvitations(ctx context.Context) (any, error) {
	rows := []workspaceInvitationRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT invitation_code, workspace_id, email, status, created_at, updated_at FROM workspace_invitations ORDER BY created_at ASC"); err != nil {
		return nil, err
	}
	return map[string]any{"items": rows}, nil
}

func (s *Service) joinWorkspace(ctx context.Context, payload map[string]any) (any, error) {
	workspaceID, ok := getString(payload, "workspaceId")
	if !ok || strings.TrimSpace(workspaceID) == "" {
		return nil, validationField("workspace id is required", "workspaceId")
	}
	workspaceID = strings.TrimSpace(workspaceID)
	if _, err := s.workspaceByID(ctx, workspaceID); err != nil {
		return nil, err
	}
	if err := s.upsertWorkspaceUser(ctx, workspaceID, defaultUser, "owner@example.com", "Owner", "member"); err != nil {
		return nil, err
	}
	return map[string]any{"workspaceId": workspaceID, "joined": true}, nil
}

func (s *Service) acceptWorkspaceInvitation(ctx context.Context, payload map[string]any) (any, error) {
	invCode, ok := getString(payload, "invitationCode")
	if !ok || strings.TrimSpace(invCode) == "" {
		return nil, validationField("invitation code is required", "invitationCode")
	}
	inv, err := s.workspaceInvitationByCode(ctx, strings.TrimSpace(invCode))
	if err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE workspace_invitations SET status = 'accepted', updated_at = ? WHERE invitation_code = ?", nowRFC3339(), inv.InvitationCode); err != nil {
		return nil, err
	}
	if err := s.upsertWorkspaceUser(ctx, inv.WorkspaceID, defaultUser, inv.Email, "Owner", "member"); err != nil {
		return nil, err
	}
	return s.workspaceInvitationByCode(ctx, inv.InvitationCode)
}

func (s *Service) rejectWorkspaceInvitation(ctx context.Context, payload map[string]any) (any, error) {
	invCode, ok := getString(payload, "invitationCode")
	if !ok || strings.TrimSpace(invCode) == "" {
		return nil, validationField("invitation code is required", "invitationCode")
	}
	inv, err := s.workspaceInvitationByCode(ctx, strings.TrimSpace(invCode))
	if err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE workspace_invitations SET status = 'rejected', updated_at = ? WHERE invitation_code = ?", nowRFC3339(), inv.InvitationCode); err != nil {
		return nil, err
	}
	return s.workspaceInvitationByCode(ctx, inv.InvitationCode)
}

func (s *Service) deleteWorkspaceInvitation(ctx context.Context, payload map[string]any) (any, error) {
	invCode := strings.TrimSpace(getStringOr(payload, "invitationCode"))
	workspaceID := strings.TrimSpace(getStringOr(payload, "workspaceId"))
	var result sql.Result
	var err error
	if workspaceID != "" {
		if _, lookupErr := s.workspaceByID(ctx, workspaceID); lookupErr != nil {
			return nil, lookupErr
		}
		if invCode != "" {
			result, err = s.db.ExecContext(ctx, "DELETE FROM workspace_invitations WHERE workspace_id = ? AND invitation_code = ?", workspaceID, invCode)
		} else {
			result, err = s.db.ExecContext(ctx, "DELETE FROM workspace_invitations WHERE workspace_id = ?", workspaceID)
		}
	} else if invCode != "" {
		result, err = s.db.ExecContext(ctx, "DELETE FROM workspace_invitations WHERE invitation_code = ?", invCode)
	} else {
		return nil, validationField("invitation code is required", "invitationCode")
	}
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		field := "invitationCode"
		if invCode == "" {
			field = "workspaceId"
		}
		return nil, notFoundField("workspace invitation not found", field)
	}
	return map[string]any{"deleted": true}, nil
}

func (s *Service) getWorkspacePlanDetails(ctx context.Context, payload map[string]any) (any, error) {
	workspaceID, ok := getString(payload, "workspaceId")
	if !ok || strings.TrimSpace(workspaceID) == "" {
		return nil, validationField("workspace id is required", "workspaceId")
	}
	workspace, err := s.workspaceByID(ctx, strings.TrimSpace(workspaceID))
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"workspaceId": workspace.ID,
		"plan":        workspace.Plan,
		"name":        workspace.Name,
	}, nil
}

func (s *Service) getUser() (any, error) {
	return map[string]any{
		"id":    defaultUser,
		"name":  "Owner",
		"email": "owner@example.com",
	}, nil
}

func (s *Service) getProductivityStats(ctx context.Context) (any, error) {
	principal := sessionctx.PrincipalFromContext(ctx)
	var open int
	if err := s.db.GetContext(ctx, &open, "SELECT COUNT(*) FROM tasks WHERE is_deleted = 0 AND checked = 0 AND user_id = ? AND workspace_id = ?", principal.UserID, principal.WorkspaceID); err != nil {
		return nil, err
	}
	var completed int
	if err := s.db.GetContext(ctx, &completed, "SELECT COUNT(*) FROM tasks WHERE is_deleted = 0 AND checked = 1 AND user_id = ? AND workspace_id = ?", principal.UserID, principal.WorkspaceID); err != nil {
		return nil, err
	}
	return map[string]any{
		"openTasks":      open,
		"completedTasks": completed,
		"totalTasks":     open + completed,
	}, nil
}

func (s *Service) projectByID(ctx context.Context, id string) (project.Project, error) {
	principal := sessionctx.PrincipalFromContext(ctx)
	canonicalID := canonicalProjectIDForContext(ctx, id)
	query := `
SELECT
    p.id,
    p.name,
    p.is_inbox_project,
    p.is_archived,
    p.is_favorite,
    p.workspace_id,
    p.created_at,
    p.updated_at,
    COALESCE(tc.open_task_count, 0) AS open_task_count
FROM projects p
LEFT JOIN (
    SELECT project_id, COUNT(*) AS open_task_count
    FROM tasks
    WHERE is_deleted = 0 AND checked = 0 AND project_id IS NOT NULL AND project_id <> ''
    GROUP BY project_id
) tc ON tc.project_id = p.id
WHERE p.id = ? AND p.user_id = ? AND p.workspace_id = ?
LIMIT 1
`
	var row project.Project
	if err := s.db.GetContext(ctx, &row, query, canonicalID, principal.UserID, principal.WorkspaceID); err != nil {
		if err == sql.ErrNoRows {
			return project.Project{}, notFoundField("project not found", "projectId")
		}
		return project.Project{}, err
	}
	return row, nil
}
