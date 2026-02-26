package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/jmoiron/sqlx"
	"gopkg.in/yaml.v3"

	"donegeon/internal/account"
	"donegeon/internal/config"
	"donegeon/internal/datbase"
	"donegeon/internal/project"
	"donegeon/internal/quickadd"
	"donegeon/internal/task"
	"donegeon/internal/todoistcompat"
)

type todoistParitySpec struct {
	Tests []todoistParityCase `yaml:"tests"`
}

type todoistParityCase struct {
	TestID      string `yaml:"test_id"`
	Description string `yaml:"description"`
	Given       struct {
		User struct {
			Authenticated bool    `yaml:"authenticated"`
			Token         *string `yaml:"token"`
		} `yaml:"user"`
		RateLimit struct {
			Force bool `yaml:"force"`
		} `yaml:"rateLimit"`
		Projects []struct {
			ID             string `yaml:"id"`
			Name           string `yaml:"name"`
			IsInboxProject bool   `yaml:"isInboxProject"`
			IsShared       bool   `yaml:"isShared"`
		} `yaml:"projects"`
		Sections []struct {
			ID        string `yaml:"id"`
			ProjectID string `yaml:"projectId"`
			Name      string `yaml:"name"`
		} `yaml:"sections"`
		Labels []struct {
			ID   string `yaml:"id"`
			Name string `yaml:"name"`
		} `yaml:"labels"`
		Tasks []struct {
			ID          string   `yaml:"id"`
			Content     string   `yaml:"content"`
			Description string   `yaml:"description"`
			ProjectID   *string  `yaml:"projectId"`
			SectionID   *string  `yaml:"sectionId"`
			Labels      []string `yaml:"labels"`
			Priority    int      `yaml:"priority"`
			Due         *struct {
				Date        string `yaml:"date"`
				IsRecurring bool   `yaml:"isRecurring"`
			} `yaml:"due"`
			Checked   bool `yaml:"checked"`
			IsDeleted bool `yaml:"isDeleted"`
		} `yaml:"tasks"`
		Comments []struct {
			ID      string  `yaml:"id"`
			TaskID  *string `yaml:"taskId"`
			Content string  `yaml:"content"`
		} `yaml:"comments"`
		Workspaces []struct {
			ID   string `yaml:"id"`
			Name string `yaml:"name"`
		} `yaml:"workspaces"`
		WorkspaceInvitations []struct {
			InvitationCode string `yaml:"invitationCode"`
			WorkspaceID    string `yaml:"workspaceId"`
			Email          string `yaml:"email"`
		} `yaml:"workspaceInvitations"`
	} `yaml:"given"`
	When struct {
		Action  string         `yaml:"action"`
		Payload map[string]any `yaml:"payload"`
	} `yaml:"when"`
	Then struct {
		Success bool `yaml:"success"`
		Error   struct {
			Code string `yaml:"code"`
		} `yaml:"error"`
	} `yaml:"then"`
}

type parityEnv struct {
	server *httptest.Server
	db     *sqlx.DB
}

func TestTodoistParityNonUploadActions(t *testing.T) {
	specPath := filepath.Join("..", "..", "docs", "test-cases-todoist-parity-archive.yaml")
	raw, err := os.ReadFile(specPath)
	if err != nil {
		t.Fatalf("read parity archive: %v", err)
	}

	var spec todoistParitySpec
	if err := yaml.Unmarshal(raw, &spec); err != nil {
		t.Fatalf("decode parity archive: %v", err)
	}

	executedByAction := map[string]int{}
	actionsDiscovered := map[string]struct{}{}
	considered := 0

	for _, testCase := range spec.Tests {
		action := strings.TrimSpace(testCase.When.Action)
		if action == "" || action == "parse_quick_add_text" || isUploadAction(action) {
			continue
		}
		considered++
		actionsDiscovered[action] = struct{}{}

		tc := testCase
		t.Run(tc.TestID, func(t *testing.T) {
			env := newParityEnv(t)
			defer env.server.Close()
			env.seedFixtures(t, tc)

			req, err := env.newRequest(tc)
			if err != nil {
				t.Fatalf("build request: %v", err)
			}
			applyCaseHeaders(req, tc)

			resp, err := env.server.Client().Do(req)
			if err != nil {
				t.Fatalf("execute request: %v", err)
			}
			defer resp.Body.Close()

			body, _ := io.ReadAll(resp.Body)
			assertCaseResponse(t, tc, resp.StatusCode, body)
			executedByAction[action]++
		})
	}

	if considered == 0 {
		t.Fatal("no parity cases were considered")
	}

	for action := range actionsDiscovered {
		if executedByAction[action] == 0 {
			t.Fatalf("no executable cases ran for parity action %q", action)
		}
	}
}

func newParityEnv(t *testing.T) *parityEnv {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "httpapi-parity.db")
	if err := datbase.RunMigrations(dbPath); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	db, err := datbase.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	queries, err := datbase.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	parser := quickadd.NewParser()
	taskSvc := task.NewService(task.NewRepository(db, queries), parser)
	projectSvc := project.NewService(project.NewRepository(db, queries))
	compatSvc := todoistcompat.NewService(db, taskSvc, projectSvc)
	accountSvc := account.NewService(db)

	cfg := config.Config{
		RequireAuth:      true,
		WriteToken:       "TOKEN_VALID",
		ReadOnlyToken:    "TOKEN_READONLY",
		CookieSigningKey: "test-signing-key",
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	staticFS := fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<html><body>ok</body></html>")},
	}

	handler := New(logger, cfg, taskSvc, projectSvc, nil, parser, compatSvc, accountSvc, staticFS)
	server := httptest.NewServer(handler)

	return &parityEnv{
		server: server,
		db:     db,
	}
}

func (e *parityEnv) seedFixtures(t *testing.T, testCase todoistParityCase) {
	t.Helper()
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := e.db.BeginTxx(ctx, nil)
	if err != nil {
		t.Fatalf("begin seed tx: %v", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	for _, workspace := range testCase.Given.Workspaces {
		id := strings.TrimSpace(workspace.ID)
		if id == "" {
			continue
		}
		name := strings.TrimSpace(workspace.Name)
		if name == "" {
			name = id
		}
		if _, err := tx.ExecContext(ctx, `
INSERT OR REPLACE INTO workspaces (id, name, plan, is_archived, created_at, updated_at)
VALUES (?, ?, 'free', 0, ?, ?)
`, id, name, now, now); err != nil {
			t.Fatalf("seed workspace %q: %v", id, err)
		}

		if _, err := tx.ExecContext(ctx, `
INSERT OR IGNORE INTO workspace_users (workspace_id, user_id, email, name, role, created_at)
VALUES (?, 'U1', 'owner@example.com', 'Owner', 'owner', ?)
`, id, now); err != nil {
			t.Fatalf("seed workspace user %q: %v", id, err)
		}
	}

	defaultWorkspaceID := ""
	if len(testCase.Given.Workspaces) > 0 {
		defaultWorkspaceID = strings.TrimSpace(testCase.Given.Workspaces[0].ID)
	}

	for _, fixture := range testCase.Given.Projects {
		id := strings.TrimSpace(fixture.ID)
		if id == "" {
			continue
		}
		name := strings.TrimSpace(fixture.Name)
		if name == "" {
			name = id
		}
		workspaceID := ""
		if fixture.IsShared {
			workspaceID = defaultWorkspaceID
		}
		if _, err := tx.ExecContext(ctx, `
INSERT OR REPLACE INTO projects (id, name, is_inbox_project, is_archived, is_favorite, workspace_id, created_at, updated_at)
VALUES (?, ?, ?, 0, 0, ?, ?, ?)
`, id, name, boolInt(fixture.IsInboxProject), nullableString(workspaceID), now, now); err != nil {
			t.Fatalf("seed project %q: %v", id, err)
		}
	}

	labelIDsByName := make(map[string]string, len(testCase.Given.Labels))
	for _, fixture := range testCase.Given.Labels {
		id := strings.TrimSpace(fixture.ID)
		if id == "" {
			continue
		}
		name := strings.TrimSpace(fixture.Name)
		if name == "" {
			name = id
		}
		if _, err := tx.ExecContext(ctx, `
INSERT OR REPLACE INTO labels (id, name, color, created_at, updated_at)
VALUES (?, ?, NULL, ?, ?)
`, id, name, now, now); err != nil {
			t.Fatalf("seed label %q: %v", id, err)
		}
		labelIDsByName[strings.ToLower(name)] = id
	}

	for _, fixture := range testCase.Given.Sections {
		id := strings.TrimSpace(fixture.ID)
		if id == "" {
			continue
		}
		projectID := strings.TrimSpace(fixture.ProjectID)
		name := strings.TrimSpace(fixture.Name)
		if name == "" {
			name = id
		}
		if _, err := tx.ExecContext(ctx, `
INSERT OR REPLACE INTO sections (id, project_id, name, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
`, id, projectID, name, now, now); err != nil {
			t.Fatalf("seed section %q: %v", id, err)
		}
	}

	taskProjectByID := make(map[string]string, len(testCase.Given.Tasks))
	for idx, fixture := range testCase.Given.Tasks {
		id := strings.TrimSpace(fixture.ID)
		if id == "" {
			continue
		}
		content := strings.TrimSpace(fixture.Content)
		if content == "" {
			content = "Fixture task"
		}
		projectID := nullableString(ptrStringValue(fixture.ProjectID))
		sectionID := nullableString(ptrStringValue(fixture.SectionID))
		priority := fixture.Priority
		if priority <= 0 {
			priority = 4
		}
		dueText := ""
		dueDeadline := ""
		if fixture.Due != nil {
			dueText = strings.TrimSpace(fixture.Due.Date)
			dueDeadline = dueText
		}

		if _, err := tx.ExecContext(ctx, `
INSERT OR REPLACE INTO tasks (id, content, description, project_id, section_id, sort_order, recurrence_rule, priority, due_text, due_deadline, processed_count, checked, is_deleted, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, ?, ?, ?, ?)
`, id, content, strings.TrimSpace(fixture.Description), projectID, sectionID, idx+1, priority, nullableString(dueText), nullableString(dueDeadline), boolInt(fixture.Checked), boolInt(fixture.IsDeleted), now, now); err != nil {
			t.Fatalf("seed task %q: %v", id, err)
		}

		if fixture.ProjectID != nil {
			taskProjectByID[id] = strings.TrimSpace(*fixture.ProjectID)
		}

		for _, labelName := range fixture.Labels {
			labelID := labelIDsByName[strings.ToLower(strings.TrimSpace(labelName))]
			if labelID == "" {
				continue
			}
			if _, err := tx.ExecContext(ctx, `
INSERT OR IGNORE INTO task_labels (task_id, label_id, created_at)
VALUES (?, ?, ?)
`, id, labelID, now); err != nil {
				t.Fatalf("seed task label task=%q label=%q: %v", id, labelID, err)
			}
		}
	}

	for _, fixture := range testCase.Given.Comments {
		id := strings.TrimSpace(fixture.ID)
		if id == "" {
			continue
		}
		taskID := ptrStringValue(fixture.TaskID)
		projectID := taskProjectByID[taskID]
		if _, err := tx.ExecContext(ctx, `
INSERT OR REPLACE INTO comments (id, task_id, project_id, content, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
`, id, nullableString(taskID), nullableString(projectID), strings.TrimSpace(fixture.Content), now, now); err != nil {
			t.Fatalf("seed comment %q: %v", id, err)
		}
	}

	for _, fixture := range testCase.Given.WorkspaceInvitations {
		code := strings.TrimSpace(fixture.InvitationCode)
		if code == "" {
			continue
		}
		workspaceID := strings.TrimSpace(fixture.WorkspaceID)
		email := strings.TrimSpace(fixture.Email)
		if email == "" {
			email = "invitee@example.com"
		}
		if _, err := tx.ExecContext(ctx, `
INSERT OR REPLACE INTO workspace_invitations (invitation_code, workspace_id, email, status, created_at, updated_at)
VALUES (?, ?, ?, 'pending', ?, ?)
`, code, workspaceID, email, now, now); err != nil {
			t.Fatalf("seed invitation %q: %v", code, err)
		}
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("commit seed tx: %v", err)
	}
}

func (e *parityEnv) newRequest(testCase todoistParityCase) (*http.Request, error) {
	body := map[string]any{
		"action":  strings.TrimSpace(testCase.When.Action),
		"payload": testCase.When.Payload,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, e.server.URL+"/api/todoist/action", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	return req, nil
}

func applyCaseHeaders(req *http.Request, testCase todoistParityCase) {
	req.Header.Set("X-Timezone", "UTC")

	if testCase.Given.User.Authenticated && testCase.Given.User.Token != nil {
		token := strings.TrimSpace(*testCase.Given.User.Token)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
	}

	if testCase.Given.RateLimit.Force {
		req.Header.Set("X-Force-Rate-Limit", "true")
	}
}

func assertCaseResponse(t *testing.T, testCase todoistParityCase, statusCode int, body []byte) {
	t.Helper()

	if testCase.Then.Success {
		if statusCode >= 200 && statusCode < 300 {
			return
		}
		t.Fatalf("expected success for %s, got status=%d body=%s", testCase.TestID, statusCode, strings.TrimSpace(string(body)))
	}

	if statusCode >= 200 && statusCode < 300 {
		t.Fatalf("expected error for %s, got status=%d body=%s", testCase.TestID, statusCode, strings.TrimSpace(string(body)))
	}

	expectedCode := strings.TrimSpace(testCase.Then.Error.Code)
	if expectedCode == "" {
		return
	}

	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("decode error response for %s: %v body=%s", testCase.TestID, err, strings.TrimSpace(string(body)))
	}
	if payload.Error.Code != expectedCode {
		t.Fatalf("error code mismatch for %s: got=%q want=%q status=%d body=%s", testCase.TestID, payload.Error.Code, expectedCode, statusCode, strings.TrimSpace(string(body)))
	}
}

func isUploadAction(action string) bool {
	switch strings.TrimSpace(action) {
	case "uploadFile", "uploadWorkspaceLogo", "deleteUpload":
		return true
	default:
		return false
	}
}

func boolInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

func nullableString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func ptrStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
