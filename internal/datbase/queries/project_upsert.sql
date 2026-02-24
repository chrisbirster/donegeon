INSERT INTO projects (
    id,
    name,
    is_inbox_project,
    is_archived,
    is_favorite,
    workspace_id,
    created_at,
    updated_at
) VALUES (
    :id,
    :name,
    0,
    0,
    COALESCE(:is_favorite, 0),
    NULL,
    :created_at,
    :updated_at
)
ON CONFLICT(id) DO UPDATE SET
    name = COALESCE(:name, projects.name),
    is_favorite = COALESCE(:is_favorite, projects.is_favorite),
    updated_at = :updated_at;
