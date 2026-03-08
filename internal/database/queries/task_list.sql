SELECT
    id,
    content,
    description,
    project_id,
    section_id,
    sort_order,
    recurrence_rule,
    priority,
    due_text,
    due_deadline,
    schedule_input,
    processed_count,
    checked,
    is_deleted,
    created_at,
    updated_at
FROM tasks
WHERE user_id = :user_id
  AND workspace_id = :workspace_id
  AND is_deleted = 0
  AND (:project_id IS NULL OR project_id = :project_id)
ORDER BY sort_order ASC, datetime(created_at) DESC
LIMIT :limit OFFSET :offset;
