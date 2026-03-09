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
project_rows AS (
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
    WHERE (
        p.workspace_id = :workspace_id
        OR p.workspace_id IS NULL
        OR p.workspace_id = ''
    )
      AND (:include_archived = 1 OR p.is_archived = 0)
),
visible_project_rows AS (
    SELECT
        pr.id,
        pr.name,
        pr.is_inbox_project,
        pr.is_archived,
        pr.is_favorite,
        pr.workspace_id,
        pr.created_at,
        pr.updated_at,
        pr.project_slug
    FROM project_rows pr
    WHERE (
        LOWER(pr.project_slug) <> 'board'
        AND LOWER(pr.project_slug) NOT LIKE 'board-%'
    )
       OR EXISTS (
        SELECT 1
        FROM board_memberships bm
        WHERE bm.workspace_id = :workspace_id
          AND bm.user_id = :user_id
          AND LOWER(bm.board_id) = LOWER(
              CASE
                  WHEN LOWER(pr.project_slug) = 'board' THEN 'default'
                  ELSE pr.project_slug
              END
          )
    )
),
orphan_rows AS (
    SELECT
        t.project_id AS id,
        CASE
            WHEN INSTR(t.project_id, '::') > 0 THEN SUBSTR(t.project_id, INSTR(t.project_id, '::') + 2)
            ELSE t.project_id
        END AS name,
        0 AS is_inbox_project,
        0 AS is_archived,
        0 AS is_favorite,
        :workspace_id AS workspace_id,
        MIN(t.created_at) AS created_at,
        MAX(t.updated_at) AS updated_at,
        CASE
            WHEN INSTR(t.project_id, '::') > 0 THEN SUBSTR(t.project_id, INSTR(t.project_id, '::') + 2)
            ELSE t.project_id
        END AS project_slug
    FROM tasks t
    LEFT JOIN visible_project_rows p
      ON p.id = t.project_id
    WHERE t.project_id IS NOT NULL
      AND t.project_id <> ''
      AND t.user_id = :user_id
      AND t.workspace_id = :workspace_id
      AND p.id IS NULL
    GROUP BY t.project_id
),
visible_orphan_rows AS (
    SELECT
        o.id,
        o.name,
        o.is_inbox_project,
        o.is_archived,
        o.is_favorite,
        o.workspace_id,
        o.created_at,
        o.updated_at,
        o.project_slug
    FROM orphan_rows o
    WHERE (
        LOWER(o.project_slug) <> 'board'
        AND LOWER(o.project_slug) NOT LIKE 'board-%'
    )
       OR EXISTS (
        SELECT 1
        FROM board_memberships bm
        WHERE bm.workspace_id = :workspace_id
          AND bm.user_id = :user_id
          AND LOWER(bm.board_id) = LOWER(
              CASE
                  WHEN LOWER(o.project_slug) = 'board' THEN 'default'
                  ELSE o.project_slug
              END
          )
    )
),
combined AS (
    SELECT * FROM visible_project_rows
    UNION ALL
    SELECT * FROM visible_orphan_rows
)
SELECT
    c.id,
    c.name,
    c.is_inbox_project,
    c.is_archived,
    c.is_favorite,
    CASE
        WHEN LOWER(c.project_slug) = 'board-team'
          OR LOWER(c.project_slug) LIKE 'board-team-%' THEN 1
        WHEN (LOWER(c.project_slug) = 'board' OR LOWER(c.project_slug) LIKE 'board-%')
         AND COALESCE(bmc.member_count, 0) > 1 THEN 1
        ELSE 0
    END AS is_team_board,
    c.workspace_id,
    c.created_at,
    c.updated_at,
    COALESCE(tc.open_task_count, 0) AS open_task_count
FROM combined c
LEFT JOIN task_counts tc ON tc.project_id = c.id
LEFT JOIN board_member_counts bmc
    ON bmc.workspace_id = :workspace_id
   AND bmc.board_key = LOWER(
       CASE
           WHEN LOWER(c.project_slug) = 'board' THEN 'default'
           ELSE c.project_slug
       END
   )
ORDER BY LOWER(c.name) ASC, c.created_at ASC;
