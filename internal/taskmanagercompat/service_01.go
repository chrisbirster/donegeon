package taskmanagercompat

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"donegeon/internal/project"
	"donegeon/internal/sessionctx"
	"donegeon/internal/tenant"
)

func (s *Service) addProject(ctx context.Context, payload map[string]any) (any, error) {
	name := strings.TrimSpace(getStringOr(payload, "name"))
	if name == "" {
		return nil, validationField("project name is required", "name")
	}

	id := "P_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	input := project.UpsertInput{Name: &name}
	if _, exists := payload["isFavorite"]; exists {
		favorite, ok := optionalBool(payload, "isFavorite")
		if !ok {
			return nil, validationField("isFavorite must be a boolean", "isFavorite")
		}
		input.IsFavorite = favorite
	}
	return s.projects.Upsert(ctx, id, input)
}

func (s *Service) getProject(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	return s.projectByID(ctx, strings.TrimSpace(projectID))
}

func (s *Service) getProjects(ctx context.Context, payload map[string]any, archivedOnly bool) (any, error) {
	all, err := s.projects.List(ctx, project.ListParams{IncludeArchived: true})
	if err != nil {
		return nil, err
	}
	filtered := make([]project.Project, 0, len(all))
	for _, item := range all {
		if archivedOnly {
			if item.IsArchived {
				filtered = append(filtered, item)
			}
			continue
		}
		if !item.IsArchived {
			filtered = append(filtered, item)
		}
	}
	limit, cursor := limitCursor(payload)
	items, next, total := paginate(filtered, limit, cursor)
	return map[string]any{
		"items":      items,
		"nextCursor": next,
		"total":      total,
	}, nil
}

func (s *Service) updateProject(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectItem, err := s.projectByID(ctx, strings.TrimSpace(projectID))
	if err != nil {
		return nil, err
	}

	input := project.UpsertInput{}
	if _, exists := payload["name"]; exists {
		name := strings.TrimSpace(getStringOr(payload, "name"))
		if name == "" {
			return nil, validationField("project name is required", "name")
		}
		input.Name = &name
	}
	if _, exists := payload["isFavorite"]; exists {
		favorite, ok := optionalBool(payload, "isFavorite")
		if !ok {
			return nil, validationField("isFavorite must be a boolean", "isFavorite")
		}
		input.IsFavorite = favorite
	}
	if input.Name == nil && input.IsFavorite == nil {
		return projectItem, nil
	}
	return s.projects.Upsert(ctx, projectItem.ID, input)
}

func (s *Service) deleteProject(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectItem, err := s.projectByID(ctx, strings.TrimSpace(projectID))
	if err != nil {
		return nil, err
	}
	if err := validateProjectDestructiveAction(projectItem); err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, "UPDATE tasks SET section_id = NULL WHERE section_id IN (SELECT id FROM sections WHERE project_id = ?)", projectItem.ID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE tasks SET project_id = NULL, section_id = NULL WHERE project_id = ?", projectItem.ID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE comments SET project_id = NULL WHERE project_id = ?", projectItem.ID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM sections WHERE project_id = ?", projectItem.ID); err != nil {
		return nil, err
	}
	result, err := tx.ExecContext(ctx, "DELETE FROM projects WHERE id = ?", projectItem.ID)
	if err != nil {
		return nil, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, notFoundField("project not found", "projectId")
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return map[string]any{"deleted": true}, nil
}

func (s *Service) setProjectArchived(ctx context.Context, payload map[string]any, archived bool) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectItem, err := s.projectByID(ctx, strings.TrimSpace(projectID))
	if err != nil {
		return nil, err
	}
	if err := validateProjectDestructiveAction(projectItem); err != nil {
		return nil, err
	}

	now := nowRFC3339()
	if _, err := s.db.ExecContext(ctx, "UPDATE projects SET is_archived = ?, updated_at = ? WHERE id = ?", boolInt(archived), now, projectItem.ID); err != nil {
		return nil, err
	}
	return s.projectByID(ctx, projectItem.ID)
}

func validateProjectDestructiveAction(item project.Project) error {
	slug := strings.ToLower(strings.TrimSpace(tenant.ProjectSlug(item.ID)))
	if item.IsInboxProject || slug == "inbox" {
		return validationField("inbox project cannot be archived or deleted", "projectId")
	}
	if slug == "board" {
		return validationField("default board cannot be archived or deleted", "projectId")
	}
	return nil
}

func (s *Service) searchProjects(ctx context.Context, payload map[string]any) (any, error) {
	query := strings.ToLower(strings.TrimSpace(getStringOr(payload, "query")))
	all, err := s.projects.List(ctx, project.ListParams{IncludeArchived: true})
	if err != nil {
		return nil, err
	}
	filtered := make([]project.Project, 0, len(all))
	for _, item := range all {
		if query == "" || strings.Contains(strings.ToLower(item.Name), query) {
			filtered = append(filtered, item)
		}
	}
	limit, cursor := limitCursor(payload)
	items, next, total := paginate(filtered, limit, cursor)
	return map[string]any{
		"items":      items,
		"nextCursor": next,
		"total":      total,
	}, nil
}

func (s *Service) moveProjectToWorkspace(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	workspaceID, ok := getString(payload, "workspaceId")
	if !ok || strings.TrimSpace(workspaceID) == "" {
		return nil, validationField("workspace id is required", "workspaceId")
	}
	projectID = strings.TrimSpace(projectID)
	workspaceID = strings.TrimSpace(workspaceID)

	projectItem, err := s.projectByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if _, err := s.workspaceByID(ctx, workspaceID); err != nil {
		return nil, err
	}

	if _, err := s.db.ExecContext(ctx, "UPDATE projects SET workspace_id = ?, updated_at = ? WHERE id = ?", workspaceID, nowRFC3339(), projectItem.ID); err != nil {
		return nil, err
	}
	return s.projectByID(ctx, projectItem.ID)
}

func (s *Service) moveProjectToPersonal(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectItem, err := s.projectByID(ctx, strings.TrimSpace(projectID))
	if err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE projects SET workspace_id = NULL, updated_at = ? WHERE id = ?", nowRFC3339(), projectItem.ID); err != nil {
		return nil, err
	}
	return s.projectByID(ctx, projectItem.ID)
}

func (s *Service) getWorkspaceProjects(ctx context.Context, payload map[string]any, archived bool) (any, error) {
	workspaceID, ok := getString(payload, "workspaceId")
	if !ok || strings.TrimSpace(workspaceID) == "" {
		return nil, validationField("workspace id is required", "workspaceId")
	}
	workspaceID = strings.TrimSpace(workspaceID)
	if _, err := s.workspaceByID(ctx, workspaceID); err != nil {
		return nil, err
	}

	principal := sessionctx.PrincipalFromContext(ctx)
	rows := []project.Project{}
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
    WHERE is_deleted = 0 AND checked = 0 AND user_id = ? AND workspace_id = ? AND project_id IS NOT NULL AND project_id <> ''
    GROUP BY project_id
) tc ON tc.project_id = p.id
WHERE p.workspace_id = ? AND p.user_id = ? AND p.is_archived = ?
ORDER BY LOWER(p.name) ASC, p.created_at ASC
`
	if err := s.db.SelectContext(ctx, &rows, query, principal.UserID, principal.WorkspaceID, workspaceID, principal.UserID, boolInt(archived)); err != nil {
		return nil, err
	}
	return map[string]any{"items": rows}, nil
}

func (s *Service) getProjectCollaborators(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectItem, err := s.projectByID(ctx, strings.TrimSpace(projectID))
	if err != nil {
		return nil, err
	}
	if projectItem.WorkspaceID == nil || strings.TrimSpace(*projectItem.WorkspaceID) == "" {
		return map[string]any{"items": []workspaceUserRow{}}, nil
	}
	rows, err := s.workspaceUsersByWorkspaceID(ctx, strings.TrimSpace(*projectItem.WorkspaceID))
	if err != nil {
		return nil, err
	}
	return map[string]any{"items": rows}, nil
}

func (s *Service) addSection(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectItem, err := s.projectByID(ctx, strings.TrimSpace(projectID))
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(getStringOr(payload, "name"))
	if name == "" {
		return nil, validationField("section name is required", "name")
	}

	now := nowRFC3339()
	id := "S_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	if _, err := s.db.ExecContext(ctx, "INSERT INTO sections (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", id, projectItem.ID, name, now, now); err != nil {
		return nil, err
	}
	return s.sectionByID(ctx, id)
}

func (s *Service) getSection(ctx context.Context, payload map[string]any) (any, error) {
	sectionID, ok := getString(payload, "sectionId")
	if !ok || strings.TrimSpace(sectionID) == "" {
		return nil, validationField("section id is required", "sectionId")
	}
	return s.sectionByID(ctx, strings.TrimSpace(sectionID))
}

func (s *Service) getSections(ctx context.Context, payload map[string]any) (any, error) {
	limit, cursor := limitCursor(payload)
	projectID := strings.TrimSpace(getStringOr(payload, "projectId"))
	principal := sessionctx.PrincipalFromContext(ctx)

	rows := []sectionRow{}
	query := `
SELECT s.id, s.project_id, s.name, s.created_at, s.updated_at
FROM sections s
JOIN projects p ON p.id = s.project_id
WHERE p.user_id = ? AND p.workspace_id = ?
`
	args := []any{principal.UserID, principal.WorkspaceID}
	if projectID != "" {
		projectItem, err := s.projectByID(ctx, projectID)
		if err != nil {
			return nil, err
		}
		query += " AND s.project_id = ?"
		args = append(args, projectItem.ID)
	}
	query += " ORDER BY s.created_at ASC, s.id ASC"
	if err := s.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}

	items, next, total := paginate(rows, limit, cursor)
	return map[string]any{
		"items":      items,
		"nextCursor": next,
		"total":      total,
	}, nil
}

func (s *Service) updateSection(ctx context.Context, payload map[string]any) (any, error) {
	sectionID, ok := getString(payload, "sectionId")
	if !ok || strings.TrimSpace(sectionID) == "" {
		return nil, validationField("section id is required", "sectionId")
	}
	sectionID = strings.TrimSpace(sectionID)
	if _, err := s.sectionByID(ctx, sectionID); err != nil {
		return nil, err
	}
	if _, exists := payload["name"]; exists {
		name := strings.TrimSpace(getStringOr(payload, "name"))
		if name == "" {
			return nil, validationField("section name is required", "name")
		}
		if _, err := s.db.ExecContext(ctx, "UPDATE sections SET name = ?, updated_at = ? WHERE id = ?", name, nowRFC3339(), sectionID); err != nil {
			return nil, err
		}
	}
	return s.sectionByID(ctx, sectionID)
}

func (s *Service) deleteSection(ctx context.Context, payload map[string]any) (any, error) {
	sectionID, ok := getString(payload, "sectionId")
	if !ok || strings.TrimSpace(sectionID) == "" {
		return nil, validationField("section id is required", "sectionId")
	}
	sectionID = strings.TrimSpace(sectionID)
	if _, err := s.sectionByID(ctx, sectionID); err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, "UPDATE tasks SET section_id = NULL WHERE section_id = ?", sectionID); err != nil {
		return nil, err
	}
	result, err := tx.ExecContext(ctx, "DELETE FROM sections WHERE id = ?", sectionID)
	if err != nil {
		return nil, err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return nil, notFoundField("section not found", "sectionId")
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return map[string]any{"deleted": true}, nil
}

func (s *Service) searchSections(ctx context.Context, payload map[string]any) (any, error) {
	limit, cursor := limitCursor(payload)
	queryText := strings.ToLower(strings.TrimSpace(getStringOr(payload, "query")))
	all, err := s.getSections(ctx, map[string]any{"limit": maxLimit, "cursor": 0})
	if err != nil {
		return nil, err
	}
	itemsAny, _ := all.(map[string]any)["items"]
	items, _ := itemsAny.([]sectionRow)
	filtered := make([]sectionRow, 0, len(items))
	for _, item := range items {
		if queryText == "" || strings.Contains(strings.ToLower(item.Name), queryText) {
			filtered = append(filtered, item)
		}
	}
	page, next, total := paginate(filtered, limit, cursor)
	return map[string]any{"items": page, "nextCursor": next, "total": total}, nil
}

func (s *Service) addLabel(ctx context.Context, payload map[string]any) (any, error) {
	name := strings.TrimSpace(getStringOr(payload, "name"))
	if name == "" {
		return nil, validationField("label name is required", "name")
	}
	color := optionalString(payload, "color")
	principal := sessionctx.PrincipalFromContext(ctx)
	now := nowRFC3339()
	id := "L_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	if _, err := s.db.ExecContext(ctx, "INSERT INTO labels (id, name, color, created_at, updated_at, user_id, workspace_id) VALUES (?, ?, ?, ?, ?, ?, ?)", id, name, stringOrNil(color), now, now, principal.UserID, principal.WorkspaceID); err != nil {
		return nil, err
	}
	return s.labelByID(ctx, id)
}

func (s *Service) getLabel(ctx context.Context, payload map[string]any) (any, error) {
	labelID, ok := getString(payload, "labelId")
	if !ok || strings.TrimSpace(labelID) == "" {
		return nil, validationField("label id is required", "labelId")
	}
	return s.labelByID(ctx, strings.TrimSpace(labelID))
}

func (s *Service) getLabels(ctx context.Context, payload map[string]any) (any, error) {
	limit, cursor := limitCursor(payload)
	principal := sessionctx.PrincipalFromContext(ctx)
	rows := []labelRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT id, name, color, created_at, updated_at FROM labels WHERE user_id = ? AND workspace_id = ? ORDER BY LOWER(name) ASC, created_at ASC, id ASC", principal.UserID, principal.WorkspaceID); err != nil {
		return nil, err
	}
	items, next, total := paginate(rows, limit, cursor)
	return map[string]any{"items": items, "nextCursor": next, "total": total}, nil
}

func (s *Service) updateLabel(ctx context.Context, payload map[string]any) (any, error) {
	labelID, ok := getString(payload, "labelId")
	if !ok || strings.TrimSpace(labelID) == "" {
		return nil, validationField("label id is required", "labelId")
	}
	labelID = strings.TrimSpace(labelID)
	if _, err := s.labelByID(ctx, labelID); err != nil {
		return nil, err
	}

	if _, exists := payload["name"]; exists {
		name := strings.TrimSpace(getStringOr(payload, "name"))
		if name == "" {
			return nil, validationField("label name is required", "name")
		}
		if _, err := s.db.ExecContext(ctx, "UPDATE labels SET name = ?, updated_at = ? WHERE id = ?", name, nowRFC3339(), labelID); err != nil {
			return nil, err
		}
	}
	if _, exists := payload["color"]; exists {
		color := optionalString(payload, "color")
		if _, err := s.db.ExecContext(ctx, "UPDATE labels SET color = ?, updated_at = ? WHERE id = ?", stringOrNil(color), nowRFC3339(), labelID); err != nil {
			return nil, err
		}
	}
	return s.labelByID(ctx, labelID)
}
