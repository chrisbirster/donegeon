package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"donegeon/internal/account"
	"donegeon/internal/board"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
)

func (a *API) postStripeSessionURL(ctx context.Context, secret string, endpoint string, operation string, form url.Values) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
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
			return "", fmt.Errorf("%s failed: %s", operation, strings.TrimSpace(payload.Error.Message))
		}
		return "", fmt.Errorf("%s failed with status %d", operation, resp.StatusCode)
	}

	checkoutURL := strings.TrimSpace(payload.URL)
	if checkoutURL == "" {
		return "", fmt.Errorf("%s did not return a url", operation)
	}
	return checkoutURL, nil
}

func (a *API) stripeAPIBaseURL() string {
	baseURL := strings.TrimSpace(a.cfg.StripeAPIBaseURL)
	if baseURL == "" {
		return "https://api.stripe.com"
	}
	return strings.TrimRight(baseURL, "/")
}

func (a *API) syncStripeWorkspaceSeatCount(ctx context.Context, workspaceID string) error {
	if a.accounts == nil {
		return fmt.Errorf("account service unavailable")
	}
	secret := strings.TrimSpace(a.cfg.StripeSecretKey)
	if secret == "" {
		return fmt.Errorf("stripe secret key is not configured")
	}

	team, err := a.accounts.GetWorkspace(ctx, strings.TrimSpace(workspaceID))
	if err != nil {
		return err
	}
	if team.BillingState != "paid" {
		return nil
	}

	subscriptionID := ptrString(team.StripeSubscriptionID)
	if subscriptionID == "" {
		return fmt.Errorf("stripe subscription id is not configured")
	}

	seatCount, err := a.accounts.WorkspaceSeatCount(ctx, team.ID)
	if err != nil {
		return err
	}

	itemID, currentQuantity, err := a.stripeSubscriptionItem(ctx, secret, subscriptionID, strings.TrimSpace(a.cfg.StripeProPriceID))
	if err != nil {
		return err
	}
	if currentQuantity == seatCount {
		return nil
	}

	return a.updateStripeSubscriptionItemQuantity(ctx, secret, itemID, seatCount)
}

func (a *API) stripeSubscriptionItem(ctx context.Context, secret string, subscriptionID string, priceID string) (string, int, error) {
	endpoint := a.stripeAPIBaseURL() + "/v1/subscriptions/" + url.PathEscape(strings.TrimSpace(subscriptionID))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", 0, err
	}
	req.SetBasicAuth(secret, "")

	client := &http.Client{Timeout: a.cfg.RequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 16384))
	var payload struct {
		Items struct {
			Data []struct {
				ID       string `json:"id"`
				Quantity int    `json:"quantity"`
				Price    struct {
					ID string `json:"id"`
				} `json:"price"`
			} `json:"data"`
		} `json:"items"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &payload)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return "", 0, fmt.Errorf("stripe subscription lookup failed: %s", strings.TrimSpace(payload.Error.Message))
		}
		return "", 0, fmt.Errorf("stripe subscription lookup failed with status %d", resp.StatusCode)
	}

	for _, item := range payload.Items.Data {
		if priceID == "" || strings.TrimSpace(item.Price.ID) == strings.TrimSpace(priceID) {
			if strings.TrimSpace(item.ID) == "" {
				return "", 0, fmt.Errorf("stripe subscription item id is missing")
			}
			return strings.TrimSpace(item.ID), item.Quantity, nil
		}
	}
	return "", 0, fmt.Errorf("stripe subscription item not found")
}

func (a *API) updateStripeSubscriptionItemQuantity(ctx context.Context, secret string, itemID string, quantity int) error {
	if quantity < 1 {
		quantity = 1
	}
	form := url.Values{}
	form.Set("quantity", strconv.Itoa(quantity))
	form.Set("proration_behavior", "create_prorations")

	endpoint := a.stripeAPIBaseURL() + "/v1/subscription_items/" + url.PathEscape(strings.TrimSpace(itemID))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.SetBasicAuth(secret, "")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: a.cfg.RequestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
	}()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	var payload struct {
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &payload)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if payload.Error != nil && strings.TrimSpace(payload.Error.Message) != "" {
			return fmt.Errorf("stripe subscription item update failed: %s", strings.TrimSpace(payload.Error.Message))
		}
		return fmt.Errorf("stripe subscription item update failed with status %d", resp.StatusCode)
	}
	return nil
}

func (a *API) storeCheckoutAvailability() (bool, string) {
	if strings.TrimSpace(a.cfg.StripeSecretKey) == "" {
		return false, "stripe store checkout is not configured"
	}
	if strings.TrimSpace(a.cfg.StripeWebhookSecret) == "" {
		return false, "stripe webhook secret is not configured"
	}
	return true, ""
}

func (a *API) boardStoreReturnURL(boardID string, params map[string]string) string {
	base := strings.TrimRight(a.cfg.AppBaseURL, "/") + "/board/store"
	values := url.Values{}
	normalizedBoardID, err := board.NormalizeBoardID(boardID)
	if err == nil && normalizedBoardID != board.DefaultBoardID {
		values.Set("board", normalizedBoardID)
	}
	for key, value := range params {
		if strings.TrimSpace(key) == "" || strings.TrimSpace(value) == "" {
			continue
		}
		values.Set(key, value)
	}
	encoded := values.Encode()
	if encoded == "" {
		return base
	}
	return base + "?" + encoded
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
