package task

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"testing"

	"donegeon/internal/database"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/quickadd"
	"donegeon/internal/sessionctx"
)

func TestServiceTaskLifecycleContract(t *testing.T) {
	t.Parallel()

	service := newLifecycleTestService(t)
	ctx := principalContext("owner", "workspace-a")

	created, err := service.Create(ctx, CreateInput{
		Content:     "draft launch notes",
		Description: "first draft",
		Priority:    3,
		SortOrder:   100,
		Labels:      []string{"Work", "@Writing", "work"},
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	if created.ID == "" {
		t.Fatal("create task: expected id")
	}
	assertTaskCore(t, created, "draft launch notes", "first draft", 3, 100, false, 0)
	if !slices.Equal(created.Labels, []string{"work", "writing"}) {
		t.Fatalf("create task labels: got=%v want=[work writing]", created.Labels)
	}

	got, err := service.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("get created task: %v", err)
	}
	assertTaskCore(t, got, "draft launch notes", "first draft", 3, 100, false, 0)

	listed, err := service.List(ctx, ListParams{Limit: 50})
	if err != nil {
		t.Fatalf("list created task: %v", err)
	}
	if listed.Total != 1 || len(listed.Items) != 1 || listed.Items[0].ID != created.ID {
		t.Fatalf("list created task: total=%d ids=%v", listed.Total, taskIDs(listed.Items))
	}

	content := "publish launch notes"
	description := "reviewed copy"
	projectID := "product"
	sectionID := "release"
	sortOrder := int64(200)
	priority := 1
	dueText := "2026-09-01T09:00:00-04:00"
	deadline := "2026-08-31T17:00:00-04:00"
	scheduleInput := "publish launch notes sep 1 at 9am"
	labels := []string{"Release", "Writing"}

	updated, err := service.Update(ctx, created.ID, UpdateInput{
		Content:       &content,
		Description:   &description,
		ProjectID:     &projectID,
		SectionID:     &sectionID,
		SortOrder:     &sortOrder,
		Priority:      &priority,
		DueText:       &dueText,
		DueDeadline:   &deadline,
		ScheduleInput: &scheduleInput,
		Labels:        &labels,
	})
	if err != nil {
		t.Fatalf("update task: %v", err)
	}
	assertTaskCore(t, updated, content, description, priority, sortOrder, false, 0)
	assertStringPtr(t, "project", updated.ProjectID, projectID)
	assertStringPtr(t, "section", updated.SectionID, sectionID)
	assertStringPtr(t, "due text", updated.DueText, dueText)
	assertStringPtr(t, "deadline", updated.DueDeadline, deadline)
	assertStringPtr(t, "schedule input", updated.ScheduleInput, scheduleInput)
	if !slices.Equal(updated.Labels, []string{"release", "writing"}) {
		t.Fatalf("update task labels: got=%v want=[release writing]", updated.Labels)
	}

	persisted, err := service.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("get updated task: %v", err)
	}
	if persisted.Content != updated.Content || persisted.Description != updated.Description || persisted.Priority != updated.Priority || persisted.SortOrder != updated.SortOrder {
		t.Fatalf("updated task did not persist: got=%+v want=%+v", persisted, updated)
	}
	if !slices.Equal(persisted.Labels, updated.Labels) {
		t.Fatalf("updated labels did not persist: got=%v want=%v", persisted.Labels, updated.Labels)
	}

	cleared, err := service.Update(ctx, created.ID, UpdateInput{ClearDueText: true, ClearDueDeadline: true})
	if err != nil {
		t.Fatalf("clear due fields: %v", err)
	}
	if cleared.DueText != nil || cleared.DueDeadline != nil {
		t.Fatalf("clear due fields: due=%v deadline=%v", cleared.DueText, cleared.DueDeadline)
	}

	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close task: %v", err)
	}
	closed, err := service.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("get closed task: %v", err)
	}
	if !closed.Checked || closed.ProcessedCount != 1 {
		t.Fatalf("close task state: checked=%v processed=%d", closed.Checked, closed.ProcessedCount)
	}

	if err := service.Close(ctx, created.ID); err != nil {
		t.Fatalf("close task idempotently: %v", err)
	}
	closedAgain, err := service.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("get task after second close: %v", err)
	}
	if !closedAgain.Checked || closedAgain.ProcessedCount != 1 {
		t.Fatalf("second close changed completion semantics: checked=%v processed=%d", closedAgain.Checked, closedAgain.ProcessedCount)
	}

	if err := service.Reopen(ctx, created.ID); err != nil {
		t.Fatalf("reopen task: %v", err)
	}
	reopened, err := service.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("get reopened task: %v", err)
	}
	if reopened.Checked || reopened.ProcessedCount != 1 {
		t.Fatalf("reopen task state: checked=%v processed=%d", reopened.Checked, reopened.ProcessedCount)
	}

	if err := service.Delete(ctx, created.ID); err != nil {
		t.Fatalf("delete task: %v", err)
	}
	assertGetNotFound(t, service, ctx, created.ID)

	afterDelete, err := service.List(ctx, ListParams{Limit: 50})
	if err != nil {
		t.Fatalf("list after delete: %v", err)
	}
	if afterDelete.Total != 0 || len(afterDelete.Items) != 0 {
		t.Fatalf("deleted task remained visible: total=%d ids=%v", afterDelete.Total, taskIDs(afterDelete.Items))
	}

	if err := service.Delete(ctx, created.ID); err == nil {
		t.Fatal("repeat delete: expected not found")
	} else {
		assertAppError(t, err, apperrors.CodeNotFound, "taskId")
	}
	if err := service.Close(ctx, created.ID); err == nil {
		t.Fatal("close deleted task: expected not found")
	} else {
		assertAppError(t, err, apperrors.CodeNotFound, "taskId")
	}
	if err := service.Reopen(ctx, created.ID); err == nil {
		t.Fatal("reopen deleted task: expected not found")
	} else {
		assertAppError(t, err, apperrors.CodeNotFound, "taskId")
	}
}

func TestServiceTaskFieldRoundTripAndValidation(t *testing.T) {
	t.Parallel()

	service := newLifecycleTestService(t)
	ctx := principalContext("owner", "workspace-a")

	projectID := "planning"
	sectionID := "next"
	recurrence := "FREQ=DAILY;INTERVAL=2"
	dueText := "2026-09-02T08:30:00-04:00"
	deadline := "2026-09-01T17:00:00-04:00"
	scheduleInput := "every 2 days at 8:30am"

	created, err := service.Create(ctx, CreateInput{
		Content:       "exercise supported fields",
		Description:   "field round trip",
		ProjectID:     &projectID,
		SectionID:     &sectionID,
		SortOrder:     321,
		Recurrence:    &recurrence,
		Priority:      2,
		DueText:       &dueText,
		DueDeadline:   &deadline,
		ScheduleInput: &scheduleInput,
		Labels:        []string{"Audit", "Task"},
	})
	if err != nil {
		t.Fatalf("create all-fields task: %v", err)
	}

	got, err := service.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("get all-fields task: %v", err)
	}
	assertTaskCore(t, got, "exercise supported fields", "field round trip", 2, 321, false, 0)
	assertStringPtr(t, "project", got.ProjectID, projectID)
	assertStringPtr(t, "section", got.SectionID, sectionID)
	assertStringPtr(t, "recurrence", got.Recurrence, recurrence)
	assertStringPtr(t, "due text", got.DueText, dueText)
	assertStringPtr(t, "deadline", got.DueDeadline, deadline)
	assertStringPtr(t, "schedule input", got.ScheduleInput, scheduleInput)
	if !slices.Equal(got.Labels, []string{"audit", "task"}) {
		t.Fatalf("all-fields labels: got=%v want=[audit task]", got.Labels)
	}

	if _, err := service.Create(ctx, CreateInput{Content: "", Priority: 4}); err == nil {
		t.Fatal("create empty content: expected validation error")
	} else {
		assertAppError(t, err, apperrors.CodeValidationError, "content")
	}
	if _, err := service.Create(ctx, CreateInput{Content: "bad priority", Priority: 5}); err == nil {
		t.Fatal("create invalid priority: expected validation error")
	} else {
		assertAppError(t, err, apperrors.CodeValidationError, "priority")
	}

	empty := ""
	if _, err := service.Update(ctx, created.ID, UpdateInput{Content: &empty}); err == nil {
		t.Fatal("update empty content: expected validation error")
	} else {
		assertAppError(t, err, apperrors.CodeValidationError, "content")
	}
	invalidPriority := 0
	if _, err := service.Update(ctx, created.ID, UpdateInput{Priority: &invalidPriority}); err == nil {
		t.Fatal("update invalid priority: expected validation error")
	} else {
		assertAppError(t, err, apperrors.CodeValidationError, "priority")
	}
}

func TestServiceTaskListPaginationContract(t *testing.T) {
	t.Parallel()

	service := newLifecycleTestService(t)
	ctx := principalContext("owner", "workspace-a")

	created := make([]Task, 0, 3)
	for i, in := range []CreateInput{
		{Content: "first", Priority: 4, SortOrder: 10},
		{Content: "second", Priority: 4, SortOrder: 20},
		{Content: "third", Priority: 4, SortOrder: 30},
	} {
		item, err := service.Create(ctx, in)
		if err != nil {
			t.Fatalf("create pagination task %d: %v", i, err)
		}
		created = append(created, item)
	}

	page1, err := service.List(ctx, ListParams{Limit: 2})
	if err != nil {
		t.Fatalf("list page 1: %v", err)
	}
	if page1.Total != 3 || len(page1.Items) != 2 || page1.NextCursor == nil || *page1.NextCursor != 2 {
		t.Fatalf("page 1 metadata: total=%d len=%d next=%v", page1.Total, len(page1.Items), page1.NextCursor)
	}
	if page1.Items[0].ID != created[0].ID || page1.Items[1].ID != created[1].ID {
		t.Fatalf("page 1 ordering: got=%v want=%v", taskIDs(page1.Items), []string{created[0].ID, created[1].ID})
	}

	page2, err := service.List(ctx, ListParams{Limit: 2, Cursor: *page1.NextCursor})
	if err != nil {
		t.Fatalf("list page 2: %v", err)
	}
	if page2.Total != 3 || len(page2.Items) != 1 || page2.NextCursor != nil || page2.Items[0].ID != created[2].ID {
		t.Fatalf("page 2 semantics: total=%d ids=%v next=%v", page2.Total, taskIDs(page2.Items), page2.NextCursor)
	}
}

func TestServiceTaskTenantIsolationContract(t *testing.T) {
	t.Parallel()

	service := newLifecycleTestService(t)
	ownerCtx := principalContext("user-a", "workspace-a")
	otherUserCtx := principalContext("user-b", "workspace-a")
	otherWorkspaceCtx := principalContext("user-a", "workspace-b")

	created, err := service.Create(ownerCtx, CreateInput{Content: "private task", Description: "owner only", Priority: 2, SortOrder: 10})
	if err != nil {
		t.Fatalf("create owner task: %v", err)
	}

	for name, foreignCtx := range map[string]context.Context{
		"other user":      otherUserCtx,
		"other workspace": otherWorkspaceCtx,
	} {
		t.Run(name, func(t *testing.T) {
			assertGetNotFound(t, service, foreignCtx, created.ID)

			list, err := service.List(foreignCtx, ListParams{Limit: 50})
			if err != nil {
				t.Fatalf("foreign list: %v", err)
			}
			if list.Total != 0 || len(list.Items) != 0 {
				t.Fatalf("foreign list leaked task: total=%d ids=%v", list.Total, taskIDs(list.Items))
			}

			content := "hijacked"
			if _, err := service.Update(foreignCtx, created.ID, UpdateInput{Content: &content}); err == nil {
				t.Fatal("foreign update: expected not found")
			} else {
				assertAppError(t, err, apperrors.CodeNotFound, "taskId")
			}
			if err := service.Close(foreignCtx, created.ID); err == nil {
				t.Fatal("foreign close: expected not found")
			} else {
				assertAppError(t, err, apperrors.CodeNotFound, "taskId")
			}
			if err := service.Reopen(foreignCtx, created.ID); err == nil {
				t.Fatal("foreign reopen: expected not found")
			} else {
				assertAppError(t, err, apperrors.CodeNotFound, "taskId")
			}
			if err := service.Delete(foreignCtx, created.ID); err == nil {
				t.Fatal("foreign delete: expected not found")
			} else {
				assertAppError(t, err, apperrors.CodeNotFound, "taskId")
			}
		})
	}

	ownerTask, err := service.Get(ownerCtx, created.ID)
	if err != nil {
		t.Fatalf("get owner task after foreign mutations: %v", err)
	}
	assertTaskCore(t, ownerTask, "private task", "owner only", 2, 10, false, 0)
}

func newLifecycleTestService(t *testing.T) *Service {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "task-lifecycle.db")
	if err := database.RunMigrations(dbPath); err != nil {
		t.Fatalf("migrate db: %v", err)
	}
	db, err := database.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	queries, err := database.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}
	return NewService(NewRepository(db, queries), quickadd.NewParser())
}

func principalContext(userID, workspaceID string) context.Context {
	ctx := sessionctx.WithPrincipal(context.Background(), sessionctx.Principal{
		UserID:      userID,
		WorkspaceID: workspaceID,
	})
	return WithTimezone(ctx, "America/New_York")
}

func assertTaskCore(t *testing.T, item Task, content, description string, priority int, sortOrder int64, checked bool, processed int) {
	t.Helper()
	if item.Content != content || item.Description != description || item.Priority != priority || item.SortOrder != sortOrder || item.Checked != checked || item.IsDeleted || item.ProcessedCount != processed {
		t.Fatalf("task core mismatch: got=%+v", item)
	}
}

func assertStringPtr(t *testing.T, field string, got *string, want string) {
	t.Helper()
	if got == nil || *got != want {
		t.Fatalf("%s: got=%v want=%q", field, got, want)
	}
}

func assertGetNotFound(t *testing.T, service *Service, ctx context.Context, id string) {
	t.Helper()
	_, err := service.Get(ctx, id)
	if err == nil {
		t.Fatal("expected not found error")
	}
	assertAppError(t, err, apperrors.CodeNotFound, "taskId")
}

func assertAppError(t *testing.T, err error, code apperrors.Code, field string) {
	t.Helper()
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected app error, got %T: %v", err, err)
	}
	if appErr.Code != code || appErr.Field != field {
		t.Fatalf("app error mismatch: code=%s field=%q want code=%s field=%q", appErr.Code, appErr.Field, code, field)
	}
}

func taskIDs(items []Task) []string {
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	return ids
}
