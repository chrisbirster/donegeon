INSERT INTO board_memberships (board_id, workspace_id, user_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(board_id, workspace_id, user_id) DO UPDATE SET
	updated_at = excluded.updated_at
