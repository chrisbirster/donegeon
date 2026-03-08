UPDATE workspaces
SET
	name = ?,
	plan = ?,
	trial_ends_at = ?,
	updated_at = ?
WHERE id = ?
