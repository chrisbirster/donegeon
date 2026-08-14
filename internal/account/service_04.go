package account

import (
	"context"
	"strings"
	"time"

	"donegeon/internal/sessionctx"
	"donegeon/internal/tenant"
)

func generatedBoardName(base string, suffix string) string {
	base = strings.TrimSpace(base)
	suffix = strings.TrimSpace(suffix)
	switch {
	case base == "" && suffix == "":
		return ""
	case base == "":
		return normalizeGeneratedBoardName(suffix)
	case suffix == "":
		return normalizeGeneratedBoardName(base)
	default:
		return normalizeGeneratedBoardName(base + " " + suffix)
	}
}

func normalizeGeneratedBoardName(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var b strings.Builder
	lastDash := false
	for _, ch := range trimmed {
		switch {
		case ch >= 'a' && ch <= 'z':
			b.WriteRune(ch)
			lastDash = false
		case ch >= 'A' && ch <= 'Z':
			b.WriteRune(ch)
			lastDash = false
		case ch >= '0' && ch <= '9':
			b.WriteRune(ch)
			lastDash = false
		default:
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}

	return strings.Trim(b.String(), "-")
}

func personalBoardBaseName(userName string, userEmail string) string {
	displayName := strings.TrimSpace(userName)
	if displayName != "" {
		return displayName
	}
	fromEmail := strings.TrimSpace(defaultNameFromEmail(userEmail))
	if fromEmail != "" {
		return fromEmail
	}
	return "Personal"
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func defaultNameFromEmail(email string) string {
	parts := strings.SplitN(strings.TrimSpace(email), "@", 2)
	if len(parts) == 0 || strings.TrimSpace(parts[0]) == "" {
		return "New User"
	}
	return strings.TrimSpace(parts[0])
}

func normalizeWaitlistPlan(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case PlanPersonal:
		return PlanPersonal
	case PlanProTrial, PlanPro:
		return PlanProTrial
	case PlanEnterprise:
		return PlanEnterprise
	default:
		return ""
	}
}

func (s *Service) waitlistSignupByEmail(ctx context.Context, email string) (WaitlistSignup, error) {
	var signup WaitlistSignup
	err := s.get(ctx, &signup, "account_waitlist_signup_get_by_email.sql", strings.ToLower(strings.TrimSpace(email)))
	return signup, err
}

func normalizeInviteEmails(raw []string, ownerEmail string) []string {
	owner := strings.ToLower(strings.TrimSpace(ownerEmail))
	seen := make(map[string]struct{}, len(raw))
	result := make([]string, 0, len(raw))
	for _, item := range raw {
		email := strings.ToLower(strings.TrimSpace(item))
		if email == "" || !strings.Contains(email, "@") || email == owner {
			continue
		}
		if _, ok := seen[email]; ok {
			continue
		}
		seen[email] = struct{}{}
		result = append(result, email)
	}
	return result
}

func projectStorageID(workspaceID, slug string) string {
	if strings.TrimSpace(workspaceID) == sessionctx.DefaultWorkspaceID {
		return strings.TrimSpace(slug)
	}
	return tenant.CanonicalProjectID(workspaceID, slug)
}

func normalizeBoardID(raw string) string {
	boardID := strings.ToLower(strings.TrimSpace(raw))
	if boardID == "" || strings.EqualFold(boardID, "board") || strings.EqualFold(boardID, defaultBoardID) {
		return defaultBoardID
	}
	return boardID
}
