SELECT
    id,
    content,
    description,
    project_id,
    section_id,
    priority,
    due_text,
    due_deadline,
    checked,
    is_deleted,
    created_at,
    updated_at
FROM tasks
WHERE is_deleted = 0
  AND (:project_id IS NULL OR project_id = :project_id)
ORDER BY datetime(created_at) DESC
LIMIT :limit OFFSET :offset;
