package task

type Task struct {
	ID             string   `db:"id" json:"id"`
	Content        string   `db:"content" json:"content"`
	Description    string   `db:"description" json:"description"`
	ProjectID      *string  `db:"project_id" json:"projectId,omitempty"`
	SectionID      *string  `db:"section_id" json:"sectionId,omitempty"`
	SortOrder      int64    `db:"sort_order" json:"sortOrder"`
	Recurrence     *string  `db:"recurrence_rule" json:"recurrenceRule,omitempty"`
	Priority       int      `db:"priority" json:"priority"`
	DueText        *string  `db:"due_text" json:"dueText,omitempty"`
	DueDeadline    *string  `db:"due_deadline" json:"dueDeadline,omitempty"`
	ScheduleInput  *string  `db:"schedule_input" json:"scheduleInput,omitempty"`
	Labels         []string `db:"-" json:"labels"`
	ProcessedCount int      `db:"processed_count" json:"processedCount"`
	Checked        bool     `db:"checked" json:"checked"`
	IsDeleted      bool     `db:"is_deleted" json:"isDeleted"`
	CreatedAt      string   `db:"created_at" json:"createdAt"`
	UpdatedAt      string   `db:"updated_at" json:"updatedAt"`
}

type CreateInput struct {
	Content       string
	Description   string
	ProjectID     *string
	SectionID     *string
	SortOrder     int64
	Recurrence    *string
	Priority      int
	DueText       *string
	DueDeadline   *string
	ScheduleInput *string
	Labels        []string
}

type UpdateInput struct {
	Content            *string
	Description        *string
	ProjectID          *string
	SectionID          *string
	SortOrder          *int64
	Recurrence         *string
	ClearRecurrence    bool
	Priority           *int
	DueText            *string
	ClearDueText       bool
	DueDeadline        *string
	ClearDueDeadline   bool
	ScheduleInput      *string
	ClearScheduleInput bool
	Labels             *[]string
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
