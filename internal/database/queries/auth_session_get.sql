SELECT id, user_id, workspace_id, email, expires_at, revoked_at
FROM auth_sessions
WHERE id = ?
LIMIT 1
