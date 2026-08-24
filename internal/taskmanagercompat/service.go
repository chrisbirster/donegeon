package taskmanagercompat

import (
	"context"
	"strings"

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
	placement, err := s.resolveTaskPlacement(ctx, payload)
	if err != nil {
		return nil, err
	}
	priority := getIntOr(payload, "priority", 4)
	description := strings.TrimSpace(getStringOr(payload, "description"))
	labels := getStringSlice(payload, "labels")

	created, err := s.tasks.Create(ctx, task.CreateInput{
		Content:     strings.TrimSpace(content),
		Description: description,
		ProjectID:   placement.ProjectID,
		SectionID:   placement.SectionID,
		Priority:    priority,
		Labels:      labels,
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
	taskID = strings.TrimSpace(taskID)
	if _, err := s.tasks.Get(ctx, taskID); err != nil {
		return nil, err
	}
	placement, err := s.resolveTaskPlacement(ctx, payload)
	if err != nil {
		return nil, err
	}

	input := task.UpdateInput{}
	hasFieldUpdate := false
	if _, exists := payload["content"]; exists {
		value := strings.TrimSpace(getStringOr(payload, "content"))
		if value == "" {
			return nil, validationField("content is required", "content")
		}
		input.Content = &value
		hasFieldUpdate = true
	}
	if _, exists := payload["description"]; exists {
		value := getStringOr(payload, "description")
		input.Description = &value
		hasFieldUpdate = true
	}
	if _, exists := payload["priority"]; exists {
		value := getIntOr(payload, "priority", 4)
		input.Priority = &value
		hasFieldUpdate = true
	}
	if _, exists := payload["labels"]; exists {
		labels := getStringSlice(payload, "labels")
		input.Labels = &labels
		hasFieldUpdate = true
	}

	if hasFieldUpdate {
		if _, err := s.tasks.Update(ctx, taskID, input); err != nil {
			return nil, err
		}
	}
	if placement.ApplyProject || placement.ApplySection {
		return s.applyTaskPlacement(ctx, taskID, placement)
	}
	return s.tasks.Get(ctx, taskID)
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
	taskID = strings.TrimSpace(taskID)
	if _, err := s.tasks.Get(ctx, taskID); err != nil {
		return nil, err
	}
	placement, err := s.resolveTaskPlacement(ctx, payload)
	if err != nil {
		return nil, err
	}
	if !placement.ApplyProject && !placement.ApplySection {
		return nil, validationField("projectId or sectionId is required", "projectId")
	}
	return s.applyTaskPlacement(ctx, taskID, placement)
}

func (s *Service) moveTasks(ctx context.Context, payload map[string]any) (any, error) {
	taskIDs := getStringSlice(payload, "taskIds")
	if len(taskIDs) == 0 {
		return nil, validationField("taskIds is required", "taskIds")
	}
	for _, taskID := range taskIDs {
		if _, err := s.tasks.Get(ctx, taskID); err != nil {
			return nil, err
		}
	}
	placement, err := s.resolveTaskPlacement(ctx, payload)
	if err != nil {
		return nil, err
	}
	if !placement.ApplyProject && !placement.ApplySection {
		return nil, validationField("projectId or sectionId is required", "projectId")
	}

	updated := make([]task.Task, 0, len(taskIDs))
	for _, taskID := range taskIDs {
		item, err := s.applyTaskPlacement(ctx, taskID, placement)
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
