SELECT wu.workspace_id, wu.user_id, wu.email, wu.name, wu.role, wu.created_at
FROM board_memberships bm
JOIN workspace_users wu
	ON wu.workspace_id = bm.workspace_id
	AND wu.user_id = bm.user_id
WHERE bm.workspace_id = ?
	AND bm.board_id = ?
ORDER BY
	CASE wu.role
		WHEN 'owner' THEN 0
		WHEN 'admin' THEN 1
		WHEN 'editor' THEN 2
		WHEN 'member' THEN 2
		WHEN 'reader' THEN 3
		ELSE 4
	END,
	LOWER(wu.name) ASC,
	LOWER(wu.email) ASC
