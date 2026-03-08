SELECT role
FROM workspace_users
WHERE workspace_id = ?
	AND user_id = ?
LIMIT 1;
