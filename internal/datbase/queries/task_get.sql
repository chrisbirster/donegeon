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
    checked,
    is_deleted,
    created_at,
    updated_at
FROM tasks
WHERE id = ? AND is_deleted = 0;
