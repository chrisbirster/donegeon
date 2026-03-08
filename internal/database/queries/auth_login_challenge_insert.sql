INSERT INTO auth_login_challenges (
	id, email, name_hint, code_hash, code_length, expires_at, created_at, consumed_at,
	attempt_count, last_attempt_at, requested_ip, requested_user_agent
)
VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, ?)
