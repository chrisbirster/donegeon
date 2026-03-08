SELECT invitation_code, workspace_id, email, role, status, created_at, updated_at
FROM workspace_invitations
WHERE workspace_id = ?
	AND LOWER(email) = LOWER(?)
	AND status = 'pending'
ORDER BY created_at DESC
LIMIT 1
