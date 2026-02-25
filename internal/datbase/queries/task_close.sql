UPDATE tasks
SET checked = 1,
    processed_count = processed_count + CASE WHEN checked = 0 THEN 1 ELSE 0 END,
    updated_at = ?
WHERE id = ? AND is_deleted = 0;
