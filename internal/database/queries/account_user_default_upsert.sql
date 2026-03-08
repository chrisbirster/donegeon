INSERT INTO users (id, email, name, show_onboarding, current_workspace_id, created_at, updated_at)
VALUES (?, ?, ?, 0, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    show_onboarding = 0,
    current_workspace_id = excluded.current_workspace_id,
    updated_at = excluded.updated_at
