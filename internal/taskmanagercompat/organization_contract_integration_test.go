package taskmanagercompat

import (
	"context"
	"errors"
	"path/filepath"
	"slices"
	"testing"

	"donegeon/internal/database"
	apperrors "donegeon/internal/errors"
	"donegeon/internal/project"
	"donegeon/internal/quickadd"
	"donegeon/internal/sessionctx"
	"donegeon/internal/task"
)

func TestOrganizationCRUDAndOrphanPolicies(t *testing.T) {
	t.Parallel()

	service, tasks := newOrganizationTestService(t)
	ctx := organizationPrincipalContext("user-a", "workspace-a")

	createdProject := mustProject(t, service.Dispatch(ctx, "addProject", map[string]any{
		"name":       "Launch",
		"isFavorite": false,
	}))
	if createdProject.ID == "" || createdProject.Name != "Launch" || createdProject.IsFavorite {
		t.Fatalf("unexpected created project: %+v", createdProject)
	}

	updatedProject := mustProject(t, service.Dispatch(ctx, "updateProject", map[string]any{
		"projectId":  createdProject.ID,
		"name":       "Launch Plan",
		"isFavorite": true,
	}))
	if updatedProject.Name != "Launch Plan" || !updatedProject.IsFavorite {
		t.Fatalf("project update/favorite did not persist: %+v", updatedProject)
	}

	archived := mustProject(t, service.Dispatch(ctx, "archiveProject", map[string]any{"projectId": createdProject.ID}))
	if !archived.IsArchived {
		t.Fatalf("archive project: expected archived state, got %+v", archived)
	}
	activeProjects := mustProjectList(t, service.Dispatch(ctx, "getProjects", map[string]any{}))
	if projectListContainsID(activeProjects, createdProject.ID) {
		t.Fatalf("archive project: project remained in active list: %+v", activeProjects)
	}
	archivedProjects := mustProjectList(t, service.Dispatch(ctx, "getArchivedProjects", map[string]any{}))
	if !projectListContainsID(archivedProjects, createdProject.ID) {
		t.Fatalf("archive project: project missing from archived list: %+v", archivedProjects)
	}
	unarchived := mustProject(t, service.Dispatch(ctx, "unarchiveProject", map[string]any{"projectId": createdProject.ID}))
	if unarchived.IsArchived {
		t.Fatalf("unarchive project: expected active state, got %+v", unarchived)
	}

	section := mustSection(t, service.Dispatch(ctx, "addSection", map[string]any{
		"projectId": createdProject.ID,
		"name":      "Next",
	}))
	section = mustSection(t, service.Dispatch(ctx, "updateSection", map[string]any{
		"sectionId": section.ID,
		"name":      "Doing",
	}))
	if section.Name != "Doing" {
		t.Fatalf("section rename did not persist: %+v", section)
	}

	label := mustLabel(t, service.Dispatch(ctx, "addLabel", map[string]any{
		"name":  "launch",
		"color": "blue",
	}))
	label = mustLabel(t, service.Dispatch(ctx, "updateLabel", map[string]any{
		"labelId": label.ID,
		"name":    "release",
		"color":   "green",
	}))
	if label.Name != "release" || label.Color == nil || *label.Color != "green" {
		t.Fatalf("label update did not persist: %+v", label)
	}

	createdTask := mustTask(t, service.Dispatch(ctx, "addTask", map[string]any{
		"content":   "Ship release",
		"projectId": createdProject.ID,
		"sectionId": section.ID,
		"labels":    []string{"release"},
		"priority":  2,
	}))
	if createdTask.ProjectID == nil || createdTask.SectionID == nil || *createdTask.SectionID != section.ID {
		t.Fatalf("task organization assignment missing: %+v", createdTask)
	}
	if !slices.Equal(createdTask.Labels, []string{"release"}) {
		t.Fatalf("task labels: got=%v want=[release]", createdTask.Labels)
	}

	if _, err := service.Dispatch(ctx, "deleteSection", map[string]any{"sectionId": section.ID}); err != nil {
		t.Fatalf("delete section: %v", err)
	}
	afterSectionDelete, err := tasks.Get(ctx, createdTask.ID)
	if err != nil {
		t.Fatalf("get task after section delete: %v", err)
	}
	if afterSectionDelete.SectionID != nil {
		t.Fatalf("section delete left task section assigned: %+v", afterSectionDelete)
	}
	if afterSectionDelete.ProjectID == nil {
		t.Fatalf("section delete unexpectedly cleared project: %+v", afterSectionDelete)
	}

	section2 := mustSection(t, service.Dispatch(ctx, "addSection", map[string]any{
		"projectId": createdProject.ID,
		"name":      "Later",
	}))
	movedTask := mustTask(t, service.Dispatch(ctx, "moveTask", map[string]any{
		"taskId":    createdTask.ID,
		"sectionId": section2.ID,
	}))
	if movedTask.SectionID == nil || *movedTask.SectionID != section2.ID || movedTask.ProjectID == nil {
		t.Fatalf("section-only move did not derive project: %+v", movedTask)
	}

	clearedTask := mustTask(t, service.Dispatch(ctx, "moveTask", map[string]any{
		"taskId":    createdTask.ID,
		"projectId": "",
	}))
	if clearedTask.ProjectID != nil || clearedTask.SectionID != nil {
		t.Fatalf("project clear did not clear project+section: %+v", clearedTask)
	}

	movedTask = mustTask(t, service.Dispatch(ctx, "moveTask", map[string]any{
		"taskId":    createdTask.ID,
		"projectId": createdProject.ID,
		"sectionId": section2.ID,
	}))
	if movedTask.ProjectID == nil || movedTask.SectionID == nil {
		t.Fatalf("task move did not restore organization: %+v", movedTask)
	}

	if _, err := service.Dispatch(ctx, "deleteProject", map[string]any{"projectId": createdProject.ID}); err != nil {
		t.Fatalf("delete project: %v", err)
	}
	assertOrganizationNotFound(t, service, ctx, "getProject", map[string]any{"projectId": createdProject.ID}, "projectId")
	assertOrganizationNotFound(t, service, ctx, "getSection", map[string]any{"sectionId": section2.ID}, "sectionId")

	afterProjectDelete, err := tasks.Get(ctx, createdTask.ID)
	if err != nil {
		t.Fatalf("get task after project delete: %v", err)
	}
	if afterProjectDelete.ProjectID != nil || afterProjectDelete.SectionID != nil {
		t.Fatalf("project delete left task organization assigned: %+v", afterProjectDelete)
	}

	defaultCtx := organizationPrincipalContext(sessionctx.DefaultUserID, sessionctx.DefaultWorkspaceID)
	assertOrganizationValidation(t, service, defaultCtx, "deleteProject", map[string]any{"projectId": "inbox"}, "projectId")
	assertOrganizationValidation(t, service, defaultCtx, "archiveProject", map[string]any{"projectId": "board"}, "projectId")
}

func TestOrganizationTenantIsolationAndForeignMoves(t *testing.T) {
	t.Parallel()

	service, tasks := newOrganizationTestService(t)
	ownerCtx := organizationPrincipalContext("user-a", "workspace-a")
	sameWorkspaceCtx := organizationPrincipalContext("user-b", "workspace-a")
	otherWorkspaceCtx := organizationPrincipalContext("user-b", "workspace-b")

	ownerProject := mustProject(t, service.Dispatch(ownerCtx, "addProject", map[string]any{"name": "Owner Project"}))
	ownerSection := mustSection(t, service.Dispatch(ownerCtx, "addSection", map[string]any{"projectId": ownerProject.ID, "name": "Owner Section"}))
	ownerLabel := mustLabel(t, service.Dispatch(ownerCtx, "addLabel", map[string]any{"name": "owner-label"}))
	ownerTask := mustTask(t, service.Dispatch(ownerCtx, "addTask", map[string]any{
		"content":   "Owner task",
		"projectId": ownerProject.ID,
		"sectionId": ownerSection.ID,
		"labels":    []string{"owner-label"},
	}))

	foreignProject := mustProject(t, service.Dispatch(otherWorkspaceCtx, "addProject", map[string]any{"name": "Foreign Project"}))
	foreignSection := mustSection(t, service.Dispatch(otherWorkspaceCtx, "addSection", map[string]any{"projectId": foreignProject.ID, "name": "Foreign Section"}))
	foreignLabel := mustLabel(t, service.Dispatch(otherWorkspaceCtx, "addLabel", map[string]any{"name": "foreign-label"}))

	// Projects and their sections are workspace resources. A different user in
	// the same workspace can discover them; user-owned tasks and labels remain
	// isolated, and HTTP role/scope middleware controls whether that user may
	// mutate shared workspace resources.
	if got := mustProject(t, service.Dispatch(sameWorkspaceCtx, "getProject", map[string]any{"projectId": ownerProject.ID})); got.ID == "" {
		t.Fatal("same-workspace project lookup returned empty project")
	}
	if got := mustSection(t, service.Dispatch(sameWorkspaceCtx, "getSection", map[string]any{"sectionId": ownerSection.ID})); got.ID != ownerSection.ID {
		t.Fatalf("same-workspace section lookup: got=%+v want=%s", got, ownerSection.ID)
	}
	assertOrganizationNotFound(t, service, sameWorkspaceCtx, "getLabel", map[string]any{"labelId": ownerLabel.ID}, "labelId")
	assertOrganizationNotFound(t, service, sameWorkspaceCtx, "getTask", map[string]any{"taskId": ownerTask.ID}, "taskId")
	otherUserLabels := mustLabelList(t, service.Dispatch(sameWorkspaceCtx, "getLabels", map[string]any{}))
	if labelListContainsID(otherUserLabels, ownerLabel.ID) {
		t.Fatalf("same-workspace label list leaked owner label: %+v", otherUserLabels)
	}

	assertOrganizationNotFound(t, service, otherWorkspaceCtx, "getProject", map[string]any{"projectId": ownerProject.ID}, "projectId")
	assertOrganizationNotFound(t, service, otherWorkspaceCtx, "getSection", map[string]any{"sectionId": ownerSection.ID}, "sectionId")
	assertOrganizationNotFound(t, service, otherWorkspaceCtx, "getLabel", map[string]any{"labelId": ownerLabel.ID}, "labelId")
	assertOrganizationNotFound(t, service, otherWorkspaceCtx, "getTask", map[string]any{"taskId": ownerTask.ID}, "taskId")

	assertOrganizationNotFound(t, service, ownerCtx, "moveTask", map[string]any{
		"taskId":    ownerTask.ID,
		"projectId": foreignProject.ID,
	}, "projectId")
	assertOrganizationNotFound(t, service, ownerCtx, "moveTask", map[string]any{
		"taskId":    ownerTask.ID,
		"sectionId": foreignSection.ID,
	}, "sectionId")
	assertOrganizationNotFound(t, service, ownerCtx, "updateTask", map[string]any{
		"taskId":    ownerTask.ID,
		"projectId": foreignProject.ID,
	}, "projectId")
	assertOrganizationNotFound(t, service, ownerCtx, "moveTasks", map[string]any{
		"taskIds":   []string{ownerTask.ID},
		"projectId": foreignProject.ID,
	}, "projectId")

	persisted, err := tasks.Get(ownerCtx, ownerTask.ID)
	if err != nil {
		t.Fatalf("get owner task after foreign move attempts: %v", err)
	}
	if persisted.ProjectID == nil || persisted.SectionID == nil || *persisted.SectionID != ownerSection.ID {
		t.Fatalf("foreign move attempt changed task placement: %+v", persisted)
	}

	if _, err := service.Dispatch(ownerCtx, "getLabel", map[string]any{"labelId": foreignLabel.ID}); err == nil {
		t.Fatal("owner accessed foreign label")
	} else {
		assertOrganizationAppError(t, err, apperrors.CodeNotFound, "labelId")
	}
}

func TestOrganizationLabelRenameRemoveAndDeleteAffectTaskLinks(t *testing.T) {
	t.Parallel()

	service, tasks := newOrganizationTestService(t)
	ctx := organizationPrincipalContext("user-a", "workspace-a")

	alpha := mustLabel(t, service.Dispatch(ctx, "addLabel", map[string]any{"name": "alpha", "color": "red"}))
	linked, err := tasks.Create(ctx, task.CreateInput{Content: "label-linked task", Priority: 4, Labels: []string{"alpha"}})
	if err != nil {
		t.Fatalf("create label-linked task: %v", err)
	}
	if !slices.Equal(linked.Labels, []string{"alpha"}) {
		t.Fatalf("initial task labels: %v", linked.Labels)
	}

	renamed := mustLabel(t, service.Dispatch(ctx, "renameSharedLabel", map[string]any{
		"name":    "alpha",
		"newName": "beta",
		"color":   "orange",
	}))
	if renamed.ID != alpha.ID || renamed.Name != "beta" {
		t.Fatalf("shared label rename: got=%+v original=%+v", renamed, alpha)
	}
	afterRename, err := tasks.Get(ctx, linked.ID)
	if err != nil {
		t.Fatalf("get task after label rename: %v", err)
	}
	if !slices.Equal(afterRename.Labels, []string{"beta"}) {
		t.Fatalf("label rename did not flow through task link: %v", afterRename.Labels)
	}

	if _, err := service.Dispatch(ctx, "removeSharedLabel", map[string]any{"name": "beta"}); err != nil {
		t.Fatalf("remove shared label: %v", err)
	}
	afterRemove, err := tasks.Get(ctx, linked.ID)
	if err != nil {
		t.Fatalf("get task after shared label removal: %v", err)
	}
	if len(afterRemove.Labels) != 0 {
		t.Fatalf("shared label removal left task link: %v", afterRemove.Labels)
	}

	gamma := mustLabel(t, service.Dispatch(ctx, "addLabel", map[string]any{"name": "gamma"}))
	linked2, err := tasks.Create(ctx, task.CreateInput{Content: "second label-linked task", Priority: 4, Labels: []string{"gamma"}})
	if err != nil {
		t.Fatalf("create second label-linked task: %v", err)
	}
	if _, err := service.Dispatch(ctx, "deleteLabel", map[string]any{"labelId": gamma.ID}); err != nil {
		t.Fatalf("delete label: %v", err)
	}
	afterDelete, err := tasks.Get(ctx, linked2.ID)
	if err != nil {
		t.Fatalf("get task after label delete: %v", err)
	}
	if len(afterDelete.Labels) != 0 {
		t.Fatalf("label delete left task link: %v", afterDelete.Labels)
	}
}

func newOrganizationTestService(t *testing.T) (*Service, *task.Service) {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "organization-contract.db")
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
	taskService := task.NewService(task.NewRepository(db, queries), quickadd.NewParser())
	projectService := project.NewService(project.NewRepository(db, queries))
	return NewService(db, taskService, projectService), taskService
}

func organizationPrincipalContext(userID, workspaceID string) context.Context {
	return sessionctx.WithPrincipal(context.Background(), sessionctx.Principal{
		UserID:      userID,
		WorkspaceID: workspaceID,
		Email:       userID + "@example.test",
	})
}

func mustProject(t *testing.T, value any, err error) project.Project {
	t.Helper()
	if err != nil {
		t.Fatalf("project action: %v", err)
	}
	item, ok := value.(project.Project)
	if !ok {
		t.Fatalf("project action returned %T", value)
	}
	return item
}

func mustSection(t *testing.T, value any, err error) sectionRow {
	t.Helper()
	if err != nil {
		t.Fatalf("section action: %v", err)
	}
	item, ok := value.(sectionRow)
	if !ok {
		t.Fatalf("section action returned %T", value)
	}
	return item
}

func mustLabel(t *testing.T, value any, err error) labelRow {
	t.Helper()
	if err != nil {
		t.Fatalf("label action: %v", err)
	}
	item, ok := value.(labelRow)
	if !ok {
		t.Fatalf("label action returned %T", value)
	}
	return item
}

func mustTask(t *testing.T, value any, err error) task.Task {
	t.Helper()
	if err != nil {
		t.Fatalf("task action: %v", err)
	}
	item, ok := value.(task.Task)
	if !ok {
		t.Fatalf("task action returned %T", value)
	}
	return item
}

func mustProjectList(t *testing.T, value any, err error) []project.Project {
	t.Helper()
	if err != nil {
		t.Fatalf("project list: %v", err)
	}
	result, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("project list returned %T", value)
	}
	items, ok := result["items"].([]project.Project)
	if !ok {
		t.Fatalf("project list items returned %T", result["items"])
	}
	return items
}

func mustLabelList(t *testing.T, value any, err error) []labelRow {
	t.Helper()
	if err != nil {
		t.Fatalf("label list: %v", err)
	}
	result, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("label list returned %T", value)
	}
	items, ok := result["items"].([]labelRow)
	if !ok {
		t.Fatalf("label list items returned %T", result["items"])
	}
	return items
}

func projectListContainsID(items []project.Project, id string) bool {
	for _, item := range items {
		if item.ID == id {
			return true
		}
	}
	return false
}

func labelListContainsID(items []labelRow, id string) bool {
	for _, item := range items {
		if item.ID == id {
			return true
		}
	}
	return false
}

func assertOrganizationNotFound(t *testing.T, service *Service, ctx context.Context, action string, payload map[string]any, field string) {
	t.Helper()
	if _, err := service.Dispatch(ctx, action, payload); err == nil {
		t.Fatalf("%s: expected not found", action)
	} else {
		assertOrganizationAppError(t, err, apperrors.CodeNotFound, field)
	}
}

func assertOrganizationValidation(t *testing.T, service *Service, ctx context.Context, action string, payload map[string]any, field string) {
	t.Helper()
	if _, err := service.Dispatch(ctx, action, payload); err == nil {
		t.Fatalf("%s: expected validation error", action)
	} else {
		assertOrganizationAppError(t, err, apperrors.CodeValidationError, field)
	}
}

func assertOrganizationAppError(t *testing.T, err error, code apperrors.Code, field string) {
	t.Helper()
	var appErr *apperrors.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected AppError, got %T: %v", err, err)
	}
	if appErr.Code != code || appErr.Field != field {
		t.Fatalf("unexpected AppError: code=%s field=%q want code=%s field=%q", appErr.Code, appErr.Field, code, field)
	}
}
