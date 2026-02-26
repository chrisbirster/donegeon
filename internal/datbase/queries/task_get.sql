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
WHERE id = :id
  AND user_id = :user_id
  AND workspace_id = :workspace_id
  AND is_deleted = 0;
