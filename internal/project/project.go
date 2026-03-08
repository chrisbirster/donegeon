package project

type Project struct {
	ID             string  `db:"id" json:"id"`
	Name           string  `db:"name" json:"name"`
	IsInboxProject bool    `db:"is_inbox_project" json:"isInboxProject"`
	IsArchived     bool    `db:"is_archived" json:"isArchived"`
	IsFavorite     bool    `db:"is_favorite" json:"isFavorite"`
	IsTeamBoard    bool    `db:"is_team_board" json:"isTeamBoard"`
	WorkspaceID    *string `db:"workspace_id" json:"workspaceId,omitempty"`
	OpenTaskCount  int     `db:"open_task_count" json:"openTaskCount"`
	CreatedAt      string  `db:"created_at" json:"createdAt"`
	UpdatedAt      string  `db:"updated_at" json:"updatedAt"`
}

type ListParams struct {
	IncludeArchived bool
}

type UpsertInput struct {
	Name       *string
	IsFavorite *bool
}
