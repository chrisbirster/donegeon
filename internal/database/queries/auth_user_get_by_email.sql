SELECT id, email, name, show_onboarding, current_workspace_id, created_at, updated_at
FROM users
WHERE LOWER(email) = LOWER(?)
LIMIT 1
