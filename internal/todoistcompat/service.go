package todoistcompat

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/project"
	"donegeon/internal/task"
)

const (
	defaultLimit = 50
	maxLimit     = 200
	defaultUser  = "U1"
)

type Service struct {
	db       *sqlx.DB
	tasks    *task.Service
	projects *project.Service
}

type sectionRow struct {
	ID        string `db:"id" json:"id"`
	ProjectID string `db:"project_id" json:"projectId"`
	Name      string `db:"name" json:"name"`
	CreatedAt string `db:"created_at" json:"createdAt"`
	UpdatedAt string `db:"updated_at" json:"updatedAt"`
}

type labelRow struct {
	ID        string  `db:"id" json:"id"`
	Name      string  `db:"name" json:"name"`
	Color     *string `db:"color" json:"color,omitempty"`
	CreatedAt string  `db:"created_at" json:"createdAt"`
	UpdatedAt string  `db:"updated_at" json:"updatedAt"`
}

type commentRow struct {
	ID        string  `db:"id" json:"id"`
	TaskID    *string `db:"task_id" json:"taskId,omitempty"`
	ProjectID *string `db:"project_id" json:"projectId,omitempty"`
	Content   string  `db:"content" json:"content"`
	CreatedAt string  `db:"created_at" json:"createdAt"`
	UpdatedAt string  `db:"updated_at" json:"updatedAt"`
}

type workspaceRow struct {
	ID         string `db:"id" json:"id"`
	Name       string `db:"name" json:"name"`
	Plan       string `db:"plan" json:"plan"`
	IsArchived bool   `db:"is_archived" json:"isArchived"`
	CreatedAt  string `db:"created_at" json:"createdAt"`
	UpdatedAt  string `db:"updated_at" json:"updatedAt"`
}

type workspaceUserRow struct {
	WorkspaceID string `db:"workspace_id" json:"workspaceId"`
	UserID      string `db:"user_id" json:"userId"`
	Email       string `db:"email" json:"email"`
	Name        string `db:"name" json:"name"`
	Role        string `db:"role" json:"role"`
	CreatedAt   string `db:"created_at" json:"createdAt"`
}

type workspaceInvitationRow struct {
	InvitationCode string `db:"invitation_code" json:"invitationCode"`
	WorkspaceID    string `db:"workspace_id" json:"workspaceId"`
	Email          string `db:"email" json:"email"`
	Status         string `db:"status" json:"status"`
	CreatedAt      string `db:"created_at" json:"createdAt"`
	UpdatedAt      string `db:"updated_at" json:"updatedAt"`
}

func NewService(db *sqlx.DB, tasks *task.Service, projects *project.Service) *Service {
	s := &Service{
		db:       db,
		tasks:    tasks,
		projects: projects,
	}
	_ = s.ensureDefaults(context.Background())
	return s
}

func (s *Service) Dispatch(ctx context.Context, action string, payload map[string]any) (any, error) {
	action = strings.TrimSpace(action)
	switch action {
	case "addTask":
		return s.addTask(ctx, payload)
	case "quickAddTask":
		return s.quickAddTask(ctx, payload)
	case "getTask":
		return s.getTask(ctx, payload)
	case "getTasks":
		return s.getTasks(ctx, payload)
	case "getTasksByFilter":
		return s.getTasksByFilter(ctx, payload)
	case "updateTask":
		return s.updateTask(ctx, payload)
	case "closeTask":
		return s.closeTask(ctx, payload)
	case "reopenTask":
		return s.reopenTask(ctx, payload)
	case "deleteTask":
		return s.deleteTask(ctx, payload)
	case "moveTask":
		return s.moveTask(ctx, payload)
	case "moveTasks":
		return s.moveTasks(ctx, payload)
	case "getCompletedTasksByCompletionDate":
		return s.getCompletedTasks(ctx, payload, "completion")
	case "getCompletedTasksByDueDate":
		return s.getCompletedTasks(ctx, payload, "due")
	case "searchCompletedTasks":
		return s.searchCompletedTasks(ctx, payload)
	case "addProject":
		return s.addProject(ctx, payload)
	case "getProject":
		return s.getProject(ctx, payload)
	case "getProjects":
		return s.getProjects(ctx, payload, false)
	case "getArchivedProjects":
		return s.getProjects(ctx, payload, true)
	case "updateProject":
		return s.updateProject(ctx, payload)
	case "deleteProject":
		return s.deleteProject(ctx, payload)
	case "archiveProject":
		return s.setProjectArchived(ctx, payload, true)
	case "unarchiveProject":
		return s.setProjectArchived(ctx, payload, false)
	case "searchProjects":
		return s.searchProjects(ctx, payload)
	case "moveProjectToWorkspace":
		return s.moveProjectToWorkspace(ctx, payload)
	case "moveProjectToPersonal":
		return s.moveProjectToPersonal(ctx, payload)
	case "getWorkspaceActiveProjects":
		return s.getWorkspaceProjects(ctx, payload, false)
	case "getWorkspaceArchivedProjects":
		return s.getWorkspaceProjects(ctx, payload, true)
	case "getProjectCollaborators":
		return s.getProjectCollaborators(ctx, payload)
	case "addSection":
		return s.addSection(ctx, payload)
	case "getSection":
		return s.getSection(ctx, payload)
	case "getSections":
		return s.getSections(ctx, payload)
	case "updateSection":
		return s.updateSection(ctx, payload)
	case "deleteSection":
		return s.deleteSection(ctx, payload)
	case "searchSections":
		return s.searchSections(ctx, payload)
	case "addLabel":
		return s.addLabel(ctx, payload)
	case "getLabel":
		return s.getLabel(ctx, payload)
	case "getLabels":
		return s.getLabels(ctx, payload)
	case "updateLabel":
		return s.updateLabel(ctx, payload)
	case "deleteLabel":
		return s.deleteLabel(ctx, payload)
	case "searchLabels":
		return s.searchLabels(ctx, payload)
	case "getSharedLabels":
		return s.getLabels(ctx, payload)
	case "renameSharedLabel":
		return s.renameSharedLabel(ctx, payload)
	case "removeSharedLabel":
		return s.removeSharedLabel(ctx, payload)
	case "addComment":
		return s.addComment(ctx, payload)
	case "getComment":
		return s.getComment(ctx, payload)
	case "getComments":
		return s.getComments(ctx, payload)
	case "updateComment":
		return s.updateComment(ctx, payload)
	case "deleteComment":
		return s.deleteComment(ctx, payload)
	case "getWorkspaces":
		return s.getWorkspaces(ctx)
	case "getWorkspaceUsers":
		return s.getWorkspaceUsers(ctx, payload)
	case "getWorkspaceInvitations":
		return s.getWorkspaceInvitations(ctx, payload)
	case "getAllWorkspaceInvitations":
		return s.getAllWorkspaceInvitations(ctx)
	case "joinWorkspace":
		return s.joinWorkspace(ctx, payload)
	case "acceptWorkspaceInvitation":
		return s.acceptWorkspaceInvitation(ctx, payload)
	case "rejectWorkspaceInvitation":
		return s.rejectWorkspaceInvitation(ctx, payload)
	case "deleteWorkspaceInvitation":
		return s.deleteWorkspaceInvitation(ctx, payload)
	case "getWorkspacePlanDetails":
		return s.getWorkspacePlanDetails(ctx, payload)
	case "getUser":
		return s.getUser()
	case "getActivityLogs":
		return map[string]any{"items": []any{}}, nil
	case "getProductivityStats":
		return s.getProductivityStats(ctx)
	case "deleteUpload", "uploadFile", "uploadWorkspaceLogo":
		return nil, apperrors.New(apperrors.CodeNotFound, "upload actions are intentionally not implemented")
	default:
		return nil, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "unknown action"), "action")
	}
}

func (s *Service) addTask(ctx context.Context, payload map[string]any) (any, error) {
	content, ok := getString(payload, "content")
	if !ok || strings.TrimSpace(content) == "" {
		return nil, validationField("content is required", "content")
	}
	priority := getIntOr(payload, "priority", 4)
	description := strings.TrimSpace(getStringOr(payload, "description"))
	projectID := optionalString(payload, "projectId")

	created, err := s.tasks.Create(ctx, task.CreateInput{
		Content:     strings.TrimSpace(content),
		Description: description,
		ProjectID:   projectID,
		Priority:    priority,
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func (s *Service) quickAddTask(ctx context.Context, payload map[string]any) (any, error) {
	text, ok := getString(payload, "text")
	if !ok || strings.TrimSpace(text) == "" {
		return nil, validationField("text is required", "text")
	}
	created, parsed, err := s.tasks.CreateFromQuickAdd(ctx, strings.TrimSpace(text))
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"task":   created,
		"parsed": parsed,
	}, nil
}

func (s *Service) getTask(ctx context.Context, payload map[string]any) (any, error) {
	taskID, ok := getString(payload, "taskId")
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, validationField("task id is required", "taskId")
	}
	return s.tasks.Get(ctx, strings.TrimSpace(taskID))
}

func (s *Service) getTasks(ctx context.Context, payload map[string]any) (any, error) {
	projectID := optionalString(payload, "projectId")
	if projectID != nil {
		if _, err := s.projectByID(ctx, *projectID); err != nil {
			return nil, err
		}
	}
	limit, cursor := limitCursor(payload)
	return s.tasks.List(ctx, task.ListParams{
		ProjectID: projectID,
		Limit:     limit,
		Cursor:    cursor,
	})
}

func (s *Service) getTasksByFilter(ctx context.Context, payload map[string]any) (any, error) {
	filter := strings.ToLower(strings.TrimSpace(getStringOr(payload, "filter")))
	if filter == "" {
		filter = strings.ToLower(strings.TrimSpace(getStringOr(payload, "query")))
	}
	limit, cursor := limitCursor(payload)

	list, err := s.tasks.List(ctx, task.ListParams{Limit: maxLimit, Cursor: 0})
	if err != nil {
		return nil, err
	}

	filtered := make([]task.Task, 0, len(list.Items))
	for _, item := range list.Items {
		if item.Checked || item.IsDeleted {
			continue
		}
		if filter == "" {
			filtered = append(filtered, item)
			continue
		}
		if strings.Contains(strings.ToLower(item.Content), filter) || strings.Contains(strings.ToLower(item.Description), filter) {
			filtered = append(filtered, item)
		}
	}

	items, next, total := paginate(filtered, limit, cursor)
	return map[string]any{
		"items":      items,
		"nextCursor": next,
		"total":      total,
	}, nil
}

func (s *Service) updateTask(ctx context.Context, payload map[string]any) (any, error) {
	taskID, ok := getString(payload, "taskId")
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, validationField("task id is required", "taskId")
	}

	input := task.UpdateInput{}
	if _, ok := payload["content"]; ok {
		value := strings.TrimSpace(getStringOr(payload, "content"))
		if value == "" {
			return nil, validationField("content is required", "content")
		}
		input.Content = &value
	}
	if _, ok := payload["description"]; ok {
		value := getStringOr(payload, "description")
		input.Description = &value
	}
	if _, ok := payload["projectId"]; ok {
		input.ProjectID = optionalString(payload, "projectId")
	}
	if _, ok := payload["sectionId"]; ok {
		input.SectionID = optionalString(payload, "sectionId")
	}
	if _, ok := payload["priority"]; ok {
		value := getIntOr(payload, "priority", 4)
		input.Priority = &value
	}

	return s.tasks.Update(ctx, strings.TrimSpace(taskID), input)
}

func (s *Service) closeTask(ctx context.Context, payload map[string]any) (any, error) {
	taskID, ok := getString(payload, "taskId")
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, validationField("task id is required", "taskId")
	}
	if err := s.tasks.Close(ctx, strings.TrimSpace(taskID)); err != nil {
		return nil, err
	}
	return map[string]any{"closed": true}, nil
}

func (s *Service) reopenTask(ctx context.Context, payload map[string]any) (any, error) {
	taskID, ok := getString(payload, "taskId")
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, validationField("task id is required", "taskId")
	}
	if err := s.tasks.Reopen(ctx, strings.TrimSpace(taskID)); err != nil {
		return nil, err
	}
	return map[string]any{"reopened": true}, nil
}

func (s *Service) deleteTask(ctx context.Context, payload map[string]any) (any, error) {
	taskID, ok := getString(payload, "taskId")
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, validationField("task id is required", "taskId")
	}
	if err := s.tasks.Delete(ctx, strings.TrimSpace(taskID)); err != nil {
		return nil, err
	}
	return map[string]any{"deleted": true}, nil
}

func (s *Service) moveTask(ctx context.Context, payload map[string]any) (any, error) {
	taskID, ok := getString(payload, "taskId")
	if !ok || strings.TrimSpace(taskID) == "" {
		return nil, validationField("task id is required", "taskId")
	}

	input := task.UpdateInput{}
	if _, ok := payload["projectId"]; ok {
		input.ProjectID = optionalString(payload, "projectId")
	}
	if _, ok := payload["sectionId"]; ok {
		input.SectionID = optionalString(payload, "sectionId")
	}
	return s.tasks.Update(ctx, strings.TrimSpace(taskID), input)
}

func (s *Service) moveTasks(ctx context.Context, payload map[string]any) (any, error) {
	taskIDs := getStringSlice(payload, "taskIds")
	if len(taskIDs) == 0 {
		return nil, validationField("taskIds is required", "taskIds")
	}

	projectID := optionalString(payload, "projectId")
	sectionID := optionalString(payload, "sectionId")
	if projectID != nil {
		if _, err := s.projectByID(ctx, *projectID); err != nil {
			return nil, err
		}
	}
	if sectionID != nil {
		if _, err := s.sectionByID(ctx, *sectionID); err != nil {
			return nil, err
		}
	}

	updated := make([]task.Task, 0, len(taskIDs))
	for _, taskID := range taskIDs {
		item, err := s.tasks.Update(ctx, taskID, task.UpdateInput{
			ProjectID: projectID,
			SectionID: sectionID,
		})
		if err != nil {
			return nil, err
		}
		updated = append(updated, item)
	}
	return map[string]any{"items": updated}, nil
}

func (s *Service) getCompletedTasks(ctx context.Context, payload map[string]any, mode string) (any, error) {
	limit, cursor := limitCursor(payload)
	since := strings.TrimSpace(getStringOr(payload, "since"))

	list, err := s.tasks.List(ctx, task.ListParams{Limit: maxLimit, Cursor: 0})
	if err != nil {
		return nil, err
	}

	filtered := make([]task.Task, 0, len(list.Items))
	for _, item := range list.Items {
		if !item.Checked || item.IsDeleted {
			continue
		}
		if since != "" {
			if mode == "due" {
				due := strings.TrimSpace(ptrStringValue(item.DueDeadline))
				if due == "" || due < since {
					continue
				}
			} else if strings.TrimSpace(item.UpdatedAt) < since {
				continue
			}
		}
		filtered = append(filtered, item)
	}

	items, next, total := paginate(filtered, limit, cursor)
	return map[string]any{
		"items":      items,
		"nextCursor": next,
		"total":      total,
	}, nil
}

func (s *Service) searchCompletedTasks(ctx context.Context, payload map[string]any) (any, error) {
	limit, cursor := limitCursor(payload)
	query := strings.ToLower(strings.TrimSpace(getStringOr(payload, "query")))

	list, err := s.tasks.List(ctx, task.ListParams{Limit: maxLimit, Cursor: 0})
	if err != nil {
		return nil, err
	}

	filtered := make([]task.Task, 0, len(list.Items))
	for _, item := range list.Items {
		if !item.Checked || item.IsDeleted {
			continue
		}
		if query == "" || strings.Contains(strings.ToLower(item.Content), query) || strings.Contains(strings.ToLower(item.Description), query) {
			filtered = append(filtered, item)
		}
	}

	items, next, total := paginate(filtered, limit, cursor)
	return map[string]any{
		"items":      items,
		"nextCursor": next,
		"total":      total,
	}, nil
}

func (s *Service) addProject(ctx context.Context, payload map[string]any) (any, error) {
	name := strings.TrimSpace(getStringOr(payload, "name"))
	if name == "" {
		return nil, validationField("project name is required", "name")
	}

	id := "P_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	return s.projects.Upsert(ctx, id, project.UpsertInput{Name: &name})
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
	projectID = strings.TrimSpace(projectID)
	if _, err := s.projectByID(ctx, projectID); err != nil {
		return nil, err
	}

	input := project.UpsertInput{}
	if _, ok := payload["name"]; ok {
		name := strings.TrimSpace(getStringOr(payload, "name"))
		if name == "" {
			return nil, validationField("project name is required", "name")
		}
		input.Name = &name
	}
	return s.projects.Upsert(ctx, projectID, input)
}

func (s *Service) deleteProject(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectID = strings.TrimSpace(projectID)
	if _, err := s.projectByID(ctx, projectID); err != nil {
		return nil, err
	}

	if _, err := s.db.ExecContext(ctx, "UPDATE tasks SET section_id = NULL WHERE section_id IN (SELECT id FROM sections WHERE project_id = ?)", projectID); err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE tasks SET project_id = NULL WHERE project_id = ?", projectID); err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "DELETE FROM sections WHERE project_id = ?", projectID); err != nil {
		return nil, err
	}
	result, err := s.db.ExecContext(ctx, "DELETE FROM projects WHERE id = ?", projectID)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, notFoundField("project not found", "projectId")
	}
	return map[string]any{"deleted": true}, nil
}

func (s *Service) setProjectArchived(ctx context.Context, payload map[string]any, archived bool) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectID = strings.TrimSpace(projectID)
	if _, err := s.projectByID(ctx, projectID); err != nil {
		return nil, err
	}

	now := nowRFC3339()
	if _, err := s.db.ExecContext(ctx, "UPDATE projects SET is_archived = ?, updated_at = ? WHERE id = ?", boolInt(archived), now, projectID); err != nil {
		return nil, err
	}
	return s.projectByID(ctx, projectID)
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

	if _, err := s.projectByID(ctx, projectID); err != nil {
		return nil, err
	}
	if _, err := s.workspaceByID(ctx, workspaceID); err != nil {
		return nil, err
	}

	if _, err := s.db.ExecContext(ctx, "UPDATE projects SET workspace_id = ?, updated_at = ? WHERE id = ?", workspaceID, nowRFC3339(), projectID); err != nil {
		return nil, err
	}
	return s.projectByID(ctx, projectID)
}

func (s *Service) moveProjectToPersonal(ctx context.Context, payload map[string]any) (any, error) {
	projectID, ok := getString(payload, "projectId")
	if !ok || strings.TrimSpace(projectID) == "" {
		return nil, validationField("project id is required", "projectId")
	}
	projectID = strings.TrimSpace(projectID)
	if _, err := s.projectByID(ctx, projectID); err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, "UPDATE projects SET workspace_id = NULL, updated_at = ? WHERE id = ?", nowRFC3339(), projectID); err != nil {
		return nil, err
	}
	return s.projectByID(ctx, projectID)
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
    WHERE is_deleted = 0 AND checked = 0 AND project_id IS NOT NULL AND project_id <> ''
    GROUP BY project_id
) tc ON tc.project_id = p.id
WHERE p.workspace_id = ? AND p.is_archived = ?
ORDER BY LOWER(p.name) ASC, p.created_at ASC
`
	if err := s.db.SelectContext(ctx, &rows, query, workspaceID, boolInt(archived)); err != nil {
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
	if _, err := s.projectByID(ctx, strings.TrimSpace(projectID)); err != nil {
		return nil, err
	}

	name := strings.TrimSpace(getStringOr(payload, "name"))
	if name == "" {
		return nil, validationField("section name is required", "name")
	}

	now := nowRFC3339()
	id := "S_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	if _, err := s.db.ExecContext(ctx, "INSERT INTO sections (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", id, strings.TrimSpace(projectID), name, now, now); err != nil {
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

	rows := []sectionRow{}
	query := "SELECT id, project_id, name, created_at, updated_at FROM sections"
	args := []any{}
	if projectID != "" {
		if _, err := s.projectByID(ctx, projectID); err != nil {
			return nil, err
		}
		query += " WHERE project_id = ?"
		args = append(args, projectID)
	}
	query += " ORDER BY created_at ASC, id ASC"
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
	if _, ok := payload["name"]; ok {
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
	if _, err := s.db.ExecContext(ctx, "UPDATE tasks SET section_id = NULL WHERE section_id = ?", sectionID); err != nil {
		return nil, err
	}
	result, err := s.db.ExecContext(ctx, "DELETE FROM sections WHERE id = ?", sectionID)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, notFoundField("section not found", "sectionId")
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
	now := nowRFC3339()
	id := "L_" + strings.ToUpper(strings.ReplaceAll(uuid.NewString()[:8], "-", ""))
	if _, err := s.db.ExecContext(ctx, "INSERT INTO labels (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", id, name, stringOrNil(color), now, now); err != nil {
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
	rows := []labelRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT id, name, color, created_at, updated_at FROM labels ORDER BY LOWER(name) ASC, created_at ASC"); err != nil {
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

	if _, ok := payload["name"]; ok {
		name := strings.TrimSpace(getStringOr(payload, "name"))
		if name == "" {
			return nil, validationField("label name is required", "name")
		}
		if _, err := s.db.ExecContext(ctx, "UPDATE labels SET name = ?, updated_at = ? WHERE id = ?", name, nowRFC3339(), labelID); err != nil {
			return nil, err
		}
	}
	if _, ok := payload["color"]; ok {
		color := optionalString(payload, "color")
		if _, err := s.db.ExecContext(ctx, "UPDATE labels SET color = ?, updated_at = ? WHERE id = ?", stringOrNil(color), nowRFC3339(), labelID); err != nil {
			return nil, err
		}
	}
	return s.labelByID(ctx, labelID)
}

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
	result, err := s.db.ExecContext(ctx, "DELETE FROM labels WHERE id = ?", labelID)
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
	rows := []labelRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT id, name, color, created_at, updated_at FROM labels ORDER BY LOWER(name) ASC, created_at ASC"); err != nil {
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
			if _, insertErr := s.db.ExecContext(ctx, "INSERT INTO labels (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", id, next, stringOrNil(color), now, now); insertErr != nil {
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
	if _, err := s.db.ExecContext(ctx, "DELETE FROM labels WHERE id = ?", row.ID); err != nil {
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
	var open int
	if err := s.db.GetContext(ctx, &open, "SELECT COUNT(*) FROM tasks WHERE is_deleted = 0 AND checked = 0"); err != nil {
		return nil, err
	}
	var completed int
	if err := s.db.GetContext(ctx, &completed, "SELECT COUNT(*) FROM tasks WHERE is_deleted = 0 AND checked = 1"); err != nil {
		return nil, err
	}
	return map[string]any{
		"openTasks":      open,
		"completedTasks": completed,
		"totalTasks":     open + completed,
	}, nil
}

func (s *Service) projectByID(ctx context.Context, id string) (project.Project, error) {
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
WHERE p.id = ?
LIMIT 1
`
	var row project.Project
	if err := s.db.GetContext(ctx, &row, query, id); err != nil {
		if err == sql.ErrNoRows {
			return project.Project{}, notFoundField("project not found", "projectId")
		}
		return project.Project{}, err
	}
	return row, nil
}

func (s *Service) sectionByID(ctx context.Context, id string) (sectionRow, error) {
	var row sectionRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, project_id, name, created_at, updated_at FROM sections WHERE id = ? LIMIT 1", id); err != nil {
		if err == sql.ErrNoRows {
			return sectionRow{}, notFoundField("section not found", "sectionId")
		}
		return sectionRow{}, err
	}
	return row, nil
}

func (s *Service) labelByID(ctx context.Context, id string) (labelRow, error) {
	var row labelRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, name, color, created_at, updated_at FROM labels WHERE id = ? LIMIT 1", id); err != nil {
		if err == sql.ErrNoRows {
			return labelRow{}, notFoundField("label not found", "labelId")
		}
		return labelRow{}, err
	}
	return row, nil
}

func (s *Service) labelByName(ctx context.Context, name string) (labelRow, error) {
	var row labelRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, name, color, created_at, updated_at FROM labels WHERE LOWER(name) = LOWER(?) ORDER BY created_at ASC LIMIT 1", name); err != nil {
		if err == sql.ErrNoRows {
			return labelRow{}, notFoundField("label not found", "name")
		}
		return labelRow{}, err
	}
	return row, nil
}

func (s *Service) commentByID(ctx context.Context, id string) (commentRow, error) {
	var row commentRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, task_id, project_id, content, created_at, updated_at FROM comments WHERE id = ? LIMIT 1", id); err != nil {
		if err == sql.ErrNoRows {
			return commentRow{}, notFoundField("comment not found", "commentId")
		}
		return commentRow{}, err
	}
	return row, nil
}

func (s *Service) workspaceByID(ctx context.Context, id string) (workspaceRow, error) {
	var row workspaceRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, name, plan, is_archived, created_at, updated_at FROM workspaces WHERE id = ? LIMIT 1", id); err != nil {
		if err == sql.ErrNoRows {
			return workspaceRow{}, notFoundField("workspace not found", "workspaceId")
		}
		return workspaceRow{}, err
	}
	return row, nil
}

func (s *Service) workspaceUsersByWorkspaceID(ctx context.Context, workspaceID string) ([]workspaceUserRow, error) {
	rows := []workspaceUserRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT workspace_id, user_id, email, name, role, created_at FROM workspace_users WHERE workspace_id = ? ORDER BY created_at ASC", workspaceID); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *Service) workspaceInvitationByCode(ctx context.Context, code string) (workspaceInvitationRow, error) {
	var row workspaceInvitationRow
	if err := s.db.GetContext(ctx, &row, "SELECT invitation_code, workspace_id, email, status, created_at, updated_at FROM workspace_invitations WHERE invitation_code = ? LIMIT 1", code); err != nil {
		if err == sql.ErrNoRows {
			return workspaceInvitationRow{}, notFoundField("workspace invitation not found", "invitationCode")
		}
		return workspaceInvitationRow{}, err
	}
	return row, nil
}

func (s *Service) upsertWorkspaceUser(ctx context.Context, workspaceID, userID, email, name, role string) error {
	_, err := s.db.ExecContext(ctx, `
INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    role = excluded.role
`, workspaceID, userID, email, name, role, nowRFC3339())
	return err
}

func (s *Service) ensureDefaults(ctx context.Context) error {
	now := nowRFC3339()
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO workspaces (id, name, plan, is_archived, created_at, updated_at)
VALUES (?, ?, ?, 0, ?, ?)
ON CONFLICT(id) DO NOTHING
`, "W1", "Default Workspace", "free", now, now); err != nil {
		return err
	}
	return s.upsertWorkspaceUser(ctx, "W1", defaultUser, "owner@example.com", "Owner", "owner")
}

func validationField(message, field string) error {
	return apperrors.WithField(apperrors.New(apperrors.CodeValidationError, message), field)
}

func notFoundField(message, field string) error {
	return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, message), field)
}

func getString(payload map[string]any, key string) (string, bool) {
	if payload == nil {
		return "", false
	}
	raw, ok := payload[key]
	if !ok || raw == nil {
		return "", false
	}
	switch typed := raw.(type) {
	case string:
		return typed, true
	default:
		return fmt.Sprintf("%v", typed), true
	}
}

func getStringOr(payload map[string]any, key string) string {
	value, ok := getString(payload, key)
	if !ok {
		return ""
	}
	return value
}

func optionalString(payload map[string]any, key string) *string {
	value, ok := getString(payload, key)
	if !ok {
		return nil
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func getIntOr(payload map[string]any, key string, fallback int) int {
	if payload == nil {
		return fallback
	}
	raw, ok := payload[key]
	if !ok || raw == nil {
		return fallback
	}
	switch typed := raw.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err != nil {
			return fallback
		}
		return parsed
	default:
		return fallback
	}
}

func getStringSlice(payload map[string]any, key string) []string {
	if payload == nil {
		return nil
	}
	raw, ok := payload[key]
	if !ok || raw == nil {
		return nil
	}
	switch typed := raw.(type) {
	case []string:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			item = strings.TrimSpace(item)
			if item != "" {
				out = append(out, item)
			}
		}
		return out
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			text := strings.TrimSpace(fmt.Sprintf("%v", item))
			if text != "" {
				out = append(out, text)
			}
		}
		return out
	default:
		return nil
	}
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func limitCursor(payload map[string]any) (int, int) {
	limit := getIntOr(payload, "limit", defaultLimit)
	cursor := getIntOr(payload, "cursor", 0)
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if cursor < 0 {
		cursor = 0
	}
	return limit, cursor
}

func paginate[T any](items []T, limit, cursor int) ([]T, *int, int) {
	total := len(items)
	if cursor > total {
		cursor = total
	}
	end := cursor + limit
	if end > total {
		end = total
	}
	page := slices.Clone(items[cursor:end])
	var next *int
	if end < total {
		n := end
		next = &n
	}
	return page, next, total
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func stringOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func ptrStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func asAppError(err error, target **apperrors.AppError) bool {
	if err == nil {
		return false
	}
	var appErr *apperrors.AppError
	if errors.As(err, &appErr) {
		*target = appErr
		return true
	}
	return false
}
