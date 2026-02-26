UPDATE tasks
SET
    content = COALESCE(:content, content),
    description = COALESCE(:description, description),
    project_id = COALESCE(:project_id, project_id),
    section_id = COALESCE(:section_id, section_id),
    sort_order = COALESCE(:sort_order, sort_order),
    recurrence_rule = COALESCE(:recurrence_rule, recurrence_rule),
    priority = COALESCE(:priority, priority),
    due_text = COALESCE(:due_text, due_text),
    due_deadline = COALESCE(:due_deadline, due_deadline),
    schedule_input = COALESCE(:schedule_input, schedule_input),
    updated_at = :updated_at
WHERE id = :id
  AND user_id = :user_id
  AND workspace_id = :workspace_id
  AND is_deleted = 0;
