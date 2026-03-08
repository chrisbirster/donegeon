package database

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// RunMigrations runs migrations against a local SQLite file.
func RunMigrations(dbPath string) error {
	db, err := sql.Open("sqlite", sqliteDSN(dbPath))
	if err != nil {
		return fmt.Errorf("open sqlite for migrations: %w", err)
	}
	defer func() {
		_ = db.Close()
	}()
	return runMigrationsOnDB(db)
}

// RunMigrationsTurso runs migrations against a remote Turso database.
func RunMigrationsTurso(dbURL string, authToken string) error {
	dsn := strings.TrimSpace(dbURL)
	if dsn == "" {
		return fmt.Errorf("turso database url is required")
	}
	if token := strings.TrimSpace(authToken); token != "" {
		dsn = dsn + "?authToken=" + token
	}
	db, err := sql.Open("libsql", dsn)
	if err != nil {
		return fmt.Errorf("open turso for migrations: %w", err)
	}
	defer func() {
		_ = db.Close()
	}()
	return runMigrationsOnDB(db)
}

func runMigrationsOnDB(db *sql.DB) error {
	sourceDriver, err := iofs.New(MigrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("create migration source: %w", err)
	}

	dbDriver, err := sqlite3.WithInstance(db, &sqlite3.Config{})
	if err != nil {
		return fmt.Errorf("create sqlite migration driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", sourceDriver, "sqlite3", dbDriver)
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}
	defer func() {
		_, _ = m.Close()
	}()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("run migrations: %w", err)
	}
	return nil
}
