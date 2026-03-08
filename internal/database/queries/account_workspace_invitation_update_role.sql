UPDATE workspace_invitations
SET
	role = ?,
	updated_at = ?
WHERE invitation_code = ?
