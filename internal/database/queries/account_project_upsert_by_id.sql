INSERT INTO projects (id, name, is_inbox_project, is_archived, is_favorite, user_id, workspace_id, created_at, updated_at)
VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
	name = excluded.name,
	updated_at = excluded.updated_at
