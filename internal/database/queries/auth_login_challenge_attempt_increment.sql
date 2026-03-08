UPDATE auth_login_challenges
SET
	attempt_count = attempt_count + 1,
	last_attempt_at = ?
WHERE id = ?
