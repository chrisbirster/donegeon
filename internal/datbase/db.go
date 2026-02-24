package datbase

import (
	"context"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

func Open(ctx context.Context, path string) (*sqlx.DB, error) {
	db, err := sqlx.ConnectContext(ctx, "sqlite", sqliteDSN(path))
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetConnMaxIdleTime(2 * time.Minute)
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
