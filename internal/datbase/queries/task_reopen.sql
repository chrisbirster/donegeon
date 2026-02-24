UPDATE tasks
SET checked = 0,
    updated_at = ?
WHERE id = ? AND is_deleted = 0;
