package account

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"

	"donegeon/internal/database"
)

func TestCompleteOnboardingCreatesOnlyWorkspaceBoardAndInbox(t *testing.T) {
	ctx := context.Background()
	svc, db := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "chris@example.com", "Chris")

	session, invites, err := svc.CompleteOnboarding(ctx, "U_OWNER", "Gladiators", "Chris", nil, PlanPersonal)
	if err != nil {
		t.Fatalf("complete onboarding: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected no invites, got %d", len(invites))
	}
	if session.Team == nil {
		t.Fatal("expected team in session")
	}

	projects := loadWorkspaceProjects(t, ctx, db, session.Team.ID)
	if len(projects) != 2 {
		t.Fatalf("expected 2 projects (board + inbox), got %d", len(projects))
	}

	boardCount := 0
	for _, project := range projects {
		if project.IsInboxProject {
			if project.Name != "inbox" {
				t.Fatalf("expected inbox project name, got %q", project.Name)
			}
			continue
		}
		boardCount++
		if project.ID != projectStorageID(session.Team.ID, "board") {
			t.Fatalf("expected workspace board id %q, got %q", projectStorageID(session.Team.ID, "board"), project.ID)
		}
		if project.Name != "Gladiators" {
			t.Fatalf("expected workspace board name %q, got %q", "Gladiators", project.Name)
		}
	}

	if boardCount != 1 {
		t.Fatalf("expected exactly one non-inbox board, got %d", boardCount)
	}
}

func TestAcceptInvitationDoesNotCreateAdditionalPersonalBoard(t *testing.T) {
	ctx := context.Background()
	svc, db := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "workspace-owner@example.com", "Owner")
	ownerSession, _, err := svc.CompleteOnboarding(ctx, "U_OWNER", "Gladiators", "Owner", nil, PlanPersonal)
	if err != nil {
		t.Fatalf("complete owner onboarding: %v", err)
	}
	if ownerSession.Team == nil {
		t.Fatal("expected owner team in session")
	}

	seedAccountUser(t, ctx, svc, "U_MEMBER", "member@example.com", "Member")
	invite, err := svc.InviteMember(ctx, "U_OWNER", ownerSession.Team.ID, "member@example.com", TeamRoleEditor)
	if err != nil {
		t.Fatalf("invite member: %v", err)
	}

	memberSession, err := svc.AcceptInvitation(ctx, "U_MEMBER", invite.InvitationCode)
	if err != nil {
		t.Fatalf("accept invitation: %v", err)
	}
	if memberSession.Team == nil {
		t.Fatal("expected member team in session")
	}

	projects := loadWorkspaceProjects(t, ctx, db, ownerSession.Team.ID)
	if len(projects) != 2 {
		t.Fatalf("expected 2 projects after invite acceptance, got %d", len(projects))
	}

	boardCount := 0
	for _, project := range projects {
		if project.IsInboxProject {
			continue
		}
		boardCount++
		if project.ID != projectStorageID(ownerSession.Team.ID, "board") {
			t.Fatalf("expected workspace board id %q, got %q", projectStorageID(ownerSession.Team.ID, "board"), project.ID)
		}
	}

	if boardCount != 1 {
		t.Fatalf("expected exactly one non-inbox board after invite acceptance, got %d", boardCount)
	}
}

func newAccountTestService(t *testing.T) (*Service, *sqlx.DB) {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "account-service-test.db")
	if err := database.RunMigrations(dbPath); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	db, err := database.Open(context.Background(), dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	queries, err := database.LoadQueries()
	if err != nil {
		t.Fatalf("load queries: %v", err)
	}

	return NewService(db, queries), db
}

func seedAccountUser(t *testing.T, ctx context.Context, svc *Service, userID, email, name string) {
	t.Helper()

	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := svc.exec(ctx, "auth_user_insert.sql", userID, email, name, now, now); err != nil {
		t.Fatalf("seed user %s: %v", userID, err)
	}
}

func loadWorkspaceProjects(t *testing.T, ctx context.Context, db *sqlx.DB, workspaceID string) []struct {
	ID             string `db:"id"`
	Name           string `db:"name"`
	IsInboxProject bool   `db:"is_inbox_project"`
} {
	t.Helper()

	var projects []struct {
		ID             string `db:"id"`
		Name           string `db:"name"`
		IsInboxProject bool   `db:"is_inbox_project"`
	}
	if err := db.SelectContext(ctx, &projects, `
SELECT id, name, is_inbox_project
FROM projects
WHERE workspace_id = ?
ORDER BY is_inbox_project ASC, name ASC
`, workspaceID); err != nil {
		t.Fatalf("load projects: %v", err)
	}
	return projects
}
