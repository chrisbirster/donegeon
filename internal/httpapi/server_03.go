package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"donegeon/internal/board"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/project"
	"donegeon/internal/sessionctx"
	"donegeon/internal/task"
	"donegeon/internal/tenant"
)

func (a *API) handleQuickAddTask(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	ctx := task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone")))
	created, parsed, err := a.tasks.CreateFromQuickAdd(ctx, strings.TrimSpace(req.Text))
	if err != nil {
		a.logError(r, "quick_add_task_failed", err)
		writeAPIError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"task": created, "parsed": parsed})
}

func (a *API) handleTaskManagerAction(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.taskManager == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "taskmanager compatibility service unavailable"))
		return
	}

	var req struct {
		Action  string         `json:"action"`
		Payload map[string]any `json:"payload"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	action := strings.TrimSpace(req.Action)
	if action == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "action is required"), "action"))
		return
	}
	if req.Payload == nil {
		req.Payload = map[string]any{}
	}

	ctx := task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone")))
	result, err := a.taskManager.Dispatch(ctx, action, req.Payload)
	if err != nil {
		a.logError(r, "taskmanager_dispatch_failed", err)
		writeAPIError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"result": result})
}

func (a *API) handleListTasks(w http.ResponseWriter, r *http.Request) {
	projectID := ptrOrNil(strings.TrimSpace(r.URL.Query().Get("projectId")))
	limit := parseIntOrDefault(r.URL.Query().Get("limit"), 50)
	cursor := parseIntOrDefault(r.URL.Query().Get("cursor"), 0)
	ctx := task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone")))

	result, err := a.tasks.List(ctx, task.ListParams{
		ProjectID: projectID,
		Limit:     limit,
		Cursor:    cursor,
	})
	if err != nil {
		a.logError(r, "list_tasks_failed", err)
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *API) handleListProjects(w http.ResponseWriter, r *http.Request) {
	includeArchived := parseBoolOrDefault(r.URL.Query().Get("includeArchived"), false)

	result, err := a.projects.List(r.Context(), project.ListParams{
		IncludeArchived: includeArchived,
	})
	if err != nil {
		a.logError(r, "list_projects_failed", err)
		writeAPIError(w, err)
		return
	}

	a.logDebug(r, "projects_listed", summarizeProjects(result).attrs()...)

	writeJSON(w, http.StatusOK, map[string]any{
		"items": result,
	})
}

func (a *API) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	var req struct {
		ID         *string `json:"id"`
		Name       *string `json:"name"`
		IsFavorite *bool   `json:"isFavorite"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	name := ""
	if req.Name != nil {
		name = strings.TrimSpace(*req.Name)
	}
	if name == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "project name is required"), "name"))
		return
	}

	projectID := ""
	if req.ID != nil {
		projectID = strings.TrimSpace(*req.ID)
	}
	if projectID == "" {
		projectID = projectIDFromName(name)
	}
	if projectID == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "project id is required"), "projectId"))
		return
	}
	boardID, isBoardProject, boardErr := boardIDFromProjectID(projectID)
	if boardErr != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, boardErr.Error()), "projectId"))
		return
	}
	if isBoardProject && a.accounts != nil {
		principal := sessionctx.PrincipalFromContext(r.Context())
		if err := a.accounts.UpsertBoardMembership(r.Context(), principal.WorkspaceID, boardID, principal.UserID); err != nil {
			a.logError(r, "create_project_board_membership_failed", err)
			writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to grant board access"))
			return
		}
	}

	created, err := a.projects.Upsert(r.Context(), projectID, project.UpsertInput{
		Name:       cleanPtr(&name),
		IsFavorite: req.IsFavorite,
	})
	if err != nil {
		a.logError(r, "create_project_failed", err)
		writeAPIError(w, err)
		return
	}

	a.logInfo(r, "project_created",
		slog.String("project_id", created.ID),
		slog.String("project_name", created.Name),
		slog.Bool("is_inbox_project", created.IsInboxProject),
		slog.Bool("is_team_board", created.IsTeamBoard),
		slog.Bool("is_board_project", tenant.IsBoardProject(created.ID)),
	)

	writeJSON(w, http.StatusCreated, created)
}

func (a *API) handleGetBoardState(w http.ResponseWriter, r *http.Request) {
	if a.boards == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "board service unavailable"))
		return
	}

	boardID, err := a.requireBoardAccess(r.Context(), boardIDFromRequest(r), false)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	state, err := a.boards.GetState(r.Context(), boardID)
	if err != nil {
		a.logError(r, "get_board_state_failed", err)
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, state)
}

func (a *API) handleBoardCommand(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.boards == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "board service unavailable"))
		return
	}

	var req board.CommandRequest
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	boardID, err := a.requireBoardAccess(r.Context(), boardIDFromRequest(r), true)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	result, err := a.boards.Command(r.Context(), boardID, req)
	if err != nil {
		a.logError(r, "board_command_failed", err)
		var conflict *board.VersionConflictError
		if errors.As(err, &conflict) {
			writeJSON(w, http.StatusConflict, map[string]any{
				"ok":         false,
				"newVersion": conflict.ServerVersion,
				"error":      conflict.Error(),
			})
			return
		}
		a.logError(r, "board_command_failed", err)
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (a *API) handleListBoardMembers(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	boardID, err := a.requireBoardAccess(r.Context(), boardIDFromRequest(r), false)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	members, err := a.accounts.ListBoardMembers(r.Context(), principal.UserID, principal.WorkspaceID, boardID)
	if err != nil {
		writeAPIError(w, asBoardMemberAppError(err, "board"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"members": members})
}

func (a *API) handleCreateBoardMember(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		UserID string `json:"userId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	boardID, err := a.requireBoardAccess(r.Context(), boardIDFromRequest(r), true)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	member, err := a.accounts.AddBoardMember(
		r.Context(),
		principal.UserID,
		principal.WorkspaceID,
		boardID,
		strings.TrimSpace(req.UserID),
	)
	if err != nil {
		writeAPIError(w, asBoardMemberAppError(err, "userId"))
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"member": member})
}

func (a *API) handleDeleteBoardMember(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	targetUserID := strings.TrimSpace(r.PathValue("userId"))
	if targetUserID == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "user id is required"), "userId"))
		return
	}

	boardID, err := a.requireBoardAccess(r.Context(), boardIDFromRequest(r), true)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	if err := a.accounts.RemoveBoardMember(r.Context(), principal.UserID, principal.WorkspaceID, boardID, targetUserID); err != nil {
		writeAPIError(w, asBoardMemberAppError(err, "userId"))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handlePatchProject(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "project id is required"), "projectId"))
		return
	}
	if boardID, isBoardProject, boardErr := boardIDFromProjectID(id); boardErr != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, boardErr.Error()), "projectId"))
		return
	} else if isBoardProject {
		if _, err := a.requireBoardAccess(r.Context(), boardID, true); err != nil {
			writeAPIError(w, err)
			return
		}
	}

	var req struct {
		Name       *string `json:"name"`
		IsFavorite *bool   `json:"isFavorite"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	updated, err := a.projects.Upsert(r.Context(), id, project.UpsertInput{
		Name:       cleanPtr(req.Name),
		IsFavorite: req.IsFavorite,
	})
	if err != nil {
		a.logError(r, "upsert_project_failed", err)
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (a *API) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "project id is required"), "projectId"))
		return
	}
	boardID, isBoardProject, boardErr := boardIDFromProjectID(id)
	if boardErr != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, boardErr.Error()), "projectId"))
		return
	}
	if isBoardProject {
		if _, err := a.requireBoardAccess(r.Context(), boardID, true); err != nil {
			writeAPIError(w, err)
			return
		}
	}

	if err := a.projects.Delete(r.Context(), id); err != nil {
		a.logError(r, "delete_project_failed", err)
		writeAPIError(w, err)
		return
	}
	if isBoardProject && a.accounts != nil {
		principal := sessionctx.PrincipalFromContext(r.Context())
		if err := a.accounts.DeleteBoardMembershipsForBoard(r.Context(), principal.WorkspaceID, boardID); err != nil {
			a.logError(r, "delete_project_board_membership_cleanup_failed", err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
