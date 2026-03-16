package account

import (
	"context"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"

	"donegeon/internal/database"
	"donegeon/internal/project"
	"donegeon/internal/sessionctx"
	sharedpricing "donegeon/web/shared/pricing"
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
	if session.Team.PlanFamily != "free" {
		t.Fatalf("expected plan family %q, got %q", "free", session.Team.PlanFamily)
	}
	if session.Team.BillingState != "none" {
		t.Fatalf("expected billing state %q, got %q", "none", session.Team.BillingState)
	}
	assertTeamEntitlements(t, session.Team, sharedpricing.EntitlementCalendarSync, sharedpricing.EntitlementQuickAdd)
	assertTeamLacksEntitlements(t, session.Team, sharedpricing.EntitlementWorkspaceInvites, sharedpricing.EntitlementTeamRoles)
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
	if session.Team.PlanFamily != "pro" {
		t.Fatalf("expected plan family %q, got %q", "pro", session.Team.PlanFamily)
	}
	if session.Team.BillingState != "trial" {
		t.Fatalf("expected billing state %q, got %q", "trial", session.Team.BillingState)
	}
	assertTeamEntitlements(
		t,
		session.Team,
		sharedpricing.EntitlementWorkspaceInvites,
		sharedpricing.EntitlementTeamRoles,
		sharedpricing.EntitlementBoardMemberManagement,
	)
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

func TestCompleteOnboardingNormalizesExplicitBoardNames(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "chris@example.com", "Chris")

	session, invites, err := svc.CompleteOnboarding(ctx, "U_OWNER", "super cool", "", "Chris", nil, PlanPersonal)
	if err != nil {
		t.Fatalf("complete onboarding: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected no invites, got %d", len(invites))
	}
	if session.Team == nil {
		t.Fatal("expected workspace in session")
	}
	if session.Team.Name != "super-cool" {
		t.Fatalf("expected workspace name %q, got %q", "super-cool", session.Team.Name)
	}

	projects := listVisibleProjectsForUser(t, db, queries, session.User.ID, session.Team.ID, session.User.Email)
	assertProjectNames(t, projects, "super-cool", "inbox")
	assertProjectIDs(t, projects, "board", "inbox")
}

func TestCompleteOnboardingStripsUnsupportedCharactersFromExplicitBoardNames(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "chris@example.com", "Chris")

	session, invites, err := svc.CompleteOnboarding(ctx, "U_OWNER", " super cool!! 99 ", " Team #7!! squad ", "Chris", nil, PlanProTrial)
	if err != nil {
		t.Fatalf("complete onboarding: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected no invites, got %d", len(invites))
	}
	if session.Team == nil {
		t.Fatal("expected workspace in session")
	}
	if session.Team.Name != "Team-7-squad" {
		t.Fatalf("expected workspace name %q, got %q", "Team-7-squad", session.Team.Name)
	}

	projects := listVisibleProjectsForUser(t, db, queries, session.User.ID, session.Team.ID, session.User.Email)
	assertProjectNames(t, projects, "super-cool-99", "Team-7-squad", "inbox")
	assertProjectIDs(t, projects, "board", "board-team", "inbox")
	assertTeamBoardNames(t, projects, "Team-7-squad")
}

func TestCompleteOnboardingTreatsSanitizedEmptyBoardNameAsOptional(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "chris@example.com", "Chris")

	session, invites, err := svc.CompleteOnboarding(ctx, "U_OWNER", "!!!", "", "Chris", nil, PlanPersonal)
	if err != nil {
		t.Fatalf("complete onboarding: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected no invites, got %d", len(invites))
	}
	if session.Team == nil {
		t.Fatal("expected workspace in session")
	}
	if session.Team.Name != "Chris-board" {
		t.Fatalf("expected workspace name %q, got %q", "Chris-board", session.Team.Name)
	}

	projects := listVisibleProjectsForUser(t, db, queries, session.User.ID, session.Team.ID, session.User.Email)
	assertProjectNames(t, projects, "Chris-board", "inbox")
	assertProjectIDs(t, projects, "board", "inbox")
}

func TestCompleteOnboardingTreatsBlankTeamBoardNameAsOptional(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "chris@example.com", "Chris")

	session, invites, err := svc.CompleteOnboarding(ctx, "U_OWNER", "Gladiators", "", "Chris", nil, PlanProTrial)
	if err != nil {
		t.Fatalf("complete onboarding: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected no invites, got %d", len(invites))
	}
	if session.Team == nil {
		t.Fatal("expected workspace in session")
	}
	if session.Team.Name != "Chris-team-board" {
		t.Fatalf("expected workspace name %q, got %q", "Chris-team-board", session.Team.Name)
	}

	projects := listVisibleProjectsForUser(t, db, queries, session.User.ID, session.Team.ID, session.User.Email)
	assertProjectNames(t, projects, "Chris-team-board", "Gladiators", "inbox")
	assertProjectIDs(t, projects, "board", "board-team", "inbox")
	assertTeamBoardNames(t, projects, "Chris-team-board")
}

func TestProjectUpsertWithoutNamePreservesExistingBoardDisplayName(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "chris@example.com", "Chris")

	session, _, err := svc.CompleteOnboarding(ctx, "U_OWNER", "super-cool", "", "Chris", nil, PlanPersonal)
	if err != nil {
		t.Fatalf("complete onboarding: %v", err)
	}
	if session.Team == nil {
		t.Fatal("expected workspace in session")
	}

	projectSvc := project.NewService(project.NewRepository(db, queries))
	projectCtx := sessionctx.WithPrincipal(context.Background(), sessionctx.Principal{
		UserID:      session.User.ID,
		WorkspaceID: session.Team.ID,
		Email:       session.User.Email,
	})

	updated, err := projectSvc.Upsert(projectCtx, "board", project.UpsertInput{})
	if err != nil {
		t.Fatalf("upsert project: %v", err)
	}
	if updated.Name != "super-cool" {
		t.Fatalf("expected board display name %q, got %q", "super-cool", updated.Name)
	}

	projects := listVisibleProjectsForUser(t, db, queries, session.User.ID, session.Team.ID, session.User.Email)
	assertProjectNames(t, projects, "super-cool", "inbox")
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

func TestDowngradeToFreePreservesExistingMembersAndFreezesTeamAdmin(t *testing.T) {
	ctx := context.Background()
	svc, db, queries := newAccountTestService(t)

	seedAccountUser(t, ctx, svc, "U_OWNER", "captain@example.com", "Owner")
	seedAccountUser(t, ctx, svc, "U_MEMBER", "member@example.com", "Member")
	seedAccountUser(t, ctx, svc, "U_PENDING", "pending@example.com", "Pending")

	ownerSession, _, err := svc.CompleteOnboarding(ctx, "U_OWNER", "solo-board", "raid-team", "Owner", nil, PlanProTrial)
	if err != nil {
		t.Fatalf("complete owner onboarding: %v", err)
	}
	if ownerSession.Team == nil {
		t.Fatal("expected owner workspace in session")
	}

	acceptedInvite, err := svc.InviteMember(ctx, "U_OWNER", ownerSession.Team.ID, "member@example.com", TeamRoleEditor)
	if err != nil {
		t.Fatalf("invite accepted member: %v", err)
	}
	memberSession, err := svc.AcceptInvitation(ctx, "U_MEMBER", acceptedInvite.InvitationCode)
	if err != nil {
		t.Fatalf("accept invitation: %v", err)
	}
	if memberSession.Team == nil {
		t.Fatal("expected member workspace in session")
	}

	pendingInvite, err := svc.InviteMember(ctx, "U_OWNER", ownerSession.Team.ID, "pending@example.com", TeamRoleReader)
	if err != nil {
		t.Fatalf("invite pending member: %v", err)
	}

	if _, err := svc.ActivateProFromStripe(ctx, ownerSession.Team.ID, "cus_test", "sub_test", "price_test", "billing@example.com"); err != nil {
		t.Fatalf("activate pro: %v", err)
	}

	if err := svc.DowngradePersonalByStripeSubscription(ctx, "sub_test"); err != nil {
		t.Fatalf("downgrade subscription: %v", err)
	}

	workspace, err := svc.GetWorkspace(ctx, ownerSession.Team.ID)
	if err != nil {
		t.Fatalf("get workspace: %v", err)
	}
	if workspace.Plan != PlanPersonal {
		t.Fatalf("expected plan %q after downgrade, got %q", PlanPersonal, workspace.Plan)
	}
	if workspace.PlanFamily != "free" {
		t.Fatalf("expected plan family %q after downgrade, got %q", "free", workspace.PlanFamily)
	}
	if workspace.BillingState != "none" {
		t.Fatalf("expected billing state %q after downgrade, got %q", "none", workspace.BillingState)
	}

	memberProjects := listVisibleProjectsForUser(t, db, queries, memberSession.User.ID, ownerSession.Team.ID, memberSession.User.Email)
	assertProjectNames(t, memberProjects, "inbox", "raid-team")
	assertProjectIDs(t, memberProjects, "board-team", "inbox")

	if _, err := svc.AcceptInvitation(ctx, "U_PENDING", pendingInvite.InvitationCode); err == nil {
		t.Fatal("expected pending invite acceptance to fail after downgrade")
	}

	if _, err := svc.InviteMember(ctx, "U_OWNER", ownerSession.Team.ID, "newperson@example.com", TeamRoleEditor); err == nil || !strings.Contains(err.Error(), "unavailable on Free") {
		t.Fatalf("expected invite to be frozen after downgrade, got %v", err)
	}
	if _, err := svc.UpdateMemberRole(ctx, "U_OWNER", ownerSession.Team.ID, "U_MEMBER", TeamRoleReader); err == nil || !strings.Contains(err.Error(), "unavailable on Free") {
		t.Fatalf("expected role update to be frozen after downgrade, got %v", err)
	}
	if _, err := svc.UpdateTeamName(ctx, "U_OWNER", ownerSession.Team.ID, "frozen-name"); err == nil || !strings.Contains(err.Error(), "unavailable on Free") {
		t.Fatalf("expected team rename to be frozen after downgrade, got %v", err)
	}
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

func assertTeamEntitlements(t *testing.T, team *Team, want ...string) {
	t.Helper()

	if team == nil {
		t.Fatal("expected team")
	}
	for _, entitlement := range want {
		if !sharedpricing.HasEntitlement(team.Entitlements, entitlement) {
			t.Fatalf("expected entitlement %q in %v", entitlement, team.Entitlements)
		}
	}
}

func assertTeamLacksEntitlements(t *testing.T, team *Team, disallowed ...string) {
	t.Helper()

	if team == nil {
		t.Fatal("expected team")
	}
	for _, entitlement := range disallowed {
		if sharedpricing.HasEntitlement(team.Entitlements, entitlement) {
			t.Fatalf("did not expect entitlement %q in %v", entitlement, team.Entitlements)
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
