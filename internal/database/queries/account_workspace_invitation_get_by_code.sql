SELECT invitation_code, workspace_id, email, role, status
FROM workspace_invitations
WHERE invitation_code = ?
LIMIT 1
