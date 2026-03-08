UPDATE auth_sessions
SET
	last_seen_at = ?,
	updated_at = ?
WHERE id = ?
