package httpapi

import (
	"log/slog"
	"net/http"
	"strings"

	"donegeon/internal/account"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
)

func (a *API) handleAuthOnboarding(w http.ResponseWriter, r *http.Request) {
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	var req struct {
		PersonalBoardName string   `json:"personalBoardName"`
		TeamBoardName     string   `json:"teamBoardName"`
		TeamName          string   `json:"teamName"`
		Name              string   `json:"name"`
		Emails            []string `json:"emails"`
		Plan              string   `json:"plan"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	requestedPlan := strings.ToLower(strings.TrimSpace(req.Plan))
	switch requestedPlan {
	case "pro":
		requestedPlan = account.PlanProTrial
	case "free", account.PlanProTrial, account.PlanEnterprise, account.PlanPersonal:
		if requestedPlan == "free" {
			requestedPlan = account.PlanPersonal
		}
	default:
		requestedPlan = account.PlanPersonal
	}
	personalBoardName := strings.TrimSpace(req.PersonalBoardName)
	teamBoardName := strings.TrimSpace(req.TeamBoardName)
	legacyTeamName := strings.TrimSpace(req.TeamName)
	if personalBoardName == "" {
		personalBoardName = legacyTeamName
	}
	if requestedPlan != account.PlanPersonal && teamBoardName == "" {
		teamBoardName = legacyTeamName
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	session, invites, err := a.accounts.CompleteOnboarding(
		r.Context(),
		principal.UserID,
		personalBoardName,
		teamBoardName,
		strings.TrimSpace(req.Name),
		req.Emails,
		requestedPlan,
	)
	if err != nil {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, err.Error()), "personalBoardName"))
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

	resolvedTeamName := teamBoardName
	if session.Team != nil && strings.TrimSpace(session.Team.Name) != "" {
		resolvedTeamName = strings.TrimSpace(session.Team.Name)
	}
	for _, inv := range invites {
		if err := a.sendInviteEmail(r.Context(), inv.Email, resolvedTeamName, inv.InvitationCode); err != nil {
			a.logError(r, "send_invite_email_failed", err)
		}
	}

	if session.User.CurrentWorkspace != nil {
		nextPrincipal := sessionctx.Principal{
			UserID:      session.User.ID,
			Email:       session.User.Email,
			WorkspaceID: strings.TrimSpace(*session.User.CurrentWorkspace),
		}
		snapshot, snapErr := a.loadProjectSnapshot(r.Context(), nextPrincipal, true)
		if snapErr != nil {
			a.logError(r, "auth_onboarding_project_snapshot_failed", snapErr)
		} else {
			attrs := append(
				sessionLogAttrs(session),
				slog.String("requested_personal_board_name", personalBoardName),
				slog.String("requested_team_board_name", teamBoardName),
				slog.String("requested_plan", requestedPlan),
				slog.Int("invite_count", len(invites)),
			)
			attrs = append(attrs, snapshot.attrs()...)
			a.logInfo(r, "auth_onboarding_completed", attrs...)
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
	a.clearSessionCookie(w, r)
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
	if session.Team != nil {
		if err := a.syncStripeWorkspaceSeatCount(r.Context(), session.Team.ID); err != nil {
			a.logError(r, "stripe_seat_sync_after_accept_failed", err)
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
	if err := a.syncStripeWorkspaceSeatCount(r.Context(), principal.WorkspaceID); err != nil {
		a.logError(r, "stripe_seat_sync_after_remove_failed", err)
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
