SELECT workspace_id, user_id, email, name, role, created_at
FROM workspace_users
WHERE workspace_id = ?
	ORDER BY
		CASE role
			WHEN 'owner' THEN 0
			WHEN 'admin' THEN 1
			WHEN 'editor' THEN 2
			WHEN 'member' THEN 2
			WHEN 'reader' THEN 3
			ELSE 4
		END,
		LOWER(name) ASC,
		LOWER(email) ASC
