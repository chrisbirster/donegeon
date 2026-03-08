SELECT COUNT(1)
FROM board_memberships
WHERE board_id = ?
	AND workspace_id = ?
	AND user_id = ?
