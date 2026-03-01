WITH task_counts AS (
    SELECT
        project_id,
        COUNT(*) AS open_task_count
    FROM tasks
    WHERE is_deleted = 0
      AND checked = 0
      AND user_id = :user_id
      AND workspace_id = :workspace_id
      AND project_id IS NOT NULL
      AND project_id <> ''
    GROUP BY project_id
),
target AS (
    SELECT
        p.id,
        p.name,
        p.is_inbox_project,
        p.is_archived,
        p.is_favorite,
        p.workspace_id,
        p.created_at,
        p.updated_at,
        CASE
            WHEN INSTR(p.id, '::') > 0 THEN SUBSTR(p.id, INSTR(p.id, '::') + 2)
            ELSE p.id
        END AS project_slug
    FROM projects p
    WHERE p.id = :id
      AND (
          p.workspace_id = :workspace_id
          OR p.workspace_id IS NULL
          OR p.workspace_id = ''
      )
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
FROM target p
LEFT JOIN task_counts tc ON tc.project_id = p.id
WHERE (
    LOWER(p.project_slug) <> 'board'
    AND LOWER(p.project_slug) NOT LIKE 'board-%'
)
   OR EXISTS (
    SELECT 1
    FROM board_memberships bm
    WHERE bm.workspace_id = :workspace_id
      AND bm.user_id = :user_id
      AND LOWER(bm.board_id) = LOWER(
          CASE
              WHEN LOWER(p.project_slug) = 'board' THEN 'default'
              ELSE p.project_slug
          END
      )
)
LIMIT 1;
