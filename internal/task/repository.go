package task

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	apperrors "donegeon/internal/errors"
)

type Repository struct {
	db      *sqlx.DB
	queries map[string]string
}

func NewRepository(db *sqlx.DB, queries map[string]string) *Repository {
	return &Repository{db: db, queries: queries}
}

func (r *Repository) query(name string) (string, error) {
	q, ok := r.queries[name]
	if !ok {
		return "", fmt.Errorf("missing embedded query: %s", name)
	}
	return q, nil
}

func (r *Repository) List(ctx context.Context, params ListParams) (ListResult, error) {
	if params.Limit <= 0 {
		params.Limit = 50
	}
	if params.Limit > 200 {
		params.Limit = 200
	}
	if params.Cursor < 0 {
		params.Cursor = 0
	}

	listQuery, err := r.query("task_list.sql")
	if err != nil {
		return ListResult{}, err
	}
	countQuery, err := r.query("task_count.sql")
	if err != nil {
		return ListResult{}, err
	}

	args := map[string]any{
		"project_id": nullableString(params.ProjectID),
		"limit":      params.Limit,
		"offset":     params.Cursor,
	}

	items := []Task{}
	named, bindArgs, err := sqlx.Named(listQuery, args)
	if err != nil {
		return ListResult{}, err
	}
	named = r.db.Rebind(named)
	if err := r.db.SelectContext(ctx, &items, named, bindArgs...); err != nil {
		return ListResult{}, err
	}

	var total int
	namedCount, bindCountArgs, err := sqlx.Named(countQuery, map[string]any{"project_id": nullableString(params.ProjectID)})
	if err != nil {
		return ListResult{}, err
	}
	namedCount = r.db.Rebind(namedCount)
	if err := r.db.GetContext(ctx, &total, namedCount, bindCountArgs...); err != nil {
		return ListResult{}, err
	}

	var next *int
	if params.Cursor+len(items) < total {
		n := params.Cursor + len(items)
		next = &n
	}

	return ListResult{Items: items, NextCursor: next, Total: total}, nil
}

func (r *Repository) Get(ctx context.Context, id string) (Task, error) {
	query, err := r.query("task_get.sql")
	if err != nil {
		return Task{}, err
	}

	var t Task
	if err := r.db.GetContext(ctx, &t, query, id); err != nil {
		if err == sql.ErrNoRows {
			return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "task not found"), "taskId")
		}
		return Task{}, err
	}
	return t, nil
}

func (r *Repository) Create(ctx context.Context, in CreateInput) (Task, error) {
	if in.Priority == 0 {
		in.Priority = 4
	}
	if in.Priority < 1 || in.Priority > 4 {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "priority must be 1..4"), "priority")
	}
	if in.Content == "" {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "content is required"), "content")
	}

	query, err := r.query("task_create.sql")
	if err != nil {
		return Task{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	id := uuid.NewString()
	sortOrder := in.SortOrder
	if sortOrder == 0 {
		sortOrder = time.Now().UTC().UnixMilli()
	}
	args := map[string]any{
		"id":              id,
		"content":         in.Content,
		"description":     in.Description,
		"project_id":      nullableString(in.ProjectID),
		"section_id":      nullableString(in.SectionID),
		"sort_order":      sortOrder,
		"recurrence_rule": nullableString(in.Recurrence),
		"priority":        in.Priority,
		"due_text":        nullableString(in.DueText),
		"due_deadline":    nullableString(in.DueDeadline),
		"created_at":      now,
		"updated_at":      now,
	}

	if _, err := r.db.NamedExecContext(ctx, query, args); err != nil {
		return Task{}, err
	}
	return r.Get(ctx, id)
}

func (r *Repository) Update(ctx context.Context, id string, in UpdateInput) (Task, error) {
	if in.Content != nil && *in.Content == "" {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "content is required"), "content")
	}
	if in.Priority != nil && (*in.Priority < 1 || *in.Priority > 4) {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "priority must be 1..4"), "priority")
	}

	query, err := r.query("task_update.sql")
	if err != nil {
		return Task{}, err
	}

	args := map[string]any{
		"id":              id,
		"content":         nullableString(in.Content),
		"description":     nullableString(in.Description),
		"project_id":      nullableString(in.ProjectID),
		"section_id":      nullableString(in.SectionID),
		"sort_order":      nullableInt64(in.SortOrder),
		"recurrence_rule": nullableString(in.Recurrence),
		"priority":        nullableInt(in.Priority),
		"due_text":        nullableString(in.DueText),
		"due_deadline":    nullableString(in.DueDeadline),
		"updated_at":      time.Now().UTC().Format(time.RFC3339),
	}

	res, err := r.db.NamedExecContext(ctx, query, args)
	if err != nil {
		return Task{}, err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "task not found"), "taskId")
	}

	return r.Get(ctx, id)
}

func (r *Repository) Close(ctx context.Context, id string) error {
	query, err := r.query("task_close.sql")
	if err != nil {
		return err
	}
	res, err := r.db.ExecContext(ctx, query, time.Now().UTC().Format(time.RFC3339), id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "task not found"), "taskId")
	}
	return nil
}

func (r *Repository) Reopen(ctx context.Context, id string) error {
	query, err := r.query("task_reopen.sql")
	if err != nil {
		return err
	}
	res, err := r.db.ExecContext(ctx, query, time.Now().UTC().Format(time.RFC3339), id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "task not found"), "taskId")
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	query, err := r.query("task_delete.sql")
	if err != nil {
		return err
	}
	res, err := r.db.ExecContext(ctx, query, time.Now().UTC().Format(time.RFC3339), id)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "task not found"), "taskId")
	}
	return nil
}

func nullableString(value *string) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableInt(value *int) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullableInt64(value *int64) any {
	if value == nil {
		return nil
	}
	return *value
}
