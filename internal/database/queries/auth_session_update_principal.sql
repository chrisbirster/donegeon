UPDATE auth_sessions
SET
	workspace_id = ?,
	email = ?,
	updated_at = ?
WHERE id = ?
	AND revoked_at IS NULL
