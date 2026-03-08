DELETE FROM board_memberships
WHERE workspace_id = ?
	AND board_id = ?
	AND user_id = ?
