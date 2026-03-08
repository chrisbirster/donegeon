SELECT
	i.invitation_code,
	i.email,
	i.status,
	w.name AS team_name
FROM workspace_invitations i
JOIN workspaces w ON w.id = i.workspace_id
WHERE i.invitation_code = ?
LIMIT 1
