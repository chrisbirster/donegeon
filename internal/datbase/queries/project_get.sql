WITH task_counts AS (
    SELECT
        project_id,
        COUNT(*) AS open_task_count
    FROM tasks
    WHERE is_deleted = 0
      AND checked = 0
      AND project_id IS NOT NULL
      AND project_id <> ''
    GROUP BY project_id
)
SELECT
    p.id,
    p.name,
    p.is_inbox_project,
    p.is_archived,
    p.is_favorite,
    p.workspace_id,
    p.created_at,
    p.updated_at,
    COALESCE(tc.open_task_count, 0) AS open_task_count
FROM projects p
LEFT JOIN task_counts tc ON tc.project_id = p.id
WHERE p.id = ?
LIMIT 1;
