package taskmanagercompat

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
	"donegeon/internal/tenant"
)

func (s *Service) sectionByID(ctx context.Context, id string) (sectionRow, error) {
	principal := sessionctx.PrincipalFromContext(ctx)
	var row sectionRow
	query := `
SELECT s.id, s.project_id, s.name, s.created_at, s.updated_at
FROM sections s
JOIN projects p ON p.id = s.project_id
WHERE s.id = ? AND p.user_id = ? AND p.workspace_id = ?
LIMIT 1
`
	if err := s.db.GetContext(ctx, &row, query, id, principal.UserID, principal.WorkspaceID); err != nil {
		if err == sql.ErrNoRows {
			return sectionRow{}, notFoundField("section not found", "sectionId")
		}
		return sectionRow{}, err
	}
	return row, nil
}

func (s *Service) labelByID(ctx context.Context, id string) (labelRow, error) {
	principal := sessionctx.PrincipalFromContext(ctx)
	var row labelRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, name, color, created_at, updated_at FROM labels WHERE id = ? AND user_id = ? AND workspace_id = ? LIMIT 1", id, principal.UserID, principal.WorkspaceID); err != nil {
		if err == sql.ErrNoRows {
			return labelRow{}, notFoundField("label not found", "labelId")
		}
		return labelRow{}, err
	}
	return row, nil
}

func (s *Service) labelByName(ctx context.Context, name string) (labelRow, error) {
	principal := sessionctx.PrincipalFromContext(ctx)
	var row labelRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, name, color, created_at, updated_at FROM labels WHERE LOWER(name) = LOWER(?) AND user_id = ? AND workspace_id = ? ORDER BY created_at ASC, id ASC LIMIT 1", name, principal.UserID, principal.WorkspaceID); err != nil {
		if err == sql.ErrNoRows {
			return labelRow{}, notFoundField("label not found", "name")
		}
		return labelRow{}, err
	}
	return row, nil
}

func (s *Service) commentByID(ctx context.Context, id string) (commentRow, error) {
	var row commentRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, task_id, project_id, content, created_at, updated_at FROM comments WHERE id = ? LIMIT 1", id); err != nil {
		if err == sql.ErrNoRows {
			return commentRow{}, notFoundField("comment not found", "commentId")
		}
		return commentRow{}, err
	}
	return row, nil
}

func (s *Service) workspaceByID(ctx context.Context, id string) (workspaceRow, error) {
	var row workspaceRow
	if err := s.db.GetContext(ctx, &row, "SELECT id, name, plan, is_archived, created_at, updated_at FROM workspaces WHERE id = ? LIMIT 1", id); err != nil {
		if err == sql.ErrNoRows {
			return workspaceRow{}, notFoundField("workspace not found", "workspaceId")
		}
		return workspaceRow{}, err
	}
	return row, nil
}

func (s *Service) workspaceUsersByWorkspaceID(ctx context.Context, workspaceID string) ([]workspaceUserRow, error) {
	rows := []workspaceUserRow{}
	if err := s.db.SelectContext(ctx, &rows, "SELECT workspace_id, user_id, email, name, role, created_at FROM workspace_users WHERE workspace_id = ? ORDER BY created_at ASC", workspaceID); err != nil {
		return nil, err
	}
	return rows, nil
}

func (s *Service) workspaceInvitationByCode(ctx context.Context, code string) (workspaceInvitationRow, error) {
	var row workspaceInvitationRow
	if err := s.db.GetContext(ctx, &row, "SELECT invitation_code, workspace_id, email, status, created_at, updated_at FROM workspace_invitations WHERE invitation_code = ? LIMIT 1", code); err != nil {
		if err == sql.ErrNoRows {
			return workspaceInvitationRow{}, notFoundField("workspace invitation not found", "invitationCode")
		}
		return workspaceInvitationRow{}, err
	}
	return row, nil
}

func (s *Service) upsertWorkspaceUser(ctx context.Context, workspaceID, userID, email, name, role string) error {
	_, err := s.db.ExecContext(ctx, `
INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    role = excluded.role
`, workspaceID, userID, email, name, role, nowRFC3339())
	return err
}

func (s *Service) ensureDefaults(ctx context.Context) error {
	now := nowRFC3339()
	if _, err := s.db.ExecContext(ctx, `
INSERT INTO workspaces (id, name, plan, is_archived, created_at, updated_at)
VALUES (?, ?, ?, 0, ?, ?)
ON CONFLICT(id) DO NOTHING
`, "W1", "Default Workspace", "free", now, now); err != nil {
		return err
	}
	return s.upsertWorkspaceUser(ctx, "W1", defaultUser, "owner@example.com", "Owner", "owner")
}

func canonicalProjectIDForContext(ctx context.Context, raw string) string {
	id := strings.TrimSpace(raw)
	if id == "" {
		return ""
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	if principal.WorkspaceID == sessionctx.DefaultWorkspaceID && !strings.Contains(id, "::") {
		return id
	}
	return tenant.CanonicalProjectID(principal.WorkspaceID, id)
}

func validationField(message, field string) error {
	return apperrors.WithField(apperrors.New(apperrors.CodeValidationError, message), field)
}

func notFoundField(message, field string) error {
	return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, message), field)
}

func getString(payload map[string]any, key string) (string, bool) {
	if payload == nil {
		return "", false
	}
	raw, ok := payload[key]
	if !ok || raw == nil {
		return "", false
	}
	switch typed := raw.(type) {
	case string:
		return typed, true
	default:
		return fmt.Sprintf("%v", typed), true
	}
}

func getStringOr(payload map[string]any, key string) string {
	value, ok := getString(payload, key)
	if !ok {
		return ""
	}
	return value
}

func optionalString(payload map[string]any, key string) *string {
	value, ok := getString(payload, key)
	if !ok {
		return nil
	}
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func optionalBool(payload map[string]any, key string) (*bool, bool) {
	if payload == nil {
		return nil, false
	}
	raw, ok := payload[key]
	if !ok || raw == nil {
		return nil, false
	}
	var value bool
	switch typed := raw.(type) {
	case bool:
		value = typed
	case string:
		parsed, err := strconv.ParseBool(strings.TrimSpace(typed))
		if err != nil {
			return nil, false
		}
		value = parsed
	case int:
		value = typed != 0
	case int64:
		value = typed != 0
	case float64:
		value = typed != 0
	default:
		return nil, false
	}
	return &value, true
}

func getIntOr(payload map[string]any, key string, fallback int) int {
	if payload == nil {
		return fallback
	}
	raw, ok := payload[key]
	if !ok || raw == nil {
		return fallback
	}
	switch typed := raw.(type) {
	case int:
		return typed
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err != nil {
			return fallback
		}
		return parsed
	default:
		return fallback
	}
}

func getStringSlice(payload map[string]any, key string) []string {
	if payload == nil {
		return nil
	}
	raw, ok := payload[key]
	if !ok || raw == nil {
		return nil
	}
	switch typed := raw.(type) {
	case []string:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			item = strings.TrimSpace(item)
			if item != "" {
				out = append(out, item)
			}
		}
		return out
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			text := strings.TrimSpace(fmt.Sprintf("%v", item))
			if text != "" {
				out = append(out, text)
			}
		}
		return out
	default:
		return nil
	}
}

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func limitCursor(payload map[string]any) (int, int) {
	limit := getIntOr(payload, "limit", defaultLimit)
	cursor := getIntOr(payload, "cursor", 0)
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if cursor < 0 {
		cursor = 0
	}
	return limit, cursor
}

func paginate[T any](items []T, limit, cursor int) ([]T, *int, int) {
	total := len(items)
	if cursor > total {
		cursor = total
	}
	end := cursor + limit
	if end > total {
		end = total
	}
	page := slices.Clone(items[cursor:end])
	var next *int
	if end < total {
		n := end
		next = &n
	}
	return page, next, total
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func stringOrNil(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func ptrStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func asAppError(err error, target **apperrors.AppError) bool {
	if err == nil {
		return false
	}
	var appErr *apperrors.AppError
	if errors.As(err, &appErr) {
		*target = appErr
		return true
	}
	return false
}
