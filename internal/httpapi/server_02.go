package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"donegeon/internal/account"
	"donegeon/internal/board"
	apperrors "donegeon/internal/errors"
	rruleparser "donegeon/internal/rrule"
	"donegeon/internal/sessionctx"
	"donegeon/internal/task"
)

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
	team, err := a.accounts.BillingWorkspace(r.Context(), principal.UserID, workspaceID)
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, err.Error()))
		return
	}

	if plan == account.PlanProTrial {
		if team.BillingState == "paid" {
			writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "workspace is already on paid Pro"), "plan"))
			return
		}
		if team.BillingState == "sales" {
			writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "workspace is already on Enterprise"), "plan"))
			return
		}
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
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "use the billing downgrade actions instead of checkout"), "plan"))
		return
	}
	if team.BillingState == "paid" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "workspace is already on paid Pro"), "plan"))
		return
	}
	if team.BillingState == "sales" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "workspace is already on Enterprise"), "plan"))
		return
	}

	if strings.TrimSpace(a.cfg.StripeSecretKey) == "" || strings.TrimSpace(a.cfg.StripeProPriceID) == "" {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "stripe checkout is not configured"))
		return
	}

	email := strings.TrimSpace(principal.Email)
	if email == "" {
		session, sessionErr := a.accounts.GetSession(r.Context(), principal.UserID)
		if sessionErr == nil {
			email = strings.TrimSpace(session.User.Email)
		}
	}
	seatCount, err := a.accounts.WorkspaceSeatCount(r.Context(), workspaceID)
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, err.Error()))
		return
	}
	checkoutURL, err := a.createStripeCheckoutSession(r.Context(), stripeCheckoutInput{
		WorkspaceID:      workspaceID,
		WorkspaceName:    team.Name,
		Plan:             plan,
		SeatCount:        seatCount,
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

func (a *API) handleCreateBillingPortalSession(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	team, err := a.accounts.BillingWorkspace(r.Context(), principal.UserID, principal.WorkspaceID)
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, err.Error()))
		return
	}
	if team.BillingState != "paid" {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "billing portal is only available for paid Pro workspaces"), "plan"))
		return
	}

	customerID := strings.TrimSpace(ptrString(team.StripeCustomerID))
	if customerID == "" {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "stripe customer is not configured for this workspace"))
		return
	}

	portalURL, err := a.createStripeBillingPortalSession(r.Context(), stripeBillingPortalInput{
		CustomerID: customerID,
	})
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, err.Error()))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"url": portalURL,
	})
}

func (a *API) handleEndBillingTrial(w http.ResponseWriter, r *http.Request) {
	if err := requireWriteScope(r.Context()); err != nil {
		writeAPIError(w, err)
		return
	}
	if a.accounts == nil {
		writeAPIError(w, apperrors.New(apperrors.CodeInternal, "account service unavailable"))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	team, err := a.accounts.EndProTrial(r.Context(), principal.UserID, principal.WorkspaceID)
	if err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, err.Error()))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"team": team,
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
		checkoutKind := strings.TrimSpace(stripeMapString(metadata, "checkout_kind"))
		workspaceID := stripeObjectString(obj, "client_reference_id")
		if workspaceID == "" {
			workspaceID = stripeMapString(metadata, "workspace_id")
		}
		if checkoutKind == "board_store" {
			if a.boards == nil {
				writeAPIError(w, apperrors.New(apperrors.CodeInternal, "board service unavailable"))
				return
			}
			boardID := stripeMapString(metadata, "board_id")
			itemID := stripeMapString(metadata, "store_item_id")
			sessionID := stripeObjectString(obj, "id")
			if workspaceID == "" || boardID == "" || itemID == "" || sessionID == "" {
				writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "missing store checkout metadata in checkout event"))
				return
			}
			ctx := sessionctx.WithPrincipal(r.Context(), sessionctx.Principal{WorkspaceID: workspaceID})
			if _, err := a.boards.GrantStorePurchase(ctx, boardID, board.StorePurchaseGrant{
				SessionID:       sessionID,
				ItemID:          itemID,
				PaymentIntentID: stripeObjectString(obj, "payment_intent"),
				CustomerID:      stripeObjectString(obj, "customer"),
				GrantedAt:       time.Now().UTC(),
			}); err != nil {
				a.logError(r, "stripe_store_checkout_fulfillment_failed", err)
				writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to grant store purchase"))
				return
			}
			break
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
		if err := a.syncStripeWorkspaceSeatCount(r.Context(), workspaceID); err != nil {
			a.logError(r, "stripe_checkout_complete_seat_sync_failed", err)
			writeAPIError(w, apperrors.New(apperrors.CodeInternal, "failed to sync subscription seats"))
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

func (a *API) handleBillingStoreCatalog(w http.ResponseWriter, r *http.Request) {
	configured, message := a.storeCheckoutAvailability()
	writeJSON(w, http.StatusOK, map[string]any{
		"items":             board.StoreCatalog(),
		"checkoutEnabled":   configured,
		"configurationHint": message,
	})
}

func (a *API) handleCreateBillingStoreCheckout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ItemID string `json:"itemId"`
		Board  string `json:"board"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, "invalid json body"))
		return
	}

	item, ok := board.StoreItemByID(req.ItemID)
	if !ok {
		writeAPIError(w, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "unknown store item"), "itemId"))
		return
	}

	boardID, err := board.NormalizeBoardID(req.Board)
	if err != nil {
		writeAPIError(w, err)
		return
	}

	if configured, message := a.storeCheckoutAvailability(); !configured {
		writeAPIError(w, apperrors.New(apperrors.CodeValidationError, message))
		return
	}

	principal := sessionctx.PrincipalFromContext(r.Context())
	workspaceName := principal.WorkspaceID
	existingCustomer := ""
	email := strings.TrimSpace(principal.Email)
	if a.accounts != nil {
		team, teamErr := a.accounts.GetWorkspace(r.Context(), principal.WorkspaceID)
		if teamErr == nil {
			if strings.TrimSpace(team.Name) != "" {
				workspaceName = strings.TrimSpace(team.Name)
			}
			existingCustomer = strings.TrimSpace(ptrString(team.StripeCustomerID))
		}
		if email == "" {
			if session, sessionErr := a.accounts.GetSession(r.Context(), principal.UserID); sessionErr == nil {
				email = strings.TrimSpace(session.User.Email)
			}
		}
	}

	checkoutURL, err := a.createStripeStoreCheckoutSession(r.Context(), stripeStoreCheckoutInput{
		WorkspaceID:      principal.WorkspaceID,
		WorkspaceName:    workspaceName,
		BoardID:          boardID,
		Item:             item,
		CustomerEmail:    email,
		ExistingCustomer: existingCustomer,
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

func (a *API) handleParseQuickAdd(w http.ResponseWriter, r *http.Request) {
	if a.quickAddParseLimiter != nil && !a.quickAddParseLimiter.Allow(quickAddParseLimiterKey(r), time.Now()) {
		w.Header().Set("Retry-After", "1")
		writeAPIError(w, apperrors.New(apperrors.CodeRateLimited, "quick-add parse rate limit exceeded"))
		return
	}

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
