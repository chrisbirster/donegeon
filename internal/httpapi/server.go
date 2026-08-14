package httpapi

import (
	"io/fs"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/securecookie"

	"donegeon/internal/account"
	"donegeon/internal/board"
	"donegeon/internal/calendar"
	"donegeon/internal/config"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/project"
	"donegeon/internal/quickadd"
	"donegeon/internal/sessionctx"
	"donegeon/internal/task"
	"donegeon/internal/taskmanagercompat"
)

const requestIDHeader = "X-Request-Id"
const authSessionCookieName = "donegeon_auth_session"
const openBetaStartsAt = "2026-06-01"
const openBetaStartsLabel = "June 1, 2026"
const waitlistDeliveryWarningMessage = "We saved your waitlist spot, but we couldn't send the confirmation email right now."

type ctxKey string

const (
	ctxKeyScope     ctxKey = "scope"
	ctxKeyRequestID ctxKey = "request_id"
	ctxKeyLogState  ctxKey = "request_log_state"
)

type Scope string

const (
	ScopeRead  Scope = "read"
	ScopeWrite Scope = "write"
)

type requestLogState struct {
	Scope             Scope
	Principal         sessionctx.Principal
	Authenticated     bool
	AuthSource        string
	HasSessionCookie  bool
	SessionExtended   bool
	AuthFailureReason string
}

type projectLogSnapshot struct {
	Total          int
	BoardCount     int
	InboxCount     int
	TeamBoardCount int
	ProjectIDs     []string
	ProjectNames   []string
}

type API struct {
	logger               *slog.Logger
	cfg                  config.Config
	tasks                *task.Service
	projects             *project.Service
	boards               *board.Service
	calendars            *calendar.Service
	parser               *quickadd.Parser
	taskManager          *taskmanagercompat.Service
	accounts             *account.Service
	webHandler           http.Handler
	cookies              *securecookie.SecureCookie
	quickAddParseLimiter *tokenBucketLimiter
}

func New(
	logger *slog.Logger,
	cfg config.Config,
	tasks *task.Service,
	projects *project.Service,
	boards *board.Service,
	calendars *calendar.Service,
	parser *quickadd.Parser,
	taskManager *taskmanagercompat.Service,
	accounts *account.Service,
	staticFS fs.FS,
) http.Handler {
	api := &API{
		logger:      logger,
		cfg:         cfg,
		tasks:       tasks,
		projects:    projects,
		boards:      boards,
		calendars:   calendars,
		parser:      parser,
		taskManager: taskManager,
		accounts:    accounts,
		webHandler:  newSPAHandler(staticFS),
		cookies:     securecookie.New([]byte(cfg.CookieSigningKey), nil),
		quickAddParseLimiter: newTokenBucketLimiter(
			quickAddParseLimitRatePerSecond,
			quickAddParseLimitBurst,
			quickAddParseLimiterTTL,
		),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", api.handleHealth)
	mux.HandleFunc("GET /api/public/config", api.handlePublicConfig)
	mux.HandleFunc("POST /api/public/waitlist", api.handlePublicWaitlist)
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
	mux.HandleFunc("POST /api/billing/portal", api.handleCreateBillingPortalSession)
	mux.HandleFunc("POST /api/billing/trial/end", api.handleEndBillingTrial)
	mux.HandleFunc("GET /api/billing/store", api.handleBillingStoreCatalog)
	mux.HandleFunc("POST /api/billing/store/checkout", api.handleCreateBillingStoreCheckout)
	mux.HandleFunc("POST /api/billing/webhook", api.handleBillingWebhook)
	mux.HandleFunc("POST /api/rrule/parse", api.handleParseRRule)
	mux.HandleFunc("POST /api/quick-add/parse", api.handleParseQuickAdd)
	mux.HandleFunc("POST /api/tasks/quick-add", api.handleQuickAddTask)
	mux.HandleFunc("POST /api/taskmanager/action", api.handleTaskManagerAction)
	mux.HandleFunc("GET /api/tasks", api.handleListTasks)
	mux.HandleFunc("GET /api/projects", api.handleListProjects)
	mux.HandleFunc("POST /api/projects", api.handleCreateProject)
	mux.HandleFunc("GET /api/board/state", api.handleGetBoardState)
	mux.HandleFunc("POST /api/board/cmd", api.handleBoardCommand)
	mux.HandleFunc("GET /api/board/members", api.handleListBoardMembers)
	mux.HandleFunc("POST /api/board/members", api.handleCreateBoardMember)
	mux.HandleFunc("DELETE /api/board/members/{userId}", api.handleDeleteBoardMember)
	mux.HandleFunc("GET /api/calendar/connections", api.handleListCalendarConnections)
	mux.HandleFunc("POST /api/calendar/connect/{provider}", api.handleCreateCalendarConnect)
	mux.HandleFunc("GET /api/calendar/callback/{provider}", api.handleCalendarConnectCallback)
	mux.HandleFunc("DELETE /api/calendar/connections/{id}", api.handleDeleteCalendarConnection)
	mux.HandleFunc("POST /api/calendar/sync", api.handleSyncCalendars)
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

func (a *API) handlePublicConfig(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"config": map[string]any{
			"openBeta":            a.cfg.OpenBeta,
			"openBetaStartsAt":    openBetaStartsAt,
			"openBetaStartsLabel": openBetaStartsLabel,
		},
	})
}

func (a *API) handlePublicWaitlist(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		Name          string `json:"name"`
		Email         string `json:"email"`
		Source        string `json:"source"`
		RequestedPlan string `json:"requestedPlan"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	source := strings.TrimSpace(req.Source)
	if source == "" {
		source = "app"
	}

	signup, alreadyJoined, err := a.accounts.JoinWaitlist(
		r.Context(),
		strings.TrimSpace(req.Name),
		strings.TrimSpace(req.Email),
		source,
		strings.TrimSpace(req.RequestedPlan),
	)
	if err != nil {
		field := "email"
		if strings.Contains(strings.ToLower(err.Error()), "name") {
			field = "name"
		}
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), field))
		return
	}

	deliveryWarning := ""
	if !alreadyJoined {
		if err := a.sendWaitlistConfirmationEmail(r.Context(), signup.Email, signup.Name, signup.RequestedPlan); err != nil {
			deliveryWarning = waitlistDeliveryWarningMessage
			a.logError(r, "send_waitlist_confirmation_failed", err)
		}
	}

	status := http.StatusCreated
	if alreadyJoined {
		status = http.StatusOK
	}

	a.logInfo(r, "waitlist_signup_recorded",
		slog.String("waitlist_id", signup.ID),
		slog.String("waitlist_email", signup.Email),
		slog.String("waitlist_name", signup.Name),
		slog.String("waitlist_source", signup.Source),
		slog.String("waitlist_requested_plan", signup.RequestedPlan),
		slog.Bool("already_joined", alreadyJoined),
		slog.Bool("delivery_warning", deliveryWarning != ""),
	)

	writeJSON(w, status, map[string]any{
		"signup":              signup,
		"alreadyJoined":       alreadyJoined,
		"deliveryWarning":     deliveryWarning,
		"openBetaStartsAt":    openBetaStartsAt,
		"openBetaStartsLabel": openBetaStartsLabel,
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

	a.logInfo(r, "auth_login_requested",
		slog.String("challenge_id", challenge.ID),
		slog.String("email", challenge.Email),
		slog.String("delivery", strings.TrimSpace(response["delivery"].(string))),
		slog.Bool("debug_code_enabled", a.cfg.AuthDebugCode),
		slog.Bool("delivery_warning", sendErr != nil),
	)
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
	if err := a.writeSessionCookie(w, r, webSession.ID); err != nil {
		a.logError(r, "write_session_cookie_failed", err)
		_ = a.accounts.RevokeAuthSession(r.Context(), webSession.ID)
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to set auth session"))
		return
	}

	a.logInfo(r, "auth_login_verified",
		append(sessionLogAttrs(session),
			slog.String("challenge_id", strings.TrimSpace(req.ChallengeID)),
			slog.Bool("invitation_applied", strings.TrimSpace(req.InvitationCode) != ""),
			slog.Bool("auth_session_created", true),
		)...,
	)

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
	a.logDebug(r, "auth_me_state", sessionLogAttrs(session)...)
	writeJSON(w, http.StatusOK, map[string]any{"session": session})
}
