INSERT INTO auth_sessions (
	id, user_id, workspace_id, email, created_at, updated_at, expires_at, revoked_at, last_seen_at, user_agent, ip_address
)
VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
