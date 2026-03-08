UPDATE auth_sessions
SET
	revoked_at = COALESCE(revoked_at, ?),
	updated_at = ?
WHERE id = ?
