INSERT INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
	email = excluded.email,
	name = excluded.name
