UPDATE users
SET
    show_onboarding = 0,
    current_workspace_id = ?,
    updated_at = ?
WHERE id = ?
