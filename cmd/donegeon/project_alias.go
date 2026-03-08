package donegeon

import (
	"strings"

	"donegeon/internal/project"
	"donegeon/internal/tenant"
)

func resolveProjectIDByReference(ref string, projects []project.Project) *string {
	trimmedRef := strings.TrimSpace(ref)
	if trimmedRef == "" {
		return nil
	}
	refSlug := slugifyProjectAlias(trimmedRef)

	// Exact project id match.
	for _, item := range projects {
		projectID := strings.TrimSpace(item.ID)
		if projectID == "" {
			continue
		}
		if strings.EqualFold(projectID, trimmedRef) {
			return stringPtr(projectID)
		}
	}

	// Exact display name match.
	for _, item := range projects {
		projectName := strings.TrimSpace(item.Name)
		projectID := strings.TrimSpace(item.ID)
		if projectName == "" || projectID == "" {
			continue
		}
		if strings.EqualFold(projectName, trimmedRef) {
			return stringPtr(projectID)
		}
	}

	if refSlug == "" {
		return nil
	}

	// Canonical slug/id or display-name slug match.
	for _, item := range projects {
		projectID := strings.TrimSpace(item.ID)
		if projectID == "" {
			continue
		}
		projectSlug := strings.ToLower(strings.TrimSpace(tenant.ProjectSlug(projectID)))
		if projectSlug == refSlug || slugifyProjectAlias(item.Name) == refSlug {
			return stringPtr(projectID)
		}
	}

	// Board shorthand alias: allow "#my-team" to target "board-my-team".
	for _, item := range projects {
		projectID := strings.TrimSpace(item.ID)
		if projectID == "" {
			continue
		}
		projectSlug := strings.ToLower(strings.TrimSpace(tenant.ProjectSlug(projectID)))
		if !strings.HasPrefix(projectSlug, "board-") {
			continue
		}
		boardAlias := strings.TrimSpace(strings.TrimPrefix(projectSlug, "board-"))
		if boardAlias == refSlug {
			return stringPtr(projectID)
		}
	}

	return nil
}

func slugifyProjectAlias(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(tenant.ProjectSlug(value)))
	if normalized == "" {
		return ""
	}

	var b strings.Builder
	b.Grow(len(normalized))
	lastDash := false
	for _, r := range normalized {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if lastDash {
			continue
		}
		b.WriteByte('-')
		lastDash = true
	}

	return strings.Trim(b.String(), "-")
}

func stringPtr(value string) *string {
	copy := value
	return &copy
}
