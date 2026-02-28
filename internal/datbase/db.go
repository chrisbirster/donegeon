package datbase

import (
	"context"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
	_ "modernc.org/sqlite"
)

func init() {
	// Register the libsql driver bind type so sqlx uses ? placeholders
	// (same as sqlite3) instead of the unknown/default bind type.
	sqlx.BindDriver("libsql", sqlx.QUESTION)
}

// Open connects to a local SQLite file using the modernc driver.
func Open(ctx context.Context, path string) (*sqlx.DB, error) {
	db, err := sqlx.ConnectContext(ctx, "sqlite", sqliteDSN(path))
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetConnMaxIdleTime(2 * time.Minute)
	return db, nil
}

// OpenTurso connects to a remote Turso/libsql database over HTTPS.
func OpenTurso(ctx context.Context, dbURL string, authToken string) (*sqlx.DB, error) {
	dsn := strings.TrimSpace(dbURL)
	if dsn == "" {
		return nil, fmt.Errorf("turso database url is required")
	}
	if token := strings.TrimSpace(authToken); token != "" {
		dsn = dsn + "?authToken=" + token
	}
	db, err := sqlx.ConnectContext(ctx, "libsql", dsn)
	if err != nil {
		return nil, fmt.Errorf("connect to turso: %w", err)
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxIdleTime(5 * time.Minute)
	return db, nil
}

func sqliteDSN(path string) string {
	return fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)", path)
}

func LoadQueries() (map[string]string, error) {
	entries, err := fs.ReadDir(QueriesFS, "queries")
	if err != nil {
		return nil, err
	}

	queries := make(map[string]string, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if filepath.Ext(entry.Name()) != ".sql" {
			continue
		}

		b, err := fs.ReadFile(QueriesFS, filepath.ToSlash(filepath.Join("queries", entry.Name())))
		if err != nil {
			return nil, err
		}
		queries[entry.Name()] = strings.TrimSpace(string(b))
	}
	return queries, nil
}
