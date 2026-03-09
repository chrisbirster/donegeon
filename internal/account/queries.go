package account

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
)

func (s *Service) query(name string) (string, error) {
	q, ok := s.queries[name]
	if !ok {
		return "", fmt.Errorf("missing embedded query: %s", name)
	}
	return q, nil
}

func (s *Service) exec(ctx context.Context, name string, args ...any) (sql.Result, error) {
	q, err := s.query(name)
	if err != nil {
		return nil, err
	}
	return s.db.ExecContext(ctx, q, args...)
}

func (s *Service) txExec(ctx context.Context, tx *sqlx.Tx, name string, args ...any) (sql.Result, error) {
	q, err := s.query(name)
	if err != nil {
		return nil, err
	}
	return tx.ExecContext(ctx, q, args...)
}

func (s *Service) get(ctx context.Context, dest any, name string, args ...any) error {
	q, err := s.query(name)
	if err != nil {
		return err
	}
	return s.db.GetContext(ctx, dest, q, args...)
}

func (s *Service) txGet(ctx context.Context, tx *sqlx.Tx, dest any, name string, args ...any) error {
	q, err := s.query(name)
	if err != nil {
		return err
	}
	return tx.GetContext(ctx, dest, q, args...)
}

func (s *Service) selectRows(ctx context.Context, dest any, name string, args ...any) error {
	q, err := s.query(name)
	if err != nil {
		return err
	}
	return s.db.SelectContext(ctx, dest, q, args...)
}

func (s *Service) txSelectRows(ctx context.Context, tx *sqlx.Tx, dest any, name string, args ...any) error {
	q, err := s.query(name)
	if err != nil {
		return err
	}
	return tx.SelectContext(ctx, dest, q, args...)
}

func (s *Service) getQueryer(ctx context.Context, db sqlx.QueryerContext, dest any, name string, args ...any) error {
	q, err := s.query(name)
	if err != nil {
		return err
	}
	return sqlx.GetContext(ctx, db, dest, q, args...)
}
