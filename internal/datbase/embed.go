package datbase

import "embed"

// QueriesFS embeds SQL query templates under internal/datbase/queries/*.sql.
//
//go:embed queries/*.sql
var QueriesFS embed.FS

// MigrationsFS embeds SQL migrations under internal/datbase/migrations/*.sql.
//
//go:embed migrations/*.sql
var MigrationsFS embed.FS
