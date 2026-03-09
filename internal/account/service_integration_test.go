package account

import (
	"context"
	"path/filepath"
	"sort"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"

	"donegeon/internal/database"
	"donegeon/internal/project"
	"donegeon/internal/sessionctx"
)

func TestCompleteOnboardingPersonalCreatesPrivateBoardAndInbox(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "chris@example.com", "Chris")

	session, invites, err := svc.CompleteOnboarding(ctx, "U_OWNER", "Gladiators", "", "Chris", nil, PlanPersonal)
	if err != nil {
		t.Fatalf("complete onboarding: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected no invites, got %d", len(invites))
	}
	if session.Team == nil {
		t.Fatal("expected workspace in session")
	}
	if session.Team.Plan != PlanPersonal {
		t.Fatalf("expected plan %q, got %q", PlanPersonal, session.Team.Plan)
	}
	if session.Team.Name != "Gladiators" {
		t.Fatalf("expected workspace name %q, got %q", "Gladiators", session.Team.Name)
	}

	projects := listVisibleProjectsForUser(t, db, queries, session.User.ID, session.Team.ID, session.User.Email)
	if len(projects) != 2 {
		t.Fatalf("expected 2 visible projects, got %d", len(projects))
	}
	assertProjectNames(t, projects, "Gladiators", "inbox")
	assertProjectIDs(t, projects, "board", "inbox")
	assertTeamBoardNames(t, projects)
}

func TestCompleteOnboardingProTrialCreatesPrivateAndTeamBoardsPlusInbox(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "chris@example.com", "Chris")

	session, invites, err := svc.CompleteOnboarding(ctx, "U_OWNER", "Gladiators", "maze", "Chris", nil, PlanProTrial)
	if err != nil {
		t.Fatalf("complete onboarding: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected no invites, got %d", len(invites))
	}
	if session.Team == nil {
		t.Fatal("expected workspace in session")
	}
	if session.Team.Plan != PlanProTrial {
		t.Fatalf("expected plan %q, got %q", PlanProTrial, session.Team.Plan)
	}
	if session.Team.Name != "maze" {
		t.Fatalf("expected workspace name %q, got %q", "maze", session.Team.Name)
	}

	projects := listVisibleProjectsForUser(t, db, queries, session.User.ID, session.Team.ID, session.User.Email)
	if len(projects) != 3 {
		t.Fatalf("expected 3 visible projects, got %d", len(projects))
	}
	assertProjectNames(t, projects, "Gladiators", "maze", "inbox")
	assertProjectIDs(t, projects, "board", "board-team", "inbox")
	assertTeamBoardNames(t, projects, "maze")
}

func TestAcceptInvitationSharesOnlyTeamBoardAndInbox(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "workspace-owner@example.com", "Owner")
	ownerSession, _, err := svc.CompleteOnboarding(ctx, "U_OWNER", "Gladiators", "maze", "Owner", nil, PlanProTrial)
	if err != nil {
		t.Fatalf("complete owner onboarding: %v", err)
	}
	if ownerSession.Team == nil {
		t.Fatal("expected owner workspace in session")
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
		t.Fatal("expected member workspace in session")
	}

	ownerProjects := listVisibleProjectsForUser(t, db, queries, ownerSession.User.ID, ownerSession.Team.ID, ownerSession.User.Email)
	if len(ownerProjects) != 3 {
		t.Fatalf("expected owner to keep 3 visible projects, got %d", len(ownerProjects))
	}
	assertProjectNames(t, ownerProjects, "Gladiators", "maze", "inbox")
	assertTeamBoardNames(t, ownerProjects, "maze")

	memberProjects := listVisibleProjectsForUser(t, db, queries, memberSession.User.ID, memberSession.Team.ID, memberSession.User.Email)
	if len(memberProjects) != 2 {
		t.Fatalf("expected member to see 2 visible projects, got %d", len(memberProjects))
	}
	assertProjectNames(t, memberProjects, "maze", "inbox")
	assertProjectIDs(t, memberProjects, "board-team", "inbox")
	assertTeamBoardNames(t, memberProjects, "maze")
}

func newAccountTestService(t *testing.T) (*Service, *sqlx.DB, map[string]string) {
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

	return NewService(db, queries), db, queries
}

func seedAccountUser(t *testing.T, ctx context.Context, svc *Service, userID, email, name string) {
	t.Helper()

	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := svc.exec(ctx, "auth_user_insert.sql", userID, email, name, now, now); err != nil {
		t.Fatalf("seed user %s: %v", userID, err)
	}
}

func listVisibleProjectsForUser(t *testing.T, db *sqlx.DB, queries map[string]string, userID, workspaceID, email string) []project.Project {
	t.Helper()

	repo := project.NewRepository(db, queries)
	svc := project.NewService(repo)
	ctx := sessionctx.WithPrincipal(context.Background(), sessionctx.Principal{
		UserID:      userID,
		WorkspaceID: workspaceID,
		Email:       email,
	})

	projects, err := svc.List(ctx, project.ListParams{})
	if err != nil {
		t.Fatalf("list visible projects: %v", err)
	}
	return projects
}

func assertProjectNames(t *testing.T, projects []project.Project, want ...string) {
	t.Helper()

	got := make([]string, 0, len(projects))
	for _, item := range projects {
		got = append(got, item.Name)
	}
	sort.Strings(got)
	sort.Strings(want)
	if len(got) != len(want) {
		t.Fatalf("expected project names %v, got %v", want, got)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("expected project names %v, got %v", want, got)
		}
	}
}

func assertProjectIDs(t *testing.T, projects []project.Project, want ...string) {
	t.Helper()

	got := make([]string, 0, len(projects))
	for _, item := range projects {
		got = append(got, item.ID)
	}
	sort.Strings(got)
	sort.Strings(want)
	if len(got) != len(want) {
		t.Fatalf("expected project ids %v, got %v", want, got)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("expected project ids %v, got %v", want, got)
		}
	}
}

func assertTeamBoardNames(t *testing.T, projects []project.Project, want ...string) {
	t.Helper()

	got := make([]string, 0, len(projects))
	for _, item := range projects {
		if item.IsTeamBoard {
			got = append(got, item.Name)
		}
	}
	sort.Strings(got)
	sort.Strings(want)
	if len(got) != len(want) {
		t.Fatalf("expected TEAM boards %v, got %v", want, got)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("expected TEAM boards %v, got %v", want, got)
		}
	}
}
