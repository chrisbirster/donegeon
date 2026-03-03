package httpapi

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"net/url"
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
	"donegeon/internal/tenant"
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
	mux.HandleFunc("POST /api/auth/login", api.handleAuthLoginRequest)
	mux.HandleFunc("POST /api/auth/login/request", api.handleAuthLoginRequest)
	mux.HandleFunc("POST /api/auth/login/verify", api.handleAuthLoginVerify)
	mux.HandleFunc("GET /api/auth/invitation", api.handleAuthInvitation)
	mux.HandleFunc("GET /api/auth/me", api.handleAuthMe)
	mux.HandleFunc("POST /api/auth/onboarding", api.handleAuthOnboarding)
	mux.HandleFunc("POST /api/auth/logout", api.handleAuthLogout)
	mux.HandleFunc("GET /api/team/settings", api.handleTeamSettings)
	mux.HandleFunc("PATCH /api/team/settings", api.handlePatchTeamSettings)
	mux.HandleFunc("POST /api/team/invitations", api.handleCreateTeamInvitation)
	mux.HandleFunc("POST /api/team/invitations/accept", api.handleAcceptTeamInvitation)
	mux.HandleFunc("DELETE /api/team/invitations/{code}", api.handleDeleteTeamInvitation)
	mux.HandleFunc("PATCH /api/team/members/{userId}", api.handlePatchTeamMember)
	mux.HandleFunc("DELETE /api/team/members/{userId}", api.handleDeleteTeamMember)
	mux.HandleFunc("GET /api/billing/status", api.handleBillingStatus)
	mux.HandleFunc("POST /api/billing/checkout", api.handleCreateBillingCheckout)
	mux.HandleFunc("POST /api/billing/webhook", api.handleBillingWebhook)
	mux.HandleFunc("POST /api/rrule/parse", api.handleParseRRule)
	mux.HandleFunc("POST /api/quick-add/parse", api.handleParseQuickAdd)
	mux.HandleFunc("POST /api/tasks/quick-add", api.handleQuickAddTask)
	mux.HandleFunc("POST /api/todoist/action", api.handleTodoistAction)
	mux.HandleFunc("GET /api/tasks", api.handleListTasks)
	mux.HandleFunc("GET /api/projects", api.handleListProjects)
	mux.HandleFunc("POST /api/projects", api.handleCreateProject)
	mux.HandleFunc("GET /api/board/state", api.handleGetBoardState)
	mux.HandleFunc("POST /api/board/cmd", api.handleBoardCommand)
	mux.HandleFunc("GET /api/board/members", api.handleListBoardMembers)
	mux.HandleFunc("POST /api/board/members", api.handleCreateBoardMember)
	mux.HandleFunc("DELETE /api/board/members/{userId}", api.handleDeleteBoardMember)
	mux.HandleFunc("PATCH /api/projects/{id}", api.handlePatchProject)
	mux.HandleFunc("DELETE /api/projects/{id}", api.handleDeleteProject)
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
		api.corsMiddleware,
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

func (a *API) handleAuthLoginRequest(w http.ResponseWriter, r *http.Request) {
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

	challenge, code, err := a.accounts.BeginEmailLogin(
		r.Context(),
		strings.TrimSpace(req.Email),
		strings.TrimSpace(req.Name),
		a.cfg.AuthCodePepper,
		a.cfg.AuthCodeTTL,
		a.cfg.AuthCodeLength,
		clientIPFromRequest(r),
		strings.TrimSpace(r.UserAgent()),
	)
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "email"))
		return
	}

	sendErr := a.sendLoginCodeEmail(r.Context(), challenge.Email, code, challenge.ExpiresAt)
	if sendErr != nil && !a.cfg.AuthDebugCode {
		a.logError(r, "send_login_code_failed", sendErr)
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to deliver login code"))
		return
	}

	response := map[string]any{
		"challengeId": challenge.ID,
		"expiresAt":   challenge.ExpiresAt,
		"delivery":    "email",
	}
	if a.cfg.AuthDebugCode {
		response["debugCode"] = code
	}
	if sendErr != nil && a.cfg.AuthDebugCode {
		response["deliveryWarning"] = sendErr.Error()
	}
	writeJSON(w, http.StatusOK, response)
}

func (a *API) handleAuthLoginVerify(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		ChallengeID    string `json:"challengeId"`
		Code           string `json:"code"`
		InvitationCode string `json:"invitationCode"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	session, err := a.accounts.VerifyEmailLogin(
		r.Context(),
		strings.TrimSpace(req.ChallengeID),
		strings.TrimSpace(req.Code),
		a.cfg.AuthCodePepper,
		a.cfg.AuthMaxCodeAttempts,
	)
	if err != nil {
		field := "code"
		if strings.TrimSpace(req.ChallengeID) == "" {
			field = "challengeId"
		}
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), field))
		return
	}

	if inviteCode := strings.TrimSpace(req.InvitationCode); inviteCode != "" {
		nextSession, acceptErr := a.accounts.AcceptInvitation(r.Context(), session.User.ID, inviteCode)
		if acceptErr != nil {
			writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, acceptErr.Error()), "invitationCode"))
			return
		}
		session = nextSession
	}

	principal := sessionctx.Principal{
		UserID: session.User.ID,
		Email:  session.User.Email,
	}
	if session.User.CurrentWorkspace != nil {
		principal.WorkspaceID = strings.TrimSpace(*session.User.CurrentWorkspace)
	}

	webSession, err := a.accounts.CreateAuthSession(
		r.Context(),
		principal,
		a.cfg.AuthSessionTTL,
		strings.TrimSpace(r.UserAgent()),
		clientIPFromRequest(r),
	)
	if err != nil {
		a.logError(r, "create_auth_session_failed", err)
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to start auth session"))
		return
	}
	if err := a.writeSessionCookie(w, webSession.ID); err != nil {
		a.logError(r, "write_session_cookie_failed", err)
		_ = a.accounts.RevokeAuthSession(r.Context(), webSession.ID)
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to set auth session"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"session": session})
}

func (a *API) handleAuthInvitation(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	invitationCode := strings.TrimSpace(r.URL.Query().Get("code"))
	if invitationCode == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invitation code is required"), "invitationCode"))
		return
	}

	invitation, err := a.accounts.InvitationForLogin(r.Context(), invitationCode)
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "invitationCode"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"invitation": invitation})
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
		Name     string   `json:"name"`
		Emails   []string `json:"emails"`
		Plan     string   `json:"plan"`
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
		strings.TrimSpace(req.Name),
		req.Emails,
		strings.TrimSpace(req.Plan),
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
	if sessionID, ok := a.readSessionID(r); ok {
		if err := a.accounts.UpdateAuthSessionPrincipal(r.Context(), sessionID, newPrincipal); err != nil {
			a.logError(r, "update_auth_session_failed", err)
			writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to update auth session"))
			return
		}
	}

	trimmedTeamName := strings.TrimSpace(req.TeamName)
	for _, inv := range invites {
		if err := a.sendInviteEmail(r.Context(), inv.Email, trimmedTeamName, inv.InvitationCode); err != nil {
			a.logError(r, "send_invite_email_failed", err)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"session":     session,
		"invitations": invites,
	})
}

func (a *API) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if a.accounts != nil {
		if sessionID, ok := a.readSessionID(r); ok {
			_ = a.accounts.RevokeAuthSession(r.Context(), sessionID)
		}
	}
	a.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleTeamSettings(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	settings, err := a.accounts.GetTeamSettings(r.Context(), principal.UserID, principal.WorkspaceID)
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, err.Error()))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"settings": settings,
	})
}

func (a *API) handlePatchTeamSettings(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		TeamName string `json:"teamName"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	team, err := a.accounts.UpdateTeamName(r.Context(), principal.UserID, principal.WorkspaceID, strings.TrimSpace(req.TeamName))
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "teamName"))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"team": team})
}

func (a *API) handleCreateTeamInvitation(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	invite, err := a.accounts.InviteMember(
		r.Context(),
		principal.UserID,
		principal.WorkspaceID,
		strings.TrimSpace(req.Email),
		strings.TrimSpace(req.Role),
	)
	if err != nil {
		field := "email"
		if strings.Contains(strings.ToLower(err.Error()), "role") {
			field = "role"
		}
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), field))
		return
	}

	teamName := "your team"
	if ws, wsErr := a.accounts.GetWorkspace(r.Context(), principal.WorkspaceID); wsErr == nil && strings.TrimSpace(ws.Name) != "" {
		teamName = strings.TrimSpace(ws.Name)
	}
	if err := a.sendInviteEmail(r.Context(), invite.Email, teamName, invite.InvitationCode); err != nil {
		a.logError(r, "send_invite_email_failed", err)
	}

	writeJSON(w, http.StatusCreated, map[string]any{"invitation": invite})
}

func (a *API) handleAcceptTeamInvitation(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		InvitationCode string `json:"invitationCode"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	session, err := a.accounts.AcceptInvitation(r.Context(), principal.UserID, strings.TrimSpace(req.InvitationCode))
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "invitationCode"))
		return
	}

	if sessionID, ok := a.readSessionID(r); ok {
		nextPrincipal := sessionctx.Principal{
			UserID: session.User.ID,
			Email:  session.User.Email,
		}
		if session.User.CurrentWorkspace != nil {
			nextPrincipal.WorkspaceID = strings.TrimSpace(*session.User.CurrentWorkspace)
		}
		if err := a.accounts.UpdateAuthSessionPrincipal(r.Context(), sessionID, nextPrincipal); err != nil {
			a.logError(r, "update_auth_session_after_accept_failed", err)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"session": session})
}

func (a *API) handleDeleteTeamInvitation(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	code := strings.TrimSpace(r.PathValue("code"))
	if code == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "invitation code is required"), "code"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	if err := a.accounts.CancelInvitation(r.Context(), principal.UserID, principal.WorkspaceID, code); err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "code"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handlePatchTeamMember(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	userID := strings.TrimSpace(r.PathValue("userId"))
	if userID == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "user id is required"), "userId"))
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	member, err := a.accounts.UpdateMemberRole(r.Context(), principal.UserID, principal.WorkspaceID, userID, req.Role)
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "role"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"member": member})
}

func (a *API) handleDeleteTeamMember(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	userID := strings.TrimSpace(r.PathValue("userId"))
	if userID == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "user id is required"), "userId"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	if err := a.accounts.RemoveMember(r.Context(), principal.UserID, principal.WorkspaceID, userID); err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "userId"))
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleBillingStatus(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}
	principal := sessionctx.PrincipalFromContext(r.Context())
	workspaceID := strings.TrimSpace(principal.WorkspaceID)
	if workspaceID == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "workspace is required"), "workspaceId"))
		return
	}

	team, err := a.accounts.GetWorkspace(r.Context(), workspaceID)
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, err.Error()))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"team": team})
}

func (a *API) handleCreateBillingCheckout(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		Plan string `json:"plan"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}
	plan := normalizeBillingPlan(req.Plan)
	if plan == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "plan must be one of personal, pro_trial, pro, enterprise"), "plan"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	workspaceID := strings.TrimSpace(principal.WorkspaceID)
	if workspaceID == "" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "workspace is required"), "workspaceId"))
		return
	}

	if plan == account.PlanProTrial {
		team, err := a.accounts.BeginProTrial(r.Context(), workspaceID)
		if err != nil {
			writeAPIError(w, apperrors.New(apperrors.CodeValidationError, err.Error()))
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"mode": "trial_started",
			"team": team,
		})
		return
	}
	if plan == account.PlanEnterprise {
		writeJSON(w, http.StatusOK, map[string]any{
			"mode":       "contact_sales",
			"contactUrl": "mailto:sales@donegeon.com",
		})
		return
	}
	if plan == account.PlanPersonal {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "use team settings to downgrade after subscription cancellation"), "plan"))
		return
	}

	if strings.TrimSpace(a.cfg.StripeSecretKey) == "" || strings.TrimSpace(a.cfg.StripeProPriceID) == "" {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "stripe checkout is not configured"))
		return
	}

	team, err := a.accounts.GetWorkspace(r.Context(), workspaceID)
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, err.Error()))
		return
	}

	email := strings.TrimSpace(principal.Email)
	if email == "" {
		session, sessionErr := a.accounts.GetSession(r.Context(), principal.UserID)
		if sessionErr == nil {
			email = strings.TrimSpace(session.User.Email)
		}
	}
	checkoutURL, err := a.createStripeCheckoutSession(r.Context(), stripeCheckoutInput{
		WorkspaceID:      workspaceID,
		WorkspaceName:    team.Name,
		Plan:             plan,
		CustomerEmail:    email,
		ExistingCustomer: strings.TrimSpace(ptrString(team.StripeCustomerID)),
	})
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, err.Error()))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"mode":        "stripe_checkout",
		"checkoutUrl": checkoutURL,
	})
}

func (a *API) handleBillingWebhook(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}
	if strings.TrimSpace(a.cfg.StripeWebhookSecret) == "" {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "stripe webhook secret is not configured"))
		return
	}

	payload, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid webhook payload"))
		return
	}
	if !verifyStripeSignature(r.Header.Get("Stripe-Signature"), a.cfg.StripeWebhookSecret, payload) {
		writeAPIError(w, apperrors.New(apperrors.CodeUnauthorized, "invalid stripe signature"))
		return
	}

	var event struct {
		Type string `json:"type"`
		Data struct {
			Object map[string]any `json:"object"`
		} `json:"data"`
	}
	if err := json.Unmarshal(payload, &event); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid stripe event json"))
		return
	}

	switch strings.TrimSpace(event.Type) {
	case "checkout.session.completed":
		obj := event.Data.Object
		metadata := stripeObjectMap(obj, "metadata")
		workspaceID := stripeObjectString(obj, "client_reference_id")
		if workspaceID == "" {
			workspaceID = stripeMapString(metadata, "workspace_id")
		}
		subscriptionID := stripeObjectString(obj, "subscription")
		customerID := stripeObjectString(obj, "customer")
		email := stripeObjectString(obj, "customer_email")
		if email == "" {
			email = stripeMapString(stripeObjectMap(obj, "customer_details"), "email")
		}
		if workspaceID == "" || subscriptionID == "" {
			writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "missing workspace or subscription in checkout event"))
			return
		}
		if _, err := a.accounts.ActivateProFromStripe(r.Context(), workspaceID, customerID, subscriptionID, a.cfg.StripeProPriceID, email); err != nil {
			a.logError(r, "stripe_checkout_complete_update_failed", err)
			writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to update workspace plan"))
			return
		}
	case "customer.subscription.deleted":
		subscriptionID := stripeObjectString(event.Data.Object, "id")
		if subscriptionID != "" {
			if err := a.accounts.DowngradePersonalByStripeSubscription(r.Context(), subscriptionID); err != nil {
				a.logError(r, "stripe_subscription_deleted_update_failed", err)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"received": true})
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
		a.logError(r, "quick_add_task_failed", err)
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
		a.logError(r, "todoist_dispatch_failed", err)
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
		Content:          cleanPtr(req.Content),
		Description:      cleanPtr(req.Description),
		ProjectID:        cleanPtr(req.ProjectID),
		SectionID:        cleanPtr(req.SectionID),
		SortOrder:        req.SortOrder,
		Recurrence:       cleanPtr(req.Recurrence),
		Priority:         req.Priority,
		DueText:          cleanPtr(req.DueText),
		ClearDueText:     req.DueText != nil && strings.TrimSpace(*req.DueText) == "",
		DueDeadline:      cleanPtr(req.DueDeadline),
		ClearDueDeadline: req.DueDeadline != nil && strings.TrimSpace(*req.DueDeadline) == "",
		ScheduleInput:    cleanPtr(req.ScheduleInput),
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

func (a *API) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api") || r.URL.Path == "/api/health" {
			next.ServeHTTP(w, r)
			return
		}

		if r.URL.Path == "/api/auth/login" ||
			r.URL.Path == "/api/auth/login/request" ||
			r.URL.Path == "/api/auth/login/verify" ||
			r.URL.Path == "/api/auth/invitation" ||
			r.URL.Path == "/api/auth/logout" ||
			r.URL.Path == "/api/billing/webhook" {
			scope := ScopeWrite
			if !isWriteRequest(r.Method) {
				scope = ScopeRead
			}
			ctx := context.WithValue(r.Context(), ctxKeyScope, scope)
			ctx = sessionctx.WithPrincipal(ctx, sessionctx.PrincipalFromContext(ctx))
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		if principal, ok, extended := a.readSessionPrincipal(r); ok {
			if extended {
				if sessionID, sidOk := a.readSessionID(r); sidOk {
					_ = a.writeSessionCookie(w, sessionID)
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

func (a *API) readSessionPrincipal(r *http.Request) (sessionctx.Principal, bool, bool) {
	if a.accounts == nil {
		return sessionctx.Principal{}, false, false
	}
	sessionID, ok := a.readSessionID(r)
	if !ok {
		return sessionctx.Principal{}, false, false
	}
	result, err := a.accounts.AuthSessionPrincipal(r.Context(), sessionID, a.cfg.AuthSessionTTL)
	if err != nil || !result.Authenticated {
		return sessionctx.Principal{}, false, false
	}
	return result.Principal, true, result.Extended
}

func (a *API) readSessionID(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(authSessionCookieName)
	if err != nil || strings.TrimSpace(cookie.Value) == "" {
		return "", false
	}

	value := map[string]string{}
	if err := a.cookies.Decode(authSessionCookieName, cookie.Value, &value); err != nil {
		return "", false
	}
	sessionID := strings.TrimSpace(value["sid"])
	if sessionID == "" {
		return "", false
	}
	return sessionID, true
}

func (a *API) writeSessionCookie(w http.ResponseWriter, sessionID string) error {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return fmt.Errorf("session id is required")
	}
	value := map[string]string{
		"sid": sessionID,
	}
	encoded, err := a.cookies.Encode(authSessionCookieName, value)
	if err != nil {
		return err
	}
	maxAge := int(a.cfg.AuthSessionTTL.Seconds())
	if maxAge <= 0 {
		maxAge = 86400 * 30
	}
	cookie := &http.Cookie{
		Name:     authSessionCookieName,
		Value:    encoded,
		Path:     "/",
		HttpOnly: true,
		SameSite: cookieSameSiteMode(a.cfg.CookieSameSite),
		Secure:   a.cfg.CookieSecure,
		MaxAge:   maxAge,
	}
	if strings.TrimSpace(a.cfg.CookieDomain) != "" {
		cookie.Domain = strings.TrimSpace(a.cfg.CookieDomain)
	}
	http.SetCookie(w, cookie)
	return nil
}

func (a *API) clearSessionCookie(w http.ResponseWriter) {
	cookie := &http.Cookie{
		Name:     authSessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: cookieSameSiteMode(a.cfg.CookieSameSite),
		Secure:   a.cfg.CookieSecure,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	}
	if strings.TrimSpace(a.cfg.CookieDomain) != "" {
		cookie.Domain = strings.TrimSpace(a.cfg.CookieDomain)
	}
	http.SetCookie(w, cookie)
}

func cookieSameSiteMode(raw string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}

func clientIPFromRequest(r *http.Request) string {
	forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		return strings.TrimSpace(host)
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func (a *API) sendLoginCodeEmail(ctx context.Context, to string, code string, expiresAt string) error {
	sendURL := strings.TrimSpace(a.cfg.EmailSendURL)
	if sendURL == "" {
		return fmt.Errorf("email sender is not configured")
	}

	payload := map[string]string{
		"to":        strings.TrimSpace(to),
		"otpCode":   strings.TrimSpace(code),
		"expiresAt": strings.TrimSpace(expiresAt),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sendURL, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	authHeader := strings.TrimSpace(a.cfg.EmailSendAuthHeader)
	authValue := strings.TrimSpace(a.cfg.EmailSendAuthValue)
	if authHeader != "" && authValue != "" {
		req.Header.Set(authHeader, authValue)
	}

	client := &http.Client{
		Timeout: a.cfg.RequestTimeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	message := strings.TrimSpace(string(body))
	if message == "" {
		message = "unknown email send error"
	}
	return fmt.Errorf("email sender returned %d: %s", resp.StatusCode, message)
}

func (a *API) sendInviteEmail(ctx context.Context, to string, teamName string, invitationCode string) error {
	sendURL := strings.TrimSpace(a.cfg.EmailSendURL)
	if sendURL == "" {
		return fmt.Errorf("email sender is not configured")
	}
	loginURL := strings.TrimSpace(a.cfg.AppBaseURL) + "/login"
	if code := strings.TrimSpace(invitationCode); code != "" {
		loginURL = loginURL + "?invite=" + url.QueryEscape(code)
	}

	subject := fmt.Sprintf("You've been invited to join %s on Donegeon", teamName)
	body := fmt.Sprintf(
		"Hi!\n\n"+
			"%s has invited you to collaborate on Donegeon.\n\n"+
			"Sign in or create your account to get started:\n"+
			"%s\n\n"+
			"Once you're logged in, the invitation will be waiting for you.\n\n"+
			"– Donegeon",
		teamName,
		loginURL,
	)

	payload := map[string]string{
		"to":      strings.TrimSpace(to),
		"subject": subject,
		"text":    body,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sendURL, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	authHeader := strings.TrimSpace(a.cfg.EmailSendAuthHeader)
	authValue := strings.TrimSpace(a.cfg.EmailSendAuthValue)
	if authHeader != "" && authValue != "" {
		req.Header.Set(authHeader, authValue)
	}

	client := &http.Client{
		Timeout: a.cfg.RequestTimeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	message := strings.TrimSpace(string(respBody))
	if message == "" {
		message = "unknown email send error"
	}
	return fmt.Errorf("email sender returned %d: %s", resp.StatusCode, message)
}

func (a *API) corsMiddleware(next http.Handler) http.Handler {
	allowedSet := make(map[string]bool, len(a.cfg.CorsAllowedOrigins))
	for _, o := range a.cfg.CorsAllowedOrigins {
		allowedSet[strings.TrimSpace(o)] = true
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin != "" && allowedSet[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")

			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id")
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
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

		attrs := []slog.Attr{
			slog.String("request_id", requestIDFromContext(r.Context())),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", lw.status),
			slog.Int("bytes", lw.bytesWritten),
			slog.Int64("duration_ms", time.Since(start).Milliseconds()),
		}

		switch {
		case lw.status >= 500:
			attrs = append(attrs, slog.String("response_body", strings.TrimSpace(string(lw.errBody))))
			a.logger.LogAttrs(r.Context(), slog.LevelError, "http_request", attrs...)
		case lw.status >= 400:
			attrs = append(attrs, slog.String("response_body", strings.TrimSpace(string(lw.errBody))))
			a.logger.LogAttrs(r.Context(), slog.LevelWarn, "http_request", attrs...)
		default:
			a.logger.LogAttrs(r.Context(), slog.LevelInfo, "http_request", attrs...)
		}
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

// logError logs an error with request context. Use this in handlers before
// calling writeAPIError when you want the underlying cause visible in logs.
func (a *API) logError(r *http.Request, msg string, err error) {
	a.logger.Error(msg,
		slog.String("request_id", requestIDFromContext(r.Context())),
		slog.String("method", r.Method),
		slog.String("path", r.URL.Path),
		slog.String("error", err.Error()),
	)
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

type stripeCheckoutInput struct {
	WorkspaceID      string
	WorkspaceName    string
	Plan             string
	CustomerEmail    string
	ExistingCustomer string
}

func (a *API) createStripeCheckoutSession(ctx context.Context, in stripeCheckoutInput) (string, error) {
	secret := strings.TrimSpace(a.cfg.StripeSecretKey)
	if secret == "" {
		return "", fmt.Errorf("stripe secret key is not configured")
	}
	priceID := strings.TrimSpace(a.cfg.StripeProPriceID)
	if priceID == "" {
		return "", fmt.Errorf("stripe pro price id is not configured")
	}
	successURL := strings.TrimSpace(a.cfg.StripeCheckoutSuccessURL)
	cancelURL := strings.TrimSpace(a.cfg.StripeCheckoutCancelURL)
	if successURL == "" || cancelURL == "" {
		return "", fmt.Errorf("stripe checkout urls are not configured")
	}

	form := url.Values{}
	form.Set("mode", "subscription")
	form.Set("success_url", successURL)
	form.Set("cancel_url", cancelURL)
	form.Set("client_reference_id", strings.TrimSpace(in.WorkspaceID))
	form.Set("allow_promotion_codes", "true")
	form.Set("line_items[0][price]", priceID)
	form.Set("line_items[0][quantity]", "1")
	form.Set("metadata[workspace_id]", strings.TrimSpace(in.WorkspaceID))
	form.Set("metadata[workspace_name]", strings.TrimSpace(in.WorkspaceName))
	form.Set("metadata[plan_target]", normalizeBillingPlan(in.Plan))
	form.Set("subscription_data[metadata][workspace_id]", strings.TrimSpace(in.WorkspaceID))
	form.Set("subscription_data[metadata][plan_target]", normalizeBillingPlan(in.Plan))
	if customer := strings.TrimSpace(in.ExistingCustomer); customer != "" {
		form.Set("customer", customer)
	} else if email := strings.TrimSpace(in.CustomerEmail); email != "" {
		form.Set("customer_email", email)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.stripe.com/v1/checkout/sessions", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(secret, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: a.cfg.RequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	var payload struct {
		URL   string `json:"url"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &payload)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return "", fmt.Errorf("stripe checkout failed: %s", strings.TrimSpace(payload.Error.Message))
		}
		return "", fmt.Errorf("stripe checkout failed with status %d", resp.StatusCode)
	}

	checkoutURL := strings.TrimSpace(payload.URL)
	if checkoutURL == "" {
		return "", fmt.Errorf("stripe did not return checkout url")
	}
	return checkoutURL, nil
}

func normalizeBillingPlan(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "free", account.PlanPersonal:
		return account.PlanPersonal
	case account.PlanProTrial:
		return account.PlanProTrial
	case account.PlanPro:
		return account.PlanPro
	case account.PlanEnterprise:
		return account.PlanEnterprise
	default:
		return ""
	}
}

func ptrString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func stripeObjectMap(object map[string]any, key string) map[string]any {
	if object == nil {
		return nil
	}
	raw, ok := object[key]
	if !ok {
		return nil
	}
	next, ok := raw.(map[string]any)
	if !ok {
		return nil
	}
	return next
}

func stripeObjectString(object map[string]any, key string) string {
	if object == nil {
		return ""
	}
	return stripeValueString(object[key])
}

func stripeMapString(object map[string]any, key string) string {
	if object == nil {
		return ""
	}
	return stripeValueString(object[key])
}

func stripeValueString(raw any) string {
	switch value := raw.(type) {
	case string:
		return strings.TrimSpace(value)
	case json.Number:
		return strings.TrimSpace(value.String())
	default:
		return ""
	}
}

func verifyStripeSignature(header string, secret string, payload []byte) bool {
	header = strings.TrimSpace(header)
	secret = strings.TrimSpace(secret)
	if header == "" || secret == "" || len(payload) == 0 {
		return false
	}

	var timestamp string
	signatures := make([]string, 0, 2)
	for _, part := range strings.Split(header, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		pieces := strings.SplitN(part, "=", 2)
		if len(pieces) != 2 {
			continue
		}
		key := strings.TrimSpace(pieces[0])
		value := strings.TrimSpace(pieces[1])
		if key == "t" {
			timestamp = value
			continue
		}
		if key == "v1" {
			signatures = append(signatures, value)
		}
	}
	if timestamp == "" || len(signatures) == 0 {
		return false
	}

	unixTime, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false
	}
	now := time.Now().Unix()
	if unixTime < now-300 || unixTime > now+300 {
		return false
	}

	signedPayload := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(signedPayload))
	expected := hex.EncodeToString(mac.Sum(nil))

	for _, signature := range signatures {
		if hmac.Equal([]byte(expected), []byte(signature)) {
			return true
		}
	}
	return false
}

func projectIDFromName(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	if name == "" {
		return ""
	}

	var b strings.Builder
	lastDash := false
	for _, ch := range name {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') {
			b.WriteRune(ch)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}

	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		return ""
	}
	return slug
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

func (a *API) requireBoardAccess(ctx context.Context, boardID string, write bool) (string, error) {
	if a.accounts == nil {
		return "", apperrors.New(apperrors.CodeInternal, "account service unavailable")
	}
	normalized, err := board.NormalizeBoardID(boardID)
	if err != nil {
		return "", err
	}
	normalized = strings.ToLower(strings.TrimSpace(normalized))
	if normalized == "" {
		normalized = board.DefaultBoardID
	}

	principal := sessionctx.PrincipalFromContext(ctx)
	var allowed bool
	if write {
		allowed, err = a.accounts.CanWriteBoard(ctx, principal.UserID, principal.WorkspaceID, normalized)
	} else {
		allowed, err = a.accounts.HasBoardAccess(ctx, principal.UserID, principal.WorkspaceID, normalized)
	}
	if err != nil {
		return "", err
	}
	if !allowed {
		msg := "no access to this board"
		if write {
			msg = "no write access to this board"
		}
		return "", apperrors.WithField(apperrors.New(apperrors.CodeForbidden, msg), "board")
	}
	return normalized, nil
}

func boardIDFromProjectID(projectID string) (string, bool, error) {
	slug := tenant.ProjectSlug(projectID)
	if !tenant.IsBoardProject(slug) {
		return "", false, nil
	}
	boardID := slug
	if strings.EqualFold(slug, "board") {
		boardID = board.DefaultBoardID
	}
	normalized, err := board.NormalizeBoardID(boardID)
	if err != nil {
		return "", true, err
	}
	normalized = strings.ToLower(strings.TrimSpace(normalized))
	if normalized == "" {
		normalized = board.DefaultBoardID
	}
	return normalized, true, nil
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

func asBoardMemberAppError(err error, field string) error {
	if err == nil {
		return nil
	}
	message := strings.TrimSpace(err.Error())
	code := apperrors.CodeValidationError
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "only team owners or admins"),
		strings.Contains(lower, "not a member of this team"),
		strings.Contains(lower, "no access to this board"),
		strings.Contains(lower, "cannot remove yourself"):
		code = apperrors.CodeForbidden
	}

	appErr := apperrors.New(code, message)
	if strings.TrimSpace(field) != "" {
		return apperrors.WithField(appErr, field)
	}
	return appErr
}

type loggingResponseWriter struct {
	http.ResponseWriter
	status       int
	bytesWritten int
	errBody      []byte // captured for error responses (4xx/5xx)
}

func (w *loggingResponseWriter) WriteHeader(statusCode int) {
	w.status = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *loggingResponseWriter) Write(p []byte) (int, error) {
	n, err := w.ResponseWriter.Write(p)
	w.bytesWritten += n
	// Capture response body for error statuses so the logging middleware can include it.
	if w.status >= 400 && len(w.errBody) < 2048 {
		w.errBody = append(w.errBody, p...)
	}
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
