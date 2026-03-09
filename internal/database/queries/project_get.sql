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
board_member_counts AS (
    SELECT
        LOWER(board_id) AS board_key,
        workspace_id,
        COUNT(DISTINCT user_id) AS member_count
    FROM board_memberships
    WHERE workspace_id = :workspace_id
    GROUP BY LOWER(board_id), workspace_id
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
    CASE
        WHEN LOWER(p.project_slug) = 'board-team'
          OR LOWER(p.project_slug) LIKE 'board-team-%' THEN 1
        WHEN (LOWER(p.project_slug) = 'board' OR LOWER(p.project_slug) LIKE 'board-%')
         AND COALESCE(bmc.member_count, 0) > 1 THEN 1
        ELSE 0
    END AS is_team_board,
    p.workspace_id,
    p.created_at,
    p.updated_at,
    COALESCE(tc.open_task_count, 0) AS open_task_count
FROM target p
LEFT JOIN task_counts tc ON tc.project_id = p.id
LEFT JOIN board_member_counts bmc
    ON bmc.workspace_id = :workspace_id
   AND bmc.board_key = LOWER(
       CASE
           WHEN LOWER(p.project_slug) = 'board' THEN 'default'
           ELSE p.project_slug
       END
   )
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
