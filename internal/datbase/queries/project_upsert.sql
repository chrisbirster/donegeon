INSERT INTO projects (
    id,
    name,
    is_inbox_project,
    is_archived,
    is_favorite,
    user_id,
    workspace_id,
    created_at,
    updated_at
) VALUES (
    :id,
    :name,
    0,
    0,
    COALESCE(:is_favorite, 0),
    :user_id,
    :workspace_id,
    :created_at,
    :updated_at
)
ON CONFLICT(id) DO UPDATE SET
    name = COALESCE(:name, projects.name),
    is_favorite = COALESCE(:is_favorite, projects.is_favorite),
    user_id = COALESCE(:user_id, projects.user_id),
    workspace_id = COALESCE(:workspace_id, projects.workspace_id),
    updated_at = :updated_at;
