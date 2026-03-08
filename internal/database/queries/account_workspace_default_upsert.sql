INSERT INTO workspaces (id, name, plan, is_archived, created_at, updated_at)
VALUES (?, ?, 'free', 0, ?, ?)
ON CONFLICT(id) DO NOTHING
