package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"donegeon/internal/account"
	"donegeon/internal/board"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/project"
	"donegeon/internal/sessionctx"
	"donegeon/internal/tenant"
)

func (a *API) logDebug(r *http.Request, msg string, attrs ...slog.Attr) {
	a.logger.LogAttrs(r.Context(), slog.LevelDebug, msg, a.baseLogAttrs(r, attrs...)...)
}

func (a *API) baseLogAttrs(r *http.Request, attrs ...slog.Attr) []slog.Attr {
	base := []slog.Attr{
		slog.String("request_id", requestIDFromContext(r.Context())),
		slog.String("method", r.Method),
		slog.String("path", r.URL.Path),
	}
	if state := requestLogStateFromContext(r.Context()); state != nil {
		base = append(base, state.attrs()...)
	}
	return append(base, attrs...)
}

func requestLogStateFromContext(ctx context.Context) *requestLogState {
	state, _ := ctx.Value(ctxKeyLogState).(*requestLogState)
	return state
}

func (s *requestLogState) attrs() []slog.Attr {
	if s == nil {
		return nil
	}

	attrs := make([]slog.Attr, 0, 8)
	if s.Scope != "" {
		attrs = append(attrs, slog.String("scope", string(s.Scope)))
	}
	if strings.TrimSpace(s.AuthSource) != "" {
		attrs = append(attrs, slog.String("auth_source", strings.TrimSpace(s.AuthSource)))
	}
	if s.Authenticated {
		attrs = append(attrs, slog.Bool("authenticated", true))
	}
	if s.HasSessionCookie {
		attrs = append(attrs, slog.Bool("session_cookie_present", true))
	}
	if s.SessionExtended {
		attrs = append(attrs, slog.Bool("session_extended", true))
	}
	if strings.TrimSpace(s.AuthFailureReason) != "" {
		attrs = append(attrs, slog.String("auth_failure_reason", strings.TrimSpace(s.AuthFailureReason)))
	}
	if s.Authenticated || strings.TrimSpace(s.Principal.Email) != "" {
		if strings.TrimSpace(s.Principal.UserID) != "" {
			attrs = append(attrs, slog.String("user_id", strings.TrimSpace(s.Principal.UserID)))
		}
		if strings.TrimSpace(s.Principal.WorkspaceID) != "" {
			attrs = append(attrs, slog.String("workspace_id", strings.TrimSpace(s.Principal.WorkspaceID)))
		}
		if strings.TrimSpace(s.Principal.Email) != "" {
			attrs = append(attrs, slog.String("user_email", strings.TrimSpace(s.Principal.Email)))
		}
	}
	return attrs
}

func sessionLogAttrs(session account.Session) []slog.Attr {
	attrs := []slog.Attr{
		slog.String("session_user_id", strings.TrimSpace(session.User.ID)),
		slog.String("session_user_email", strings.TrimSpace(session.User.Email)),
		slog.String("session_user_name", strings.TrimSpace(session.User.Name)),
		slog.Bool("show_onboarding", session.User.ShowOnboarding),
	}
	if session.User.CurrentWorkspace != nil && strings.TrimSpace(*session.User.CurrentWorkspace) != "" {
		attrs = append(attrs, slog.String("session_workspace_id", strings.TrimSpace(*session.User.CurrentWorkspace)))
	}
	if session.Team != nil {
		attrs = append(attrs,
			slog.String("session_team_id", strings.TrimSpace(session.Team.ID)),
			slog.String("session_team_name", strings.TrimSpace(session.Team.Name)),
			slog.String("session_team_plan", strings.TrimSpace(session.Team.Plan)),
			slog.Bool("session_team_archived", session.Team.IsArchived),
		)
		if session.Team.TrialEndsAt != nil && strings.TrimSpace(*session.Team.TrialEndsAt) != "" {
			attrs = append(attrs, slog.String("session_team_trial_ends_at", strings.TrimSpace(*session.Team.TrialEndsAt)))
		}
	}
	return attrs
}

func summarizeProjects(items []project.Project) projectLogSnapshot {
	snapshot := projectLogSnapshot{
		Total:        len(items),
		ProjectIDs:   make([]string, 0, minInt(len(items), 10)),
		ProjectNames: make([]string, 0, minInt(len(items), 10)),
	}
	for _, item := range items {
		if item.IsInboxProject {
			snapshot.InboxCount++
		}
		if tenant.IsBoardProject(item.ID) {
			snapshot.BoardCount++
		}
		if item.IsTeamBoard {
			snapshot.TeamBoardCount++
		}
		if len(snapshot.ProjectIDs) < 10 {
			snapshot.ProjectIDs = append(snapshot.ProjectIDs, strings.TrimSpace(item.ID))
		}
		if len(snapshot.ProjectNames) < 10 {
			snapshot.ProjectNames = append(snapshot.ProjectNames, strings.TrimSpace(item.Name))
		}
	}
	return snapshot
}

func (s projectLogSnapshot) attrs() []slog.Attr {
	return []slog.Attr{
		slog.Int("project_count", s.Total),
		slog.Int("board_project_count", s.BoardCount),
		slog.Int("team_board_count", s.TeamBoardCount),
		slog.Int("inbox_project_count", s.InboxCount),
		slog.Any("project_ids", s.ProjectIDs),
		slog.Any("project_names", s.ProjectNames),
	}
}

func (a *API) loadProjectSnapshot(ctx context.Context, principal sessionctx.Principal, includeArchived bool) (projectLogSnapshot, error) {
	if a.projects == nil {
		return projectLogSnapshot{}, fmt.Errorf("project service unavailable")
	}
	listCtx := sessionctx.WithPrincipal(ctx, principal)
	items, err := a.projects.List(listCtx, project.ListParams{IncludeArchived: includeArchived})
	if err != nil {
		return projectLogSnapshot{}, err
	}
	return summarizeProjects(items), nil
}

func inferredScopeFromMethod(method string) Scope {
	if isWriteRequest(method) {
		return ScopeWrite
	}
	return ScopeRead
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
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
	SeatCount        int
	CustomerEmail    string
	ExistingCustomer string
}

type stripeBillingPortalInput struct {
	CustomerID string
}

type stripeStoreCheckoutInput struct {
	WorkspaceID      string
	WorkspaceName    string
	BoardID          string
	Item             board.StoreCatalogItem
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
	seatCount := in.SeatCount
	if seatCount < 1 {
		seatCount = 1
	}

	form := url.Values{}
	form.Set("mode", "subscription")
	form.Set("success_url", successURL)
	form.Set("cancel_url", cancelURL)
	form.Set("client_reference_id", strings.TrimSpace(in.WorkspaceID))
	form.Set("allow_promotion_codes", "true")
	form.Set("line_items[0][price]", priceID)
	form.Set("line_items[0][quantity]", strconv.Itoa(seatCount))
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

	return a.postStripeSessionURL(ctx, secret, a.stripeAPIBaseURL()+"/v1/checkout/sessions", "stripe checkout", form)
}

func (a *API) createStripeBillingPortalSession(ctx context.Context, in stripeBillingPortalInput) (string, error) {
	secret := strings.TrimSpace(a.cfg.StripeSecretKey)
	if secret == "" {
		return "", fmt.Errorf("stripe secret key is not configured")
	}
	returnURL := strings.TrimSpace(a.cfg.StripePortalReturnURL)
	if returnURL == "" {
		return "", fmt.Errorf("stripe billing portal return url is not configured")
	}
	customerID := strings.TrimSpace(in.CustomerID)
	if customerID == "" {
		return "", fmt.Errorf("stripe customer id is required")
	}

	form := url.Values{}
	form.Set("customer", customerID)
	form.Set("return_url", returnURL)

	return a.postStripeSessionURL(ctx, secret, a.stripeAPIBaseURL()+"/v1/billing_portal/sessions", "stripe billing portal", form)
}

func (a *API) createStripeStoreCheckoutSession(ctx context.Context, in stripeStoreCheckoutInput) (string, error) {
	secret := strings.TrimSpace(a.cfg.StripeSecretKey)
	if secret == "" {
		return "", fmt.Errorf("stripe secret key is not configured")
	}
	if strings.TrimSpace(in.WorkspaceID) == "" {
		return "", fmt.Errorf("workspace id is required")
	}
	if strings.TrimSpace(in.BoardID) == "" {
		return "", fmt.Errorf("board id is required")
	}
	if strings.TrimSpace(in.Item.ID) == "" {
		return "", fmt.Errorf("store item id is required")
	}
	if in.Item.PriceCents <= 0 {
		return "", fmt.Errorf("store item price is invalid")
	}
	currency := strings.ToLower(strings.TrimSpace(in.Item.Currency))
	if currency == "" {
		currency = "usd"
	}

	form := url.Values{}
	form.Set("mode", "payment")
	form.Set("success_url", a.boardStoreReturnURL(in.BoardID, map[string]string{
		"store":      "success",
		"item":       in.Item.ID,
		"session_id": "{CHECKOUT_SESSION_ID}",
	}))
	form.Set("cancel_url", a.boardStoreReturnURL(in.BoardID, map[string]string{
		"store": "canceled",
		"item":  in.Item.ID,
	}))
	form.Set("client_reference_id", strings.TrimSpace(in.WorkspaceID))
	form.Set("allow_promotion_codes", "true")
	form.Set("line_items[0][quantity]", "1")
	form.Set("line_items[0][price_data][currency]", currency)
	form.Set("line_items[0][price_data][unit_amount]", strconv.Itoa(in.Item.PriceCents))
	form.Set("line_items[0][price_data][product_data][name]", strings.TrimSpace(in.Item.Name))
	if description := strings.TrimSpace(in.Item.Description); description != "" {
		form.Set("line_items[0][price_data][product_data][description]", description)
	}
	form.Set("metadata[checkout_kind]", "board_store")
	form.Set("metadata[workspace_id]", strings.TrimSpace(in.WorkspaceID))
	form.Set("metadata[workspace_name]", strings.TrimSpace(in.WorkspaceName))
	form.Set("metadata[board_id]", strings.TrimSpace(in.BoardID))
	form.Set("metadata[store_item_id]", strings.TrimSpace(in.Item.ID))
	if customer := strings.TrimSpace(in.ExistingCustomer); customer != "" {
		form.Set("customer", customer)
	} else if email := strings.TrimSpace(in.CustomerEmail); email != "" {
		form.Set("customer_email", email)
	}

	return a.postStripeSessionURL(ctx, secret, a.stripeAPIBaseURL()+"/v1/checkout/sessions", "stripe checkout", form)
}
