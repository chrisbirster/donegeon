package project

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

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

func (r *Repository) List(ctx context.Context, params ListParams) ([]Project, error) {
	listQuery, err := r.query("project_list.sql")
	if err != nil {
		return nil, err
	}

	args := map[string]any{
		"include_archived": boolAsInt(params.IncludeArchived),
	}

	rows := []Project{}
	named, bindArgs, err := sqlx.Named(listQuery, args)
	if err != nil {
		return nil, err
	}
	named = r.db.Rebind(named)
	if err := r.db.SelectContext(ctx, &rows, named, bindArgs...); err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *Repository) Get(ctx context.Context, id string) (Project, error) {
	query, err := r.query("project_get.sql")
	if err != nil {
		return Project{}, err
	}

	var row Project
	if err := r.db.GetContext(ctx, &row, query, id); err != nil {
		if err == sql.ErrNoRows {
			return Project{}, apperrors.WithField(apperrors.New(apperrors.CodeNotFound, "project not found"), "projectId")
		}
		return Project{}, err
	}
	return row, nil
}

func (r *Repository) Upsert(ctx context.Context, id string, in UpsertInput) (Project, error) {
	query, err := r.query("project_upsert.sql")
	if err != nil {
		return Project{}, err
	}

	name := cleanName(id)
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		name = strings.TrimSpace(*in.Name)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	args := map[string]any{
		"id":          id,
		"name":        name,
		"is_favorite": nullableBoolAsInt(in.IsFavorite),
		"updated_at":  now,
		"created_at":  now,
	}

	if _, err := r.db.NamedExecContext(ctx, query, args); err != nil {
		return Project{}, err
	}

	return r.Get(ctx, id)
}

func boolAsInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func nullableBoolAsInt(value *bool) any {
	if value == nil {
		return nil
	}
	if *value {
		return 1
	}
	return 0
}

func cleanName(id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return id
	}
	return id
}
