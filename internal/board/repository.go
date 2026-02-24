package board

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
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

func (r *Repository) Load(ctx context.Context, boardID string) (*State, error) {
	query, err := r.query("board_get.sql")
	if err != nil {
		return nil, err
	}

	var raw string
	if err := r.db.GetContext(ctx, &raw, query, boardID); err != nil {
		if err == sql.ErrNoRows {
			return NewState(), nil
		}
		return nil, err
	}

	state := NewState()
	if err := json.Unmarshal([]byte(raw), state); err != nil {
		return nil, fmt.Errorf("decode board state: %w", err)
	}
	state.normalize()
	return state, nil
}

func (r *Repository) Save(ctx context.Context, boardID string, state *State) error {
	query, err := r.query("board_upsert.sql")
	if err != nil {
		return err
	}
	if state == nil {
		state = NewState()
	}
	state.normalize()

	b, err := json.Marshal(state)
	if err != nil {
		return fmt.Errorf("encode board state: %w", err)
	}

	args := map[string]any{
		"board_id":   boardID,
		"state_json": string(b),
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}

	if _, err := r.db.NamedExecContext(ctx, query, args); err != nil {
		return err
	}
	return nil
}
