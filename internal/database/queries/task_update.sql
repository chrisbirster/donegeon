UPDATE tasks
SET
    content = COALESCE(:content, content),
    description = COALESCE(:description, description),
    project_id = COALESCE(:project_id, project_id),
    section_id = COALESCE(:section_id, section_id),
    sort_order = COALESCE(:sort_order, sort_order),
    recurrence_rule = CASE
        WHEN :clear_recurrence_rule = 1 THEN NULL
        ELSE COALESCE(:recurrence_rule, recurrence_rule)
    END,
    priority = COALESCE(:priority, priority),
    due_text = CASE
        WHEN :clear_due_text = 1 THEN NULL
        ELSE COALESCE(:due_text, due_text)
    END,
    due_deadline = CASE
        WHEN :clear_due_deadline = 1 THEN NULL
        ELSE COALESCE(:due_deadline, due_deadline)
    END,
    schedule_input = CASE
        WHEN :clear_schedule_input = 1 THEN NULL
        ELSE COALESCE(:schedule_input, schedule_input)
    END,
    updated_at = :updated_at
WHERE id = :id
  AND user_id = :user_id
  AND workspace_id = :workspace_id
  AND is_deleted = 0;
