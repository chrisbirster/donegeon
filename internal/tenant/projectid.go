package tenant

import "strings"

const projectIDSeparator = "::"

func CanonicalProjectID(workspaceID string, raw string) string {
	workspaceID = strings.TrimSpace(workspaceID)
	id := strings.TrimSpace(raw)
	if id == "" {
		return ""
	}
	if strings.Contains(id, projectIDSeparator) || workspaceID == "" {
		return id
	}
	return workspaceID + projectIDSeparator + id
}

func ProjectSlug(raw string) string {
	id := strings.TrimSpace(raw)
	if id == "" {
		return ""
	}
	index := strings.LastIndex(id, projectIDSeparator)
	if index < 0 {
		return id
	}
	return strings.TrimSpace(id[index+len(projectIDSeparator):])
}

func IsBoardProject(raw string) bool {
	slug := strings.ToLower(strings.TrimSpace(ProjectSlug(raw)))
	return slug == "board" || strings.HasPrefix(slug, "board-")
}

func IsInboxProject(raw string) bool {
	return strings.EqualFold(ProjectSlug(raw), "inbox")
}
