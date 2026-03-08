SELECT workspace_id, user_id, email, name, role, created_at
FROM workspace_users
WHERE workspace_id = ?
	AND user_id = ?
LIMIT 1;
