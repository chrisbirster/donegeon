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
),
project_rows AS (
    SELECT
        p.id,
        p.name,
        p.is_inbox_project,
        p.is_archived,
        p.is_favorite,
        p.workspace_id,
        p.created_at,
        p.updated_at
    FROM projects p
    WHERE (:include_archived = 1 OR p.is_archived = 0)
),
orphan_rows AS (
    SELECT
        t.project_id AS id,
        t.project_id AS name,
        0 AS is_inbox_project,
        0 AS is_archived,
        0 AS is_favorite,
        NULL AS workspace_id,
        MIN(t.created_at) AS created_at,
        MAX(t.updated_at) AS updated_at
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.project_id IS NOT NULL
      AND t.project_id <> ''
      AND p.id IS NULL
    GROUP BY t.project_id
),
combined AS (
    SELECT * FROM project_rows
    UNION ALL
    SELECT * FROM orphan_rows
)
SELECT
    c.id,
    c.name,
    c.is_inbox_project,
    c.is_archived,
    c.is_favorite,
    c.workspace_id,
    c.created_at,
    c.updated_at,
    COALESCE(tc.open_task_count, 0) AS open_task_count
FROM combined c
LEFT JOIN task_counts tc ON tc.project_id = c.id
ORDER BY LOWER(c.name) ASC, c.created_at ASC;
