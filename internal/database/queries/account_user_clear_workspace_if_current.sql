UPDATE users
SET
	current_workspace_id = CASE
		WHEN current_workspace_id = ? THEN NULL
		ELSE current_workspace_id
	END,
	show_onboarding = CASE
		WHEN current_workspace_id = ? THEN 1
		ELSE show_onboarding
	END,
	updated_at = CASE
		WHEN current_workspace_id = ? THEN ?
		ELSE updated_at
	END
WHERE id = ?
