package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/securecookie"

	"donegeon/internal/account"
	"donegeon/internal/board"
	"donegeon/internal/config"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/project"
	"donegeon/internal/quickadd"
	rruleparser "donegeon/internal/rrule"
	"donegeon/internal/sessionctx"
	"donegeon/internal/task"
	"donegeon/internal/todoistcompat"
)

const requestIDHeader = "X-Request-Id"
const authSessionCookieName = "donegeon_auth_session"

type ctxKey string

const (
	ctxKeyScope     ctxKey = "scope"
	ctxKeyRequestID ctxKey = "request_id"
)

type Scope string

const (
	ScopeRead  Scope = "read"
	ScopeWrite Scope = "write"
)

type API struct {
	logger     *slog.Logger
	cfg        config.Config
	tasks      *task.Service
	projects   *project.Service
	boards     *board.Service
	parser     *quickadd.Parser
	todoist    *todoistcompat.Service
	accounts   *account.Service
	webHandler http.Handler
	cookies    *securecookie.SecureCookie
}

func New(
	logger *slog.Logger,
	cfg config.Config,
	tasks *task.Service,
	projects *project.Service,
	boards *board.Service,
	parser *quickadd.Parser,
	todoist *todoistcompat.Service,
	accounts *account.Service,
	staticFS fs.FS,
) http.Handler {
	api := &API{
		logger:     logger,
		cfg:        cfg,
		tasks:      tasks,
		projects:   projects,
		boards:     boards,
		parser:     parser,
		todoist:    todoist,
		accounts:   accounts,
		webHandler: newSPAHandler(staticFS),
		cookies:    securecookie.New([]byte(cfg.CookieSigningKey), nil),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", api.handleHealth)
	mux.HandleFunc("POST /api/auth/login", api.handleAuthLogin)
	mux.HandleFunc("GET /api/auth/me", api.handleAuthMe)
	mux.HandleFunc("POST /api/auth/onboarding", api.handleAuthOnboarding)
	mux.HandleFunc("POST /api/auth/logout", api.handleAuthLogout)
	mux.HandleFunc("POST /api/rrule/parse", api.handleParseRRule)
	mux.HandleFunc("POST /api/quick-add/parse", api.handleParseQuickAdd)
	mux.HandleFunc("POST /api/tasks/quick-add", api.handleQuickAddTask)
	mux.HandleFunc("POST /api/todoist/action", api.handleTodoistAction)
	mux.HandleFunc("GET /api/tasks", api.handleListTasks)
	mux.HandleFunc("GET /api/projects", api.handleListProjects)
	mux.HandleFunc("GET /api/board/state", api.handleGetBoardState)
	mux.HandleFunc("POST /api/board/cmd", api.handleBoardCommand)
	mux.HandleFunc("PATCH /api/projects/{id}", api.handlePatchProject)
	mux.HandleFunc("POST /api/tasks", api.handleCreateTask)
	mux.HandleFunc("GET /api/tasks/{id}", api.handleGetTask)
	mux.HandleFunc("PATCH /api/tasks/{id}", api.handlePatchTask)
	mux.HandleFunc("POST /api/tasks/{id}/close", api.handleCloseTask)
	mux.HandleFunc("POST /api/tasks/{id}/reopen", api.handleReopenTask)
	mux.HandleFunc("DELETE /api/tasks/{id}", api.handleDeleteTask)

	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api") {
			writeAPIError(w, apperrors.New(apperrors.CodeNotFound, "route not found"))
			return
		}
		api.webHandler.ServeHTTP(w, r)
	}))

	return chain(
		api.requestIDMiddleware,
		api.recoverMiddleware,
		api.loggingMiddleware,
		api.rateLimitMiddleware,
		api.authMiddleware,
	)(mux)
}

func (a *API) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"name":   "donegeon",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

func (a *API) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	session, err := a.accounts.Login(r.Context(), strings.TrimSpace(req.Email), strings.TrimSpace(req.Name))
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "email"))
		return
	}

	principal := sessionctx.Principal{
		UserID: session.User.ID,
		Email:  session.User.Email,
	}
	if session.User.CurrentWorkspace != nil {
		principal.WorkspaceID = strings.TrimSpace(*session.User.CurrentWorkspace)
	}
	if err := a.writeSessionCookie(w, principal); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to set auth session"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"session": session})
}

func (a *API) handleAuthMe(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	session, err := a.accounts.GetSession(r.Context(), principal.UserID)
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeUnauthorized, "not authenticated"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"session": session})
}

func (a *API) handleAuthOnboarding(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		TeamName string   `json:"teamName"`
		Emails   []string `json:"emails"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	session, invites, err := a.accounts.CompleteOnboarding(
		r.Context(),
		principal.UserID,
		strings.TrimSpace(req.TeamName),
		req.Emails,
	)
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "teamName"))
		return
	}

	newPrincipal := sessionctx.Principal{
		UserID: session.User.ID,
		Email:  session.User.Email,
	}
	if session.User.CurrentWorkspace != nil {
		newPrincipal.WorkspaceID = strings.TrimSpace(*session.User.CurrentWorkspace)
	}
	if err := a.writeSessionCookie(w, newPrincipal); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to update auth session"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"session":     session,
		"invitations": invites,
	})
}

func (a *API) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	a.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleParseQuickAdd(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Text string `json:"text"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "text is required"), "text"))
		return
	}

	parsed := a.tasks.ParseQuickAdd(task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone"))), req.Text)
	writeJSON(w, http.StatusOK, map[string]any{"parsed": parsed})
}

func (a *API) handleParseRRule(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RRule string `json:"rrule"`
		Value string `json:"value"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	input := strings.TrimSpace(req.RRule)
	if input == "" {
		input = strings.TrimSpace(req.Value)
	}
	if input == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "rrule is required"), "rrule"))
		return
	}

	parsed, err := rruleparser.Parse(input)
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "rrule"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"rule":      parsed,
		"canonical": parsed.Canonical(),
	})
}

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
		writeAPIError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"task": created, "parsed": parsed})
}

func (a *API) handleTodoistAction(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.todoist == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "todoist compatibility service unavailable"))
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
	result, err := a.todoist.Dispatch(ctx, action, req.Payload)
	if err != nil {
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
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": result,
	})
}

func (a *API) handleGetBoardState(w http.ResponseWriter, r *http.Request) {
	if a.boards == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "board service unavailable"))
		return
	}

	state, err := a.boards.GetState(r.Context(), boardIDFromRequest(r))
	if err != nil {
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

	result, err := a.boards.Command(r.Context(), boardIDFromRequest(r), req)
	if err != nil {
		var conflict *board.VersionConflictError
		if errors.As(err, &conflict) {
			writeJSON(w, http.StatusConflict, map[string]any{
				"ok":         false,
				"newVersion": conflict.ServerVersion,
				"error":      conflict.Error(),
			})
			return
		}
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
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
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (a *API) handleGetTask(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "task id is required"), "taskId"))
		return
	}

	ctx := task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone")))
	item, err := a.tasks.Get(ctx, id)
	if err != nil {
		writeAPIError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (a *API) handleCreateTask(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	var req struct {
		Content       string   `json:"content"`
		Description   string   `json:"description"`
		ProjectID     *string  `json:"projectId"`
		SectionID     *string  `json:"sectionId"`
		SortOrder     *int64   `json:"sortOrder"`
		Recurrence    *string  `json:"recurrenceRule"`
		Priority      int      `json:"priority"`
		DueText       *string  `json:"dueText"`
		DueDeadline   *string  `json:"dueDeadline"`
		ScheduleInput *string  `json:"scheduleInput"`
		Labels        []string `json:"labels"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	ctx := task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone")))
	created, err := a.tasks.Create(ctx, task.CreateInput{
		Content:       strings.TrimSpace(req.Content),
		Description:   strings.TrimSpace(req.Description),
		ProjectID:     cleanPtr(req.ProjectID),
		SectionID:     cleanPtr(req.SectionID),
		SortOrder:     ptrInt64Value(req.SortOrder),
		Recurrence:    cleanPtr(req.Recurrence),
		Priority:      req.Priority,
		DueText:       cleanPtr(req.DueText),
		DueDeadline:   cleanPtr(req.DueDeadline),
		ScheduleInput: cleanPtr(req.ScheduleInput),
		Labels:        cleanStringSlice(req.Labels),
	})
	if err != nil {
		writeAPIError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (a *API) handlePatchTask(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "task id is required"), "taskId"))
		return
	}

	var req struct {
		Content       *string  `json:"content"`
		Description   *string  `json:"description"`
		ProjectID     *string  `json:"projectId"`
		SectionID     *string  `json:"sectionId"`
		SortOrder     *int64   `json:"sortOrder"`
		Recurrence    *string  `json:"recurrenceRule"`
		Priority      *int     `json:"priority"`
		DueText       *string  `json:"dueText"`
		DueDeadline   *string  `json:"dueDeadline"`
		ScheduleInput *string  `json:"scheduleInput"`
		Labels        []string `json:"labels"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	ctx := task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone")))
	input := task.UpdateInput{
		Content:       cleanPtr(req.Content),
		Description:   cleanPtr(req.Description),
		ProjectID:     cleanPtr(req.ProjectID),
		SectionID:     cleanPtr(req.SectionID),
		SortOrder:     req.SortOrder,
		Recurrence:    cleanPtr(req.Recurrence),
		Priority:      req.Priority,
		DueText:       cleanPtr(req.DueText),
		DueDeadline:   cleanPtr(req.DueDeadline),
		ScheduleInput: cleanPtr(req.ScheduleInput),
	}
	if req.Labels != nil {
		labels := cleanStringSlice(req.Labels)
		input.Labels = &labels
	}

	updated, err := a.tasks.Update(ctx, id, input)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (a *API) handleCloseTask(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "task id is required"), "taskId"))
		return
	}

	ctx := task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone")))
	if err := a.tasks.Close(ctx, id); err != nil {
		writeAPIError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleReopenTask(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "task id is required"), "taskId"))
		return
	}

	if err := a.tasks.Reopen(r.Context(), id); err != nil {
		writeAPIError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}

	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "task id is required"), "taskId"))
		return
	}

	if err := a.tasks.Delete(r.Context(), id); err != nil {
		writeAPIError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api") || r.URL.Path == "/api/health" {
			next.ServeHTTP(w, r)
			return
		}

		if r.URL.Path == "/api/auth/login" || r.URL.Path == "/api/auth/logout" {
			ctx := context.WithValue(r.Context(), ctxKeyScope, ScopeWrite)
			ctx = sessionctx.WithPrincipal(ctx, sessionctx.PrincipalFromContext(ctx))
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if principal, ok := a.readSessionPrincipal(r); ok {
			scope := ScopeRead
			if isWriteRequest(r.Method) {
				scope = ScopeWrite
			}
			ctx := context.WithValue(r.Context(), ctxKeyScope, scope)
			ctx = sessionctx.WithPrincipal(ctx, principal)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if !a.cfg.RequireAuth {
			scope := ScopeRead
			if isWriteRequest(r.Method) {
				scope = ScopeWrite
			}
			ctx := context.WithValue(r.Context(), ctxKeyScope, scope)
			ctx = sessionctx.WithPrincipal(ctx, sessionctx.PrincipalFromContext(ctx))
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		token, ok := bearerToken(r.Header.Get("Authorization"))
		if !ok {
			writeAPIError(w, apperrors.New(apperrors.CodeUnauthorized, "missing or invalid authorization header"))
			return
		}

		scope := ScopeRead
		switch token {
		case a.cfg.WriteToken:
			scope = ScopeWrite
		case a.cfg.ReadOnlyToken:
			scope = ScopeRead
		default:
			writeAPIError(w, apperrors.New(apperrors.CodeUnauthorized, "invalid api token"))
			return
		}

		ctx := context.WithValue(r.Context(), ctxKeyScope, scope)
		ctx = sessionctx.WithPrincipal(ctx, sessionctx.PrincipalFromContext(ctx))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func isWriteRequest(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return false
	default:
		return true
	}
}

func (a *API) readSessionPrincipal(r *http.Request) (sessionctx.Principal, bool) {
	cookie, err := r.Cookie(authSessionCookieName)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		return sessionctx.Principal{}, false
	}

	value := map[string]string{}
	if err := a.cookies.Decode(authSessionCookieName, cookie.Value, &value); err != nil {
		return sessionctx.Principal{}, false
	}

	userID := strings.TrimSpace(value["userId"])
	if userID == "" {
		return sessionctx.Principal{}, false
	}

	principal := sessionctx.Principal{
		UserID:      userID,
		WorkspaceID: strings.TrimSpace(value["workspaceId"]),
		Email:       strings.TrimSpace(value["email"]),
	}
	if principal.WorkspaceID == "" {
		principal.WorkspaceID = sessionctx.DefaultWorkspaceID
	}
	return principal, true
}

func (a *API) writeSessionCookie(w http.ResponseWriter, principal sessionctx.Principal) error {
	if strings.TrimSpace(principal.UserID) == "" {
		return fmt.Errorf("user id is required")
	}
	if strings.TrimSpace(principal.WorkspaceID) == "" {
		principal.WorkspaceID = sessionctx.DefaultWorkspaceID
	}
	value := map[string]string{
		"userId":      strings.TrimSpace(principal.UserID),
		"workspaceId": strings.TrimSpace(principal.WorkspaceID),
		"email":       strings.TrimSpace(principal.Email),
	}
	encoded, err := a.cookies.Encode(authSessionCookieName, value)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     authSessionCookieName,
		Value:    encoded,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400 * 30,
	})
	return nil
}

func (a *API) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     authSessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func (a *API) rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Force-Rate-Limit")), "true") {
			w.Header().Set("Retry-After", "60")
			writeAPIError(w, apperrors.New(apperrors.CodeRateLimited, "rate limit exceeded"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *API) requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := strings.TrimSpace(r.Header.Get(requestIDHeader))
		if requestID == "" {
			requestID = uuid.NewString()
		}
		w.Header().Set(requestIDHeader, requestID)
		ctx := context.WithValue(r.Context(), ctxKeyRequestID, requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (a *API) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lw := &loggingResponseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(lw, r)

		a.logger.Info("http_request",
			slog.String("request_id", requestIDFromContext(r.Context())),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", lw.status),
			slog.Int("bytes", lw.bytesWritten),
			slog.Int64("duration_ms", time.Since(start).Milliseconds()),
		)
	})
}

func (a *API) recoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				a.logger.Error("panic_recovered",
					slog.String("request_id", requestIDFromContext(r.Context())),
					slog.Any("panic", recovered),
				)
				writeAPIError(w, apperrors.New(apperrors.CodeInternal, "internal server error"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func chain(middlewares ...func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		for i := len(middlewares) - 1; i >= 0; i-- {
			next = middlewares[i](next)
		}
		return next
	}
}

func writeAPIError(w http.ResponseWriter, err error) {
	status := apperrors.StatusCode(err)
	body := map[string]any{
		"error": map[string]any{
			"code": apperrors.CodeInternal,
		},
	}

	var appErr *apperrors.AppError
	if ok := asAppError(err, &appErr); ok {
		body["error"] = map[string]any{
			"code": appErr.Code,
		}
		if appErr.Field != "" {
			body["error"].(map[string]any)["field"] = appErr.Field
		}
		if appErr.Message != "" {
			body["error"].(map[string]any)["message"] = appErr.Message
		}
	}

	writeJSON(w, status, body)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func decodeJSON(r *http.Request, out any) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		return fmt.Errorf("empty body")
	}
	if err := json.Unmarshal(body, out); err != nil {
		return err
	}
	return nil
}

func bearerToken(header string) (string, bool) {
	header = strings.TrimSpace(header)
	if header == "" {
		return "", false
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return "", false
	}
	token := strings.TrimSpace(strings.TrimPrefix(header, prefix))
	if token == "" {
		return "", false
	}
	return token, true
}

func requireWriteScope(ctx context.Context) error {
	scope, _ := ctx.Value(ctxKeyScope).(Scope)
	if scope == ScopeWrite || scope == "" {
		return nil
	}
	return apperrors.New(apperrors.CodeForbidden, "insufficient scope")
}

func requestIDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(ctxKeyRequestID).(string)
	return id
}

func ptrOrNil(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	v := value
	return &v
}

func cleanPtr(value *string) *string {
	if value == nil {
		return nil
	}
	v := strings.TrimSpace(*value)
	if v == "" {
		return nil
	}
	return &v
}

func cleanStringSlice(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	cleaned := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		cleaned = append(cleaned, trimmed)
	}
	return cleaned
}

func parseIntOrDefault(raw string, fallback int) int {
	if strings.TrimSpace(raw) == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func parseBoolOrDefault(raw string, fallback bool) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return fallback
	}
}

func boardIDFromRequest(r *http.Request) string {
	return strings.TrimSpace(r.URL.Query().Get("board"))
}

func ptrInt64Value(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func asAppError(err error, target **apperrors.AppError) bool {
	if err == nil {
		return false
	}
	appErr, ok := err.(*apperrors.AppError)
	if ok {
		*target = appErr
		return true
	}
	return false
}

type loggingResponseWriter struct {
	http.ResponseWriter
	status       int
	bytesWritten int
}

func (w *loggingResponseWriter) WriteHeader(statusCode int) {
	w.status = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *loggingResponseWriter) Write(p []byte) (int, error) {
	n, err := w.ResponseWriter.Write(p)
	w.bytesWritten += n
	return n, err
}

func newSPAHandler(content fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if cleanPath == "" || cleanPath == "." {
			http.ServeFileFS(w, r, content, "index.html")
			return
		}

		if hasStaticFile(content, cleanPath) {
			if strings.HasPrefix(cleanPath, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			http.ServeFileFS(w, r, content, cleanPath)
			return
		}

		http.ServeFileFS(w, r, content, "index.html")
	})
}

func hasStaticFile(content fs.FS, name string) bool {
	if !fs.ValidPath(name) {
		return false
	}
	stat, err := fs.Stat(content, name)
	if err != nil {
		return false
	}
	return !stat.IsDir()
}
