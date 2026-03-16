DELETE FROM workspace_invitations
WHERE workspace_id = ?
  AND status = 'pending';
