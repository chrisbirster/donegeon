package task

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	apperrors "donegeon/internal/errors"
	"donegeon/internal/sessionctx"
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

	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"project_id":   nullableString(params.ProjectID),
		"limit":        params.Limit,
		"offset":       params.Cursor,
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
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
	if err := r.attachLabels(ctx, items); err != nil {
		return ListResult{}, err
	}

	var total int
	namedCount, bindCountArgs, err := sqlx.Named(countQuery, map[string]any{
		"project_id":   nullableString(params.ProjectID),
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
	})
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
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"id":           id,
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
	}

	var t Task
	named, bindArgs, err := sqlx.Named(query, args)
	if err != nil {
		return Task{}, err
	}
	named = r.db.Rebind(named)
	if err := r.db.GetContext(ctx, &t, named, bindArgs...); err != nil {
		if err == sql.ErrNoRows {
			return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "task not found"), "taskId")
		}
		return Task{}, err
	}
	if labels, err := r.taskLabels(ctx, t.ID); err == nil {
		t.Labels = labels
	} else {
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

	principal := sessionctx.PrincipalFromContext(ctx)
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
		"schedule_input":  nullableString(in.ScheduleInput),
		"user_id":         principal.UserID,
		"workspace_id":    principal.WorkspaceID,
		"created_at":      now,
		"updated_at":      now,
	}

	if _, err := r.db.NamedExecContext(ctx, query, args); err != nil {
		return Task{}, err
	}
	if err := r.replaceTaskLabels(ctx, id, in.Labels); err != nil {
		return Task{}, err
	}
	return r.Get(ctx, id)
}

func (r *Repository) CloseRecurringAndCreateNext(ctx context.Context, id string, in CreateInput) error {
	if in.Priority == 0 {
		in.Priority = 4
	}
	if in.Priority < 1 || in.Priority > 4 {
		return apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "priority must be 1..4"), "priority")
	}
	if in.Content == "" {
		return apperrors.WithField(apperrors.New(apperrors.CodeValidationError, "content is required"), "content")
	}

	closeQuery, err := r.query("task_close.sql")
	if err != nil {
		return err
	}
	createQuery, err := r.query("task_create.sql")
	if err != nil {
		return err
	}
	linkQuery, err := r.query("task_label_link_insert_ignore.sql")
	if err != nil {
		return err
	}

	principal := sessionctx.PrincipalFromContext(ctx)
	now := time.Now().UTC().Format(time.RFC3339)
	nextID := uuid.NewString()
	sortOrder := in.SortOrder
	if sortOrder == 0 {
		sortOrder = time.Now().UTC().UnixMilli()
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	closeResult, err := tx.NamedExecContext(ctx, closeQuery, map[string]any{
		"id":           id,
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
		"updated_at":   now,
	})
	if err != nil {
		return err
	}
	rows, _ := closeResult.RowsAffected()
	if rows == 0 {
		return apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "task not found"), "taskId")
	}

	if _, err := tx.NamedExecContext(ctx, createQuery, map[string]any{
		"id":              nextID,
		"content":         in.Content,
		"description":     in.Description,
		"project_id":      nullableString(in.ProjectID),
		"section_id":      nullableString(in.SectionID),
		"sort_order":      sortOrder,
		"recurrence_rule": nullableString(in.Recurrence),
		"priority":        in.Priority,
		"due_text":        nullableString(in.DueText),
		"due_deadline":    nullableString(in.DueDeadline),
		"schedule_input":  nullableString(in.ScheduleInput),
		"user_id":         principal.UserID,
		"workspace_id":    principal.WorkspaceID,
		"created_at":      now,
		"updated_at":      now,
	}); err != nil {
		return err
	}

	for _, label := range normalizeLabels(in.Labels) {
		labelID, err := r.findOrCreateLabel(ctx, tx, principal, label, now)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, linkQuery, nextID, labelID, now); err != nil {
			return err
		}
	}

	return tx.Commit()
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

	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"id":                   id,
		"content":              nullableString(in.Content),
		"description":          nullableString(in.Description),
		"project_id":           nullableString(in.ProjectID),
		"section_id":           nullableString(in.SectionID),
		"sort_order":           nullableInt64(in.SortOrder),
		"recurrence_rule":      nullableString(in.Recurrence),
		"clear_recurrence_rule": boolToInt(in.ClearRecurrence),
		"priority":             nullableInt(in.Priority),
		"due_text":             nullableString(in.DueText),
		"clear_due_text":       boolToInt(in.ClearDueText),
		"due_deadline":         nullableString(in.DueDeadline),
		"clear_due_deadline":   boolToInt(in.ClearDueDeadline),
		"schedule_input":       nullableString(in.ScheduleInput),
		"clear_schedule_input": boolToInt(in.ClearScheduleInput),
		"user_id":              principal.UserID,
		"workspace_id":         principal.WorkspaceID,
		"updated_at":           time.Now().UTC().Format(time.RFC3339),
	}

	res, err := r.db.NamedExecContext(ctx, query, args)
	if err != nil {
		return Task{}, err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return Task{}, apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "task not found"), "taskId")
	}
	if in.Labels != nil {
		if err := r.replaceTaskLabels(ctx, id, *in.Labels); err != nil {
			return Task{}, err
		}
	}

	return r.Get(ctx, id)
}

func (r *Repository) Close(ctx context.Context, id string) error {
	query, err := r.query("task_close.sql")
	if err != nil {
		return err
	}
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"id":           id,
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	}
	res, err := r.db.NamedExecContext(ctx, query, args)
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
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"id":           id,
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	}
	res, err := r.db.NamedExecContext(ctx, query, args)
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
	principal := sessionctx.PrincipalFromContext(ctx)
	args := map[string]any{
		"id":           id,
		"user_id":      principal.UserID,
		"workspace_id": principal.WorkspaceID,
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	}
	res, err := r.db.NamedExecContext(ctx, query, args)
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

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func (r *Repository) attachLabels(ctx context.Context, tasks []Task) error {
	if len(tasks) == 0 {
		return nil
	}

	ids := make([]string, 0, len(tasks))
	for _, item := range tasks {
		if item.ID != "" {
			ids = append(ids, item.ID)
		}
	}
	if len(ids) == 0 {
		return nil
	}

	queryTemplate, err := r.query("task_labels_by_task_ids.sql")
	if err != nil {
		return err
	}
	query, args, err := sqlx.In(queryTemplate, ids)
	if err != nil {
		return err
	}

	query = r.db.Rebind(query)

	type taskLabelRow struct {
		TaskID string `db:"task_id"`
		Name   string `db:"name"`
	}

	rows := make([]taskLabelRow, 0, len(ids))
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return err
	}

	labelsByTaskID := make(map[string][]string, len(ids))
	for _, row := range rows {
		labelsByTaskID[row.TaskID] = append(labelsByTaskID[row.TaskID], row.Name)
	}

	for i := range tasks {
		taskID := tasks[i].ID
		labels := labelsByTaskID[taskID]
		if labels == nil {
			tasks[i].Labels = []string{}
			continue
		}
		tasks[i].Labels = labels
	}

	return nil
}

func (r *Repository) taskLabels(ctx context.Context, taskID string) ([]string, error) {
	if strings.TrimSpace(taskID) == "" {
		return []string{}, nil
	}

	query, err := r.query("task_labels_by_task_id.sql")
	if err != nil {
		return nil, err
	}

	rows := make([]struct {
		Name string `db:"name"`
	}, 0, 4)
	if err := r.db.SelectContext(ctx, &rows, query, taskID); err != nil {
		return nil, err
	}

	labels := make([]string, 0, len(rows))
	for _, row := range rows {
		labels = append(labels, row.Name)
	}
	return labels, nil
}

func (r *Repository) replaceTaskLabels(ctx context.Context, taskID string, labels []string) error {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil
	}

	principal := sessionctx.PrincipalFromContext(ctx)
	normalized := normalizeLabels(labels)

	deleteQuery, err := r.query("task_labels_delete_by_task_id.sql")
	if err != nil {
		return err
	}
	linkQuery, err := r.query("task_label_link_insert_ignore.sql")
	if err != nil {
		return err
	}

	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(ctx, deleteQuery, taskID); err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	for _, label := range normalized {
		labelID, err := r.findOrCreateLabel(ctx, tx, principal, label, now)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, linkQuery, taskID, labelID, now); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *Repository) findOrCreateLabel(ctx context.Context, tx *sqlx.Tx, principal sessionctx.Principal, label string, now string) (string, error) {
	findQuery, err := r.query("label_find_by_name_user_workspace.sql")
	if err != nil {
		return "", err
	}
	insertQuery, err := r.query("label_insert.sql")
	if err != nil {
		return "", err
	}

	var labelID string
	if err := tx.GetContext(ctx, &labelID, findQuery, label, principal.UserID, principal.WorkspaceID); err != nil {
		if err != sql.ErrNoRows {
			return "", err
		}
		labelID = uuid.NewString()
		if _, err := tx.ExecContext(ctx, insertQuery, labelID, label, principal.UserID, principal.WorkspaceID, now, now); err != nil {
			return "", err
		}
	}
	return labelID, nil
}

func normalizeLabels(labels []string) []string {
	if len(labels) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(labels))
	normalized := make([]string, 0, len(labels))

	for _, raw := range labels {
		label := strings.TrimSpace(raw)
		label = strings.TrimPrefix(label, "@")
		label = strings.ToLower(label)
		if label == "" {
			continue
		}
		if _, ok := seen[label]; ok {
			continue
		}
		seen[label] = struct{}{}
		normalized = append(normalized, label)
	}

	return normalized
}
