UPDATE auth_sessions
SET
	revoked_at = COALESCE(revoked_at, ?),
	updated_at = ?
WHERE user_id = ?
	AND workspace_id = ?
	AND revoked_at IS NULL
