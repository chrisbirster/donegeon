package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"donegeon/internal/account"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
)

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

func (a *API) writeSessionCookie(w http.ResponseWriter, r *http.Request, sessionID string) error {
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
	requestHost := cookieRequestHost(r)
	domain := cookieDomainForRequestHost(a.cfg.CookieDomain, requestHost)
	sameSite := cookieSameSiteMode(a.cfg.CookieSameSite)
	secure := a.cfg.CookieSecure
	if domain == "" && sameSite == http.SameSiteNoneMode {
		sameSite = http.SameSiteLaxMode
	}
	if domain == "" && isLocalCookieHost(requestHost) {
		secure = false
	}

	cookie := &http.Cookie{
		Name:     authSessionCookieName,
		Value:    encoded,
		Path:     "/",
		HttpOnly: true,
		SameSite: sameSite,
		Secure:   secure,
		MaxAge:   maxAge,
	}
	if domain != "" {
		cookie.Domain = domain
	}
	http.SetCookie(w, cookie)
	return nil
}

func (a *API) clearSessionCookie(w http.ResponseWriter, r *http.Request) {
	requestHost := cookieRequestHost(r)
	domain := cookieDomainForRequestHost(a.cfg.CookieDomain, requestHost)
	sameSite := cookieSameSiteMode(a.cfg.CookieSameSite)
	secure := a.cfg.CookieSecure
	if domain == "" && sameSite == http.SameSiteNoneMode {
		sameSite = http.SameSiteLaxMode
	}
	if domain == "" && isLocalCookieHost(requestHost) {
		secure = false
	}

	cookie := &http.Cookie{
		Name:     authSessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: sameSite,
		Secure:   secure,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	}
	if domain != "" {
		cookie.Domain = domain
	}
	http.SetCookie(w, cookie)
}

func cookieRequestHost(r *http.Request) string {
	if r == nil {
		return ""
	}
	host := strings.TrimSpace(strings.ToLower(r.Host))
	if host == "" {
		return ""
	}
	if strings.Contains(host, ":") {
		parsedHost, _, err := net.SplitHostPort(host)
		if err == nil {
			return strings.TrimSpace(strings.ToLower(parsedHost))
		}
	}
	return host
}

func cookieDomainForRequestHost(rawDomain string, requestHost string) string {
	domain := strings.TrimSpace(strings.ToLower(rawDomain))
	if domain == "" {
		return ""
	}
	domain = strings.TrimPrefix(domain, ".")
	host := strings.TrimSpace(strings.ToLower(requestHost))
	if host == "" {
		return ""
	}
	if host == domain || strings.HasSuffix(host, "."+domain) {
		return domain
	}
	return ""
}

func isLocalCookieHost(host string) bool {
	normalized := strings.TrimSpace(strings.ToLower(host))
	if normalized == "" {
		return false
	}
	return normalized == "localhost" ||
		normalized == "127.0.0.1" ||
		normalized == "::1" ||
		strings.HasSuffix(normalized, ".localhost")
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
	payload := map[string]string{
		"to":        strings.TrimSpace(to),
		"otpCode":   strings.TrimSpace(code),
		"expiresAt": strings.TrimSpace(expiresAt),
	}
	return a.sendEmailPayload(ctx, payload)
}

func (a *API) sendInviteEmail(ctx context.Context, to string, teamName string, invitationCode string) error {
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
	return a.sendEmailPayload(ctx, payload)
}

func (a *API) sendWaitlistConfirmationEmail(ctx context.Context, to string, name string, requestedPlan string) error {
	planLine := ""
	switch strings.TrimSpace(requestedPlan) {
	case account.PlanEnterprise:
		planLine = "\nYou asked about enterprise access, so we will keep that in mind when we follow up."
	case account.PlanProTrial:
		planLine = "\nYou asked about Pro access, so we will include team rollout details when beta opens."
	}

	subject := "You're on the Donegeon waitlist"
	body := fmt.Sprintf(
		"Hi %s,\n\n"+
			"Thanks for joining the Donegeon waitlist.\n\n"+
			"Open beta starts %s.\n"+
			"We'll email you at this address when access opens.%s\n\n"+
			"If you did not request this, you can ignore this email.\n\n"+
			"– Donegeon",
		strings.TrimSpace(name),
		openBetaStartsLabel,
		planLine,
	)

	return a.sendTextEmail(ctx, to, subject, body)
}

func (a *API) sendTextEmail(ctx context.Context, to string, subject string, body string) error {
	payload := map[string]string{
		"to":      strings.TrimSpace(to),
		"subject": strings.TrimSpace(subject),
		"text":    strings.TrimSpace(body),
	}
	return a.sendEmailPayload(ctx, payload)
}

func (a *API) sendEmailPayload(ctx context.Context, payload map[string]string) error {
	sendURL := strings.TrimSpace(a.cfg.EmailSendURL)
	if sendURL == "" {
		return fmt.Errorf("email sender is not configured")
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
	if authHeader != "" && authValue == "" {
		return fmt.Errorf("email sender auth is not configured")
	}
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
		ctx = context.WithValue(ctx, ctxKeyLogState, &requestLogState{})
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
		if state := requestLogStateFromContext(r.Context()); state != nil {
			attrs = append(attrs, state.attrs()...)
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
	a.logger.LogAttrs(r.Context(), slog.LevelError, msg, a.baseLogAttrs(r, slog.String("error", err.Error()))...)
}

func (a *API) logInfo(r *http.Request, msg string, attrs ...slog.Attr) {
	a.logger.LogAttrs(r.Context(), slog.LevelInfo, msg, a.baseLogAttrs(r, attrs...)...)
}
