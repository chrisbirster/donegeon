UPDATE auth_login_challenges
SET
	consumed_at = ?,
	attempt_count = attempt_count + 1,
	last_attempt_at = ?
WHERE id = ?
	AND consumed_at IS NULL
	AND expires_at >= ?
