UPDATE workspaces
SET
	plan = ?,
	trial_ends_at = ?,
	updated_at = ?
WHERE id = ?
