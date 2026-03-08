INSERT INTO board_memberships (board_id, workspace_id, user_id, created_at, updated_at)
SELECT ?, workspace_id, user_id, ?, ?
FROM workspace_users
WHERE workspace_id = ?
ON CONFLICT(board_id, workspace_id, user_id) DO UPDATE SET
	updated_at = excluded.updated_at
