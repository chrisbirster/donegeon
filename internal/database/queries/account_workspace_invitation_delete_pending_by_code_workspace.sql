DELETE FROM workspace_invitations
WHERE invitation_code = ?
	AND workspace_id = ?
	AND status = 'pending'
