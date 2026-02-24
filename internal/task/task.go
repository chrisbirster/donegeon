package task

type Task struct {
	ID          string  `db:"id" json:"id"`
	Content     string  `db:"content" json:"content"`
	Description string  `db:"description" json:"description"`
	ProjectID   *string `db:"project_id" json:"projectId,omitempty"`
	SectionID   *string `db:"section_id" json:"sectionId,omitempty"`
	Priority    int     `db:"priority" json:"priority"`
	DueText     *string `db:"due_text" json:"dueText,omitempty"`
	DueDeadline *string `db:"due_deadline" json:"dueDeadline,omitempty"`
	Checked     bool    `db:"checked" json:"checked"`
	IsDeleted   bool    `db:"is_deleted" json:"isDeleted"`
	CreatedAt   string  `db:"created_at" json:"createdAt"`
	UpdatedAt   string  `db:"updated_at" json:"updatedAt"`
}

type CreateInput struct {
	Content     string
	Description string
	ProjectID   *string
	SectionID   *string
	Priority    int
	DueText     *string
	DueDeadline *string
}

type UpdateInput struct {
	Content     *string
	Description *string
	ProjectID   *string
	SectionID   *string
	Priority    *int
	DueText     *string
	DueDeadline *string
}

type ListParams struct {
	ProjectID *string
	Limit     int
	Cursor    int
}

type ListResult struct {
	Items      []Task `json:"items"`
	NextCursor *int   `json:"nextCursor,omitempty"`
	Total      int    `json:"total"`
}
