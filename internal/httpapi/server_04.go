package httpapi

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
	"donegeon/internal/task"
)

func (a *API) handleGetTask(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "task id is required"), "taskId"))
		return
	}

	ctx := task.WithTimezone(r.Context(), strings.TrimSpace(r.Header.Get("X-Timezone")))
	item, err := a.tasks.Get(ctx, id)
	if err != nil {
		a.logError(r, "get_task_failed", err)
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
		a.logError(r, "create_task_failed", err)
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
		Content:            cleanPtr(req.Content),
		Description:        cleanPtr(req.Description),
		ProjectID:          cleanPtr(req.ProjectID),
		SectionID:          cleanPtr(req.SectionID),
		SortOrder:          req.SortOrder,
		Recurrence:         cleanPtr(req.Recurrence),
		ClearRecurrence:    req.Recurrence != nil && strings.TrimSpace(*req.Recurrence) == "",
		Priority:           req.Priority,
		DueText:            cleanPtr(req.DueText),
		ClearDueText:       req.DueText != nil && strings.TrimSpace(*req.DueText) == "",
		DueDeadline:        cleanPtr(req.DueDeadline),
		ClearDueDeadline:   req.DueDeadline != nil && strings.TrimSpace(*req.DueDeadline) == "",
		ScheduleInput:      cleanPtr(req.ScheduleInput),
		ClearScheduleInput: req.ScheduleInput != nil && strings.TrimSpace(*req.ScheduleInput) == "",
	}
	if req.Labels != nil {
		labels := cleanStringSlice(req.Labels)
		input.Labels = &labels
	}

	updated, err := a.tasks.Update(ctx, id, input)
	if err != nil {
		a.logError(r, "update_task_failed", err)
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
		a.logError(r, "close_task_failed", err)
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
		a.logError(r, "reopen_task_failed", err)
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
		a.logError(r, "delete_task_failed", err)
		writeAPIError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleListCalendarConnections(w http.ResponseWriter, r *http.Request) {
	if a.calendars == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "calendar service unavailable"))
		return
	}
	items, err := a.calendars.ListConnections(r.Context())
	if err != nil {
		a.logError(r, "list_calendar_connections_failed", err)
		writeAPIError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (a *API) handleCreateCalendarConnect(w http.ResponseWriter, r *http.Request) {
	if a.calendars == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "calendar service unavailable"))
		return
	}
	provider := strings.TrimSpace(r.PathValue("provider"))
	if provider == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "calendar provider is required"), "provider"))
		return
	}
	authURL, err := a.calendars.BeginConnect(r.Context(), provider)
	if err != nil {
		a.logError(r, "begin_calendar_connect_failed", err)
		writeAPIError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"provider": strings.ToLower(provider),
		"authUrl":  authURL,
	})
}

func (a *API) handleCalendarConnectCallback(w http.ResponseWriter, r *http.Request) {
	if a.calendars == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "calendar service unavailable"))
		return
	}
	provider := strings.TrimSpace(r.PathValue("provider"))
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	redirectBase := strings.TrimRight(a.cfg.AppBaseURL, "/") + "/profile"
	if provider == "" || state == "" || code == "" {
		http.Redirect(w, r, redirectBase+"?calendar=error&message="+url.QueryEscape("Calendar connect callback is missing required values"), http.StatusFound)
		return
	}
	if _, err := a.calendars.CompleteConnect(r.Context(), provider, state, code); err != nil {
		a.logError(r, "complete_calendar_connect_failed", err)
		http.Redirect(w, r, redirectBase+"?calendar=error&message="+url.QueryEscape(err.Error()), http.StatusFound)
		return
	}
	http.Redirect(w, r, redirectBase+"?calendar=connected&provider="+url.QueryEscape(strings.ToLower(provider)), http.StatusFound)
}

func (a *API) handleDeleteCalendarConnection(w http.ResponseWriter, r *http.Request) {
	if a.calendars == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "calendar service unavailable"))
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "connection id is required"), "connectionId"))
		return
	}
	if err := a.calendars.DeleteConnection(r.Context(), id); err != nil {
		a.logError(r, "delete_calendar_connection_failed", err)
		writeAPIError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleSyncCalendars(w http.ResponseWriter, r *http.Request) {
	if a.calendars == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "calendar service unavailable"))
		return
	}
	var req struct {
		ConnectionID string `json:"connectionId"`
	}
	if err := decodeJSON(r, &req); err != nil && !errors.Is(err, io.EOF) && !strings.Contains(strings.ToLower(err.Error()), "empty body") {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	result, err := a.calendars.SyncConnections(r.Context(), strings.TrimSpace(req.ConnectionID))
	if err != nil {
		a.logError(r, "sync_calendar_failed", err)
		writeAPIError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *API) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logState := requestLogStateFromContext(r.Context())

		if !strings.HasPrefix(r.URL.Path, "/api") || r.URL.Path == "/api/health" {
			next.ServeHTTP(w, r)
			return
		}

		if r.URL.Path == "/api/auth/login" ||
			r.URL.Path == "/api/auth/login/request" ||
			r.URL.Path == "/api/auth/login/verify" ||
			r.URL.Path == "/api/auth/invitation" ||
			r.URL.Path == "/api/auth/logout" ||
			r.URL.Path == "/api/public/config" ||
			r.URL.Path == "/api/public/waitlist" ||
			r.URL.Path == "/api/billing/webhook" {
			scope := ScopeWrite
			if !isWriteRequest(r.Method) {
				scope = ScopeRead
			}
			if logState != nil {
				logState.Scope = scope
				logState.AuthSource = "public"
			}
			ctx := context.WithValue(r.Context(), ctxKeyScope, scope)
			ctx = sessionctx.WithPrincipal(ctx, sessionctx.PrincipalFromContext(ctx))
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if principal, ok, extended := a.readSessionPrincipal(r); ok {
			if logState != nil {
				logState.Principal = principal
				logState.Authenticated = true
				logState.AuthSource = "session"
				logState.HasSessionCookie = true
				logState.SessionExtended = extended
			}
			if extended {
				if sessionID, sidOk := a.readSessionID(r); sidOk {
					_ = a.writeSessionCookie(w, r, sessionID)
				}
			}
			scope := ScopeRead
			if isWriteRequest(r.Method) {
				if strings.HasPrefix(r.URL.Path, "/api/auth/") || a.accounts == nil {
					scope = ScopeWrite
				} else {
					canWrite, err := a.accounts.CanWriteWorkspace(r.Context(), principal.UserID, principal.WorkspaceID)
					if err != nil {
						a.logError(r, "workspace_write_access_check_failed", err)
						writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to evaluate workspace permissions"))
						return
					}
					if canWrite {
						scope = ScopeWrite
					}
				}
			}
			if logState != nil {
				logState.Scope = scope
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
			if logState != nil {
				logState.Scope = scope
				logState.AuthSource = "auth_disabled"
				logState.Principal = sessionctx.PrincipalFromContext(r.Context())
			}
			ctx := context.WithValue(r.Context(), ctxKeyScope, scope)
			ctx = sessionctx.WithPrincipal(ctx, sessionctx.PrincipalFromContext(ctx))
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		token, ok := bearerToken(r.Header.Get("Authorization"))
		if !ok {
			if logState != nil {
				logState.Scope = inferredScopeFromMethod(r.Method)
				logState.AuthSource = "missing"
				logState.AuthFailureReason = "missing_or_invalid_authorization_header"
			}
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
			if logState != nil {
				logState.Scope = inferredScopeFromMethod(r.Method)
				logState.AuthSource = "bearer"
				logState.AuthFailureReason = "invalid_api_token"
			}
			writeAPIError(w, apperrors.New(apperrors.CodeUnauthorized, "invalid api token"))
			return
		}

		if logState != nil {
			logState.Scope = scope
			logState.Authenticated = true
			logState.AuthSource = "bearer"
			logState.Principal = sessionctx.PrincipalFromContext(r.Context())
		}
		ctx := context.WithValue(r.Context(), ctxKeyScope, scope)
		ctx = sessionctx.WithPrincipal(ctx, sessionctx.PrincipalFromContext(ctx))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
