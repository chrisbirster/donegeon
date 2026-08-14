package httpapi

import (
	"io/fs"
	"net/http"
	"path"
	"strings"

	"donegeon/internal/board"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/tenant"
)

func boardIDFromProjectID(projectID string) (string, bool, error) {
	slug := tenant.ProjectSlug(projectID)
	if !tenant.IsBoardProject(slug) {
		return "", false, nil
	}
	boardID := slug
	if strings.EqualFold(slug, "board") {
		boardID = board.DefaultBoardID
	}
	normalized, err := board.NormalizeBoardID(boardID)
	if err != nil {
		return "", true, err
	}
	normalized = strings.ToLower(strings.TrimSpace(normalized))
	if normalized == "" {
		normalized = board.DefaultBoardID
	}
	return normalized, true, nil
}

func boardIDFromRequest(r *http.Request) string {
	return strings.TrimSpace(r.URL.Query().Get("board"))
}

func ptrInt64Value(value *int64) int64 {
	if value == nil {
		return 0
	}
	return *value
}

func asAppError(err error, target **apperrors.AppError) bool {
	if err == nil {
		return false
	}
	appErr, ok := err.(*apperrors.AppError)
	if ok {
		*target = appErr
		return true
	}
	return false
}

func asBoardMemberAppError(err error, field string) error {
	if err == nil {
		return nil
	}
	message := strings.TrimSpace(err.Error())
	code := apperrors.CodeValidationError
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "only team owners or admins"),
		strings.Contains(lower, "not a member of this team"),
		strings.Contains(lower, "no access to this board"),
		strings.Contains(lower, "cannot remove yourself"):
		code = apperrors.CodeForbidden
	}

	appErr := apperrors.New(code, message)
	if strings.TrimSpace(field) != "" {
		return apperrors.WithField(appErr, field)
	}
	return appErr
}

type loggingResponseWriter struct {
	http.ResponseWriter
	status       int
	bytesWritten int
	errBody      []byte // captured for error responses (4xx/5xx)
}

func (w *loggingResponseWriter) WriteHeader(statusCode int) {
	w.status = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *loggingResponseWriter) Write(p []byte) (int, error) {
	n, err := w.ResponseWriter.Write(p)
	w.bytesWritten += n
	// Capture response body for error statuses so the logging middleware can include it.
	if w.status >= 400 && len(w.errBody) < 2048 {
		w.errBody = append(w.errBody, p...)
	}
	return n, err
}

func newSPAHandler(content fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if cleanPath == "" || cleanPath == "." {
			http.ServeFileFS(w, r, content, "index.html")
			return
		}

		if hasStaticFile(content, cleanPath) {
			if strings.HasPrefix(cleanPath, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			http.ServeFileFS(w, r, content, cleanPath)
			return
		}

		http.ServeFileFS(w, r, content, "index.html")
	})
}

func hasStaticFile(content fs.FS, name string) bool {
	if !fs.ValidPath(name) {
		return false
	}
	stat, err := fs.Stat(content, name)
	if err != nil {
		return false
	}
	return !stat.IsDir()
}
