package account

import (
	"context"
	"strings"
	"testing"
)

func TestCollaborationRolesAndInvitationsContract(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	svc, _, _ := newAccountTestService(t)
	seedAccountUser(t, ctx, svc, "U_OWNER", "owner@example.com", "Owner")
	seedAccountUser(t, ctx, svc, "U_EDITOR", "editor@example.com", "Editor")
	seedAccountUser(t, ctx, svc, "U_READER", "reader@example.com", "Reader")
	seedAccountUser(t, ctx, svc, "U_PENDING", "pending@example.com", "Pending")

	ownerSession, _, err := svc.CompleteOnboarding(ctx, "U_OWNER", "private", "team", "Owner", nil, PlanProTrial)
	if err != nil {
		t.Fatalf("complete owner onboarding: %v", err)
	}
	workspaceID := ownerSession.Team.ID

	editorInvite, err := svc.InviteMember(ctx, "U_OWNER", workspaceID, "EDITOR@example.com", TeamRoleEditor)
	if err != nil {
		t.Fatalf("invite editor: %v", err)
	}
	if editorInvite.Email != "editor@example.com" || editorInvite.Role != TeamRoleEditor || editorInvite.Status != "pending" {
		t.Fatalf("unexpected editor invite: %+v", editorInvite)
	}
	duplicateInvite, err := svc.InviteMember(ctx, "U_OWNER", workspaceID, "editor@example.com", TeamRoleEditor)
	if err != nil {
		t.Fatalf("repeat editor invite: %v", err)
	}
	if duplicateInvite.InvitationCode != editorInvite.InvitationCode {
		t.Fatalf("repeat invite was not idempotent: first=%q second=%q", editorInvite.InvitationCode, duplicateInvite.InvitationCode)
	}
	if _, err := svc.AcceptInvitation(ctx, "U_EDITOR", editorInvite.InvitationCode); err != nil {
		t.Fatalf("accept editor invite: %v", err)
	}

	readerInvite, err := svc.InviteMember(ctx, "U_OWNER", workspaceID, "reader@example.com", TeamRoleReader)
	if err != nil {
		t.Fatalf("invite reader: %v", err)
	}
	if _, err := svc.AcceptInvitation(ctx, "U_READER", readerInvite.InvitationCode); err != nil {
		t.Fatalf("accept reader invite: %v", err)
	}

	assertWorkspaceWrite(t, svc, workspaceID, "U_OWNER", true)
	assertWorkspaceWrite(t, svc, workspaceID, "U_EDITOR", true)
	assertWorkspaceWrite(t, svc, workspaceID, "U_READER", false)
	assertWorkspaceWrite(t, svc, workspaceID, "not-a-member", false)

	if _, err := svc.InviteMember(ctx, "U_READER", workspaceID, "pending@example.com", TeamRoleEditor); err == nil || !strings.Contains(err.Error(), "owners or admins") {
		t.Fatalf("expected reader invite denial, got %v", err)
	}
	if _, err := svc.UpdateMemberRole(ctx, "U_EDITOR", workspaceID, "U_READER", TeamRoleEditor); err == nil || !strings.Contains(err.Error(), "only team owners") {
		t.Fatalf("expected editor role-change denial, got %v", err)
	}

	updated, err := svc.UpdateMemberRole(ctx, "U_OWNER", workspaceID, "U_EDITOR", TeamRoleReader)
	if err != nil {
		t.Fatalf("owner demote editor: %v", err)
	}
	if updated.Role != TeamRoleReader {
		t.Fatalf("unexpected updated role: %+v", updated)
	}
	assertWorkspaceWrite(t, svc, workspaceID, "U_EDITOR", false)

	updated, err = svc.UpdateMemberRole(ctx, "U_OWNER", workspaceID, "U_EDITOR", TeamRoleEditor)
	if err != nil {
		t.Fatalf("owner restore editor: %v", err)
	}
	if updated.Role != TeamRoleEditor {
		t.Fatalf("unexpected restored role: %+v", updated)
	}
	assertWorkspaceWrite(t, svc, workspaceID, "U_EDITOR", true)

	pendingInvite, err := svc.InviteMember(ctx, "U_OWNER", workspaceID, "pending@example.com", TeamRoleReader)
	if err != nil {
		t.Fatalf("create pending invite: %v", err)
	}
	if err := svc.CancelInvitation(ctx, "U_OWNER", workspaceID, pendingInvite.InvitationCode); err != nil {
		t.Fatalf("cancel pending invite: %v", err)
	}
	if _, err := svc.AcceptInvitation(ctx, "U_PENDING", pendingInvite.InvitationCode); err == nil {
		t.Fatal("expected cancelled invitation acceptance to fail")
	}

	if err := svc.RemoveMember(ctx, "U_OWNER", workspaceID, "U_EDITOR"); err != nil {
		t.Fatalf("remove editor: %v", err)
	}
	assertWorkspaceWrite(t, svc, workspaceID, "U_EDITOR", false)
}

func assertWorkspaceWrite(t *testing.T, svc *Service, workspaceID, userID string, want bool) {
	t.Helper()
	got, err := svc.CanWriteWorkspace(context.Background(), userID, workspaceID)
	if err != nil {
		t.Fatalf("CanWriteWorkspace(%s): %v", userID, err)
	}
	if got != want {
		t.Fatalf("CanWriteWorkspace(%s): got=%v want=%v", userID, got, want)
	}
}
