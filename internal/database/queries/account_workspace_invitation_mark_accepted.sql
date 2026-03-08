UPDATE workspace_invitations
SET
	status = 'accepted',
	updated_at = ?
WHERE invitation_code = ?
